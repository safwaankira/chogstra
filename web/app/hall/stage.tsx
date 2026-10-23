"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
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

/** One stage gel per role; the colour a Chog throws when it plays. */
export const ROLE_META: Record<Role, { label: string; gel: string; text: string }> = {
  drums: { label: "Drums", gel: "var(--gel-drums)", text: "text-gel-drums" },
  bass: { label: "Bass", gel: "var(--gel-bass)", text: "text-gel-bass" },
  chords: { label: "Chords", gel: "var(--gel-chords)", text: "text-gel-chords" },
  melody: { label: "Melody", gel: "var(--gel-melody)", text: "text-gel-melody" },
};

// Kept for the composer's instrument card.
export const ROLE_COLOUR: Record<Role, string> = {
  drums: ROLE_META.drums.text,
  bass: ROLE_META.bass.text,
  chords: ROLE_META.chords.text,
  melody: ROLE_META.melody.text,
};

export type StageSeat = {
  chog: Chog;
  sound: ChogSound;
  tags: string[]; // "Spotlight", "Yours", "Preview · not onchain", "Part from an earlier movement"
  partThisMovement: boolean;
};

type Details = {
  owners?: Map<number, Address>;
  careers?: Map<number, Career>;
  applauded?: Set<number>;
};

// Back riser: the rhythm section. Front riser: harmony and melody.
const RISERS: Role[][] = [
  ["drums", "bass"],
  ["chords", "melody"],
];

/** Line drawings of each role's instrument, for empty seats and the empty stage. */
export const SILHOUETTES: Record<Role, ReactNode> = {
  drums: (
    <>
      <ellipse cx="40" cy="44" rx="22" ry="7" />
      <path d="M18 44v16c0 4 10 7 22 7s22-3 22-7V44" />
      <path d="M50 14l18-5M58 11v22" />
      <path d="M24 30l10 10M56 30l-10 10" />
    </>
  ),
  bass: (
    <>
      <path d="M46 8l6 4-14 34" />
      <path d="M38 46c-10-3-20 4-18 13 2 10 16 12 22 4 3-4 2-9-4-11" />
      <circle cx="33" cy="58" r="2.5" />
    </>
  ),
  chords: (
    <>
      <rect x="8" y="30" width="64" height="22" rx="3" />
      <path d="M16 30v14M24 30v14M32 30v14M40 30v14M48 30v14M56 30v14M64 30v14" />
      <path d="M20 52v14M60 52v14" />
    </>
  ),
  melody: (
    <>
      <rect x="31" y="8" width="18" height="28" rx="9" />
      <path d="M24 28c0 9 7 16 16 16s16-7 16-16M40 44v16M30 66h20" />
    </>
  ),
};

export function Silhouette({ role, className }: { role: Role; className?: string }) {
  return (
    <svg viewBox="0 0 80 76" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {SILHOUETTES[role]}
    </svg>
  );
}

/** Portrait size grows as the band shrinks, so three players read as a headline act, not a corner. */
function tileMax(count: number, front: boolean) {
  const [back, frontPx] = count <= 4 ? [190, 210] : count <= 8 ? [160, 180] : count <= 12 ? [130, 150] : [112, 132];
  // Also capped by height, so both risers and their captions stay on stage on short screens.
  const vh = count <= 4 ? 21 : count <= 8 ? 18 : 15;
  return `min(${front ? frontPx : back}px, ${vh}vh)`;
}

