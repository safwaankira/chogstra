"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPublicClient, http, webSocket, type Address, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { chogstraAbi } from "@/lib/abi/chogstra";
import { ADDRESSES, RPC, WS, chain } from "@/lib/chain";
import {
  findOwnedChogs,
  readApplauded,
  readCareers,
  readChogAllowance,
  readChogBalance,
  readDelegation,
  readLentToMe,
  readClock,
  readEncorePot,
  readMovement,
  readOwners,
  readParts,
  readPerformerIds,
  readSetting,
  readSpotlightIds,
  type OnchainPart,
} from "@/lib/reads";

export type FeedItem = { id: string; tokenId: number; movement: number; kind: "joined" | "rewrote"; at: number };

const FEED_LENGTH = 6;

/** The live hall: current movement, its setting, its performers' parts, Spotlight, pot. */
export function useHall() {
  const client = usePublicClient() as PublicClient;
  const qc = useQueryClient();
  const deployed = !!ADDRESSES.chogstra;
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const movementQ = useQuery({
    queryKey: ["movement"],
    queryFn: () => readMovement(client),
    enabled: deployed,
    refetchInterval: 3000,
  });
  const movement = movementQ.data;
  const ready = movement !== undefined;

  const settingQ = useQuery({
    queryKey: ["setting", movement],
    queryFn: () => readSetting(client, movement!),
    enabled: ready,
    refetchInterval: (q) => (q.state.data?.waiting ? 3000 : false),
  });

  const partsQ = useQuery({
    queryKey: ["parts", movement],
    queryFn: async () => {
      const fetched = await readParts(client, await readPerformerIds(client, movement!));
      // Keep anything the live watcher added while this was loading.
      const live = qc.getQueryData<Map<number, OnchainPart>>(["parts", movement]);
      for (const [id, p] of live ?? []) {
        if ((fetched.get(id)?.updatedBlock ?? -1) < p.updatedBlock) fetched.set(id, p);
      }
      return fetched;
    },
    enabled: ready,
  });

  // Spotlight Chogs come from the previous movement's draw and play their latest onchain part.
  const spotlightQ = useQuery({
    queryKey: ["spotlights", movement],
    queryFn: async () => {
      const ids = await readSpotlightIds(client, movement! - 1);
      return { ids, parts: await readParts(client, ids) };
    },
    enabled: ready,
  });

  const potQ = useQuery({
    queryKey: ["pot", movement],
    queryFn: () => readEncorePot(client, movement!),
    enabled: ready,
  });

  // Live events. WebSocket subscription when NEXT_PUBLIC_WS_URL is set, else 1s polling.
  const movementRef = useRef(movement);
  useEffect(() => {
    movementRef.current = movement;
  }, [movement]);

  useEffect(() => {
    if (!ADDRESSES.chogstra) return;
    const watcher = createPublicClient({ chain, transport: WS ? webSocket(WS) : http(RPC), pollingInterval: 1000 });
    const unwatch = watcher.watchContractEvent({
      address: ADDRESSES.chogstra,
      abi: chogstraAbi,
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.eventName === "Performed") {
            const { tokenId, movement: m, pattern } = log.args;
            if (tokenId === undefined || m === undefined || pattern === undefined) continue;
            const id = Number(tokenId);
            const key = ["parts", m];
            const before = qc.getQueryData<Map<number, OnchainPart>>(key);
            const kind = before?.has(id) ? "rewrote" : "joined";
            qc.setQueryData<Map<number, OnchainPart>>(key, (old) => {
              const next = new Map(old ?? []);
              next.set(id, { tokenId: id, pattern, movement: m, updatedBlock: Number(log.blockNumber) });
              return next;
            });
            if (m === movementRef.current) {
              const item: FeedItem = { id: `${log.transactionHash}-${log.logIndex}`, tokenId: id, movement: m, kind, at: Date.now() };
              setFeed((f) => [item, ...f].slice(0, FEED_LENGTH));
            }
            qc.invalidateQueries({ queryKey: ["careers"] });
            qc.invalidateQueries({ queryKey: ["owned-parts"] });
          } else if (log.eventName === "Applauded") {
            qc.invalidateQueries({ queryKey: ["careers"] });
            qc.invalidateQueries({ queryKey: ["applauded"] });
          } else if (log.eventName === "Tipped") {
            qc.invalidateQueries({ queryKey: ["pot"] });
            qc.invalidateQueries({ queryKey: ["chog-balance"] });
          } else {
            // MovementClosed / MovementSeeded / Spotlighted / SpotlightResolved / delegation
            qc.invalidateQueries({ queryKey: ["setting"] });
            qc.invalidateQueries({ queryKey: ["spotlights"] });
            qc.invalidateQueries({ queryKey: ["pot"] });
            qc.invalidateQueries({ queryKey: ["careers"] });
            qc.invalidateQueries({ queryKey: ["delegation"] });
            qc.invalidateQueries({ queryKey: ["lent"] });
          }
        }
      },
    });
    return unwatch;
  }, [qc]);

  return { deployed, movementQ, movement, settingQ, partsQ, spotlightQ, potQ, feed: feed.filter((f) => f.movement === movement) };
}

