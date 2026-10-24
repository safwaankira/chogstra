// Every read the hall makes from the chain. Nothing here is invented: each value
// comes from Chogstra, Chog Genesis or $CHOG via the RPC.

import { BaseError, ContractFunctionRevertedError, encodeAbiParameters, keccak256, type Address, type Hex, type PublicClient } from "viem";
import { chogstraAbi } from "./abi/chogstra";
import { ADDRESSES, erc20Abi, erc721Abi } from "./chain";
import { CHOG_COUNT } from "./chogs";
import { DEFAULT_SETTING, type Setting } from "./music";

export type OnchainPart = { tokenId: number; pattern: bigint; movement: number; updatedBlock: number };
export type Career = { performances: number; lastMovement: number; streak: number; spotlights: number; applause: bigint };

function chogstra(): Address {
  if (!ADDRESSES.chogstra) throw new Error("NEXT_PUBLIC_CHOGSTRA_ADDRESS is not set");
  return ADDRESSES.chogstra;
}

export async function readMovement(client: PublicClient): Promise<number> {
  return Number(await client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "currentMovement" }));
}

/** The movement's key/tempo/mood. Before its draw arrives, the contract's default with waiting = true. */
export async function readSetting(client: PublicClient, movement: number): Promise<{ setting: Setting; waiting: boolean }> {
  try {
    const [keyIndex, tempo, moodIndex] = await client.readContract({
      address: chogstra(),
      abi: chogstraAbi,
      functionName: "settingFor",
      args: [movement],
    });
    return { setting: { keyIndex, tempo, moodIndex }, waiting: false };
  } catch (err) {
    const revert = err instanceof BaseError ? err.walk((e) => e instanceof ContractFunctionRevertedError) : null;
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName === "SeedNotReady") {
      return { setting: DEFAULT_SETTING, waiting: true };
    }
    throw err;
  }
}

const ALL_IDS = Array.from({ length: CHOG_COUNT }, (_, i) => i + 1);
const STATE_BATCH = 500; // 1,969 Chogs in 4 multicalls

function batches<T>(items: T[], size = STATE_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// No log scans: public Monad RPCs cap eth_getLogs at 100 blocks (about 40 seconds),
// so everything below reads contract state through Multicall3 instead. That works on
// any chain with no indexer, at a few eth_calls per read.

/** parts[] for every Chog (1..1969). Chogs that never performed have updatedBlock 0 and are left out. */
export async function readAllParts(client: PublicClient): Promise<Map<number, OnchainPart>> {
  const all = new Map<number, OnchainPart>();
  for (const ids of batches(ALL_IDS)) for (const [id, p] of await readParts(client, ids)) all.set(id, p);
  return all;
}

/** tokenIds whose current part was written in this movement. */
export async function readPerformerIds(client: PublicClient, movement: number): Promise<number[]> {
  return [...(await readAllParts(client)).values()].filter((p) => p.movement === movement).map((p) => p.tokenId);
}

/** Every tokenId that has ever performed. */
export async function readAllPerformerIds(client: PublicClient): Promise<number[]> {
  return [...(await readAllParts(client)).keys()];
}

/** Every Chog `who` may perform (owned or lent): canPerform for all 1,969, with live expiry and owner checks onchain. */
export async function readLentToMe(client: PublicClient, who: Address): Promise<number[]> {
  const lent: number[] = [];
  for (const ids of batches(ALL_IDS)) {
    const can = await client.multicall({
      contracts: ids.map((id) => ({ address: chogstra(), abi: chogstraAbi, functionName: "canPerform", args: [who, BigInt(id)] }) as const),
      allowFailure: true,
    });
    // canPerform is also true for Chogs `who` owns; the hall removes those.
    ids.forEach((id, i) => {
      const r = can[i];
      if (r.status === "success" && r.result === true) lent.push(id);
    });
  }
  return lent;
}

export type Delegation = { to: Address; expiry: number; ownerAtGrant: Address };

export async function readDelegation(client: PublicClient, tokenId: number): Promise<Delegation> {
  const [to, expiry, ownerAtGrant] = await client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "delegations", args: [BigInt(tokenId)] });
  return { to, expiry: Number(expiry), ownerAtGrant };
}

