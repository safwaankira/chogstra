"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CHOG_COUNT, chogImageUrl, loadChogs, type Chog } from "@/lib/chogs";
import type { BandEngine } from "@/lib/engine";
import { chogSound, type ChogSound, type Role } from "@/lib/mapping";
import { decodePattern, randomPattern } from "@/lib/music";

type Member = { chog: Chog; sound: ChogSound; pattern: bigint };

const ROLES: Role[] = ["drums", "bass", "chords", "melody"];
const BAND_SIZE = 16;

const ROLE_COLOUR: Record<Role, string> = {
  drums: "text-amber-300",
  bass: "text-rose-300",
  chords: "text-sky-300",
  melody: "text-lime-300",
};

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickBand(byRole: Map<Role, Member["chog"][]>): Member[] {
  const perRole = BAND_SIZE / ROLES.length;
  return ROLES.flatMap((role) =>
    shuffle(byRole.get(role) ?? [])
      .slice(0, perRole)
      .map((chog) => ({ chog, sound: chogSound(chog.tokenId, chog.traits), pattern: randomPattern(role) })),
  );
}

export function Lab() {
  const [chogs, setChogs] = useState<Map<number, Chog> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [mode, setMode] = useState<"band" | "solo" | null>(null);
  const [soloInput, setSoloInput] = useState("");
  const [soloError, setSoloError] = useState<string | null>(null);

  const engineRef = useRef<BandEngine | null>(null);
  const cardRefs = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    loadChogs().then(setChogs, (err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)));
    return () => engineRef.current?.dispose();
  }, []);

  const byRole = useMemo(() => {
    const map = new Map<Role, Chog[]>();
    if (!chogs) return map;
    for (const chog of chogs.values()) {
      const role = chogSound(chog.tokenId, chog.traits).role;
      map.set(role, [...(map.get(role) ?? []), chog]);
    }
    return map;
  }, [chogs]);

  async function start() {
    setStarting(true);
    try {
      const { BandEngine } = await import("@/lib/engine");
      const engine = new BandEngine();
      await engine.start();
      engineRef.current = engine;
      setStarted(true);
    } finally {
      setStarting(false);
    }
  }

  function flash(tokenId: number, step: number) {
    const card = cardRefs.current.get(tokenId);
    if (!card) return;
    card.querySelector("[data-light]")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: "ease-out" });
    card.querySelector(`[data-step="${step}"]`)?.animate([{ transform: "scale(1.9)", backgroundColor: "#fff" }, { transform: "scale(1)" }], {
      duration: 260,
      easing: "ease-out",
    });
  }

  function play(next: Member[], nextMode: "band" | "solo") {
    setMembers(next);
    setMode(nextMode);
    engineRef.current?.play(
      next.map((m) => ({ sound: m.sound, pattern: m.pattern })),
      flash,
    );
  }

  function randomBand() {
    play(pickBand(byRole), "band");
  }

  function playSolo(e?: React.FormEvent) {
    e?.preventDefault();
    const id = Number(soloInput);
    if (!Number.isInteger(id) || id < 1 || id > CHOG_COUNT) {
      setSoloError(`Token IDs run from 1 to ${CHOG_COUNT}.`);
      return;
    }
    const chog = chogs?.get(id);
    if (!chog) {
      setSoloError(`Chog ${id} isn't in data/chogs.json.`);
      return;
    }
    setSoloError(null);
    const sound = chogSound(id, chog.traits);
    play([{ chog, sound, pattern: randomPattern(sound.role) }], "solo");
  }

  function newLoops() {
    play(
      members.map((m) => ({ ...m, pattern: randomPattern(m.sound.role) })),
      mode ?? "band",
    );
  }

  function stop() {
    engineRef.current?.stop();
    setMode(null);
  }

  return (
    <main className="min-h-screen bg-[#07060a] px-4 py-6 text-neutral-200 sm:px-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-mono text-sm uppercase tracking-[0.3em] text-neutral-400">Chogstra · sound lab</h1>
        <p className="font-mono text-xs text-neutral-500">C minor pentatonic · 90 bpm · random test loops, not onchain parts</p>
      </header>

      {loadError && <p className="mb-4 font-mono text-sm text-rose-400">Couldn&apos;t load Chog data: {loadError}</p>}

      {!started ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <button
            onClick={start}
            disabled={starting || !chogs}
            className="rounded-full border border-neutral-600 px-10 py-5 font-mono text-lg tracking-wide text-white transition hover:border-white disabled:opacity-40"
          >
            {!chogs ? "Loading 1,969 Chogs…" : starting ? "Starting audio…" : "Tap to start"}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button onClick={randomBand} className="rounded-full bg-white px-5 py-2 font-mono text-sm text-black hover:bg-neutral-200">
              Random band
            </button>
            <form onSubmit={playSolo} className="flex items-center gap-2">
              <label htmlFor="solo" className="sr-only">
                Token ID
              </label>
              <input
                id="solo"
                inputMode="numeric"
                placeholder="Token ID"
                value={soloInput}
                onChange={(e) => setSoloInput(e.target.value.replace(/\D/g, ""))}
                className="w-28 rounded-full border border-neutral-700 bg-transparent px-4 py-2 font-mono text-sm outline-none focus:border-white"
              />
              <button type="submit" className="rounded-full border border-neutral-600 px-4 py-2 font-mono text-sm hover:border-white">
                Hear alone
              </button>
            </form>
            {mode && (
              <>
                <button onClick={newLoops} className="rounded-full border border-neutral-600 px-4 py-2 font-mono text-sm hover:border-white">
                  New loops
                </button>
                <button onClick={stop} className="rounded-full border border-neutral-600 px-4 py-2 font-mono text-sm hover:border-white">
                  Stop
                </button>
              </>
            )}
          </div>
          {soloError && <p className="-mt-3 mb-4 font-mono text-xs text-rose-400">{soloError}</p>}

          {members.length === 0 ? (
            <p className="font-mono text-sm text-neutral-500">Press Random band, or type a token ID to hear one Chog alone.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {members.map((m) => (
                <li
                  key={m.chog.tokenId}
                  ref={(el) => {
                    if (el) cardRefs.current.set(m.chog.tokenId, el);
                    else cardRefs.current.delete(m.chog.tokenId);
                  }}
                  className="relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 p-3"
                >
                  <div data-light className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.22),transparent_70%)] opacity-0" />
                  <div className="flex gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- IPFS portraits, no Next image config yet */}
                    <img src={chogImageUrl(m.chog)} alt={m.chog.name} width={72} height={72} loading="lazy" className="h-18 w-18 shrink-0 rounded bg-neutral-900 object-cover" />
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-neutral-500">
                        #{m.chog.tokenId} · {m.chog.name}
                      </p>
                      <p className={`font-mono text-sm uppercase tracking-wider ${ROLE_COLOUR[m.sound.role]}`}>{m.sound.role}</p>
                      <p className="mt-1 text-xs leading-snug text-neutral-400">{m.sound.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-1" aria-label="16-step loop">
                    {decodePattern(m.pattern).map((s, i) => (
                      <span key={i} data-step={i} className={`h-1.5 flex-1 rounded-full ${s.on ? "bg-neutral-400" : "bg-neutral-800"}`} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
