"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { chogstraAbi } from "@/lib/abi/chogstra";
import { ADDRESSES } from "@/lib/chain";
import { chogImageUrl, type Chog } from "@/lib/chogs";
import { FAMILY_TONE, ROLE_OCTAVE, chogSound, type ChogSound } from "@/lib/mapping";
import { DRUM_PIECES, STEPS, decodePattern, degreeToMidi, encodePattern, noteName, type Scale, type Step } from "@/lib/music";
import type { OnchainPart } from "@/lib/reads";
import { useTx } from "@/lib/useTx";
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
}) {
  const [selected, setSelected] = useState<number>(ownedIds[0]);
  const [steps, setSteps] = useState<Step[]>(() => initialSteps(existingParts.get(ownedIds[0])));
  const tx = useTx();

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
    if (receipt) onPerformed(selected, receipt.transactionHash);
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

      <InstrumentCard chog={chog} sound={sound} onchain={onchain} movement={movement} />

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="font-display text-base font-extrabold uppercase tracking-wide text-ink">Your part</p>
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
              onChange={(e) => onPreview(e.target.checked ? { tokenId: selected, pattern } : null)}
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
        {previewing && <p className="mt-1 text-[11px] text-ink-3">Only you hear the preview. Nothing is onchain until you perform.</p>}
      </div>

      <div className="space-y-1.5">
        {noteCount > 0 && (
          <p className="text-xs text-ink-2">
            <span className="font-medium text-ink">{chog.name}</span> · {ROLE_META[sound.role].label.toLowerCase()} ·{" "}
            <span className="tabular">{noteCount}</span> {noteCount === 1 ? "note" : "notes"} → Movement <span className="tabular">{movement}</span>
            {onchain && <span className="text-ink-3">. Replaces your part from Movement {onchain.movement}.</span>}
          </p>
        )}
        <button
          onClick={perform}
          disabled={tx.busy || noteCount === 0}
          className="w-full rounded-2xl bg-monad py-3 font-display text-xl font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_10px_30px_-10px_var(--monad)] transition hover:bg-monad-hi active:scale-[0.99] disabled:bg-house-3 disabled:text-ink-3 disabled:shadow-none"
        >
          {tx.busy ? "Performing…" : "Perform onchain"}
        </button>
        {noteCount === 0 && <p className="text-xs text-ink-3">Light up at least one step to perform. Performing writes this loop onchain for this Movement.</p>}
        <TxStatus state={tx.state} verb="your performance" />
      </div>
    </div>
  );
}

function InstrumentCard({ chog, sound, onchain, movement }: { chog: Chog; sound: ChogSound; onchain: OnchainPart | undefined; movement: number }) {
  const meta = ROLE_META[sound.role];
  return (
    <div className="flex gap-4">
      <div className="relative shrink-0">
        <div aria-hidden className="absolute -inset-3 rounded-[28px] opacity-50 blur-xl" style={{ background: `radial-gradient(closest-side, ${meta.gel}, transparent)` }} />
        {/* eslint-disable-next-line @next/next/no-img-element -- IPFS portraits */}
        <img
          src={chogImageUrl(chog)}
          alt={chog.name}
          width={128}
          height={128}
          className="relative h-32 w-32 rounded-2xl bg-house-3 object-cover shadow-[0_12px_30px_-10px_rgba(0,0,0,0.9)] xl:h-36 xl:w-36"
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
              <dt className="truncate text-ink-3" title={`${trait}: ${value}`}>
                {value}
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
      style={{ background: "linear-gradient(to bottom, color-mix(in oklab, var(--spill) 22%, transparent), color-mix(in oklab, var(--spill) 6%, transparent))" }}
    />
  );
}

function initialSteps(part: OnchainPart | undefined): Step[] {
  return part ? decodePattern(part.pattern) : emptySteps();
}
