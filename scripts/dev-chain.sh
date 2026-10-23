#!/usr/bin/env bash
# Local Chogstra dev chain: an anvil fork of Monad mainnet, on this Mac only.
#
#   scripts/dev-chain.sh          start the fork, deploy, hand out Chogs and $CHOG
#   scripts/dev-chain.sh stop     stop the fork
#
# Uses the REAL Chog Genesis and $CHOG contracts (as they were at FORK_BLOCK),
# a MockEntropyV2 for randomness (dev only; real Pyth Entropy on mainnet later),
# and anvil impersonation to move real Chogs into anvil's test accounts.
# Nothing is sent to Monad: every transaction happens inside the local fork.
#
# Env overrides: FORK_BLOCK, PORT, CHOG_WHALE, ENTROPY_FEE_WEI.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="$ROOT/.dev-chain"
PID_FILE="$STATE_DIR/anvil.pid"
LOG_FILE="$STATE_DIR/anvil.log"

MONAD_RPC="https://rpc.monad.xyz"
FORK_BLOCK="${FORK_BLOCK:-115840000}" # fixed so every run starts from the same state
PORT="${PORT:-8545}"
RPC="http://127.0.0.1:$PORT"
CHAIN_ID=31337

# Real mainnet contracts (CLAUDE.md "Addresses").
CHOG_NFT="0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763"
CHOG_TOKEN="0x350035555E10d9AfAF1566AaebfCeD5BA6C27777"
# Largest $CHOG balance found among recent transfers (a contract; fine to impersonate on a fork).
CHOG_WHALE="${CHOG_WHALE:-0x52ed909a2d775679a91316bcd2bcbac13c215992}"
ENTROPY_FEE_WEI="${ENTROPY_FEE_WEI:-10000000000000000}" # 0.01 MON, mimics a real fee

# anvil's default test accounts (public, test-only keys printed by anvil).
ACCOUNT0="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
ACCOUNT1="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

HALO=1667
CHOG_TO_ACCOUNT0_WEI="10000000000000000000000" # 10,000 $CHOG
CHOG_TO_ACCOUNT1_WEI="2000000000000000000000"  #  2,000 $CHOG

say() { printf '\033[1m%s\033[0m\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

stop_chain() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    kill "$(cat "$PID_FILE")"
    say "Stopped anvil (pid $(cat "$PID_FILE"))."
  else
    say "No dev chain running."
  fi
  rm -f "$PID_FILE"
}

if [[ "${1:-}" == "stop" ]]; then
  stop_chain
  exit 0
fi

for bin in anvil cast forge node; do
  command -v "$bin" >/dev/null || die "$bin not found"
done

mkdir -p "$STATE_DIR"
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  die "a dev chain is already running (pid $(cat "$PID_FILE")). Run: scripts/dev-chain.sh stop"
fi
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  die "port $PORT is already in use"
fi

# --- 1. Start the fork ------------------------------------------------------
say "Starting anvil: Monad mainnet fork at block $FORK_BLOCK, chain id $CHAIN_ID, port $PORT"
anvil --fork-url "$MONAD_RPC" --fork-block-number "$FORK_BLOCK" --chain-id "$CHAIN_ID" \
  --port "$PORT" --silent >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
# If any later step fails, don't leave a half-set-up chain running.
trap 'echo "setup failed; stopping anvil" >&2; stop_chain' ERR

for _ in $(seq 1 60); do
  cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 && break
  kill -0 "$(cat "$PID_FILE")" 2>/dev/null || { cat "$LOG_FILE"; die "anvil exited"; }
  sleep 0.5
done
[[ "$(cast chain-id --rpc-url "$RPC" 2>/dev/null)" == "$CHAIN_ID" ]] || die "anvil did not come up (see $LOG_FILE)"

send() { cast send --rpc-url "$RPC" --unlocked "$@" >/dev/null; }

# --- 2. MockEntropyV2 + Chogstra ---------------------------------------------
cd "$ROOT/contracts"
say "Deploying MockEntropyV2 (fee $ENTROPY_FEE_WEI wei)"
forge build --quiet
ENTROPY=$(forge create test/mocks/MockEntropyV2.sol:MockEntropyV2 --rpc-url "$RPC" --unlocked \
  --from "$ACCOUNT0" --broadcast --json --constructor-args "$ENTROPY_FEE_WEI" |
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).deployedTo))')

