"use client";

import { formatUnits } from "viem";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { IS_LOCAL, chain } from "@/lib/chain";
import { useChogBalance } from "./useHall";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function WalletBar() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const balance = useChogBalance(address);

  if (!isConnected || !address) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {connectors.map((c) => (
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
