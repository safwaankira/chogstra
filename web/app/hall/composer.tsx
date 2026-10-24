"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import type { PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { chogstraAbi } from "@/lib/abi/chogstra";
import { ADDRESSES } from "@/lib/chain";
import { chogImageUrl, type Chog } from "@/lib/chogs";
import { FAMILY_TONE, ROLE_OCTAVE, chogSound, type ChogSound } from "@/lib/mapping";
import { DRUM_PIECES, STEPS, decodePattern, degreeToMidi, encodePattern, noteName, type Scale, type Step } from "@/lib/music";
import { readCareers, type Career, type OnchainPart } from "@/lib/reads";
import { useTx } from "@/lib/useTx";
import { DelegatePanel } from "./delegate";
import { ROLE_META } from "./stage";
import { TxStatus } from "./tx-status";

const DEGREES = [7, 6, 5, 4, 3, 2, 1, 0]; // top row = highest
const emptySteps = (): Step[] => Array.from({ length: STEPS }, () => ({ on: false, degree: 0 }));

export type Draft = { tokenId: number; pattern: bigint };
/** When the current bar started (performance.now()) and how long one step lasts. Written by the hall. */
export type BarClock = { startedAt: number; stepMs: number } | null;

export function Composer({
  chogs,
  ownedIds,
  scale,
  movement,
  existingParts,
  previewing,
  onPreview,
  onPerformed,
  barClock,
  lentIds = [],
  audioOn = true,
  onNeedAudio,
  guest = false,
  onAnotherGuest,
}: {
  chogs: Map<number, Chog>;
  ownedIds: number[];
  scale: Scale;
  movement: number;
  existingParts: Map<number, OnchainPart>;
  previewing: boolean;
  onPreview: (draft: Draft | null) => void;
  onPerformed: (tokenId: number, hash: string) => void;
  barClock: RefObject<BarClock>;
  /** Whether the hall's sound is on; previewing turns it on if not. */
  audioOn?: boolean;
  onNeedAudio?: () => void;
  /** Chogs lent to this wallet (perform allowed, lending not). */
  lentIds?: number[];
  /** Guest Chog: preview only; Perform stays disabled. */
  guest?: boolean;
  onAnotherGuest?: () => void;
}) {
  const [selected, setSelected] = useState<number>(ownedIds[0]);
  const [steps, setSteps] = useState<Step[]>(() => initialSteps(existingParts.get(ownedIds[0])));
  const tx = useTx();
  const client = usePublicClient() as PublicClient;
  const qc = useQueryClient();
  const career = useQuery({
    queryKey: ["career", selected],
    queryFn: async () => (await readCareers(client, [selected])).get(selected)!,
    enabled: !guest && !!ADDRESSES.chogstra,
  });

  const chog = chogs.get(selected)!;
  const sound = chogSound(selected, chog.traits);
  const pattern = encodePattern(steps);
  const noteCount = steps.filter((s) => s.on).length;
  const gel = ROLE_META[sound.role].gel;

  // Keep the preview in the song in sync with the grid.
  useEffect(() => {
    if (previewing) onPreview({ tokenId: selected, pattern });
  }, [previewing, selected, pattern, onPreview]);

  function pick(id: number) {
    setSelected(id);
    setSteps(initialSteps(existingParts.get(id)));
    tx.reset();
  }

  function toggle(step: number, degree: number) {
    setSteps((s) => s.map((x, i) => (i !== step ? x : x.on && x.degree === degree ? { on: false, degree: 0 } : { on: true, degree })));
  }

  async function perform() {
    if (!ADDRESSES.chogstra) return;
    const receipt = await tx.send({
      address: ADDRESSES.chogstra,
      abi: chogstraAbi,
      functionName: "perform",
      args: [BigInt(selected), pattern],
    });
    if (receipt) {
      qc.invalidateQueries({ queryKey: ["career", selected] });
      onPerformed(selected, receipt.transactionHash);
    }
  }

  const rowLabel = (degree: number) =>
    sound.role === "drums" ? DRUM_PIECES[degree] : noteName(degreeToMidi(scale, degree, ROLE_OCTAVE[sound.role][sound.range]));
  const onchain = existingParts.get(selected);

  return (
    <div className="flex flex-col gap-3" style={{ "--gel": gel } as CSSProperties}>
      {ownedIds.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Your Chogs"
          className="flex flex-wrap gap-1.5"
          onKeyDown={(e) => {
            const i = ownedIds.indexOf(selected);
            const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : null;
            if (next === null) return;
            e.preventDefault();
            const id = ownedIds[(next + ownedIds.length) % ownedIds.length];
            pick(id);
            (e.currentTarget.querySelector(`[data-chog="${id}"]`) as HTMLElement | null)?.focus();
          }}
        >
          {ownedIds.map((id) => {
            const c = chogs.get(id)!;
            const on = id === selected;
            return (
              <button
                key={id}
                data-chog={id}
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => pick(id)}
                className={`flex h-8 items-center gap-1.5 rounded-full pl-1 pr-3 text-xs transition ${on ? "bg-monad-deep text-white" : "bg-house-3 text-ink-2 hover:bg-line"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- IPFS portraits */}
                <img src={chogImageUrl(c)} alt="" width={24} height={24} className="h-6 w-6 rounded-full bg-house object-cover" />
                <span className="max-w-[9rem] truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {guest && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-warn/10 px-3 py-2 text-xs text-warn">
          <span>
            <span className="font-semibold">Guest Chog.</span> Real traits, played only in your browser. Never onchain.
          </span>
          {onAnotherGuest && (
            <button onClick={onAnotherGuest} className="h-8 rounded-full px-3 font-semibold ring-1 ring-inset ring-warn/40 hover:bg-warn/10">
              Another Guest Chog
            </button>
          )}
        </div>
      )}
      {lentIds.includes(selected) && (
        <p className="rounded-2xl bg-monad-deep/25 px-3 py-2 text-xs text-ink-2">
          <span className="font-semibold text-ink">Lent to you.</span> Its owner gave this wallet play rights. Performing writes this Chog&apos;s part.
        </p>
      )}
      <InstrumentCard chog={chog} sound={sound} onchain={guest ? undefined : onchain} movement={movement} />

      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-t border-line pt-3">
          <p className="whitespace-nowrap font-display text-base font-extrabold uppercase tracking-wide text-ink">Your part</p>
          <p className="text-[11px] text-ink-3">
            16 steps, one note each, locked to <span className="text-ink-2">{scale.name}</span>
          </p>
        </div>
        <Sequencer steps={steps} rowLabel={rowLabel} onToggle={toggle} barClock={barClock} />
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-2">
            <input
              type="checkbox"
              checked={previewing}
              onChange={(e) => {
                if (e.target.checked && !audioOn) onNeedAudio?.();
                onPreview(e.target.checked ? { tokenId: selected, pattern } : null);
              }}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative h-5 w-9 shrink-0 rounded-full bg-line transition peer-checked:bg-monad peer-focus-visible:ring-2 peer-focus-visible:ring-monad-hi after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-ink after:transition peer-checked:after:translate-x-4"
            />
            Hear it in the song
          </label>
          <div className="ml-auto flex gap-1.5">
            {onchain && (
              <button
                onClick={() => setSteps(decodePattern(onchain.pattern))}
                className="h-8 rounded-full bg-house-3 px-3 text-xs text-ink-2 hover:bg-line hover:text-ink"
              >
                Load onchain part
              </button>
            )}
            <button onClick={() => setSteps(emptySteps())} className="h-8 rounded-full px-3 text-xs text-ink-3 hover:bg-house-3 hover:text-bad">
              Clear
            </button>
          </div>
        </div>
        {previewing && (
          <p className="mt-1 text-[11px] text-ink-2">
            {onchain && onchain.pattern === pattern
              ? "This matches your onchain part, so the song sounds the same. Change a step to hear the difference."
              : `${chog.name} is playing this draft on the Stage now (dashed outline). Only you hear it; nothing is onchain until you perform.`}
          </p>
        )}
      </div>

      <div className="space-y-1.5 border-t border-line pt-3">
        {noteCount > 0 && !guest && (
          <p className="text-xs text-ink-2">
            <span className="font-medium text-ink">{chog.name}</span> · {ROLE_META[sound.role].label.toLowerCase()} ·{" "}
            <span className="tabular">{noteCount}</span> {noteCount === 1 ? "note" : "notes"} → Movement <span className="tabular">{movement}</span>
            {onchain && <span className="text-ink-3">. Replaces your part from Movement {onchain.movement}.</span>}
          </p>
        )}
        <button
          onClick={perform}
          disabled={guest || tx.busy || noteCount === 0}
          className="w-full rounded-2xl bg-monad py-3 font-display text-xl font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_10px_30px_-10px_var(--monad)] transition hover:bg-monad-deep active:scale-[0.99] disabled:bg-house-3 disabled:text-ink-3 disabled:shadow-none"
        >
          {guest ? "You need a Chog to play" : tx.busy ? "Performing…" : "Perform onchain"}
        </button>
        {guest && <p className="text-xs text-ink-3">Turn on Hear it in the song to play your loop with the live band. Holders perform onchain.</p>}
        {noteCount === 0 && !guest && <p className="text-xs text-ink-3">Light up at least one step to perform. Performing writes this loop onchain for this Movement.</p>}
        {!guest && career.data && <StreakLine career={career.data} movement={movement} />}
        <TxStatus state={tx.state} verb="your performance" />
      </div>
      {!guest && !lentIds.includes(selected) && <DelegatePanel key={selected} tokenId={selected} />}
    </div>
  );
}

/** Where this Chog's streak stands this Movement, straight from careers(tokenId). */
function StreakLine({ career, movement }: { career: Career; movement: number }) {
  const { performances, lastMovement, streak } = career;
  const n = (k: number) => <span className="tabular font-semibold text-ink">{k}</span>;
  let line;
  if (performances === 0) line = <>No performances yet. Your first one starts a streak.</>;
  else if (lastMovement === movement) line = <>Played this Movement. Streak: {n(streak)} {streak === 1 ? "movement" : "movements"} in a row.</>;
  else if (lastMovement + 1 === movement)
    line = (
      <>
        {n(streak)}-movement streak. Perform before this Movement ends to make it {n(streak + 1)}.
      </>
    );
  else line = <>Streak ended after Movement {lastMovement}. Perform to start a new one.</>;
  const live = performances > 0 && lastMovement + 1 === movement;
  return (
    <p className={`flex items-center gap-2 text-xs ${live ? "text-warn" : "text-ink-2"}`}>
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? "bg-warn" : lastMovement === movement && performances > 0 ? "bg-ok" : "bg-ink-3"}`} />
      <span>{line}</span>
    </p>
  );
}

function InstrumentCard({ chog, sound, onchain, movement }: { chog: Chog; sound: ChogSound; onchain: OnchainPart | undefined; movement: number }) {
  const meta = ROLE_META[sound.role];
  return (
    <div className="flex gap-3">
      {/* Channel meter: jumps on every note this Chog plays in the song. */}
      <div aria-hidden className="relative w-2 shrink-0 overflow-hidden rounded-full bg-house">
        <span
          data-meter={chog.tokenId}
          className="absolute inset-0 block origin-bottom rounded-full"
          style={{ transform: "scaleY(0.18)", background: `linear-gradient(to top, ${meta.gel}, color-mix(in oklab, ${meta.gel} 40%, white))` }}
        />
      </div>
      <div className="relative shrink-0">
        <div aria-hidden className="absolute -inset-3 rounded-[28px] opacity-50 blur-xl" style={{ background: `radial-gradient(closest-side, ${meta.gel}, transparent)` }} />
        {/* eslint-disable-next-line @next/next/no-img-element -- IPFS portraits */}
        <img
          src={chogImageUrl(chog)}
          alt={chog.name}
          width={128}
          height={128}
          className="relative h-24 w-24 rounded-2xl bg-house-3 object-cover shadow-[0_12px_30px_-10px_rgba(0,0,0,0.9)] sm:h-32 sm:w-32 xl:h-36 xl:w-36"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-ink-3">
          {chog.name} <span className="tabular text-ink-3">· tokenId {chog.tokenId}</span>
        </p>
        <p className={`font-display text-3xl font-black uppercase leading-none tracking-wide ${meta.text}`}>{meta.label}</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] leading-snug">
          {translation(chog, sound).map(([trait, value, result]) => (
            <div key={trait} className="contents">
              <dt className="flex min-w-0 items-center gap-1.5 text-ink-3" title={`${trait}: ${value}`}>
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.gel, boxShadow: `0 1px 4px ${meta.gel}` }} />
                <span className="truncate">{value}</span>
              </dt>
              <dd className="truncate text-ink-2">
                <span aria-hidden className="text-ink-3">
                  →{" "}
                </span>
                {result}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-[11px] text-ink-3">
          {onchain ? `Onchain part from Movement ${onchain.movement}${onchain.movement === movement ? " (this one)" : ""}` : "No onchain part yet"}
        </p>
      </div>
    </div>
  );
}

/** Each trait the mapping read, and what it turned into. Straight from lib/mapping.ts's result. */
function translation(chog: Chog, s: ChogSound): [string, string, string][] {
  const t = chog.traits;
  if (s.signature) {
    return [
      ["Base", "1:1 Legendary", `signature "${s.signature}"`],
      ["Sound", "hand-designed", `${s.range} ${s.role}, ${FAMILY_TONE[s.family].label}`],
      ["Effect", "hand-designed", `${s.effect}, ${s.room} room`],
    ];
  }
  const rows: [string, string, string][] = [
    ["Skin", t.Skin ?? "none", s.role],
    ["Eyes", t.Eyes ?? "none", `${s.range} range`],
    ["Mouth", t.Mouth ?? "none", `${s.shape} notes`],
    ["Body", t.Body ?? "no body", s.family === "bare" ? "plain tone" : FAMILY_TONE[s.family].label],
    ["Head", t.Head ?? "no head", `${s.brightness} filter`],
    ["Aura", t.Aura ?? "no aura", s.effect === "dry" ? "dry" : s.effect],
    ["Background", t.Background ?? "none", `${s.room} room`],
  ];
  if (s.flavour !== "none") rows.push(["Base", t.Base, s.flavour]);
  if (s.sparkle !== "none") rows.push(["Accessory", t.Accessory, `${s.sparkle} sparkle`]);
  if (s.layer !== "none") rows.push(["Tier", t.Tier, `${s.layer} layer`]);
  return rows;
}

function Sequencer({
  steps,
  rowLabel,
  onToggle,
  barClock,
}: {
  steps: Step[];
  rowLabel: (degree: number) => string;
  onToggle: (step: number, degree: number) => void;
  barClock: RefObject<BarClock>;
}) {
  // One tab stop for the whole grid; arrow keys move between cells.
  const [focus, setFocus] = useState({ step: 0, row: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent) {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    const next = { step: (focus.step + m[0] + STEPS) % STEPS, row: Math.min(DEGREES.length - 1, Math.max(0, focus.row + m[1])) };
    setFocus(next);
    (gridRef.current?.querySelector(`[data-cell="${next.step}-${next.row}"]`) as HTMLElement | null)?.focus();
  }

  const labels = (half: string) =>
    DEGREES.map((d) => (
      <span key={`${half}-${d}`} className="tabular flex items-center justify-end font-mono text-[11px] leading-none text-ink-3">
        {rowLabel(d)}
      </span>
    ));

  return (
    <div className="flex gap-1.5">
      {/* Phones show the loop as two rows of 8 steps, so labels repeat for the second half. */}
      <div aria-hidden className="grid grid-rows-[repeat(17,minmax(0,1fr))] gap-[3px] pr-0.5 text-right sm:grid-rows-8">
        {labels("a")}
        <span className="sm:hidden" />
        <span className="contents sm:hidden">{labels("b")}</span>
      </div>
      <div className="relative min-w-0 flex-1">
        <Playhead barClock={barClock} />
        <div
          ref={gridRef}
          role="grid"
          aria-label="16-step loop"
          onKeyDown={onKeyDown}
          className="relative grid grid-cols-8 grid-rows-[repeat(17,minmax(0,1fr))] gap-[3px] sm:grid-cols-16 sm:grid-rows-8"
        >
          {DEGREES.map((degree, row) =>
            steps.map((s, i) => {
              const on = s.on && s.degree === degree;
              const second = i >= 8;
              return (
                <button
                  key={`${degree}-${i}`}
                  data-cell={`${i}-${row}`}
                  tabIndex={focus.step === i && focus.row === row ? 0 : -1}
                  onFocus={() => setFocus({ step: i, row })}
                  aria-label={`Step ${i + 1}, ${rowLabel(degree)}`}
                  aria-pressed={on}
                  onClick={() => onToggle(i, degree)}
                  style={
                    {
                      "--c": (i % 8) + 1,
                      "--r": row + 1 + (second ? DEGREES.length + 1 : 0),
                      "--C": i + 1,
                      "--R": row + 1,
                    } as CSSProperties
                  }
                  className={`[grid-column:var(--c)] [grid-row:var(--r)] sm:[grid-column:var(--C)] sm:[grid-row:var(--R)] aspect-square min-h-0 rounded-[5px] transition-[background-color,box-shadow] duration-150 ${
                    on ? "bg-[var(--gel)] shadow-[0_2px_12px_var(--gel)]" : i % 4 === 0 ? "bg-line/80 hover:bg-ink-3/50" : "bg-house-3 hover:bg-ink-3/40"
                  }`}
                />
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

/** A column of light sweeping across the grid in time with the song. Hidden until audio runs. */
function Playhead({ barClock }: { barClock: RefObject<BarClock> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 640px)");
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      const clock = barClock.current;
      if (el) {
        if (!clock) el.style.opacity = "0";
        else {
          const step = Math.max(0, Math.floor((performance.now() - clock.startedAt) / clock.stepMs) % STEPS);
          el.style.opacity = "1";
          // Wide: one row of 16 columns. Phones: two blocks of 8 (rows 1-8, spacer, rows 10-17).
          el.style.width = wide.matches ? "calc(100% / 16)" : "calc(100% / 8)";
          el.style.height = wide.matches ? "calc(100% + 8px)" : "calc(8 / 17 * 100% + 8px)";
          el.style.top = !wide.matches && step >= 8 ? "calc(9 / 17 * 100%)" : "0";
          el.style.transform = `translate(${(wide.matches ? step : step % 8) * 100}%, -4px)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [barClock]);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-10 rounded-md opacity-0"
      style={{
        background: "linear-gradient(to bottom, color-mix(in oklab, var(--gel) 38%, transparent), color-mix(in oklab, var(--gel) 12%, transparent))",
        boxShadow: "0 6px 18px -4px color-mix(in oklab, var(--gel) 55%, transparent)",
      }}
    />
  );
}

function initialSteps(part: OnchainPart | undefined): Step[] {
  return part ? decodePattern(part.pattern) : emptySteps();
}