export function Stage({
  seats,
  details,
  movement,
  featured,
  empty,
  overlay,
}: {
  seats: StageSeat[];
  details: Details;
  movement: number;
  /** The connected holder's just-performed Chog (Result state). */
  featured?: number;
  empty: ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <div className="relative flex h-full min-h-[30rem] flex-col overflow-hidden rounded-[28px] bg-[#0d0919]">
      {/* Rig lights from above. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% -8%, color-mix(in oklab, var(--monad) 34%, transparent), transparent 70%)," +
            "radial-gradient(30% 35% at 18% -5%, color-mix(in oklab, var(--spill) 9%, transparent), transparent 70%)," +
            "radial-gradient(30% 35% at 82% -5%, color-mix(in oklab, var(--spill) 9%, transparent), transparent 70%)",
        }}
      />
      {/* The stage floor: lacquered black boards catching the rig light, with a front lip. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 60% at 50% 0%, color-mix(in oklab, var(--monad) 16%, transparent), transparent 75%)," +
              "repeating-linear-gradient(90deg, transparent 0 63px, rgba(255,255,255,0.035) 63px 64px)," +
              "linear-gradient(to bottom, #171028, #0a0712)",
            maskImage: "linear-gradient(to bottom, transparent, black 22%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[linear-gradient(to_bottom,#2a2045,#0b0814)]" />
      </div>

      {seats.length === 0 ? (
        <div className="relative flex flex-1 items-center justify-center p-6">{empty}</div>
      ) : (
        <div className="relative flex flex-1 flex-col justify-evenly gap-6 px-3 pb-6 pt-14 sm:px-6">
          {RISERS.map((roles, r) => (
            <div key={r} className={`grid gap-x-6 gap-y-5 sm:grid-cols-2 ${r === 0 ? "sm:px-[5%]" : ""}`}>
              {roles.map((role) => (
                <RoleZone
                  key={role}
                  role={role}
                  seats={seats.filter((s) => s.sound.role === role)}
                  maxTile={tileMax(seats.length, r === 1)}
                  featured={featured}
                  details={details}
                  movement={movement}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      {overlay}
    </div>
  );
}

function RoleZone({
  role,
  seats,
  maxTile,
  featured,
  details,
  movement,
}: {
  role: Role;
  seats: StageSeat[];
  maxTile: string;
  featured?: number;
  details: Details;
  movement: number;
}) {
  const meta = ROLE_META[role];
  return (
    <section aria-label={meta.label} className="relative z-10 min-w-0 has-[[aria-expanded=true]]:z-40">
      <h3 className="mb-3 flex items-center justify-center gap-2 font-display text-sm font-extrabold uppercase tracking-[0.18em] text-ink-2">
        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: meta.gel, boxShadow: `0 2px 10px ${meta.gel}` }} />
        {meta.label}
        {seats.length > 1 && <span className="tabular font-sans text-xs font-normal normal-case tracking-normal text-ink-3">{seats.length}</span>}
      </h3>
      {seats.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-2 text-ink-3/70">
          <Silhouette role={role} className="h-16 w-16" />
          <p className="text-xs text-ink-3">Open seat</p>
        </div>
      ) : (
        <ul className="flex items-start justify-center gap-2.5 sm:gap-4">
          {seats.map((seat) => (
            <StageTile
              key={seat.chog.tokenId}
              seat={seat}
              maxTile={maxTile}
              featured={featured === seat.chog.tokenId}
              owner={details.owners?.get(seat.chog.tokenId)}
              career={details.careers?.get(seat.chog.tokenId)}
              applauded={details.applauded?.has(seat.chog.tokenId) ?? false}
              movement={movement}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function StageTile({
  seat,
  maxTile,
  featured,
  owner,
  career,
  applauded,
  movement,
}: {
  seat: StageSeat;
  maxTile: string;
  featured: boolean;
  owner: Address | undefined;
  career: Career | undefined;
  applauded: boolean;
  movement: number;
}) {
  const { address } = useAccount();
  const [tipOpen, setTipOpen] = useState(false);
  const isOwner = !!address && !!owner && owner.toLowerCase() === address.toLowerCase();
  const id = seat.chog.tokenId;
  const meta = ROLE_META[seat.sound.role];
  const gel = meta.gel;
  const spotlight = seat.tags.includes("Spotlight");
  const mine = seat.tags.includes("Yours");
  const preview = seat.tags.some((t) => t.startsWith("Preview"));
  const earlier = seat.tags.some((t) => t.startsWith("Part from"));
  const canAct = !!address && !isOwner && !!owner;
  const beam = spotlight || featured;

  return (
    <li className="group @container relative min-w-0 flex-1 basis-0" style={{ "--gel": gel, maxWidth: maxTile } as CSSProperties}>
      {beam && (
        <div
          aria-hidden
          className="beam pointer-events-none absolute -top-[200px] left-1/2 h-[calc(200px+70%)] w-[150%] -translate-x-1/2"
          style={{
            background: featured
              ? "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--monad-hi) 34%, transparent))"
              : "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--spill) 26%, transparent))",
            clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)",
            filter: "blur(6px)",
          }}
        />
      )}

      <div className="relative">
        {/* Floor pool: the light the Chog throws on the stage when it plays. */}
        <div
          aria-hidden
          data-pool={id}
          className="pointer-events-none absolute -bottom-4 left-1/2 h-7 w-[130%] -translate-x-1/2 rounded-[50%] opacity-30"
          style={{ background: `radial-gradient(closest-side, ${gel}, transparent)` }}
        />
        <div
          aria-hidden
          data-glow={id}
          className="pointer-events-none absolute -inset-1 rounded-[20px] opacity-0"
          style={{ boxShadow: `0 0 0 2px ${gel}, 0 10px 30px 2px color-mix(in oklab, ${gel} 65%, transparent)` }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- IPFS portraits, no Next image config yet */}
        <img
          data-portrait={id}
          src={chogImageUrl(seat.chog)}
          alt={`${seat.chog.name}, ${meta.label.toLowerCase()}${spotlight ? ", Spotlight" : ""}${mine ? ", yours" : ""}`}
          width={240}
          height={240}
          loading="lazy"
          className={`relative aspect-square w-full rounded-[18px] bg-house-3 object-cover shadow-[0_14px_28px_-12px_rgba(0,0,0,0.9)] ${featured ? "ring-2 ring-monad-hi ring-offset-2 ring-offset-[#0d0919]" : ""} ${preview ? "outline-2 outline-dashed outline-offset-2 outline-ink-3" : ""} ${earlier && !preview ? "saturate-[0.7]" : ""}`}
        />
        {spotlight && (
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-spill px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-house shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
            Spotlight
          </span>
        )}
        {mine && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-monad-deep px-2 py-0.5 text-[11px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            Yours
          </span>
        )}
      </div>

      <div className="mt-3 min-w-0 text-center">
        <p className="truncate text-xs font-medium leading-tight text-ink" title={`${seat.chog.name} (tokenId ${id})`}>
          {seat.chog.name}
        </p>
        <p className="tabular truncate text-[11px] leading-tight text-ink-3">
          {preview ? "Preview, not onchain" : earlier ? "Earlier part" : career ? `${career.applause.toString()} applause` : " "}
          {!preview && career && career.streak > 1 ? ` · ${career.streak} streak` : ""}
        </p>
      </div>

      {canAct && (
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {seat.partThisMovement && <ApplaudButton tokenId={id} applauded={applauded} />}
          <button
            onClick={() => setTipOpen((o) => !o)}
            aria-expanded={tipOpen}
            aria-label={`Tip ${seat.chog.name} in $CHOG`}
            className="h-8 whitespace-nowrap rounded-full bg-house-3 px-3 text-xs font-medium text-ink-2 transition hover:bg-line hover:text-ink active:scale-95"
          >
            Tip<span className="hidden @[118px]:inline"> $CHOG</span>
          </button>
        </div>
      )}
      {canAct && tipOpen && <TipTray tokenId={id} name={seat.chog.name} movement={movement} onClose={() => setTipOpen(false)} />}
    </li>
  );
}

