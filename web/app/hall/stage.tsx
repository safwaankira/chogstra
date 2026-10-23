"use client";

import { useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { useAccount } from "wagmi";
import { chogstraAbi } from "@/lib/abi/chogstra";
import { ADDRESSES, erc20Abi } from "@/lib/chain";
import { chogImageUrl, type Chog } from "@/lib/chogs";
import type { ChogSound, Role } from "@/lib/mapping";
import type { Career } from "@/lib/reads";
import { useTx } from "@/lib/useTx";
import { TxStatus } from "./tx-status";
import { useChogBalance } from "./useHall";

export const ROLE_COLOUR: Record<Role, string> = {
  drums: "text-amber-300",
  bass: "text-rose-300",
  chords: "text-sky-300",
  melody: "text-lime-300",
};

export type StageSeat = {
  chog: Chog;
  sound: ChogSound;
  tags: string[]; // "Spotlight", "You", "Preview", "Last movement's part"
  partThisMovement: boolean;
};

export function StageCard({
  seat,
  owner,
  career,
  applauded,
  movement,
}: {
  seat: StageSeat;
  owner: Address | undefined;
  career: Career | undefined;
  applauded: boolean;
  movement: number;
}) {
  const { address } = useAccount();
  const isOwner = !!address && !!owner && owner.toLowerCase() === address.toLowerCase();
  const id = seat.chog.tokenId;

  return (
    <li className="relative rounded-lg border border-neutral-800 bg-neutral-950 p-3">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- IPFS portraits, no Next image config yet */}
        <img
          data-portrait={id}
          src={chogImageUrl(seat.chog)}
          alt={seat.chog.name}
          width={64}
          height={64}
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded bg-neutral-900 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-neutral-500">
            #{id} · {seat.chog.name}
          </p>
          <p className={`font-mono text-sm uppercase tracking-wider ${ROLE_COLOUR[seat.sound.role]}`}>{seat.sound.role}</p>
          {seat.tags.length > 0 && (
            <p className="mt-0.5 flex flex-wrap gap-1">
              {seat.tags.map((t) => (
                <span key={t} className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] uppercase text-neutral-300">
                  {t}
                </span>
              ))}
            </p>
          )}
          {career && (
            <p className="mt-1 font-mono text-[11px] text-neutral-500">
              {career.applause.toString()} applause · streak {career.streak} · {career.spotlights} spotlights
            </p>
          )}
        </div>
      </div>
      {address && !isOwner && owner && (
        <div className="mt-3 space-y-2">
          {seat.partThisMovement && <ApplaudButton tokenId={id} applauded={applauded} />}
          <TipForm tokenId={id} movement={movement} />
        </div>
      )}
    </li>
  );
}

function ApplaudButton({ tokenId, applauded }: { tokenId: number; applauded: boolean }) {
  const tx = useTx();
  const done = applauded || tx.state.status === "confirmed";
  return (
    <div>
      <button
        disabled={done || tx.busy}
        onClick={() => tx.send({ address: ADDRESSES.chogstra!, abi: chogstraAbi, functionName: "applaud", args: [BigInt(tokenId)] })}
        className="rounded-full border border-neutral-600 px-3 py-1 font-mono text-xs hover:border-white disabled:opacity-40"
      >
        {done ? "Applauded this movement" : "Applaud"}
      </button>
      <TxStatus state={tx.state} verb="applause" />
    </div>
  );
}

function TipForm({ tokenId, movement }: { tokenId: number; movement: number }) {
  const { address } = useAccount();
  const balance = useChogBalance(address);
  const approveTx = useTx();
  const tipTx = useTx();
  const [amount, setAmount] = useState("10");

  let wei: bigint | null = null;
  try {
    wei = parseUnits(amount || "0", 18);
  } catch {
    wei = null;
  }
  const valid = wei !== null && wei > BigInt(0);
  const enough = valid && balance.data !== undefined && balance.data.balance >= wei!;
  const busy = approveTx.busy || tipTx.busy;

  async function tip() {
    if (!valid || !ADDRESSES.chogstra) return;
    const allowance = (await balance.refetch()).data?.allowance ?? BigInt(0);
    if (allowance < wei!) {
      const ok = await approveTx.send({ address: ADDRESSES.chogToken, abi: erc20Abi, functionName: "approve", args: [ADDRESSES.chogstra, wei!] });
      if (!ok) return;
    }
    await tipTx.send({ address: ADDRESSES.chogstra, abi: chogstraAbi, functionName: "tip", args: [BigInt(tokenId), wei!] });
    balance.refetch();
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          aria-label="Tip amount in $CHOG"
          className="w-20 rounded-full border border-neutral-700 bg-transparent px-3 py-1 font-mono text-xs outline-none focus:border-white"
        />
        <button
          onClick={tip}
          disabled={!enough || busy}
          className="rounded-full border border-neutral-600 px-3 py-1 font-mono text-xs hover:border-white disabled:opacity-40"
        >
          Tip $CHOG
        </button>
        {valid && balance.data && !enough && <span className="font-mono text-[11px] text-neutral-500">Not enough $CHOG</span>}
      </div>
      <p className="mt-1 font-mono text-[10px] text-neutral-600">90% to the owner, 10% to movement {movement}&apos;s Encore Pot</p>
      <TxStatus state={approveTx.state} verb="the $CHOG approval" />
      <TxStatus state={tipTx.state} verb="the tip" />
      {tipTx.state.status === "confirmed" && valid && (
        <p className="font-mono text-[11px] text-lime-300">Tipped {formatUnits(wei!, 18)} $CHOG</p>
      )}
    </div>
  );
}
