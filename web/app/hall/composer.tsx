"use client";

import { useEffect, useState } from "react";
import { chogstraAbi } from "@/lib/abi/chogstra";
import { ADDRESSES } from "@/lib/chain";
import { chogImageUrl, type Chog } from "@/lib/chogs";
import { ROLE_OCTAVE, chogSound } from "@/lib/mapping";
import { DRUM_PIECES, STEPS, decodePattern, degreeToMidi, encodePattern, noteName, type Scale, type Step } from "@/lib/music";
import type { OnchainPart } from "@/lib/reads";
import { useTx } from "@/lib/useTx";
import { ROLE_COLOUR } from "./stage";
import { TxStatus } from "./tx-status";

const DEGREES = [7, 6, 5, 4, 3, 2, 1, 0]; // top row = highest
const emptySteps = (): Step[] => Array.from({ length: STEPS }, () => ({ on: false, degree: 0 }));

export type Draft = { tokenId: number; pattern: bigint };

export function Composer({
  chogs,
  ownedIds,
  scale,
  movement,
  existingParts,
  previewing,
  onPreview,
  onPerformed,
}: {
  chogs: Map<number, Chog>;
  ownedIds: number[];
  scale: Scale;
  movement: number;
  existingParts: Map<number, OnchainPart>;
  previewing: boolean;
  onPreview: (draft: Draft | null) => void;
  onPerformed: (tokenId: number, hash: string) => void;
}) {
  const [selected, setSelected] = useState<number>(ownedIds[0]);
  const [steps, setSteps] = useState<Step[]>(() => initialSteps(existingParts.get(ownedIds[0])));
  const tx = useTx();

  const chog = chogs.get(selected)!;
  const sound = chogSound(selected, chog.traits);
  const pattern = encodePattern(steps);
  const noteCount = steps.filter((s) => s.on).length;

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
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ownedIds.map((id) => {
          const c = chogs.get(id)!;
          return (
            <button
              key={id}
              onClick={() => pick(id)}
              className={`flex items-center gap-2 rounded-lg border p-1.5 pr-3 ${id === selected ? "border-white" : "border-neutral-800 hover:border-neutral-500"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- IPFS portraits */}
              <img src={chogImageUrl(c)} alt="" width={36} height={36} className="h-9 w-9 rounded bg-neutral-900 object-cover" />
              <span className="font-mono text-xs">#{id}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 rounded-lg border border-neutral-800 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- IPFS portraits */}
        <img src={chogImageUrl(chog)} alt={chog.name} width={96} height={96} className="h-24 w-24 shrink-0 rounded bg-neutral-900 object-cover" />
        <div className="min-w-0">
          <p className="font-mono text-xs text-neutral-500">
            #{selected} · {chog.name}
          </p>
          <p className={`font-mono text-lg uppercase tracking-wider ${ROLE_COLOUR[sound.role]}`}>{sound.role}</p>
          <p className="mt-1 text-sm leading-snug text-neutral-300">{sound.description}</p>
          <p className="mt-1 font-mono text-[11px] text-neutral-500">
            {onchain
              ? `Onchain part from movement ${onchain.movement}${onchain.movement === movement ? " (this movement)" : ""}`
              : "No onchain part yet"}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs text-neutral-500">
          16 steps · one note per step · locked to {scale.name}
        </p>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5">
            <tbody>
              {DEGREES.map((degree) => (
                <tr key={degree}>
                  <th className="pr-2 text-right font-mono text-[10px] font-normal text-neutral-500">{rowLabel(degree)}</th>
                  {steps.map((s, i) => {
                    const on = s.on && s.degree === degree;
                    return (
                      <td key={i}>
                        <button
                          aria-label={`Step ${i + 1}, ${rowLabel(degree)}`}
                          aria-pressed={on}
                          onClick={() => toggle(i, degree)}
                          className={`block h-6 w-6 rounded-sm ${on ? "bg-white" : i % 4 === 0 ? "bg-neutral-800" : "bg-neutral-900"} hover:bg-neutral-600`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => setSteps(emptySteps())} className="rounded-full border border-neutral-700 px-3 py-1 font-mono text-xs hover:border-white">
            Clear
          </button>
          {onchain && (
            <button
              onClick={() => setSteps(decodePattern(onchain.pattern))}
              className="rounded-full border border-neutral-700 px-3 py-1 font-mono text-xs hover:border-white"
            >
              Load onchain part
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-mono text-xs text-neutral-300">
          <input type="checkbox" checked={previewing} onChange={(e) => onPreview(e.target.checked ? { tokenId: selected, pattern } : null)} />
          Preview inside the live song (only you hear it, nothing onchain)
        </label>
      </div>

      <div className="space-y-1">
        <button
          onClick={perform}
          disabled={tx.busy || noteCount === 0}
          className="rounded-full bg-white px-6 py-2.5 font-mono text-sm text-black hover:bg-neutral-200 disabled:opacity-40"
        >
          {tx.busy ? "Performing…" : "Perform onchain"}
        </button>
        {noteCount === 0 && <p className="font-mono text-xs text-neutral-500">Add at least one note to perform.</p>}
        <TxStatus state={tx.state} verb="your performance" />
      </div>
    </section>
  );
}

function initialSteps(part: OnchainPart | undefined): Step[] {
  return part ? decodePattern(part.pattern) : emptySteps();
}