/**
 * Seconds until the next movement, by the chain's clock. The latest block's
 * timestamp is re-read every 15s and advanced locally in between.
 */
export function useNextMovementIn(movement: number | undefined) {
  const client = usePublicClient() as PublicClient;
  const clock = useQuery({
    queryKey: ["clock", movement],
    queryFn: async () => ({ ...(await readClock(client)), fetchedAt: Date.now() }),
    enabled: movement !== undefined && !!ADDRESSES.chogstra,
    refetchInterval: 15_000,
  });
  // Wall time is read only in timer callbacks, never during render (prerender-safe).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  if (!clock.data || movement === undefined || now === null) return null;
  const chainNow = clock.data.chainTime + Math.max(0, (now - clock.data.fetchedAt) / 1000);
  const nextStart = clock.data.startTime + (movement + 1) * 86_400;
  return Math.max(0, Math.round(nextStart - chainNow));
}

/** Which tokenIds a wallet holds, found with a Multicall3 ownerOf sweep. Cached for the session. */
export function useOwnedChogs(address: Address | undefined) {
  const client = usePublicClient() as PublicClient;
  const [progress, setProgress] = useState(0);
  const query = useQuery({
    queryKey: ["owned", chain.id, address],
    queryFn: () => findOwnedChogs(client, address!, setProgress),
    enabled: !!address,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return { ...query, progress };
}

/** Owners, careers and (for a connected fan) applause state for the Chogs on stage. */
export function useStageDetails(ids: number[], movement: number | undefined, fan: Address | undefined) {
  const client = usePublicClient() as PublicClient;
  const key = [...ids].sort((a, b) => a - b).join(",");
  const owners = useQuery({ queryKey: ["owners", key], queryFn: () => readOwners(client, ids), enabled: ids.length > 0, staleTime: 30_000 });
  const careers = useQuery({ queryKey: ["careers", key], queryFn: () => readCareers(client, ids), enabled: ids.length > 0 });
  const applauded = useQuery({
    queryKey: ["applauded", movement, key, fan],
    queryFn: () => readApplauded(client, movement!, ids, fan!),
    enabled: ids.length > 0 && movement !== undefined && !!fan,
  });
  return { owners: owners.data, careers: careers.data, applauded: applauded.data };
}

/** Chogs other holders have lent to this wallet. */
export function useLentChogs(address: Address | undefined) {
  const client = usePublicClient() as PublicClient;
  return useQuery({ queryKey: ["lent", address], queryFn: () => readLentToMe(client, address!), enabled: !!address && !!ADDRESSES.chogstra });
}

/** A Chog's current delegation plus the chain's clock, to tell whether it is still live. */
export function useDelegation(tokenId: number) {
  const client = usePublicClient() as PublicClient;
  return useQuery({
    queryKey: ["delegation", tokenId],
    queryFn: async () => ({ delegation: await readDelegation(client, tokenId), clock: await readClock(client) }),
  });
}

/** Latest onchain part (any movement) for each of the wallet's Chogs. */
export function useOwnedParts(ids: number[] | undefined) {
  const client = usePublicClient() as PublicClient;
  return useQuery({
    queryKey: ["owned-parts", ids?.join(",")],
    queryFn: () => readParts(client, ids!),
    enabled: !!ids && ids.length > 0,
  });
}

export function useChogBalance(address: Address | undefined) {
  const client = usePublicClient() as PublicClient;
  return useQuery({
    queryKey: ["chog-balance", address],
    queryFn: async () => ({ balance: await readChogBalance(client, address!), allowance: await readChogAllowance(client, address!) }),
    enabled: !!address && !!ADDRESSES.chogstra,
  });
}