START_TIME=$(cast block latest -f timestamp --rpc-url "$RPC")
say "Deploying Chogstra (startTime $START_TIME)"
CHOG_NFT="$CHOG_NFT" CHOG_TOKEN="$CHOG_TOKEN" ENTROPY="$ENTROPY" START_TIME="$START_TIME" \
  forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC" --broadcast --unlocked --sender "$ACCOUNT0" >"$STATE_DIR/deploy.log" 2>&1 ||
  { cat "$STATE_DIR/deploy.log"; die "deploy failed"; }
RUN_JSON="$ROOT/contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json"
CHOGSTRA=$(node -e 'const r=require(process.argv[1]);console.log(r.transactions.find(t=>t.contractName==="Chogstra").contractAddress)' "$RUN_JSON")
DEPLOY_BLOCK=$(node -e 'const r=require(process.argv[1]);console.log(Number(r.receipts[0].blockNumber))' "$RUN_JSON")
cd "$ROOT"

# --- 3. Real Chogs into the test accounts -------------------------------------
owner_of() { cast call "$CHOG_NFT" "ownerOf(uint256)(address)" "$1" --rpc-url "$RPC"; }

give_chog() { # tokenId to
  local id=$1 to=$2 owner
  owner=$(owner_of "$id")
  if [[ "$(echo "$owner" | tr A-F a-f)" == "$(echo "$to" | tr A-F a-f)" ]]; then return; fi
  cast rpc anvil_impersonateAccount "$owner" --rpc-url "$RPC" >/dev/null
  cast rpc anvil_setBalance "$owner" 0x8AC7230489E80000 --rpc-url "$RPC" >/dev/null # 10 MON for gas
  send --from "$owner" "$CHOG_NFT" "transferFrom(address,address,uint256)" "$owner" "$to" "$id"
  cast rpc anvil_stopImpersonatingAccount "$owner" --rpc-url "$RPC" >/dev/null
  echo "  tokenId $id  $owner -> $to"
}

# Candidates from the metadata dump, in tokenId order.
read -r -a SKULLS <<<"$(node -e 'console.log(require(process.argv[1]).filter(c=>c.traits.Base==="Skull").map(c=>c.tokenId).join(" "))' "$ROOT/web/data/chogs.json")"
read -r -a COMMONS <<<"$(node -e 'console.log(require(process.argv[1]).filter(c=>c.traits.Tier==="Common"&&c.traits.Base==="Origin").map(c=>c.tokenId).join(" "))' "$ROOT/web/data/chogs.json")"

first_movable() { # first tokenId whose owner lookup works, skipping any given as later args
  local skip=" ${*:2} "
  for id in $1; do
    [[ "$skip" == *" $id "* ]] && continue
    owner_of "$id" >/dev/null 2>&1 && { echo "$id"; return; }
  done
  die "no movable Chog found"
}

SKULL=$(first_movable "${SKULLS[*]}")
COMMON=$(first_movable "${COMMONS[*]}")
COMMON1=$(first_movable "${COMMONS[*]}" "$COMMON")

say "Moving real Chogs (impersonating their current owners on the fork)"
give_chog "$HALO" "$ACCOUNT0"
give_chog "$SKULL" "$ACCOUNT0"
give_chog "$COMMON" "$ACCOUNT0"
give_chog "$COMMON1" "$ACCOUNT1"

# --- 4. Real $CHOG into the test accounts -------------------------------------
say "Moving \$CHOG from $CHOG_WHALE"
cast rpc anvil_impersonateAccount "$CHOG_WHALE" --rpc-url "$RPC" >/dev/null
cast rpc anvil_setBalance "$CHOG_WHALE" 0x8AC7230489E80000 --rpc-url "$RPC" >/dev/null
send --from "$CHOG_WHALE" "$CHOG_TOKEN" "transfer(address,uint256)" "$ACCOUNT0" "$CHOG_TO_ACCOUNT0_WEI"
send --from "$CHOG_WHALE" "$CHOG_TOKEN" "transfer(address,uint256)" "$ACCOUNT1" "$CHOG_TO_ACCOUNT1_WEI"
cast rpc anvil_stopImpersonatingAccount "$CHOG_WHALE" --rpc-url "$RPC" >/dev/null

# --- 4b. Warm the fork's cache of Chog owners (makes the app's first ownership scan fast) ---
say "Caching all 1,969 Chog owners in the fork (one-time, from Monad's RPC)"
(cd "$ROOT/web" && node scripts/warm-fork.mjs "$RPC" "$CHOG_NFT")

# --- 5. Check and write env files ----------------------------------------------
lower() { echo "$1" | tr A-F a-f; }
for id in "$HALO" "$SKULL" "$COMMON"; do
  [[ "$(lower "$(owner_of "$id")")" == "$(lower "$ACCOUNT0")" ]] || die "account #0 does not own tokenId $id"
