"use client";

import { useBlockNumber } from "wagmi";
import { monad, monadTestnet } from "wagmi/chains";

function ChainStatus({ chainId, name }: { chainId: typeof monad.id | typeof monadTestnet.id; name: string }) {
  const { data, isError } = useBlockNumber({ chainId, watch: true });
  return (
    <li>
      {name} ({chainId}): {isError ? "RPC unreachable" : data !== undefined ? `block ${data}` : "connecting…"}
    </li>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-black p-8 font-mono text-sm text-neutral-300">
      <h1 className="mb-4 text-lg text-white">Chogstra</h1>
      <ul className="space-y-1">
        <ChainStatus chainId={monad.id} name={monad.name} />
        <ChainStatus chainId={monadTestnet.id} name={monadTestnet.name} />
      </ul>
    </main>
  );
}