const MAX_SPOTLIGHTS = 3;
const MAX_DRAWS = 2048;

/**
 * Spotlight Chogs drawn for a movement, recomputed from onchain state with the exact
 * algorithm in Chogstra.resolveSpotlight: draw i picks keccak256(abi.encode(seed, i)) % 1969 + 1
 * and keeps the first 3 distinct Chogs with performedIn[movement][tokenId]. Only once resolved.
 */
export async function readSpotlightIds(client: PublicClient, movement: number): Promise<number[]> {
  if (movement < 0) return [];
  const [, , resolved] = await client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "closings", args: [movement] });
  if (!resolved) return [];
  const seed = await client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "seeds", args: [movement] });
  return drawSpotlight(seed, await readPerformedIn(client, movement)).winners;
}

async function readPerformedIn(client: PublicClient, movement: number): Promise<Set<number>> {
  const performed = new Set<number>();
  for (const ids of batches(ALL_IDS)) {
    const res = await client.multicall({
      contracts: ids.map((id) => ({ address: chogstra(), abi: chogstraAbi, functionName: "performedIn", args: [movement, BigInt(id)] }) as const),
      allowFailure: false,
    });
    ids.forEach((id, i) => res[i] && performed.add(id));
  }
  return performed;
}

/** One draw that landed on a Chog that performed (misses are only counted). */
export type DrawHit = { draw: number; tokenId: number; kept: boolean };

/** resolveSpotlight's loop, step by step. */
export function drawSpotlight(seed: Hex, performed: Set<number>): { winners: number[]; hits: DrawHit[]; draws: number } {
  const winners: number[] = [];
  const hits: DrawHit[] = [];
  let i = 0;
  for (; i < MAX_DRAWS && winners.length < MAX_SPOTLIGHTS; i++) {
    const tokenId = Number(BigInt(keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [seed, BigInt(i)]))) % BigInt(CHOG_COUNT)) + 1;
    if (!performed.has(tokenId)) continue;
    const kept = !winners.includes(tokenId);
    if (kept) winners.push(tokenId);
    hits.push({ draw: i, tokenId, kept });
  }
  return { winners, hits, draws: i };
}

const MIN_TEMPO = 80;
const MAX_TEMPO = 110;
const MOOD_COUNT = 4;

/** settingFor(movement + 1)'s formula, from the seed of `movement`. */
export function settingFromSeed(seed: Hex): Setting {
  const r = BigInt(keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "string" }], [seed, "setting"])));
  return {
    keyIndex: Number(r % BigInt(12)),
    tempo: MIN_TEMPO + Number((r >> BigInt(64)) % BigInt(MAX_TEMPO - MIN_TEMPO + 1)),
    moodIndex: Number((r >> BigInt(128)) % BigInt(MOOD_COUNT)),
  };
}

export type DrawProof = {
  movement: number;
  closed: boolean;
  seeded: boolean;
  resolved: boolean;
  sequence: bigint;
  entropy: Address;
  seed: Hex | null;
  /** The next movement's setting as the contract reports it, and as recomputed here. */
  settingOnchain: Setting | null;
  settingHere: Setting | null;
  performers: number;
  draw: ReturnType<typeof drawSpotlight> | null;
};

/** Everything needed to check a movement's draw by hand, read from Chogstra. */
export async function readDrawProof(client: PublicClient, movement: number): Promise<DrawProof> {
  const [[closed, seeded, resolved, sequence], entropy] = await Promise.all([
    client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "closings", args: [movement] }),
    client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "entropy" }),
  ]);
  const base = { movement, closed, seeded, resolved, sequence, entropy };
  if (!seeded) return { ...base, seed: null, settingOnchain: null, settingHere: null, performers: 0, draw: null };
  const [seed, onchain, performed] = await Promise.all([
    client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "seeds", args: [movement] }),
    client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "settingFor", args: [movement + 1] }),
    readPerformedIn(client, movement),
  ]);
  return {
    ...base,
    seed,
    settingOnchain: { keyIndex: onchain[0], tempo: onchain[1], moodIndex: onchain[2] },
    settingHere: settingFromSeed(seed),
    performers: performed.size,
    draw: drawSpotlight(seed, performed),
  };
}

