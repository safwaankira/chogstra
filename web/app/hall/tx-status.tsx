import type { TxState } from "@/lib/useTx";

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

export function TxStatus({ state, verb }: { state: TxState; verb: string }) {
  switch (state.status) {
    case "idle":
      return null;
    case "estimating":
      return <p className="text-xs text-ink-3">Estimating gas…</p>;
    case "signing":
      return <p className="text-xs text-ink-2">Confirm {verb} in your wallet…</p>;
    case "pending":
      return (
        <p className="text-xs text-warn">
          Pending <span className="font-mono">{short(state.hash)}</span>
        </p>
      );
    case "confirmed":
      return (
        <p className="text-xs text-ok">
          Confirmed in block <span className="tabular font-mono">{state.blockNumber.toString()}</span> · <span className="font-mono">{short(state.hash)}</span>
        </p>
      );
    case "error":
      return (
        <p className="text-xs text-bad">
          {state.message}
          {state.hash ? (
            <>
              {" "}
              · <span className="font-mono">{short(state.hash)}</span>
            </>
          ) : null}
        </p>
      );
  }
}
