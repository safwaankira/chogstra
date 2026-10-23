"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  top,
  overlay,
}: {
  seats: StageSeat[];
  details: Details;
  movement: number;
  /** The connected holder's just-performed Chog (Result state). */
  featured?: number;
  empty: ReactNode;
  /** Banner and live feed: in flow on phones, floating over the stage's top edge on wider screens. */
  top?: ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <div data-stage className="relative flex h-full min-h-[30rem] flex-col overflow-hidden rounded-[28px] bg-[#0d0919]">
      {/* Rig lights from above: Monad purple wash with two warm spots. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% -8%, color-mix(in oklab, var(--monad) 34%, transparent), transparent 70%)," +
            "radial-gradient(26% 40% at 22% -6%, color-mix(in oklab, var(--spill) 16%, transparent), transparent 70%)," +
            "radial-gradient(26% 40% at 78% -6%, color-mix(in oklab, var(--spill) 16%, transparent), transparent 70%)",
        }}
      />
      {/* The stage floor: black lacquer with one long sheen where the rig light lands, and a front lip. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[36%]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 28% at 50% 18%, color-mix(in oklab, var(--spill) 7%, transparent), transparent 80%)," +
              "radial-gradient(80% 70% at 50% 0%, color-mix(in oklab, var(--monad) 18%, transparent), transparent 75%)," +
              "linear-gradient(to bottom, #181029, #0d0819 60%, #08060f)",
            maskImage: "linear-gradient(to bottom, transparent, black 18%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-2 bg-[linear-gradient(to_bottom,#2c2148,#0b0814)] shadow-[0_-1px_0_rgba(255,255,255,0.05)]" />
      </div>

      {top && <div className="relative z-20 px-3 pt-3 sm:absolute sm:inset-x-3 sm:top-3 sm:p-0">{top}</div>}
      {seats.length === 0 ? (
        <div className="relative flex flex-1 items-center justify-center p-6">{empty}</div>
      ) : (
        <div className="relative flex flex-1 flex-col justify-evenly gap-6 px-3 pb-6 pt-6 sm:px-6 sm:pt-14">
          {RISERS.map((roles, r) => {
            return (
              <div key={r} className={`relative grid gap-x-6 gap-y-5 sm:grid-cols-2 ${r === 0 ? "sm:px-[5%]" : ""}`}>
                {/* Riser plinth: the back row stands on a raised step. */}
                {r === 0 && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-[2%] -bottom-3 hidden h-[42%] rounded-t-[14px] sm:block"
                    style={{
                      background: "linear-gradient(to bottom, color-mix(in oklab, var(--house-3) 70%, transparent), transparent)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}
                  />
                )}
                {roles.map((role) => (
                  <RoleZone
                    key={role}
                    role={role}
                    seats={byRole(seats, role)}
                    maxTile={tileMax(seats.length, r === 1)}
                    featured={featured}
                    details={details}
                    movement={movement}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
      {overlay}
    </div>
  );
}

const TILE_GAP = 12;
const MIN_SLOTS = 3;

/** A role's seats in a stable order (Spotlight first, then tokenId), so rotation never reshuffles tiles under the cursor. */
function byRole(seats: StageSeat[], role: Role) {
  const spot = (s: StageSeat) => (s.tags.includes("Spotlight") ? 0 : 1);
  return seats.filter((s) => s.sound.role === role).sort((a, b) => spot(a) - spot(b) || a.chog.tokenId - b.chog.tokenId);
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
  // Every zone sizes tiles as if it held at least MIN_SLOTS players, so zones of 1-3 all match
  // (and match across the riser); only a busier zone shrinks its own tiles.
  const slots = Math.max(MIN_SLOTS, seats.length);
  const width = `calc((100% - ${(slots - 1) * TILE_GAP}px) / ${slots})`;
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
        <ul className="flex items-start justify-center" style={{ gap: TILE_GAP }}>
          {seats.map((seat) => (
            <StageTile
              key={seat.chog.tokenId}
              seat={seat}
              width={width}
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
  width,
  maxTile,
  featured,
  owner,
  career,
  applauded,
  movement,
}: {
  seat: StageSeat;
  width: string;
  maxTile: string;
  featured: boolean;
  owner: Address | undefined;
  career: Career | undefined;
  applauded: boolean;
  movement: number;
}) {
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"center" | "left" | "right">("center");
  const tileRef = useRef<HTMLLIElement>(null);

  function toggle() {
    // Keep the 16rem panel inside the stage: align it to whichever side has room.
    const tile = tileRef.current?.getBoundingClientRect();
    const stage = tileRef.current?.closest("[data-stage]")?.getBoundingClientRect();
    if (tile && stage) {
      const half = 128 + 8;
      const mid = tile.left + tile.width / 2;
      setAlign(mid - half < stage.left ? "left" : mid + half > stage.right ? "right" : "center");
    }
    setOpen((o) => !o);
  }
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
  // "CHOG #1464" -> "#1464"; a 1:1 like "CHOG #1159 — Halo" -> "Halo".
  const shortName = seat.chog.name.replace(/^CHOG #(\d+)(?: — (.+))?$/, (_m, n: string, title?: string) => title ?? `#${n}`);
  const alt = `${seat.chog.name}, ${meta.label.toLowerCase()}${spotlight ? ", Spotlight" : ""}${mine ? ", yours" : ""}`;

  // Close the actions panel on Escape or a click elsewhere.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => tileRef.current && !tileRef.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const portrait = (
    <>
      {/* Floor pool: the light the Chog throws on the stage; brightens on every note. */}
      <span
        aria-hidden
        data-pool={id}
        className="pointer-events-none absolute -bottom-5 left-1/2 block h-9 w-[135%] -translate-x-1/2 rounded-[50%] opacity-60"
        style={{ background: `radial-gradient(closest-side, ${gel}, transparent)` }}
      />
      <span
        aria-hidden
        data-glow={id}
        className="pointer-events-none absolute -inset-1 block rounded-[20px] opacity-0"
        style={{ boxShadow: `0 0 0 2px ${gel}, 0 10px 30px 2px color-mix(in oklab, ${gel} 65%, transparent)` }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- IPFS portraits, no Next image config yet */}
      <img
        data-portrait={id}
        src={chogImageUrl(seat.chog)}
        alt={alt}
        width={240}
        height={240}
        loading="lazy"
        className={`relative block aspect-square w-full rounded-[18px] bg-house-3 object-cover shadow-[0_14px_28px_-12px_rgba(0,0,0,0.9)] ${featured ? "ring-2 ring-monad-hi ring-offset-2 ring-offset-[#0d0919]" : ""} ${preview ? "outline-2 outline-dashed outline-offset-2 outline-ink-3" : ""} ${earlier && !preview ? "saturate-[0.7]" : ""}`}
      />
      {/* Reflection in the lacquered floor. */}
      <span aria-hidden className="pointer-events-none absolute left-0 top-full mt-1 block aspect-[2/1] w-full overflow-hidden rounded-[18px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- reflection of the same portrait */}
        <img
          src={chogImageUrl(seat.chog)}
          alt=""
          className="block aspect-square w-full -scale-y-100 object-cover opacity-[0.14]"
          style={{ maskImage: "linear-gradient(to top, black, transparent 55%)" }}
        />
      </span>
      {spotlight && (
        <span
          className="absolute -top-2.5 left-1/2 flex max-w-full -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-spill px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-house shadow-[0_3px_10px_rgba(0,0,0,0.5)] @[120px]:px-2.5"
          title="Spotlight"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0">
            <path d="M6 1l1.4 3.1 3.4.3-2.6 2.2.8 3.3L6 8.2 3 9.9l.8-3.3L1.2 4.4l3.4-.3z" fill="currentColor" />
          </svg>
          <span className="sr-only @[120px]:not-sr-only">Spotlight</span>
        </span>
      )}
      {mine && (
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-monad-deep px-2 py-0.5 text-[11px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
          Yours
        </span>
      )}
    </>
  );

  return (
    <li ref={tileRef} className="@container relative min-w-0 shrink-0" style={{ "--gel": gel, width, maxWidth: maxTile } as CSSProperties}>
      {beam && (
        <div
          aria-hidden
          className="beam pointer-events-none absolute -top-[200px] left-1/2 h-[calc(200px+70%)] w-[150%] -translate-x-1/2"
          style={{
            background: featured
              ? "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--monad-hi) 34%, transparent))"
              : "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--spill) 30%, transparent))",
            clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)",
            filter: "blur(6px)",
          }}
        />
      )}

      {canAct ? (
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-label={`${alt}. Applaud or tip`}
          className="relative block w-full rounded-[18px] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 motion-reduce:transform-none"
        >
          {portrait}
        </button>
      ) : (
        <div className="relative">{portrait}</div>
      )}

      <div className="relative mt-3 min-w-0 text-center">
        <p className="truncate text-xs font-medium leading-tight text-ink" title={`${seat.chog.name} (tokenId ${id})`}>
          {shortName}
        </p>
        <p
          className="tabular truncate text-[11px] leading-tight text-ink-3"
          title={career ? `${career.applause} applause, ${career.streak}-movement streak` : undefined}
        >
          {preview ? "Preview, not onchain" : earlier ? "Earlier part" : career ? `${career.applause.toString()} applause` : " "}
        </p>
      </div>

      {canAct && open && (
        <ActionsPanel
          tokenId={id}
          name={seat.chog.name}
          gel={gel}
          align={align}
          canApplaud={seat.partThisMovement}
          applauded={applauded}
          movement={movement}
          onClose={() => setOpen(false)}
        />
      )}
    </li>
  );
}

/** One anchored place for a Chog's audience actions: applause and a $CHOG tip. */
function ActionsPanel({
  tokenId,
  name,
  gel,
  align,
  canApplaud,
  applauded,
  movement,
  onClose,
}: {
  tokenId: number;
  name: string;
  gel: string;
  align: "center" | "left" | "right";
  canApplaud: boolean;
  applauded: boolean;
  movement: number;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={`Applaud or tip ${name}`}
      className={`absolute top-full z-40 mt-2 w-64 rounded-2xl bg-house-3 p-3 ${align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"}`}
      style={{ boxShadow: `0 18px 40px -10px rgba(0,0,0,0.9), inset 0 2px 0 ${gel}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-display text-base font-extrabold uppercase tracking-wide text-ink">{name}</p>
        <button onClick={onClose} aria-label="Close" className="h-8 w-8 shrink-0 rounded-full text-ink-3 hover:bg-line hover:text-ink">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="mx-auto">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {canApplaud ? (
        <div className="mt-2">
          <ApplaudButton tokenId={tokenId} applauded={applauded} />
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-ink-3">This part is from an earlier movement, so applause opens when it performs again.</p>
      )}
      <TipForm tokenId={tokenId} movement={movement} />
    </div>
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
        style={{ width: "100%" }}
        onClick={() => tx.send({ address: ADDRESSES.chogstra!, abi: chogstraAbi, functionName: "applaud", args: [BigInt(tokenId)] })}
        className={`h-8 rounded-full px-3 text-xs font-semibold transition active:scale-95 ${done ? "bg-transparent text-ink-3" : "bg-monad-deep text-white hover:bg-monad-press"} disabled:cursor-default ${tx.busy ? "animate-pulse motion-reduce:animate-none" : ""}`}
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
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-xs font-medium text-ink-2">Tip in $CHOG</p>
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
            className="h-9 rounded-full bg-monad-deep px-4 text-sm font-semibold text-white transition hover:bg-monad-press active:scale-95 disabled:opacity-40"
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
