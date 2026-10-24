# CHOGSTRA

**1,969 Chogs, one live onchain song.**

Every Chog Genesis NFT is an instrument, and its traits decide how it sounds. Its holder writes a 16-step loop for it onchain. Every loop plays together as one song on Monad, which anyone can walk in and hear.

Live demo (Monad testnet): **https://chogstra.vercel.app**

Built solo for Chogathon 2026.

## Try it in two minutes

1. Open the demo and tap **Enter the hall**. You hear every Chog that has performed, playing live.
2. No Chog? Open **Guest mode** (`/guest`). You get a real Chog's traits, labelled Guest, and can write a loop and hear it inside the song. Guest loops stay in your browser and are never written onchain.
3. Holding a Chog (on testnet, a MockChog with the same tokenIds as Chog Genesis): connect a wallet, pick your Chog in **Your console**, light up some steps, and press **Perform onchain**. Your Chog joins the stage playing your part. You can then download a share card or post it on X.
4. Click any Chog on stage to **applaud** it (once per Movement) or **tip** it $CHOG.
5. Open **Fair draw** (`/fairness`) to check the random seed behind any past Movement against the contract.

To get a testnet Chog, call `mint(yourAddress, tokenId)` on MockChog `0xb095539fab7515d308f86baea46b163df388255e` with any free tokenId from 1 to 1969. Mock $CHOG `0x19ba01858cd63875c3d9e4fb483261954a48856a` mints the same way: `mint(to, amount)`.

## How it works

**No Chog, no sound.** Only the holder of a Chog, or someone they lend it to, can write that Chog's part. Without a Chog there is no instrument.

**Traits are the instrument.** `web/lib/mapping.ts` turns traits into sound, the same way every time:

| Trait | Becomes |
| --- | --- |
| Skin | Band role: Pink melody, Origin chords, Red/Black bass, the rest drums |
| Base | Flavour: Skull is spooky (detuned, vibrato), Radioactive is glitchy (bit-crushed) |
| Tier | Volume. Rare adds an octave layer, Epic a harmony layer, Legendary both |
| Eyes / Mouth | Pitch range / note length |
| Body / Head | Tone colour / filter brightness |
| Aura / Background | Effect (echo, chorus, shimmer…) / reverb room size |
| Side / Accessory | Stereo pan / bell, chime or glass sparkle layer |

The ten 1:1 Legendaries get hand-designed signature sounds. The console shows, trait by trait, what each one turned into.

**Movements.** The song runs in 24-hour Movements. When one ends, anyone can close it. Closing requests a random seed from Pyth Entropy, and that one seed:

- sets the next Movement's key, tempo and mood. Every note is locked to that scale, so any loop fits.
- picks up to three **Spotlight Chogs** from those that performed. They split the Movement's **Encore Pot**.

**$CHOG.** Tips are paid in $CHOG: 90% goes to the Chog's current owner and 10% to the Encore Pot.

**Retention.** Each Chog keeps a career onchain: performances, a streak of consecutive Movements, applause and Spotlight wins. The console shows your streak and what you need to do to keep it. `/leaderboard` ranks every Chog that has played.

**Lending.** An owner can lend a Chog's play rights to a friend until a set expiry. The loan ends automatically if the Chog changes hands.

## Fair by construction

Each draw uses only values stored in the contract:

```
settingFor(m + 1): r = keccak256(abi.encode(seed[m], "setting"))
                   key = r % 12, tempo = 80 + (r >> 64) % 31, mood = (r >> 128) % 4
Spotlight(m):      draw i = keccak256(abi.encode(seed[m], i)) % 1969 + 1
                   kept if it performed in m; first 3 distinct; up to 2048 draws
```

`/fairness` reads `seeds(m)` and `performedIn` from the chain and reruns both formulas in your browser. It shows whether the contract's `settingFor` matches, and lists every draw that landed on a performer.

## What's onchain

All game state lives in `contracts/src/Chogstra.sol`; there is no backend server. The app reads the contract directly through Multicall3.

- `perform(tokenId, pattern)`: the loop is one `uint64`: 16 steps × 4 bits (on/off + scale degree). `perform` only writes that Chog's own storage, so performances for different Chogs never conflict on Monad's parallel execution.
- `applaud`, `tip`, `delegate`, `closeMovement`, `resolveSpotlight`.
- Gas limits are set from `estimateGas` plus at most 10%, because Monad charges for the gas limit, not the gas used.

## Honest limits

- **The hosted demo runs on Monad testnet with mocks:** MockChog (open mint, same tokenIds as Chog Genesis), mock $CHOG, and MockEntropyV2. Pyth Entropy's testnet contract doesn't answer V2 requests, so on testnet anyone can reveal a closed Movement's seed. On mainnet the contract points at the real Chog Genesis, real $CHOG and Pyth Entropy, and the seed arrives by Pyth's callback. The mainnet deployment has not happened yet.
- Chog portraits load from IPFS through a public gateway and can be slow the first time.
- The Encore Pot is only as big as the tips that went into it. Nothing is promised beyond that.

## Run it locally

Needs Node 20+ and Foundry.

```bash
scripts/dev-chain.sh            # anvil fork of Monad mainnet + Chogstra, with real Chogs moved to test accounts
npm --prefix web install
npm --prefix web run dev        # http://localhost:3000, use the "Dev: Account #0" wallet
scripts/dev-next-day.sh --close --spotlight   # jump 24h, close the Movement and draw its Spotlight
```

Contract tests: `cd contracts && forge test` (43 tests).

## Layout

- `contracts/`: Chogstra.sol, tests, deploy scripts (Foundry).
- `web/`: Next.js app. `lib/mapping.ts` (traits to sound), `lib/engine.ts` (Tone.js band), `lib/reads.ts` (every chain read), `app/hall/` (the main screen).
- `web/data/chogs.json`: metadata for all 1,969 Chogs, dumped once from the collection, so the app never fetches metadata live.
