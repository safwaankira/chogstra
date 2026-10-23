"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAbi, toHex, type PublicClient } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { chogstraAbi } from "@/lib/abi/chogstra";
import { ADDRESSES, IS_LOCAL, IS_TESTNET } from "@/lib/chain";
import { useTx } from "@/lib/useTx";
import { TxStatus } from "./tx-status";

// Pyth Entropy V2's fee read, and MockEntropyV2's reveal (local fork and testnet only).
const entropyAbi = parseAbi(["function getFeeV2() view returns (uint128)", "function mockReveal(uint64 sequence, bytes32 randomNumber)"]);
const MOCK_ENTROPY = IS_LOCAL || IS_TESTNET;

/**
 * Anyone can run the daily draw once a movement has ended: close it (pays the Entropy fee),
 * deliver the random seed (only the mock needs this; real Pyth calls back by itself), then
 * draw the Spotlight. Each step is one real transaction from the connected wallet.
 */
export function DrawControl({ movement }: { movement: number }) {
  const client = usePublicClient() as PublicClient;
  const qc = useQueryClient();
  const { address } = useAccount();
  const tx = useTx();

  const closing = useQuery({
    queryKey: ["closing", movement],
    enabled: !!ADDRESSES.chogstra,
    refetchInterval: (q) => (q.state.data?.resolved ? false : 5000),
    queryFn: async () => {
      const [closed, seeded, resolved, sequence] = await client.readContract({
        address: ADDRESSES.chogstra!,
        abi: chogstraAbi,
        functionName: "closings",
        args: [movement],
      });
      const entropy = await client.readContract({ address: ADDRESSES.chogstra!, abi: chogstraAbi, functionName: "entropy" });
      const fee = closed ? BigInt(0) : await client.readContract({ address: entropy, abi: entropyAbi, functionName: "getFeeV2" });
      return { closed, seeded, resolved, sequence, entropy, fee };
    },
  });

  const c = closing.data;
  if (!c || c.resolved) return null;

  const step = !c.closed ? "close" : !c.seeded ? (MOCK_ENTROPY ? "reveal" : "wait") : "spotlight";
  const label = { close: `Close Movement ${movement}`, reveal: "Reveal the draw", spotlight: "Draw the Spotlight", wait: "Waiting for Pyth Entropy…" }[step];

  async function run() {
    if (!c || !ADDRESSES.chogstra) return;
    const ok =
      step === "close"
        ? await tx.send({ address: ADDRESSES.chogstra, abi: chogstraAbi, functionName: "closeMovement", args: [movement], value: c.fee })
        : step === "reveal"
          ? await tx.send({
              address: c.entropy,
              abi: entropyAbi,
              functionName: "mockReveal",
              // Test randomness for the mock only; mainnet's seed comes from Pyth Entropy.
              args: [c.sequence, toHex(crypto.getRandomValues(new Uint8Array(32)))],
            })
          : step === "spotlight"
            ? await tx.send({ address: ADDRESSES.chogstra, abi: chogstraAbi, functionName: "resolveSpotlight", args: [movement] })
            : null;
    if (ok) {
      closing.refetch();
      qc.invalidateQueries({ queryKey: ["setting"] });
      qc.invalidateQueries({ queryKey: ["spotlights"] });
      qc.invalidateQueries({ queryKey: ["pot"] });
    }
  }

  return (
    <li className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={!address || step === "wait" || tx.busy}
        title={address ? `Anyone can run Movement ${movement}'s draw` : "Connect a wallet to run the draw"}
        className="h-7 rounded-full bg-monad-deep px-3 text-xs font-semibold text-white transition hover:bg-monad-press disabled:opacity-50"
      >
        {tx.busy ? "…" : label}
      </button>
      {tx.state.status === "error" || tx.state.status === "pending" ? <TxStatus state={tx.state} verb="the draw" /> : null}
    </li>
  );
}
