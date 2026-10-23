// Which chain the app talks to, picked by NEXT_PUBLIC_CHAIN_ID at build time.
//   31337  local Monad mainnet fork from scripts/dev-chain.sh (default for now)
//   143    Monad mainnet (switch on once Chogstra is deployed there)
// Addresses come from NEXT_PUBLIC_* env vars (dev-chain.sh writes web/.env.local).

import { defineChain, getAddress, parseAbi, type Address } from "viem";
import { monad } from "viem/chains";

export const LOCAL_CHAIN_ID = 31337;
export const MAINNET_CHAIN_ID = 143;

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? LOCAL_CHAIN_ID);
if (CHAIN_ID !== LOCAL_CHAIN_ID && CHAIN_ID !== MAINNET_CHAIN_ID) {
  throw new Error(`NEXT_PUBLIC_CHAIN_ID must be ${LOCAL_CHAIN_ID} or ${MAINNET_CHAIN_ID}, got ${process.env.NEXT_PUBLIC_CHAIN_ID}`);
}

/** True only for the local fork. Dev-only UI (mock wallets) must check this. */
export const IS_LOCAL = CHAIN_ID === LOCAL_CHAIN_ID;

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? (IS_LOCAL ? "http://127.0.0.1:8545" : "https://rpc.monad.xyz");
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || undefined;

// Multicall3 is at its canonical address on Monad mainnet, so also on the fork.
const MULTICALL3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const chain = IS_LOCAL
  ? defineChain({
      id: LOCAL_CHAIN_ID,
      name: "Monad fork (local)",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL], ...(WS_URL ? { webSocket: [WS_URL] } : {}) } },
      contracts: { multicall3: { address: MULTICALL3 } },
      testnet: true,
    })
  : defineChain({
      ...monad,
      rpcUrls: { default: { http: [RPC_URL], ...(WS_URL ? { webSocket: [WS_URL] } : {}) } },
      contracts: { ...monad.contracts, multicall3: { address: MULTICALL3 } },
    });

export const RPC = RPC_URL;
export const WS = WS_URL;

/** eth_getLogs block range per request. Monad's public RPC allows 100; anvil has no limit. */
export const LOG_RANGE = BigInt(process.env.NEXT_PUBLIC_LOG_RANGE ?? (IS_LOCAL ? 1_000_000 : 100));

function optionalAddress(value: string | undefined): Address | null {
  if (!value) return null;
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

export const ADDRESSES = {
  chogstra: optionalAddress(process.env.NEXT_PUBLIC_CHOGSTRA_ADDRESS),
  chogNft: optionalAddress(process.env.NEXT_PUBLIC_CHOG_NFT_ADDRESS) ?? getAddress("0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763"),
  chogToken: optionalAddress(process.env.NEXT_PUBLIC_CHOG_TOKEN_ADDRESS) ?? getAddress("0x350035555E10d9AfAF1566AaebfCeD5BA6C27777"),
};
export const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_CHOGSTRA_DEPLOY_BLOCK ?? 0);

/** anvil's public test accounts, local fork only. */
export const DEV_ACCOUNTS = IS_LOCAL
  ? ([optionalAddress(process.env.NEXT_PUBLIC_DEV_ACCOUNT0), optionalAddress(process.env.NEXT_PUBLIC_DEV_ACCOUNT1)].filter(Boolean) as Address[])
  : [];

export const erc721Abi = parseAbi(["function ownerOf(uint256 tokenId) view returns (address)"]);
export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
