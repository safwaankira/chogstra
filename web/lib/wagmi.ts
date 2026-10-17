import { createConfig, http } from "wagmi";
import { monad, monadTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [monad, monadTestnet],
  connectors: [injected()],
  transports: {
    [monad.id]: http("https://rpc.monad.xyz"),
    [monadTestnet.id]: http("https://testnet-rpc.monad.xyz"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