/** A short burst of sparks in the role's gel colour, shown on a confirmed applause or tip. */
function Sparks({ colour }: { colour: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const dist = 26 + (i % 3) * 8;
        return (
          <span
            key={i}
            className="spark absolute h-1.5 w-1.5 rounded-full"
            style={{ background: colour, "--dx": `${Math.cos(angle) * dist}px`, "--dy": `${Math.sin(angle) * dist}px` } as CSSProperties}
          />
        );
      })}
    </span>
  );
}

function ApplaudButton({ tokenId, applauded }: { tokenId: number; applauded: boolean }) {
  const tx = useTx();
  const justDone = tx.state.status === "confirmed";
  const done = applauded || justDone;
  return (
    <div className="relative">
      <button
        disabled={done || tx.busy}
        onClick={() => tx.send({ address: ADDRESSES.chogstra!, abi: chogstraAbi, functionName: "applaud", args: [BigInt(tokenId)] })}
        className={`h-8 rounded-full px-3 text-xs font-semibold transition active:scale-95 ${done ? "bg-transparent text-ink-3" : "bg-monad-deep text-white hover:bg-monad"} disabled:cursor-default ${tx.busy ? "animate-pulse" : ""}`}
      >
        {done ? "Applauded" : tx.busy ? "Clapping…" : "Applaud"}
      </button>
      {justDone && <Sparks colour="var(--gel)" />}
      {tx.state.status === "error" && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg bg-house-3 p-2 shadow-xl">
          <TxStatus state={tx.state} verb="applause" />
        </div>
      )}
    </div>
  );
}

function TipTray({ tokenId, name, movement, onClose }: { tokenId: number; name: string; movement: number; onClose: () => void }) {
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
    <div className="absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-2xl bg-house-3 p-3 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between">
        <p className="truncate font-display text-base font-extrabold uppercase tracking-wide text-ink">Tip {name}</p>
        <button onClick={onClose} aria-label="Close tip" className="rounded-full px-2 text-ink-3 hover:text-ink">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="flex flex-1 items-center rounded-full bg-house px-3 py-1.5 focus-within:ring-2 focus-within:ring-monad">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            aria-label="Tip amount in $CHOG"
            className="tabular w-full bg-transparent font-mono text-sm text-ink outline-none"
          />
          <span className="text-xs text-ink-3">$CHOG</span>
        </label>
        <div className="relative">
          <button
            onClick={tip}
            disabled={!enough || busy}
            className="h-9 rounded-full bg-monad-deep px-4 text-sm font-semibold text-white transition hover:bg-monad active:scale-95 disabled:opacity-40"
          >
            {busy ? "…" : "Tip"}
          </button>
          {tipTx.state.status === "confirmed" && <Sparks colour="var(--spill)" />}
        </div>
      </div>
      {valid && balance.data && !enough && <p className="mt-1 text-[11px] text-warn">Not enough $CHOG in this wallet.</p>}
      <p className="mt-1.5 text-[11px] leading-snug text-ink-3">90% goes to the owner, 10% to the Movement {movement} Encore Pot.</p>
      <div className="mt-1">
        <TxStatus state={approveTx.state} verb="the $CHOG approval" />
        <TxStatus state={tipTx.state} verb="the tip" />
        {tipTx.state.status === "confirmed" && valid && <p className="text-[11px] text-ok">Tipped {formatUnits(wei!, 18)} $CHOG.</p>}
      </div>
    </div>
  );
}
