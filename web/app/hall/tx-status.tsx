import type { TxState } from "@/lib/useTx";

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

export function TxStatus({ state, verb }: { state: TxState; verb: string }) {
  switch (state.status) {
    case "idle":
      return null;
    case "estimating":
      return <p className="font-mono text-xs text-neutral-400">Estimating gas…</p>;
    case "signing":
      return <p className="font-mono text-xs text-neutral-300">Confirm {verb} in your wallet…</p>;
    case "pending":
      return <p className="font-mono text-xs text-amber-300">Pending · {short(state.hash)}</p>;
    case "confirmed":
      return (
        <p className="font-mono text-xs text-lime-300">
          Confirmed in block {state.blockNumber.toString()} · {short(state.hash)}
        </p>
      );
    case "error":
      return (
        <p className="font-mono text-xs text-rose-400">
          {state.message}
          {state.hash ? ` · ${short(state.hash)}` : ""}
        </p>
      );
  }
}
