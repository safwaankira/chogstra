#!/usr/bin/env bash
# Skip the local dev chain forward one day (one Movement).
#
#   scripts/dev-next-day.sh                  +24h only
#   scripts/dev-next-day.sh --close          +24h, close the movement that just ended,
#                                            and deliver a MockEntropy random seed
#   scripts/dev-next-day.sh --close --spotlight   ...and also resolve its Spotlight
#
# Local fork only (needs scripts/dev-chain.sh running). The seed is random from
# this Mac (openssl), standing in for Pyth Entropy.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/contracts/.env.local"
[[ -f "$ENV_FILE" ]] || { echo "error: $ENV_FILE missing. Run scripts/dev-chain.sh first." >&2; exit 1; }
# Plain KEY=value lines only (works with macOS's bash 3.2).
while IFS='=' read -r key value; do
  [[ "$key" =~ ^[A-Z0-9_]+$ ]] && export "$key=$value"
done <"$ENV_FILE"

CLOSE=false
SPOTLIGHT=false
for arg in "$@"; do
  case "$arg" in
    --close) CLOSE=true ;;
    --spotlight) CLOSE=true; SPOTLIGHT=true ;;
    *) echo "usage: $0 [--close] [--spotlight]" >&2; exit 1 ;;
  esac
done

[[ "$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null)" == "31337" ]] || { echo "error: no dev chain at $RPC_URL" >&2; exit 1; }

cast rpc evm_increaseTime 86400 --rpc-url "$RPC_URL" >/dev/null
cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null
MOVEMENT=$(cast call "$CHOGSTRA" "currentMovement()(uint32)" --rpc-url "$RPC_URL")
echo "Skipped 24h. Current movement: $MOVEMENT"

$CLOSE || exit 0
PREV=$((MOVEMENT - 1))

CLOSING=$(cast call "$CHOGSTRA" "closings(uint32)(bool,bool,bool,uint64)" "$PREV" --rpc-url "$RPC_URL")
if [[ "$(echo "$CLOSING" | sed -n 1p)" == "true" ]]; then
  echo "Movement $PREV was already closed."
else
  FEE=$(cast call "$ENTROPY" "getFeeV2()(uint128)" --rpc-url "$RPC_URL" | awk '{print $1}')
  cast send "$CHOGSTRA" "closeMovement(uint32)" "$PREV" --value "$FEE" \
    --from "$ACCOUNT0" --unlocked --rpc-url "$RPC_URL" >/dev/null
  echo "Closed movement $PREV (paid $FEE wei to MockEntropy)."
fi

CLOSING=$(cast call "$CHOGSTRA" "closings(uint32)(bool,bool,bool,uint64)" "$PREV" --rpc-url "$RPC_URL")
if [[ "$(echo "$CLOSING" | sed -n 2p)" == "true" ]]; then
  echo "Movement $PREV already has a seed."
else
  SEQUENCE=$(echo "$CLOSING" | sed -n 4p)
  SEED="0x$(openssl rand -hex 32)"
  cast send "$ENTROPY" "mockReveal(uint64,bytes32)" "$SEQUENCE" "$SEED" \
    --from "$ACCOUNT0" --unlocked --rpc-url "$RPC_URL" >/dev/null
  echo "Seeded movement $PREV: $SEED"
fi

SETTING=$(cast call "$CHOGSTRA" "settingFor(uint32)(uint8,uint8,uint8)" "$MOVEMENT" --rpc-url "$RPC_URL" | tr '\n' ' ')
echo "Movement $MOVEMENT setting (key, tempo, mood): $SETTING"

$SPOTLIGHT || exit 0
cast send "$CHOGSTRA" "resolveSpotlight(uint32)" "$PREV" \
  --from "$ACCOUNT0" --unlocked --rpc-url "$RPC_URL" >/dev/null
echo "Resolved Spotlight for movement $PREV:"
for id in ${ACCOUNT0_TOKEN_IDS//,/ } ${ACCOUNT1_TOKEN_IDS//,/ }; do
  SPOTS=$(cast call "$CHOGSTRA" "careers(uint256)(uint32,uint32,uint32,uint32,uint64)" "$id" --rpc-url "$RPC_URL" | sed -n 4p)
  echo "  tokenId $id spotlights: $SPOTS"
done
echo "  Encore Pot now in movement $MOVEMENT: $(cast call "$CHOGSTRA" "encorePot(uint256)(uint256)" "$MOVEMENT" --rpc-url "$RPC_URL")"
