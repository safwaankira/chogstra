// Picks who plays on the Stage right now: at most 16 Chogs with balanced roles.
// Pinned Chogs (Spotlight, your own, your preview) are always in; the rest
// rotate every few bars so everyone who performed gets heard.

import type { Role } from "./mapping";

export const STAGE_SIZE = 16;
export const ROTATE_EVERY_BARS = 4;
const ROLES: Role[] = ["drums", "bass", "chords", "melody"];

export type Candidate = { tokenId: number; role: Role };

export function selectBand(candidates: Candidate[], pinned: number[], rotation: number): number[] {
  const byId = new Map(candidates.map((c) => [c.tokenId, c]));
  const chosen = new Set<number>();
  for (const id of pinned) if (byId.has(id) && chosen.size < STAGE_SIZE) chosen.add(id);

  const quota = STAGE_SIZE / ROLES.length;
  const pools = new Map(
    ROLES.map((role) => {
      const ids = candidates
        .filter((c) => c.role === role && !chosen.has(c.tokenId))
        .map((c) => c.tokenId)
        .sort((a, b) => a - b);
      // Rotate the pool so a different slice is on stage each turn.
      const shift = ids.length ? (rotation * quota) % ids.length : 0;
      return [role, [...ids.slice(shift), ...ids.slice(0, shift)]];
    }),
  );

  // First pass: fill each role up to its quota (pinned Chogs count toward it).
  for (const role of ROLES) {
    let count = [...chosen].filter((id) => byId.get(id)?.role === role).length;
    const pool = pools.get(role)!;
    while (pool.length && count < quota && chosen.size < STAGE_SIZE) {
      chosen.add(pool.shift()!);
      count++;
    }
  }
  // Second pass: roles with spare players fill any empty seats, round-robin.
  let added = true;
  while (chosen.size < STAGE_SIZE && added) {
    added = false;
    for (const role of ROLES) {
      const pool = pools.get(role)!;
      if (pool.length && chosen.size < STAGE_SIZE) {
        chosen.add(pool.shift()!);
        added = true;
      }
    }
  }
  return [...chosen];
}
