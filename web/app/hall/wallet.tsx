"use client";

import { useSyncExternalStore } from "react";
import { formatUnits } from "viem";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { IS_LOCAL, chain } from "@/lib/chain";
import { useChogBalance } from "./useHall";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const noSubscribe = () => () => {};

/** false during SSR and the hydration render, true afterwards on the client. */
function useMounted() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Wallet extensions announce themselves (EIP-6963) only in the browser, and the
 * connection is restored only on the client, so the server can't know what this
 * bar shows. Render it after mount; until then, a same-height placeholder.
 */
export function WalletBar() {
  const mounted = useMounted();
  if (!mounted) return <div aria-hidden className="h-[30px] w-72 max-w-full" />;
  return <WalletBarClient />;
}

function WalletBarClient() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const balance = useChogBalance(address);

  // The same wallet can show up twice: the generic injected connector (window.ethereum)
  // next to the wallet's own EIP-6963 entry, or two announcements with the same name.
  // When any wallet announced itself by name, drop the generic one; then dedupe by name.
  const announced = connectors.some((c) => c.type === "injected" && c.id !== "injected");
  const seen = new Set<string>();
  const unique = connectors.filter((c) => {
    if (announced && c.id === "injected") return false;
    const label = c.id === "injected" ? "Connect wallet" : c.name;
    if (seen.has(label.toLowerCase())) return false;
    seen.add(label.toLowerCase());
    return true;
  });

  if (!isConnected || !address) {
    return (
      <div className="flex min-h-[30px] flex-wrap items-center gap-2">
        {unique.map((c) => (
          <button
            key={c.uid}
            onClick={() => connect({ connector: c })}
            disabled={isPending}
            className={`rounded-full border px-4 py-1.5 font-mono text-xs ${c.id.startsWith("dev-") ? "border-amber-700 text-amber-300 hover:border-amber-400" : "border-neutral-600 hover:border-white"}`}
          >
            {c.id === "injected" ? "Connect wallet" : c.name}
          </button>
        ))}
        {error && <span className="font-mono text-xs text-rose-400">{error.message.split("\n")[0]}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
      <span className="text-neutral-300">{short(address)}</span>
      {IS_LOCAL && connector?.id.startsWith("dev-") && <span className="text-amber-300">{connector.name}</span>}
      {balance.data && <span className="text-neutral-400">{Number(formatUnits(balance.data.balance, 18)).toLocaleString()} $CHOG</span>}
      {chainId !== chain.id && (
        <button onClick={() => switchChain({ chainId: chain.id })} className="rounded-full border border-rose-500 px-3 py-1 text-rose-300">
          Switch to {chain.name}
        </button>
      )}
      <button onClick={() => disconnect()} className="text-neutral-500 hover:text-white">
        Disconnect
      </button>
    </div>
  );
}
