// Pre-loads every Chog's owner into the local anvil fork, so the app's first
// "Finding your Chogs" scan is instant instead of anvil fetching 1,969 storage
// slots from Monad one by one. Called by scripts/dev-chain.sh.
//   node web/scripts/warm-fork.mjs <rpc-url> <chog-nft-address>

import { createPublicClient, http, parseAbi } from "viem";

const [rpc, nft] = process.argv.slice(2);
const client = createPublicClient({ transport: http(rpc, { timeout: 120_000 }) });
const abi = parseAbi(["function ownerOf(uint256) view returns (address)"]);
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const BATCH = 100;
const PARALLEL = 8;

const batches = [];
for (let start = 1; start <= 1969; start += BATCH) {
  batches.push(Array.from({ length: Math.min(BATCH, 1970 - start) }, (_, i) => BigInt(start + i)));
}
let done = 0;
for (let i = 0; i < batches.length; i += PARALLEL) {
  await Promise.all(
    batches.slice(i, i + PARALLEL).map((ids) =>
      client.multicall({
        multicallAddress: MULTICALL3,
        allowFailure: true,
        contracts: ids.map((id) => ({ address: nft, abi, functionName: "ownerOf", args: [id] })),
      }),
    ),
  );
  done = Math.min(1969, (i + PARALLEL) * BATCH);
  process.stdout.write(`\r  ${done}/1969 owners cached`);
}
process.stdout.write("\n");