done
[[ "$(lower "$(owner_of "$COMMON1")")" == "$(lower "$ACCOUNT1")" ]] || die "account #1 does not own tokenId $COMMON1"
BAL0=$(cast call "$CHOG_TOKEN" "balanceOf(address)(uint256)" "$ACCOUNT0" --rpc-url "$RPC" | awk '{print $1}')
BAL1=$(cast call "$CHOG_TOKEN" "balanceOf(address)(uint256)" "$ACCOUNT1" --rpc-url "$RPC" | awk '{print $1}')

# Replaces only the block between the markers, so other lines in the file survive.
write_env_block() { # file, block
  local file=$1 block=$2 begin="# >>> dev-chain.sh (generated, do not edit)" end="# <<< dev-chain.sh"
  touch "$file"
  awk -v b="$begin" -v e="$end" '$0==b{skip=1} !skip{print} $0==e{skip=0}' "$file" >"$file.tmp"
  { cat "$file.tmp"; echo "$begin"; echo "$block"; echo "$end"; } >"$file"
  rm "$file.tmp"
}

write_env_block "$ROOT/web/.env.local" "NEXT_PUBLIC_CHAIN_ID=$CHAIN_ID
NEXT_PUBLIC_RPC_URL=$RPC
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:$PORT
NEXT_PUBLIC_CHOGSTRA_ADDRESS=$CHOGSTRA
NEXT_PUBLIC_CHOGSTRA_DEPLOY_BLOCK=$DEPLOY_BLOCK
NEXT_PUBLIC_ENTROPY_ADDRESS=$ENTROPY
NEXT_PUBLIC_CHOG_NFT_ADDRESS=$CHOG_NFT
NEXT_PUBLIC_CHOG_TOKEN_ADDRESS=$CHOG_TOKEN
NEXT_PUBLIC_DEV_ACCOUNT0=$ACCOUNT0
NEXT_PUBLIC_DEV_ACCOUNT0_TOKEN_IDS=$HALO,$SKULL,$COMMON
NEXT_PUBLIC_DEV_ACCOUNT1=$ACCOUNT1
NEXT_PUBLIC_DEV_ACCOUNT1_TOKEN_IDS=$COMMON1"

write_env_block "$ROOT/contracts/.env.local" "RPC_URL=$RPC
CHAIN_ID=$CHAIN_ID
FORK_BLOCK=$FORK_BLOCK
START_TIME=$START_TIME
CHOGSTRA=$CHOGSTRA
CHOGSTRA_DEPLOY_BLOCK=$DEPLOY_BLOCK
ENTROPY=$ENTROPY
CHOG_NFT=$CHOG_NFT
CHOG_TOKEN=$CHOG_TOKEN
ACCOUNT0=$ACCOUNT0
ACCOUNT0_TOKEN_IDS=$HALO,$SKULL,$COMMON
ACCOUNT1=$ACCOUNT1
ACCOUNT1_TOKEN_IDS=$COMMON1"

trap - ERR

# --- 6. Summary ---------------------------------------------------------------
cat <<EOF

────────────────────────────────────────────────────────────────
 Chogstra dev chain is running (local only, nothing sent to Monad)
────────────────────────────────────────────────────────────────
 RPC            $RPC   (chain id $CHAIN_ID)
 Forked from    Monad mainnet block $FORK_BLOCK
 Chogstra       $CHOGSTRA   (deployed in block $DEPLOY_BLOCK)
 MockEntropyV2  $ENTROPY   (fee $(cast from-wei "$ENTROPY_FEE_WEI") MON)
 Chog Genesis   $CHOG_NFT   (real, forked)
 \$CHOG          $CHOG_TOKEN   (real, forked)
 Movement 0     started at $START_TIME

 Account #0     $ACCOUNT0
   Chogs        $HALO (Halo, Legendary), $SKULL (Skull), $COMMON (Common)
   \$CHOG        $(cast from-wei "$BAL0")
 Account #1     $ACCOUNT1
   Chogs        $COMMON1 (Common)
   \$CHOG        $(cast from-wei "$BAL1")
 (Private keys for these anvil test accounts: run \`anvil\` and read its banner.)

 Wrote web/.env.local and contracts/.env.local
 Next day:      scripts/dev-next-day.sh [--close] [--spotlight]
 Stop:          scripts/dev-chain.sh stop
 Log:           .dev-chain/anvil.log
────────────────────────────────────────────────────────────────
EOF