export async function readParts(client: PublicClient, ids: number[]): Promise<Map<number, OnchainPart>> {
  if (ids.length === 0) return new Map();
  const results = await client.multicall({
    contracts: ids.map((id) => ({ address: chogstra(), abi: chogstraAbi, functionName: "parts", args: [BigInt(id)] }) as const),
    allowFailure: false,
  });
  const parts = new Map<number, OnchainPart>();
  results.forEach(([pattern, movement, updatedBlock], i) => {
    if (updatedBlock !== 0) parts.set(ids[i], { tokenId: ids[i], pattern, movement, updatedBlock });
  });
  return parts;
}

export async function readCareers(client: PublicClient, ids: number[]): Promise<Map<number, Career>> {
  if (ids.length === 0) return new Map();
  const results = await client.multicall({
    contracts: ids.map((id) => ({ address: chogstra(), abi: chogstraAbi, functionName: "careers", args: [BigInt(id)] }) as const),
    allowFailure: false,
  });
  return new Map(
    results.map(([performances, lastMovement, streak, spotlights, applause], i) => [ids[i], { performances, lastMovement, streak, spotlights, applause }]),
  );
}

export async function readOwners(client: PublicClient, ids: number[]): Promise<Map<number, Address>> {
  if (ids.length === 0) return new Map();
  const results = await client.multicall({
    contracts: ids.map((id) => ({ address: ADDRESSES.chogNft, abi: erc721Abi, functionName: "ownerOf", args: [BigInt(id)] }) as const),
    allowFailure: true,
  });
  const owners = new Map<number, Address>();
  results.forEach((r, i) => r.status === "success" && owners.set(ids[i], r.result));
  return owners;
}

export async function readApplauded(client: PublicClient, movement: number, ids: number[], fan: Address): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const results = await client.multicall({
    contracts: ids.map(
      (id) => ({ address: chogstra(), abi: chogstraAbi, functionName: "hasApplauded", args: [BigInt(movement), BigInt(id), fan] }) as const,
    ),
    allowFailure: false,
  });
  return new Set(ids.filter((_, i) => results[i]));
}

/** The chain's own clock (the dev fork can run ahead of wall time) and Chogstra's start. */
export async function readClock(client: PublicClient): Promise<{ startTime: number; chainTime: number }> {
  const [startTime, block] = await Promise.all([
    client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "startTime" }),
    client.getBlock({ blockTag: "latest" }),
  ]);
  return { startTime: Number(startTime), chainTime: Number(block.timestamp) };
}

export async function readEncorePot(client: PublicClient, movement: number): Promise<bigint> {
  return client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "encorePot", args: [BigInt(movement)] });
}

export async function readChogBalance(client: PublicClient, who: Address): Promise<bigint> {
  return client.readContract({ address: ADDRESSES.chogToken, abi: erc20Abi, functionName: "balanceOf", args: [who] });
}

export async function readChogAllowance(client: PublicClient, who: Address): Promise<bigint> {
  return client.readContract({ address: ADDRESSES.chogToken, abi: erc20Abi, functionName: "allowance", args: [who, chogstra()] });
}

const OWNER_SCAN_BATCH = 500;

/**
 * Chog Genesis isn't enumerable, so ask ownerOf for every tokenId 1..1969
 * through Multicall3, OWNER_SCAN_BATCH at a time.
 */
export async function findOwnedChogs(client: PublicClient, owner: Address, onProgress?: (done: number) => void): Promise<number[]> {
  const owned: number[] = [];
  const target = owner.toLowerCase();
  for (let start = 1; start <= CHOG_COUNT; start += OWNER_SCAN_BATCH) {
    const ids = Array.from({ length: Math.min(OWNER_SCAN_BATCH, CHOG_COUNT - start + 1) }, (_, i) => start + i);
    const owners = await readOwners(client, ids);
    for (const id of ids) if (owners.get(id)?.toLowerCase() === target) owned.push(id);
    onProgress?.(ids[ids.length - 1]);
  }
  return owned;
}

export { chogstra as chogstraAddress };
