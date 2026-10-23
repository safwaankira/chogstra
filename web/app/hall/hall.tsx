"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { ROTATE_EVERY_BARS, STAGE_SIZE, selectBand, type Candidate } from "@/lib/band";
import { IS_LOCAL, RPC, chain } from "@/lib/chain";
import { chogImageUrl, loadChogs, type Chog } from "@/lib/chogs";
import type { BandEngine } from "@/lib/engine";
import { chogSound, type Role } from "@/lib/mapping";
import { DEFAULT_SETTING, KEY_NAMES, MOODS, scaleFor } from "@/lib/music";
import { Composer, type BarClock, type Draft } from "./composer";
import { Silhouette, Stage, type StageSeat } from "./stage";
import { useHall, useLentChogs, useNextMovementIn, useOwnedChogs, useOwnedParts, useStageDetails } from "./useHall";
import { WalletBar } from "./wallet";

type Performed = { tokenId: number; movement: number; hash: string; by: string };

/** guest: the /guest door for judges and non-holders. A random real Chog's traits, browser-only, never onchain. */
export function Hall({ guest = false }: { guest?: boolean }) {
  const [chogs, setChogs] = useState<Map<number, Chog> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<number | null>(null);
  useEffect(() => {
    loadChogs().then(
      (map) => {
        setChogs(map);
        if (guest) setGuestId(pickGuest(map));
      },
      (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)),
    );
  }, [guest]);

  const { address } = useAccount();
  const hall = useHall();
  const owned = useOwnedChogs(address);
  const lent = useLentChogs(address);
  // The console plays your own Chogs plus any lent to you.
  const consoleIds = useMemo(() => {
    if (!owned.data) return undefined;
    return [...owned.data, ...(lent.data ?? []).filter((id) => !owned.data.includes(id))];
  }, [owned.data, lent.data]);
  const ownedParts = useOwnedParts(consoleIds);

  // Both belong to the wallet that made them; switching wallets hides them.
  const [previewState, setPreviewState] = useState<(Draft & { by: string }) | null>(null);
  const [performedState, setPerformed] = useState<Performed | null>(null);
  const previewer = guest ? "guest" : address;
  const preview = previewState && previewState.by === previewer ? previewState : null;
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
        mine.has(id) && !guest ? "Yours" : null,
        guest && id === guestId ? "Guest" : null,
        preview?.tokenId === id ? "Preview · not onchain" : null,
        !p.thisMovement && preview?.tokenId !== id ? `Part from an earlier movement` : null,
      ].filter(Boolean) as string[];
      return { chog, sound: chogSound(id, chog.traits), tags, partThisMovement: p.thisMovement, pattern: p.pattern };
    });
  }, [chogs, movement, hall.partsQ.data, hall.spotlightQ.data, preview, performed, owned.data, rotation, guest, guestId]);

  const details = useStageDetails(
    seats.map((s) => s.chog.tokenId),
    movement,
    address,
  );

  // --- Audio -----------------------------------------------------------------
  const flash = useCallback((tokenId: number) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const opts = { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
    if (!reduce) {
      document.querySelectorAll(`[data-portrait="${tokenId}"]`).forEach((el) =>
        el.animate([{ transform: "scale(1.06)", filter: "brightness(1.35)" }, { transform: "scale(1)", filter: "brightness(1)" }], opts),
      );
    }
    document.querySelectorAll(`[data-glow="${tokenId}"]`).forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], opts));
    document.querySelectorAll(`[data-pool="${tokenId}"]`).forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0.6 }], opts));
    document.querySelectorAll(`[data-meter="${tokenId}"]`).forEach((el) => el.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0.18)" }], opts));
  }, []);
  const barClock = useRef<BarClock>(null);
  const tempoRef = useRef(tempo);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);
  const onBar = useCallback((bar: number) => {
    barClock.current = { startedAt: performance.now(), stepMs: 60_000 / tempoRef.current / 4 };
    setRotation(Math.floor((bar - 1) / ROTATE_EVERY_BARS));
  }, []);

  const [doors, setDoors] = useState<"closed" | "opening" | "gone">("closed");
  const nextIn = useNextMovementIn(movement);

  async function enterHall() {
    setDoors("opening");
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

  const onPreview = useCallback((d: Draft | null) => setPreviewState(d && previewer ? { ...d, by: previewer } : null), [previewer]);
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
      <Notice>
        Chogstra isn&apos;t deployed on {chain.name} yet.
        {IS_LOCAL && <span className="block text-ink-3">Run scripts/dev-chain.sh, then restart the dev server.</span>}
      </Notice>
    );
  }
  if (hall.movementQ.isError) {
    return (
      <Notice tone="bad">
        Can&apos;t reach {chain.name} at <span className="font-mono">{RPC}</span>.
        {IS_LOCAL && <span className="block text-ink-3">Is the dev chain running? Start it with scripts/dev-chain.sh.</span>}
      </Notice>
    );
  }
  if (loadError) {
    return <Notice tone="bad">Couldn&apos;t load Chog data: {loadError}</Notice>;
  }
  if (hall.partsQ.isError || hall.settingQ.isError) {
    return (
      <Notice tone="bad">
        The chain is busy and didn&apos;t answer. Retrying…
        <button onClick={() => (hall.partsQ.refetch(), hall.settingQ.refetch())} className="mt-3 block w-full text-sm text-ink-2 underline underline-offset-4">
          Retry now
        </button>
      </Notice>
    );
  }
  if (!chogs || movement === undefined || !hall.settingQ.data || !hall.partsQ.data) {
    return <Notice>Opening the hall…</Notice>;
  }

  const performerCount = [...hall.partsQ.data.values()].filter((p) => p.movement === movement).length;
  const youAreIn = performed && performed.movement === movement;
  const mood = MOODS[setting.moodIndex];
  const holdsChogs = !!address && !!owned.data && owned.data.length > 0;

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-4 pb-4 pt-3 lg:h-dvh lg:overflow-hidden sm:px-6">
      <nav aria-label="Chogstra" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="flex items-baseline gap-3">
          <span className="font-display text-xl font-black uppercase tracking-[0.22em] text-monad-hi">Chogstra</span>
          <span className="hidden text-xs text-ink-3 sm:inline">1,969 Chogs, one live song on {chain.name}</span>
        </p>
        <div className="flex items-center gap-3">
          <Link href="/leaderboard" className="text-xs font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            Leaderboard
          </Link>
          {!guest && (
            <Link href="/guest" className="text-xs font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              Guest mode
            </Link>
          )}
          <WalletBar />
        </div>
      </nav>

      <header className="-mt-1 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-end gap-x-5 gap-y-2">
          <h1 className="font-display text-[clamp(2.75rem,6.2vw,5.5rem)] font-black uppercase leading-[0.82] tracking-[-0.01em] text-ink">
            Movement <span className="tabular text-monad-hi">{movement}</span>
          </h1>
          <ul className="mb-1 flex flex-wrap gap-1.5" aria-label="This movement's setting">
            <Chip label="Key" value={KEY_NAMES[setting.keyIndex]} />
            <Chip label="Mood" value={`${mood.name}, ${mood.scale}`} />
            <Chip label="Tempo" value={`${setting.tempo} bpm`} />
            {waiting && (
              <li className="flex items-center gap-1.5 rounded-full bg-warn/15 px-3 py-1 text-xs text-warn">
                <span aria-hidden className="h-1.5 w-1.5 animate-pulse motion-reduce:animate-none rounded-full bg-warn" />
                Waiting for today&apos;s draw
              </li>
            )}
          </ul>
        </div>

        <div className="grid w-full grid-cols-3 items-end gap-x-4 gap-y-3 sm:flex sm:w-auto sm:gap-x-8">
          <Stat label="Encore Pot" unit="$CHOG">
            {hall.potQ.data !== undefined ? <CountUp value={Number(formatUnits(hall.potQ.data, 18))} /> : "…"}
          </Stat>
          <Stat label="Next movement">{nextIn === null ? "…" : formatCountdown(nextIn)}</Stat>
          <Stat label="On stage" unit={`of ${STAGE_SIZE} seats`}>
            {seats.length}
          </Stat>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,25rem)]">
        <section aria-labelledby="stage-heading" className="relative min-h-0">
          <h2 id="stage-heading" className="sr-only">
            The Stage
          </h2>
          <p className="sr-only" aria-live="polite">
            {audio === "on" ? `Sound on. ${seats.length} ${seats.length === 1 ? "Chog" : "Chogs"} playing in Movement ${movement}.` : ""}
          </p>
          <Stage
            seats={seats}
            details={details}
            movement={movement}
            featured={youAreIn ? performed.tokenId : undefined}
            empty={<EmptyStage movement={movement} connected={!!address} holdsChogs={holdsChogs} quiet={doors !== "gone"} />}
            top={
              <div className="pointer-events-none flex flex-wrap items-start justify-between gap-2">
                  {youAreIn ? (
                    <p className="feed-in pointer-events-auto rounded-full bg-monad-deep px-4 py-1.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_var(--monad)]">
                      You&apos;re in Movement {movement}. {chogs.get(performed.tokenId)?.name ?? `#${performed.tokenId}`} is playing your part.
                      <span className="ml-2 font-mono text-xs font-normal text-white/70">
                        tx {performed.hash.slice(0, 8)}…{performed.hash.slice(-4)}
                      </span>
                      <ShareCardButton
                        chog={chogs.get(performed.tokenId)}
                        pattern={hall.partsQ.data.get(performed.tokenId)?.pattern}
                        movement={movement}
                        settingText={`${KEY_NAMES[setting.keyIndex]} ${mood.scale} · ${setting.tempo} bpm · mood ${mood.name}`}
                        hash={performed.hash}
                      />
                    </p>
                  ) : address && seats.some((x) => !x.tags.includes("Yours")) && doors === "gone" ? (
                    <p className="rounded-full bg-house/85 px-3 py-1 text-xs text-ink-2">Tap a Chog to applaud or tip</p>
                  ) : (
                    <span />
                  )}
                  {hall.feed.length > 0 && (
                    <ul className="flex flex-wrap justify-end gap-1.5" aria-live="polite">
                      {hall.feed.slice(0, 3).map((f, i) => (
                        <li key={f.id} className={`feed-in rounded-full bg-house/85 px-3 py-1 text-xs text-ink-2 ${i > 0 ? "hidden md:block" : ""}`}>
                          <span className="font-medium text-ink">{chogs.get(f.tokenId)?.name ?? `#${f.tokenId}`}</span>{" "}
                          {f.kind === "joined" ? "just joined" : "rewrote their part"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
            }
            overlay={
              <>
                {doors !== "gone" && (
                  <HallDoors
                    state={doors}
                    starting={audio === "starting"}
                    playing={seats.length}
                    playedThisMovement={performerCount}
                    movement={movement}
                    onEnter={enterHall}
                    onOpened={() => setDoors("gone")}
                  />
                )}
              </>
            }
          />
        </section>

        <aside
          aria-labelledby="console-heading"
          className="flex min-h-0 flex-col rounded-[22px] bg-[linear-gradient(180deg,#1a1230,#110b20_40%,#0e0a1b)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_48px_-24px_rgba(0,0,0,0.9)] lg:overflow-y-auto"
        >
          <h2 id="console-heading" className="mb-3 flex items-center gap-2 font-display text-2xl font-black uppercase tracking-wide text-ink">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-monad shadow-[0_2px_8px_var(--monad)]" />
            Your console
          </h2>
          {guest ? (
            guestId === null ? (
              <p className="text-sm text-ink-2">Picking your Guest Chog…</p>
            ) : (
              <Composer
                key={`guest-${guestId}`}
                chogs={chogs}
                ownedIds={[guestId]}
                scale={scale}
                movement={movement}
                existingParts={new Map()}
                previewing={preview !== null}
                onPreview={onPreview}
                onPerformed={onPerformed}
                barClock={barClock}
                guest
                onAnotherGuest={() => {
                  setPreviewState(null);
                  setGuestId(pickGuest(chogs));
                }}
              />
            )
          ) : !address ? (
            <Spectate reason="Connect a wallet that holds a Chog to write its part." />
          ) : owned.isPending ? (
            <p className="text-sm text-ink-2">
              Finding your Chogs… <span className="tabular font-mono text-ink-3">{owned.progress} / 1,969</span>
            </p>
          ) : owned.isError ? (
            <p className="text-sm text-bad">Couldn&apos;t check Chog ownership: {owned.error.message.split("\n")[0]}</p>
          ) : consoleIds!.length === 0 ? (
            <Spectate reason="This wallet holds no Chogs. You can still listen, applaud and tip." />
          ) : !ownedParts.data ? (
            <p className="text-sm text-ink-2">Reading your Chogs&apos; parts…</p>
          ) : (
            <Composer
              key={address}
              chogs={chogs}
              ownedIds={consoleIds!}
              lentIds={(lent.data ?? []).filter((id) => !owned.data.includes(id))}
              scale={scale}
              movement={movement}
              existingParts={ownedParts.data}
              previewing={preview !== null}
              onPreview={onPreview}
              onPerformed={onPerformed}
              barClock={barClock}
            />
          )}
        </aside>
      </div>
    </main>
  );
}

/** Draws and downloads the Result share card (real Chog, real onchain loop, real tx). */
function ShareCardButton({
  chog,
  pattern,
  movement,
  settingText,
  hash,
}: {
  chog: Chog | undefined;
  pattern: bigint | undefined;
  movement: number;
  settingText: string;
  hash: string;
}) {
  const [state, setState] = useState<"idle" | "drawing" | "error">("idle");
  if (!chog || pattern === undefined) return null;
  const sound = chogSound(chog.tokenId, chog.traits);
  async function share() {
    setState("drawing");
    try {
      const { renderShareCard } = await import("@/lib/shareCard");
      const gel = getComputedStyle(document.documentElement).getPropertyValue(`--gel-${sound.role}`).trim();
      const blob = await renderShareCard({
        imageUrl: chogImageUrl(chog!),
        chogName: chog!.name,
        role: sound.role,
        gel,
        pattern: pattern!,
        movement,
        settingText,
        txHash: hash,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chogstra-movement-${movement}-${chog!.tokenId}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setState("idle");
    } catch {
      setState("error");
    }
  }
  return (
    <button
      onClick={share}
      disabled={state === "drawing"}
      className="ml-3 h-7 rounded-full bg-white/15 px-3 text-xs font-semibold text-white transition hover:bg-white/25 disabled:opacity-60"
    >
      {state === "drawing" ? "Drawing…" : state === "error" ? "Card failed, retry" : "Share card"}
    </button>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-full bg-house-3 px-3 py-1 text-xs text-ink-2">
      <span className="text-ink-3">{label}</span> <span className="font-semibold text-ink">{value}</span>
    </li>
  );
}

function Stat({ label, unit, children }: { label: string; unit?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-ink-3">{label}</p>
      <p className="tabular whitespace-nowrap font-display text-2xl font-extrabold leading-none text-ink sm:text-3xl">
        {children}
        {unit && <span className="ml-1 font-display text-base font-bold text-ink-3">{unit}</span>}
      </p>
    </div>
  );
}

/** Counts up to a new value when the pot changes, so a tip is felt. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = reduce ? 1 : Math.min(1, (t - t0) / 700);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(start + (value - start) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toLocaleString(undefined, { maximumFractionDigits: 2 })}</>;
}

function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** The house doors: translucent, so the dimmed band shows through until the visitor taps in (audio needs that tap). */
function HallDoors({
  state,
  starting,
  playing,
  playedThisMovement,
  movement,
  onEnter,
  onOpened,
}: {
  state: "closed" | "opening";
  starting: boolean;
  playing: number;
  playedThisMovement: number;
  movement: number;
  onEnter: () => void;
  onOpened: () => void;
}) {
  const held = playing - playedThisMovement;
  const copy =
    playing === 0
      ? `The stage is set for Movement ${movement}. Nobody has played yet.`
      : playedThisMovement === 0
        ? `${held} Spotlight ${held === 1 ? "Chog is" : "Chogs are"} holding the stage with earlier parts. Nobody has played Movement ${movement} yet.`
        : `${playing} ${playing === 1 ? "Chog is" : "Chogs are"} on stage, each playing a loop its holder wrote onchain.`;
  const panel = "absolute inset-y-0 w-1/2 bg-[color-mix(in_oklab,#120b22_58%,transparent)] backdrop-blur-[1.5px] backdrop-saturate-50";
  return (
    <div className={`absolute inset-0 z-30 overflow-hidden rounded-[28px] ${state === "opening" ? "doors-open" : ""}`}>
      <div aria-hidden className={`door-left left-0 ${panel} shadow-[inset_-10px_0_18px_-12px_rgba(0,0,0,0.9)]`} onAnimationEnd={onOpened} />
      <div aria-hidden className={`door-right right-0 ${panel} shadow-[inset_10px_0_18px_-12px_rgba(0,0,0,0.9)]`} />
      {state === "closed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
          <p className="max-w-md text-sm text-ink-2">{copy}</p>
          <button
            onClick={onEnter}
            disabled={starting}
            className="whitespace-nowrap rounded-full bg-monad px-8 py-4 font-display text-2xl font-black uppercase tracking-[0.1em] text-white shadow-[0_18px_44px_-14px_var(--monad),0_4px_12px_rgba(0,0,0,0.5)] transition hover:bg-monad-deep active:scale-[0.98] sm:px-10 sm:py-5 sm:text-4xl sm:tracking-[0.14em]"
          >
            Enter the hall
          </button>
          <p className="text-xs text-ink-3">Tap to turn the sound on.</p>
        </div>
      )}
    </div>
  );
}

const ROLES_IN_ORDER: Role[] = ["drums", "bass", "chords", "melody"];

function EmptyStage({ movement, connected, holdsChogs, quiet }: { movement: number; connected: boolean; holdsChogs: boolean; quiet: boolean }) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center text-center">
      <ul className="mb-8 flex w-full items-end justify-around" aria-hidden>
        {ROLES_IN_ORDER.map((role) => (
          <li key={role} className="flex flex-col items-center gap-2">
            <Silhouette role={role} className="h-16 w-16 text-ink-3/60 sm:h-20 sm:w-20" />
            <span className="h-3 w-20 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--monad)_35%,transparent),transparent)] sm:w-24" />
            <span className="font-display text-xs font-extrabold uppercase tracking-[0.2em] text-ink-3">{role}</span>
          </li>
        ))}
      </ul>
      {quiet ? null : <p className="font-display text-4xl font-black uppercase leading-none text-ink sm:text-5xl">Be the first to play</p>}
      <p className={`mt-3 max-w-md text-sm text-ink-2 ${quiet ? "hidden" : ""}`}>
        {holdsChogs
          ? `Movement ${movement} has no band yet. Write a loop in the console and perform it, and it starts with you.`
          : connected
            ? `Nobody has played Movement ${movement} yet. When a holder performs, you'll hear it here.`
            : `Hold a Chog? Connect your wallet and write the first part of Movement ${movement}.`}
      </p>
    </div>
  );
}

/** A random real Chog for a guest visit (not a live performer, so the preview never shadows a real part). */
function pickGuest(chogs: Map<number, Chog>): number {
  const ids = [...chogs.keys()];
  return ids[Math.floor(Math.random() * ids.length)];
}

function Spectate({ reason }: { reason: string }) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="font-display text-3xl font-black uppercase leading-[0.95] text-ink">
        Every Chog is <span className="text-monad-hi">an instrument</span>
      </p>
      <p className="text-sm leading-relaxed text-ink-2">
        Its traits set the sound. Its holder writes a 16-step loop onchain, and every loop plays together as one song on Monad.
      </p>
      <p className="text-sm text-ink-3">{reason}</p>
      <Link href="/guest" className="text-sm font-medium text-monad-hi underline-offset-4 hover:underline">
        No Chog? Try it as a guest
      </Link>
      <button disabled className="mt-auto w-full rounded-2xl bg-house-3 py-3 font-display text-xl font-extrabold uppercase tracking-[0.12em] text-ink-3">
        You need a Chog to play
      </button>
    </div>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone?: "bad" }) {
  return (
    <main className="flex min-h-dvh flex-col px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-xl font-black uppercase tracking-[0.22em] text-monad-hi">Chogstra</p>
        <WalletBar />
      </header>
      <div className="flex flex-1 items-center justify-center">
        <p className={`max-w-lg text-center text-base ${tone === "bad" ? "text-bad" : "text-ink-2"}`}>{children}</p>
      </div>
    </main>
  );
}
