// Every read the hall makes from the chain. Nothing here is invented: each value
// comes from Chogstra, Chog Genesis or $CHOG via the RPC.

import { BaseError, ContractFunctionRevertedError, type Address, type PublicClient } from "viem";
import { chogstraAbi } from "./abi/chogstra";
import { ADDRESSES, DEPLOY_BLOCK, LOG_RANGE, erc20Abi, erc721Abi } from "./chain";
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

/** Block ranges from the deploy block to now, sized for the RPC's eth_getLogs limit. */
async function logRanges(client: PublicClient): Promise<[bigint, bigint][]> {
  // cacheTime 0: an event just told us a new block exists, so never reuse a cached height.
  const latest = await client.getBlockNumber({ cacheTime: 0 });
  const ranges: [bigint, bigint][] = [];
  for (let from = DEPLOY_BLOCK; from <= latest; from += LOG_RANGE) {
    const to = from + LOG_RANGE - BigInt(1);
    ranges.push([from, to < latest ? to : latest]);
  }
  return ranges;
}

/** tokenIds with a Performed event in this movement. */
export async function readPerformerIds(client: PublicClient, movement: number): Promise<number[]> {
  const ids = new Set<number>();
  for (const [fromBlock, toBlock] of await logRanges(client)) {
    const logs = await client.getContractEvents({
      address: chogstra(),
      abi: chogstraAbi,
      eventName: "Performed",
      args: { movement },
      fromBlock,
      toBlock,
    });
    for (const log of logs) if (log.args.tokenId !== undefined) ids.add(Number(log.args.tokenId));
  }
  return [...ids];
}

/** Spotlight Chogs drawn for a movement (Spotlighted events). */
export async function readSpotlightIds(client: PublicClient, movement: number): Promise<number[]> {
  if (movement < 0) return [];
  const ids = new Set<number>();
  for (const [fromBlock, toBlock] of await logRanges(client)) {
    const logs = await client.getContractEvents({
      address: chogstra(),
      abi: chogstraAbi,
      eventName: "Spotlighted",
      args: { movement },
      fromBlock,
      toBlock,
    });
    for (const log of logs) if (log.args.tokenId !== undefined) ids.add(Number(log.args.tokenId));
  }
  return [...ids];
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

export async function readEncorePot(client: PublicClient, movement: number): Promise<bigint> {
  return client.readContract({ address: chogstra(), abi: chogstraAbi, functionName: "encorePot", args: [BigInt(movement)] });
}

export async function readChogBalance(client: PublicClient, who: Address): Promise<bigint> {
  return client.readContract({ address: ADDRESSES.chogToken, abi: erc20Abi, functionName: "balanceOf", args: [who] });
}

export async function readChogAllowance(client: PublicClient, who: Address): Promise<bigint> {
  return client.readContract({ address: ADDRESSES.chogToken, abi: erc20Abi, functionName: "allowance", args: [who, chogstra()] });
}

const OWNER_SCAN_BATCH = 300;

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
