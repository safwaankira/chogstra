"use client";

import { useState } from "react";
import { getAddress, isAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import type { PublicClient } from "viem";
import { chogstraAbi } from "@/lib/abi/chogstra";
import { ADDRESSES } from "@/lib/chain";
import { readClock } from "@/lib/reads";
import { useTx } from "@/lib/useTx";
import { TxStatus } from "./tx-status";
import { useDelegation } from "./useHall";

const DURATIONS = [
  { label: "1 day", seconds: 86_400 },
  { label: "7 days", seconds: 7 * 86_400 },
  { label: "30 days", seconds: 30 * 86_400 },
];
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Lend a Chog's play rights to a friend's wallet, or revoke it. Selling the Chog ends a loan onchain. */
export function DelegatePanel({ tokenId }: { tokenId: number }) {
  const { address } = useAccount();
  const client = usePublicClient() as PublicClient;
  const current = useDelegation(tokenId);
  const lendTx = useTx();
  const revokeTx = useTx();
  const [to, setTo] = useState("");
  const [duration, setDuration] = useState(DURATIONS[1].seconds);

  const d = current.data?.delegation;
  const now = current.data?.clock.chainTime ?? 0;
  const live = !!d && d.to !== "0x0000000000000000000000000000000000000000" && d.expiry > now && !!address && d.ownerAtGrant.toLowerCase() === address.toLowerCase();
  const validTo = isAddress(to) && to.toLowerCase() !== address?.toLowerCase();

  async function lend() {
    if (!validTo || !ADDRESSES.chogstra) return;
    const { chainTime } = await readClock(client);
    const ok = await lendTx.send({
      address: ADDRESSES.chogstra,
      abi: chogstraAbi,
      functionName: "delegate",
      args: [BigInt(tokenId), getAddress(to), BigInt(chainTime + duration)],
    });
    if (ok) {
      setTo("");
      current.refetch();
    }
  }

  async function revoke() {
    if (!ADDRESSES.chogstra) return;
    const ok = await revokeTx.send({ address: ADDRESSES.chogstra, abi: chogstraAbi, functionName: "revokeDelegation", args: [BigInt(tokenId)] });
    if (ok) current.refetch();
  }

  return (
    <details className="group border-t border-line pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-ink-2 hover:text-ink">
        <span>Lend play rights{live ? ` · lent to ${short(d!.to)}` : ""}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="transition-transform group-open:rotate-180">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="mt-2 space-y-2">
        {live ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
            <span>
              Lent to <span className="font-mono text-ink">{short(d!.to)}</span> until{" "}
              <span className="tabular">{new Date(d!.expiry * 1000).toLocaleString()}</span> (chain time). Selling the Chog ends it.
            </span>
            <button onClick={revoke} disabled={revokeTx.busy} className="h-8 rounded-full px-3 font-semibold text-bad ring-1 ring-inset ring-bad/40 hover:bg-bad/10 disabled:opacity-50">
              Revoke
            </button>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-ink-3">A friend&apos;s wallet can perform this Chog until the loan ends. You keep the Chog.</p>
            <div className="flex flex-wrap gap-2">
              <input
                value={to}
                onChange={(e) => setTo(e.target.value.trim())}
                placeholder="Friend's address 0x…"
                aria-label="Friend's wallet address"
                className="h-8 min-w-0 flex-1 rounded-full bg-house px-3 font-mono text-xs text-ink outline-none ring-1 ring-inset ring-line focus:ring-monad"
              />
              <span className="relative">
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  aria-label="Loan length"
                  className="h-8 appearance-none rounded-full bg-house pl-3 pr-8 text-xs text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-monad"
                >
                  {DURATIONS.map((o) => (
                    <option key={o.seconds} value={o.seconds}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </span>
              <button
                onClick={lend}
                disabled={!validTo || lendTx.busy}
                className="h-8 rounded-full bg-monad-deep px-4 text-xs font-semibold text-white hover:bg-monad-press disabled:opacity-40"
              >
                Lend
              </button>
            </div>
            {to && !validTo && <p className="text-[11px] text-warn">Enter a different wallet address (0x… 40 hex characters).</p>}
          </>
        )}
        <TxStatus state={lendTx.state} verb="the loan" />
        <TxStatus state={revokeTx.state} verb="the revoke" />
      </div>
    </details>
  );
}
