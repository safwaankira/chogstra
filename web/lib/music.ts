// Shared music helpers: scales, the 16-step pattern format, drum pieces.
// No audio code here (see lib/engine.ts).

import type { Role } from "./mapping";

export const STEPS = 16;

// A pattern is a uint64, the same format Chogstra.sol stores.
// Step i lives in bits [4i, 4i+3]: bit 3 = note on/off, bits 0-2 = scale degree 0-7.
export type Step = { on: boolean; degree: number };

export function encodePattern(steps: Step[]): bigint {
  let pattern = BigInt(0);
  steps.forEach((s, i) => {
    const nibble = (s.on ? 8 : 0) | (s.degree & 7);
    pattern |= BigInt(nibble) << BigInt(4 * i);
  });
  return pattern;
}

export function decodePattern(pattern: bigint): Step[] {
  return Array.from({ length: STEPS }, (_, i) => {
    const nibble = Number((pattern >> BigInt(4 * i)) & BigInt(15));
    return { on: (nibble & 8) !== 0, degree: nibble & 7 };
  });
}

export type Scale = { name: string; rootMidi: number; intervals: number[] };

// The /lab plays everything in C minor pentatonic. Movements will pick their own.
export const C_MINOR_PENTATONIC: Scale = { name: "C minor pentatonic", rootMidi: 0, intervals: [0, 3, 5, 7, 10] };

/** MIDI note for a scale degree. Degrees past the scale length climb into the next octave. */
export function degreeToMidi(scale: Scale, degree: number, octave: number): number {
  const len = scale.intervals.length;
  const idx = ((degree % len) + len) % len;
  const octaveShift = Math.floor(degree / len);
  return 12 * (octave + 1 + octaveShift) + scale.rootMidi + scale.intervals[idx];
}

// For drums the 3-bit degree picks the drum instead of a note.
export type DrumPiece = "kick" | "snare" | "hat" | "tom" | "openhat";
export const DRUM_PIECES: DrumPiece[] = ["kick", "kick", "snare", "snare", "hat", "hat", "tom", "openhat"];

/** A random but musical 16-step loop for a role. For the /lab only, never written onchain. */
export function randomPattern(role: Role, rand: () => number = Math.random): bigint {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const steps: Step[] = Array.from({ length: STEPS }, () => ({ on: false, degree: 0 }));
  const hit = (i: number, degree: number) => (steps[i] = { on: true, degree });

  if (role === "drums") {
    for (let i = 0; i < STEPS; i++) {
      if (i % 8 === 0 && rand() < 0.95) hit(i, 0);
      else if (i % 8 === 4 && rand() < 0.9) hit(i, 2);
      else if (i % 2 === 0 && rand() < 0.6) hit(i, pick([4, 5, 4, 7]));
      else if (rand() < 0.12) hit(i, pick([1, 6, 4]));
    }
  } else if (role === "bass") {
    hit(0, 0);
    for (let i = 1; i < STEPS; i++) if (rand() < (i % 4 === 0 ? 0.55 : 0.2)) hit(i, pick([0, 0, 2, 3, 4, 5]));
  } else if (role === "chords") {
    for (const i of [0, 8]) if (rand() < 0.9) hit(i, pick([0, 1, 2, 3, 4]));
    for (const i of [4, 12, 14]) if (rand() < 0.25) hit(i, pick([0, 1, 2, 3, 4]));
  } else {
    let degree = Math.floor(rand() * 8);
    for (let i = 0; i < STEPS; i++) {
      if (rand() < (i % 2 === 0 ? 0.5 : 0.25)) {
        degree = Math.max(0, Math.min(7, degree + pick([-2, -1, -1, 0, 1, 1, 2])));
        hit(i, degree);
      }
    }
  }
  return encodePattern(steps);
}
