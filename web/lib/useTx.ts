"use client";

// Sends one contract write: estimateGas + at most 10% buffer (Monad charges the
// gas LIMIT, not gas used), then waits for the receipt. Tracks honest states:
// nothing says "confirmed" until a receipt with status success comes back.

import { useCallback, useState } from "react";
import { BaseError, type Abi, type Address, type ContractFunctionArgs, type ContractFunctionName, type Hash } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { chain } from "./chain";

export type TxState =
  | { status: "idle" }
  | { status: "estimating" }
  | { status: "signing" }
  | { status: "pending"; hash: Hash }
  | { status: "confirmed"; hash: Hash; blockNumber: bigint }
  | { status: "error"; message: string; hash?: Hash };

export type WriteRequest<abi extends Abi, fn extends ContractFunctionName<abi, "nonpayable" | "payable">> = {
  address: Address;
  abi: abi;
  functionName: fn;
  args: ContractFunctionArgs<abi, "nonpayable" | "payable", fn>;
  value?: bigint;
};

export function errorMessage(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => (e as { name?: string }).name === "ContractFunctionRevertedError") as
      | (BaseError & { data?: { errorName?: string } })
      | null;
    if (revert?.data?.errorName) return `Reverted: ${revert.data.errorName}`;
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}

export function useTx() {
  const [state, setState] = useState<TxState>({ status: "idle" });
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const send = useCallback(
    async <abi extends Abi, fn extends ContractFunctionName<abi, "nonpayable" | "payable">>(req: WriteRequest<abi, fn>) => {
      if (!address || !walletClient || !publicClient) {
        setState({ status: "error", message: "Connect a wallet first." });
        return null;
      }
      let hash: Hash | undefined;
      try {
        setState({ status: "estimating" });
        // The generic request is passed through as-is; viem checks it at runtime.
        const call = { ...req, account: address } as never;
        const estimate = await publicClient.estimateContractGas(call);
        const gas = estimate + estimate / BigInt(10);
        setState({ status: "signing" });
        hash = await walletClient.writeContract({ ...(call as object), gas, chain } as never);
        setState({ status: "pending", hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Transaction reverted onchain.");
        setState({ status: "confirmed", hash, blockNumber: receipt.blockNumber });
        return receipt;
      } catch (err) {
        setState({ status: "error", message: errorMessage(err), hash });
        return null;
      }
    },
    [address, publicClient, walletClient],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);
  const busy = state.status === "estimating" || state.status === "signing" || state.status === "pending";
  return { state, send, reset, busy };
}
