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
            className={`h-8 rounded-full px-4 text-xs font-semibold transition active:scale-95 ${c.id.startsWith("dev-") ? "text-warn/90 ring-1 ring-inset ring-warn/30 hover:bg-warn/10" : "bg-monad-deep text-white hover:bg-monad"}`}
          >
            {c.id === "injected" ? "Connect wallet" : c.name}
          </button>
        ))}
        {error && <span className="text-xs text-bad">{error.message.split("\n")[0]}</span>}
      </div>
    );
  }

  return (
    <div className="flex min-h-[30px] flex-wrap items-center gap-x-3 gap-y-1 rounded-full bg-house-2 py-1 pl-3 pr-1.5 text-xs">
      <span className="font-mono text-ink">{short(address)}</span>
      {IS_LOCAL && connector?.id.startsWith("dev-") && <span className="text-warn">{connector.name}</span>}
      {balance.data && (
        <span className="text-ink-3">
          <span className="tabular font-mono text-ink-2">{Number(formatUnits(balance.data.balance, 18)).toLocaleString()}</span> $CHOG
        </span>
      )}
      {chainId !== chain.id && (
        <button onClick={() => switchChain({ chainId: chain.id })} className="rounded-full bg-bad/15 px-3 py-1 font-semibold text-bad">
          Switch to {chain.name}
        </button>
      )}
      <button onClick={() => disconnect()} className="rounded-full px-2.5 py-1 text-ink-3 transition hover:bg-house-3 hover:text-ink">
        Disconnect
      </button>
    </div>
  );
}
