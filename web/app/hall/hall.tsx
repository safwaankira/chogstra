"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { ROTATE_EVERY_BARS, STAGE_SIZE, selectBand, type Candidate } from "@/lib/band";
import { IS_LOCAL, RPC, chain } from "@/lib/chain";
import { loadChogs, type Chog } from "@/lib/chogs";
import type { BandEngine } from "@/lib/engine";
import { chogSound } from "@/lib/mapping";
import { DEFAULT_SETTING, KEY_NAMES, MOODS, scaleFor } from "@/lib/music";
import { Composer, type Draft } from "./composer";
import { StageCard, type StageSeat } from "./stage";
import { useHall, useOwnedChogs, useOwnedParts, useStageDetails } from "./useHall";
import { WalletBar } from "./wallet";

type Performed = { tokenId: number; movement: number; hash: string; by: string };

export function Hall() {
  const [chogs, setChogs] = useState<Map<number, Chog> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    loadChogs().then(setChogs, (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  const { address } = useAccount();
  const hall = useHall();
  const owned = useOwnedChogs(address);
  const ownedParts = useOwnedParts(owned.data);

  // Both belong to the wallet that made them; switching wallets hides them.
  const [previewState, setPreviewState] = useState<(Draft & { by: string }) | null>(null);
  const [performedState, setPerformed] = useState<Performed | null>(null);
  const preview = previewState && previewState.by === address ? previewState : null;
  const performed = performedState && performedState.by === address ? performedState : null;
  const [rotation, setRotation] = useState(0);
  const [audio, setAudio] = useState<"off" | "starting" | "on">("off");
  const engineRef = useRef<BandEngine | null>(null);

  const movement = hall.movement;
  const { setting, waiting } = hall.settingQ.data ?? { setting: DEFAULT_SETTING, waiting: false };
  const { keyIndex, moodIndex, tempo } = setting;
  const scale = useMemo(() => scaleFor({ keyIndex, moodIndex, tempo }), [keyIndex, moodIndex, tempo]);

  // --- Who plays -------------------------------------------------------------
  const seats = useMemo<(StageSeat & { pattern: bigint })[]>(() => {
    if (!chogs || movement === undefined) return [];
    const patterns = new Map<number, { pattern: bigint; thisMovement: boolean }>();
    for (const [id, p] of hall.partsQ.data ?? []) if (p.movement === movement) patterns.set(id, { pattern: p.pattern, thisMovement: true });
    const spotlightIds = hall.spotlightQ.data?.ids ?? [];
    for (const id of spotlightIds) {
      const p = hall.spotlightQ.data?.parts.get(id);
      if (p && !patterns.has(id)) patterns.set(id, { pattern: p.pattern, thisMovement: p.movement === movement });
    }
    if (preview) patterns.set(preview.tokenId, { pattern: preview.pattern, thisMovement: patterns.get(preview.tokenId)?.thisMovement ?? false });

    const candidates: Candidate[] = [...patterns.keys()]
      .filter((id) => chogs.has(id))
      .map((id) => ({ tokenId: id, role: chogSound(id, chogs.get(id)!.traits).role }));
    const pinned = [...spotlightIds, ...(performed ? [performed.tokenId] : []), ...(preview ? [preview.tokenId] : [])];
    const mine = new Set(owned.data ?? []);

    return selectBand(candidates, pinned, rotation).map((id) => {
      const chog = chogs.get(id)!;
      const p = patterns.get(id)!;
      const tags = [
        spotlightIds.includes(id) ? "Spotlight" : null,
        mine.has(id) ? "Yours" : null,
        preview?.tokenId === id ? "Preview · not onchain" : null,
        !p.thisMovement && preview?.tokenId !== id ? `Part from an earlier movement` : null,
      ].filter(Boolean) as string[];
      return { chog, sound: chogSound(id, chog.traits), tags, partThisMovement: p.thisMovement, pattern: p.pattern };
    });
  }, [chogs, movement, hall.partsQ.data, hall.spotlightQ.data, preview, performed, owned.data, rotation]);

  const details = useStageDetails(
    seats.map((s) => s.chog.tokenId),
    movement,
    address,
  );

  // --- Audio -----------------------------------------------------------------
  const flash = useCallback((tokenId: number) => {
    document.querySelectorAll(`[data-portrait="${tokenId}"]`).forEach((el) =>
      el.animate([{ transform: "scale(1.12)", filter: "brightness(1.6)" }, { transform: "scale(1)", filter: "brightness(1)" }], {
        duration: 260,
        easing: "ease-out",
      }),
    );
  }, []);
  const onBar = useCallback((bar: number) => setRotation(Math.floor((bar - 1) / ROTATE_EVERY_BARS)), []);

  async function enterHall() {
    setAudio("starting");
    const { BandEngine } = await import("@/lib/engine");
    const engine = new BandEngine();
    await engine.start();
    engine.startLive(flash, onBar, tempo);
    engineRef.current = engine;
    setAudio("on");
  }
  useEffect(() => () => engineRef.current?.dispose(), []);

  const bandKey = seats.map((s) => `${s.chog.tokenId}:${s.pattern}`).join("|");
  useEffect(() => {
    if (audio !== "on") return;
    engineRef.current?.setBand(
      seats.map((s) => ({ sound: s.sound, pattern: s.pattern })),
      scale,
    );
    // bandKey captures every seat/pattern change; seats itself changes identity more often.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, bandKey, scale]);
  useEffect(() => {
    if (audio === "on") engineRef.current?.setTempo(tempo);
  }, [audio, tempo]);

  const onPreview = useCallback((d: Draft | null) => setPreviewState(d && address ? { ...d, by: address } : null), [address]);
  const onPerformed = useCallback(
    (tokenId: number, hash: string) => {
      setPreviewState(null);
      if (movement !== undefined && address) setPerformed({ tokenId, movement, hash, by: address });
    },
    [movement, address],
  );

  // --- Render ----------------------------------------------------------------
  if (!hall.deployed) {
    return (
      <Shell>
        <p className="font-mono text-sm text-neutral-400">
          Chogstra isn&apos;t deployed on {chain.name} yet (NEXT_PUBLIC_CHOGSTRA_ADDRESS is empty).
          {IS_LOCAL && " Run scripts/dev-chain.sh, then restart the dev server."}
        </p>
      </Shell>
    );
  }
  if (hall.movementQ.isError) {
    return (
      <Shell>
        <p className="font-mono text-sm text-rose-400">Can&apos;t reach {chain.name} at {RPC}.</p>
        {IS_LOCAL && <p className="mt-2 font-mono text-xs text-neutral-500">Is the dev chain running? Start it with scripts/dev-chain.sh.</p>}
      </Shell>
    );
  }
  if (loadError) {
    return (
      <Shell>
        <p className="font-mono text-sm text-rose-400">Couldn&apos;t load Chog data: {loadError}</p>
      </Shell>
    );
  }
  if (!chogs || movement === undefined || !hall.settingQ.data || !hall.partsQ.data) {
    return (
      <Shell>
        <p className="font-mono text-sm text-neutral-500">Opening the hall…</p>
      </Shell>
    );
  }

  const performerCount = [...hall.partsQ.data.values()].filter((p) => p.movement === movement).length;
  const youAreIn = performed && performed.movement === movement;

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-xs text-neutral-400">
        <span className="text-sm text-white">Movement {movement}</span>
        <span>
          {KEY_NAMES[setting.keyIndex]} {MOODS[setting.moodIndex].scale} · {setting.tempo} bpm · mood {MOODS[setting.moodIndex].name}
        </span>
        {waiting && <span className="text-amber-300">Waiting for today&apos;s draw (default setting)</span>}
        <span>Encore Pot {hall.potQ.data !== undefined ? `${Number(formatUnits(hall.potQ.data, 18)).toLocaleString()} $CHOG` : "…"}</span>
        <span>
          {performerCount} performed this movement · {seats.length}/{STAGE_SIZE} on stage
        </span>
      </div>

      {youAreIn && (
        <div className="mb-5 rounded-lg border border-lime-700 bg-lime-950/40 p-3 font-mono text-sm text-lime-200">
          You&apos;re in Movement {movement}. #{performed.tokenId} is on the Stage playing your part.
          <span className="ml-2 text-xs text-lime-400/70">tx {performed.hash.slice(0, 10)}…{performed.hash.slice(-6)}</span>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-400">The Stage</h2>
            {audio !== "on" && (
              <button
                onClick={enterHall}
                disabled={audio === "starting"}
                className="rounded-full bg-white px-5 py-2 font-mono text-sm text-black hover:bg-neutral-200 disabled:opacity-50"
              >
                {audio === "starting" ? "Starting audio…" : "Tap to enter the hall"}
              </button>
            )}
          </div>

          {hall.feed.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2 font-mono text-[11px] text-neutral-400">
              {hall.feed.map((f) => (
                <li key={f.id} className="rounded-full border border-neutral-800 px-2 py-0.5">
                  #{f.tokenId} {f.kind === "joined" ? "just joined" : "rewrote their part"}
                </li>
              ))}
            </ul>
          )}

          {seats.length === 0 ? (
            <p className="font-mono text-sm text-neutral-500">Nobody has performed in Movement {movement} yet. The Stage is silent until someone does.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {seats.map((seat) => (
                <StageCard
                  key={seat.chog.tokenId}
                  seat={seat}
                  owner={details.owners?.get(seat.chog.tokenId)}
                  career={details.careers?.get(seat.chog.tokenId)}
                  applauded={details.applauded?.has(seat.chog.tokenId) ?? false}
                  movement={movement}
                />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-neutral-400">Compose</h2>
          {!address ? (
            <Spectate reason="Connect a wallet that holds a Chog to write your part." />
          ) : owned.isPending ? (
            <p className="font-mono text-sm text-neutral-500">Finding your Chogs… checked {owned.progress} of 1,969</p>
          ) : owned.isError ? (
            <p className="font-mono text-sm text-rose-400">Couldn&apos;t check Chog ownership: {owned.error.message.split("\n")[0]}</p>
          ) : owned.data.length === 0 ? (
            <Spectate reason="This wallet holds no Chogs. You can still listen, applaud and tip." />
          ) : !ownedParts.data ? (
            <p className="font-mono text-sm text-neutral-500">Reading your Chogs&apos; parts…</p>
          ) : (
            <Composer
              key={address}
              chogs={chogs}
              ownedIds={owned.data}
              scale={scale}
              movement={movement}
              existingParts={ownedParts.data}
              previewing={preview !== null}
              onPreview={onPreview}
              onPerformed={onPerformed}
            />
          )}
        </section>
      </div>
    </Shell>
  );
}

function Spectate({ reason }: { reason: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">{reason}</p>
      <button disabled className="rounded-full bg-white px-6 py-2.5 font-mono text-sm text-black opacity-40">
        You need a Chog to play
      </button>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#07060a] px-4 py-6 text-neutral-200 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-sm uppercase tracking-[0.3em] text-white">Chogstra</h1>
          <p className="font-mono text-xs text-neutral-500">1,969 Chogs, one live onchain song · {chain.name}</p>
        </div>
        <WalletBar />
      </header>
      {children}
    </main>
  );
}
