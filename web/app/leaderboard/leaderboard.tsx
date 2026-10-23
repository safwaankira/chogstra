"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { ADDRESSES, chain } from "@/lib/chain";
import { chogImageUrl, loadChogs, type Chog } from "@/lib/chogs";
import { chogSound } from "@/lib/mapping";
import { readAllPerformerIds, readCareers, readMovement, type Career } from "@/lib/reads";
import { ROLE_META } from "../hall/stage";
import { WalletBar } from "../hall/wallet";

type Row = { tokenId: number; career: Career; activeStreak: number };

const BOARDS: { title: string; unit: string; value: (r: Row) => number; note?: string }[] = [
  { title: "Active streak", unit: "movements", value: (r) => r.activeStreak, note: "Counts only if the Chog played this movement or the last one." },
  { title: "Applause", unit: "applause", value: (r) => Number(r.career.applause) },
  { title: "Spotlights", unit: "wins", value: (r) => r.career.spotlights },
  { title: "Performances", unit: "movements", value: (r) => r.career.performances },
];

/** Rankings read straight from the chain: Performed logs for who has played, then careers[] for each. */
export function Leaderboard() {
  const client = usePublicClient() as PublicClient;
  const [chogs, setChogs] = useState<Map<number, Chog> | null>(null);
  useEffect(() => {
    loadChogs().then(setChogs, () => setChogs(new Map()));
  }, []);

  const rows = useQuery({
    queryKey: ["leaderboard"],
    enabled: !!ADDRESSES.chogstra,
    refetchInterval: 15_000,
    queryFn: async () => {
      const [movement, ids] = await Promise.all([readMovement(client), readAllPerformerIds(client)]);
      const careers = await readCareers(client, ids);
      return ids.map((tokenId) => {
        const career = careers.get(tokenId)!;
        const activeStreak = career.lastMovement + 1 >= movement ? career.streak : 0;
        return { tokenId, career, activeStreak } satisfies Row;
      });
    },
  });

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-4 pb-8 pt-3 sm:px-6">
      <nav aria-label="Chogstra" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="font-display text-xl font-black uppercase tracking-[0.22em] text-monad-hi">Chogstra</span>
          <span className="hidden text-xs text-ink-3 sm:inline">Back to the hall</span>
        </Link>
        <WalletBar />
      </nav>
      <header>
        <h1 className="font-display text-[clamp(2.75rem,6.2vw,5.5rem)] font-black uppercase leading-[0.82] text-ink">Leaderboard</h1>
        <p className="mt-2 text-sm text-ink-2">Every Chog that has performed onchain on {chain.name}. Guest Chogs never count.</p>
      </header>

      {!ADDRESSES.chogstra ? (
        <p className="text-ink-2">Chogstra isn&apos;t deployed on {chain.name} yet.</p>
      ) : rows.isError ? (
        <p className="text-bad">Couldn&apos;t read the chain: {rows.error.message.split("\n")[0]}</p>
      ) : !rows.data || !chogs ? (
        <p className="text-ink-2">Reading every performance…</p>
      ) : rows.data.length === 0 ? (
        <p className="text-ink-2">Nobody has performed yet. The first Chog to play tops every board.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BOARDS.map((board) => {
            const ranked = [...rows.data]
              .filter((r) => board.value(r) > 0)
              .sort((a, b) => board.value(b) - board.value(a) || a.tokenId - b.tokenId)
              .slice(0, 10);
            return (
              <section key={board.title} aria-label={board.title} className="rounded-[22px] bg-house-2 p-4">
                <h2 className="font-display text-2xl font-black uppercase tracking-wide text-ink">{board.title}</h2>
                {board.note && <p className="mt-0.5 text-[11px] text-ink-3">{board.note}</p>}
                {ranked.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-3">No entries yet.</p>
                ) : (
                  <ol className="mt-3 space-y-2">
                    {ranked.map((r, i) => {
                      const chog = chogs.get(r.tokenId);
                      const role = chog ? chogSound(r.tokenId, chog.traits).role : null;
                      return (
                        <li key={r.tokenId} className="flex items-center gap-3">
                          <span className="tabular w-5 text-right font-display text-lg font-extrabold text-ink-3">{i + 1}</span>
                          {chog && (
                            // eslint-disable-next-line @next/next/no-img-element -- IPFS portraits
                            <img src={chogImageUrl(chog)} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 rounded-lg bg-house-3 object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{chog?.name ?? `tokenId ${r.tokenId}`}</p>
                            {role && <p className={`text-[11px] uppercase tracking-wider ${ROLE_META[role].text}`}>{ROLE_META[role].label}</p>}
                          </div>
                          <span className="tabular font-display text-xl font-extrabold text-ink">
                            {board.value(r)}
                            <span className="ml-1 font-sans text-[11px] font-normal text-ink-3">{board.unit}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
