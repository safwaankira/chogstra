"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { ADDRESSES, IS_LOCAL, IS_TESTNET, chain } from "@/lib/chain";
import { chogImageUrl, loadChogs, type Chog } from "@/lib/chogs";
import { KEY_NAMES, MOODS, type Setting } from "@/lib/music";
import { readDrawProof, readMovement } from "@/lib/reads";
import { WalletBar } from "../hall/wallet";

const MOCK_ENTROPY = IS_LOCAL || IS_TESTNET;
const EXPLORER = chain.blockExplorers?.default.url;

const settingText = (s: Setting) => `${KEY_NAMES[s.keyIndex]} ${MOODS[s.moodIndex]?.scale ?? "?"} · ${s.tempo} bpm · ${MOODS[s.moodIndex]?.name ?? "?"}`;

/** Re-runs a Movement's draw in the browser from the seed stored in Chogstra. */
export function Fairness() {
  const client = usePublicClient() as PublicClient;
  const [chogs, setChogs] = useState<Map<number, Chog> | null>(null);
  useEffect(() => {
    loadChogs().then(setChogs, () => setChogs(new Map()));
  }, []);

  const current = useQuery({ queryKey: ["movement"], queryFn: () => readMovement(client), enabled: !!ADDRESSES.chogstra });
  const [picked, setPicked] = useState<number | null>(null);
  const movement = picked ?? (current.data !== undefined ? Math.max(current.data - 1, 0) : null);
  const proof = useQuery({
    queryKey: ["draw-proof", movement],
    queryFn: () => readDrawProof(client, movement!),
    enabled: movement !== null && !!ADDRESSES.chogstra,
  });
  const name = (id: number) => chogs?.get(id)?.name ?? `tokenId ${id}`;
  const p = proof.data;

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-4 pb-10 pt-3 sm:px-6">
      <nav aria-label="Chogstra" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="font-display text-xl font-black uppercase tracking-[0.22em] text-monad-hi">Chogstra</span>
          <span className="hidden text-xs text-ink-3 sm:inline">Back to the hall</span>
        </Link>
        <WalletBar />
      </nav>
      <header className="max-w-3xl">
        <h1 className="font-display text-[clamp(2.75rem,6.2vw,5.5rem)] font-black uppercase leading-[0.82] text-ink">Fair draw</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          When a Movement closes, one random seed sets the next Movement&apos;s key, tempo and mood, and picks up to three Spotlight Chogs from those that
          performed. This page reads that seed from the contract and reruns the contract&apos;s own math in your browser, so you can check every result.
        </p>
      </header>

      {!ADDRESSES.chogstra ? (
        <p className="text-ink-2">Chogstra isn&apos;t deployed on {chain.name} yet.</p>
      ) : current.isError ? (
        <p className="text-bad">Couldn&apos;t read the chain: {current.error.message.split("\n")[0]}</p>
      ) : current.data === undefined || movement === null ? (
        <p className="text-ink-2">Reading the current Movement…</p>
      ) : current.data === 0 ? (
        <p className="text-ink-2">Movement 0 is still playing. Its draw happens once it ends, then it shows up here.</p>
      ) : (
        <>
          <label className="flex items-center gap-3 text-sm text-ink-2">
            Movement
            <select
              value={movement}
              onChange={(e) => setPicked(Number(e.target.value))}
              className="tabular h-9 rounded-full bg-house-3 px-3 text-ink focus-visible:outline-2 focus-visible:outline-monad-hi"
            >
              {Array.from({ length: current.data }, (_, i) => current.data! - 1 - i).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          {proof.isError ? (
            <p className="text-bad">Couldn&apos;t read the draw: {proof.error.message.split("\n")[0]}</p>
          ) : !p ? (
            <p className="text-ink-2">Reading Movement {movement}&apos;s seed and every Chog&apos;s performance…</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <section aria-labelledby="seed-heading" className="rounded-[22px] bg-house-2 p-5">
                <h2 id="seed-heading" className="font-display text-2xl font-black uppercase tracking-wide text-ink">
                  1 · The seed
                </h2>
                <ol className="mt-3 space-y-1.5 text-sm">
                  <Check ok={p.closed} label="Movement closed, randomness requested" detail={p.closed ? `Entropy sequence ${p.sequence}` : "Anyone can close it from the hall"} />
                  <Check ok={p.seeded} label="Seed delivered by the entropy contract" />
                  <Check ok={p.resolved} label="Spotlight drawn and Encore Pot paid" />
                </ol>
                {p.seed && (
                  <p className="mt-4 break-all rounded-xl bg-house px-3 py-2 font-mono text-xs text-ink-2">
                    <span className="block font-sans text-[11px] text-ink-3">seeds({p.movement})</span>
                    {p.seed}
                  </p>
                )}
                <p className="mt-3 text-xs text-ink-3">
                  Entropy contract{" "}
                  {EXPLORER ? (
                    <a href={`${EXPLORER}/address/${p.entropy}`} target="_blank" rel="noopener noreferrer" className="font-mono text-ink-2 underline underline-offset-4">
                      {p.entropy.slice(0, 8)}…{p.entropy.slice(-4)}
                    </a>
                  ) : (
                    <span className="font-mono text-ink-2">{p.entropy}</span>
                  )}
                </p>
                {MOCK_ENTROPY && (
                  <p className="mt-3 rounded-xl bg-warn/10 px-3 py-2 text-xs leading-relaxed text-warn">
                    {IS_TESTNET
                      ? "Testnet note: Pyth Entropy's testnet contract doesn't answer V2 requests, so this deployment uses a mock that lets anyone reveal the seed."
                      : "Local dev chain: the seed comes from a mock entropy contract that lets anyone reveal it."}{" "}
                    On mainnet the seed comes from Pyth Entropy and nobody picks it. The math below is the same either way.
                  </p>
                )}
              </section>

              <section aria-labelledby="setting-heading" className="rounded-[22px] bg-house-2 p-5">
                <h2 id="setting-heading" className="font-display text-2xl font-black uppercase tracking-wide text-ink">
                  2 · Movement {p.movement + 1}&apos;s sound
                </h2>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink-3">
                  r = keccak256(abi.encode(seed, &quot;setting&quot;))
                  <br />
                  key = r % 12 · tempo = 80 + (r &gt;&gt; 64) % 31 · mood = (r &gt;&gt; 128) % 4
                </p>
                {p.settingOnchain && p.settingHere ? (
                  <>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div>
                        <dt className="text-[11px] text-ink-3">Contract says (settingFor)</dt>
                        <dd className="text-ink">{settingText(p.settingOnchain)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-ink-3">Your browser computed</dt>
                        <dd className="text-ink">{settingText(p.settingHere)}</dd>
                      </div>
                    </dl>
                    <Verdict
                      ok={
                        p.settingOnchain.keyIndex === p.settingHere.keyIndex &&
                        p.settingOnchain.tempo === p.settingHere.tempo &&
                        p.settingOnchain.moodIndex === p.settingHere.moodIndex
                      }
                    />
                  </>
                ) : (
                  <p className="mt-4 text-sm text-ink-3">Waiting for the seed.</p>
                )}
              </section>

              <section aria-labelledby="spotlight-heading" className="rounded-[22px] bg-house-2 p-5">
                <h2 id="spotlight-heading" className="font-display text-2xl font-black uppercase tracking-wide text-ink">
                  3 · Spotlight
                </h2>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink-3">
                  draw i → keccak256(abi.encode(seed, i)) % 1969 + 1, kept if it performed in Movement {p.movement}, first 3 distinct
                </p>
                {!p.draw ? (
                  <p className="mt-4 text-sm text-ink-3">Waiting for the seed.</p>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-ink-2">
                      <span className="tabular font-semibold text-ink">{p.performers}</span> {p.performers === 1 ? "Chog" : "Chogs"} performed.{" "}
                      <span className="tabular font-semibold text-ink">{p.draw.draws}</span> draws, {p.draw.draws - p.draw.hits.length} landed on Chogs that didn&apos;t
                      play.
                    </p>
                    {!p.resolved && p.draw.winners.length > 0 && (
                      <p className="mt-2 text-xs text-ink-3">Not drawn onchain yet. Parts for a past Movement can&apos;t change, so these are the Chogs it will pick.</p>
                    )}
                    {p.draw.hits.length === 0 ? (
                      <p className="mt-3 text-sm text-ink-3">No draw landed on a performer, so the Encore Pot rolls into the current Movement.</p>
                    ) : (
                      <ol className="mt-3 space-y-2">
                        {p.draw.hits.map((h) => {
                          const chog = chogs?.get(h.tokenId);
                          return (
                            <li key={h.draw} className="flex items-center gap-3">
                              <span className="tabular w-16 shrink-0 font-mono text-[11px] text-ink-3">draw {h.draw}</span>
                              {chog && (
                                // eslint-disable-next-line @next/next/no-img-element -- IPFS portraits
                                <img src={chogImageUrl(chog)} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 rounded-lg bg-house-3 object-cover" />
                              )}
                              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                {name(h.tokenId)} <span className="tabular text-[11px] text-ink-3">· tokenId {h.tokenId}</span>
                              </span>
                              <span className={`text-xs font-semibold ${h.kept ? "text-ok" : "text-ink-3"}`}>{h.kept ? "Spotlight" : "already in"}</span>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
          <p className="max-w-3xl text-xs leading-relaxed text-ink-3">
            Chogstra contract{" "}
            {EXPLORER ? (
              <a href={`${EXPLORER}/address/${ADDRESSES.chogstra}`} target="_blank" rel="noopener noreferrer" className="font-mono text-ink-2 underline underline-offset-4">
                {ADDRESSES.chogstra}
              </a>
            ) : (
              <span className="font-mono text-ink-2">{ADDRESSES.chogstra}</span>
            )}{" "}
            on {chain.name}. The same formulas are in <span className="font-mono">settingFor</span> and <span className="font-mono">resolveSpotlight</span>.
          </p>
        </>
      )}
    </main>
  );
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-ok shadow-[0_1px_6px_var(--ok)]" : "bg-line"}`} />
      <span>
        <span className={ok ? "text-ink" : "text-ink-3"}>
          {label}
          <span className="sr-only">{ok ? ": done" : ": not yet"}</span>
        </span>
        {detail && <span className="block text-[11px] text-ink-3">{detail}</span>}
      </span>
    </li>
  );
}

function Verdict({ ok }: { ok: boolean }) {
  return (
    <p className={`mt-4 rounded-xl px-3 py-2 text-sm font-semibold ${ok ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad"}`}>
      {ok ? "Match: the contract used exactly this seed." : "Mismatch: the contract's setting doesn't follow from this seed."}
    </p>
  );
}
