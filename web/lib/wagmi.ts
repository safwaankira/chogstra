import { createConfig, createConnector, http } from "wagmi";
import { injected, mock } from "wagmi/connectors";
import type { Address } from "viem";
import { DEV_ACCOUNTS, IS_LOCAL, MAINNET_CHAIN_ID, RPC, chain } from "./chain";

/** One mock wallet per anvil test account. Sends go to anvil, which signs for its unlocked accounts. */
function devAccount(address: Address, index: number) {
  return createConnector((config) => ({
    ...mock({ accounts: [address], features: { reconnect: true } })(config),
    id: `dev-account-${index}`,
    name: `Dev: Account #${index}`,
  }));
}

// Dev wallets exist only on the local fork. Belt and braces: never on mainnet.
const devConnectors = IS_LOCAL && chain.id !== MAINNET_CHAIN_ID ? DEV_ACCOUNTS.map(devAccount) : [];

export const config = createConfig({
  chains: [chain],
  connectors: [injected(), ...devConnectors],
  transports: { [chain.id]: http(RPC) } as Record<typeof chain.id, ReturnType<typeof http>>,
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
