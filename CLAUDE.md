# CHOGSTRA — Chogathon 2026

1,969 Chogs, one live onchain song. Your Chog's traits are its instrument; your loop is its part. Every holder writes a 16-step loop onchain for their Chog, and all loops play together as one live song on Monad.

Positioning: lead with the SHARED SONG (many holders, one live piece). Do not lead with "history follows the token" — several other Chogathon entries already do that.

Solo vibecoded build for Chogathon 2026 (14-day sprint). Same repo will be posted to the BuildAnything Showcase.

## Judging (build every screen for these)
- Gate (pass/fail): the Chog NFT must be essential. No Chog = no instrument = no sound.
- Novelty 30, Fun 20, Retention 20, Clarity 15, Execution 15. Bonus: meaningful $CHOG use.

## Hard rules
- LOCAL ONLY. Never add a git remote, push, create a GitHub repo, or deploy anywhere (Vercel etc.) unless I explicitly say so in that session. Git is used locally for history only.
- Always start Monad work with the `monskill` routing skill (Monskills plugin).
- Never fake data. No placeholder arrays, no hardcoded results, no success toast without a real transaction. Judges click everything twice.
- One screen, three states: Spectate (no Chog) → Compose (has Chog) → Result (performed, share card).
- Small, honest commits several times a day. Clear messages. No "final v2".
- Keep scope tight. Do NOT add: chat, marketplace, combat, staking-for-yield, AI agents, PFP maker, swap.
- Ask before adding any new dependency or paid service.

## Addresses (verify on monadscan before use)
- Monad mainnet chain ID 143, RPC https://rpc.monad.xyz
- Monad testnet chain ID 10143, RPC https://testnet-rpc.monad.xyz
- Chog Genesis (ERC-721, 1,969 supply): 0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763
- $CHOG (ERC-20): 0x350035555E10d9AfAF1566AaebfCeD5BA6C27777 — the ONLY $CHOG. Ignore look-alike tokens.
- Pyth Entropy mainnet: 0xD458261E832415CFd3BAE5E416FdF3230ce6F134
- Pyth Entropy testnet: 0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320
- Note: tokenId ≠ display name number (e.g. tokenId 409 is "CHOG #1870"). Always key on tokenId.

## Stack
- Contracts: Foundry, Solidity ^0.8.24, OpenZeppelin.
- Frontend: Next.js (App Router) + TypeScript, wagmi + viem, Tailwind, Tone.js for audio.
- Wallet: Para (email/social) + injected wallets, via Monskills `wallet-integration`.
- Indexing (later, day 8+): Envio HyperIndex via Monskills `indexer`.
- Hosting: Vercel.

## Contract design (Chogstra.sol)
- `perform(tokenId, uint64 pattern)`: caller must own the Chog or be a valid delegate. Writes only `parts[tokenId]` and `careers[tokenId]`. Emits `Performed`.
- No global counters inside `perform` (keeps writes parallel-friendly on Monad). Totals come from the indexer.
- Pattern = 16 steps × 4 bits (1 on/off bit + 3-bit scale degree).
- Movements last 24h. `closeMovement()` is callable by anyone after 24h, requests Pyth Entropy; the callback sets next key/tempo/theme and picks Spotlight Chogs.
- `delegate(tokenId, to, expiry)` lets an owner lend play rights to a friend. Delegation dies if the owner changes. (Nice-to-have; build after the core loop.)
- Primary contract is on MAINNET against the real Chog Genesis. Testnet + MockChog is the backup sandbox.

## Guest mode (judges and non-holders)
- `/guest`: no wallet needed. The visitor gets a temporary Guest Chog (a random real Chog's traits, clearly labelled "Guest") and composes a loop that plays inside the live song in their browser only.
- Guest loops are never written onchain and never appear on leaderboards. The "Perform onchain" button shows "You need a Chog" instead.
- The live song they hear is still the real onchain song, so judges see real data.
- `applaud(tokenId)`: once per address per token per Movement.
- `tip(tokenId, amount)`: $CHOG, 90% to current owner, 10% to the Encore Pot paid to Spotlight Chogs.
- MockChog.sol on testnet only, same tokenIds, for the sandbox.

## Sound design
- Metadata for all 1,969 Chogs is dumped once to `web/data/chogs.json` by `web/scripts/dump-chogs.ts` (trait counts in `web/data/traits-summary.md`). Never fetch metadata from IPFS live in the app. Portrait images still load from an IPFS gateway (Filebase).
- Deterministic trait → sound map in `web/lib/mapping.ts`. All keyword groupings are tables at the top of that file; every Chog gets a complete sound (fallbacks for missing traits).
  - Skin → band role: Pink = melody, Origin = chords, Red/Black = bass, Yellow + rare skins = drums (~28/27/28/16%). Not Base: 94.9% of Chogs are Base "Origin".
  - Base → flavour: Skull = spooky (detuned twin + vibrato), Radioactive = glitch (bit-crush). Form "Skull" is always Base "Skull", so Form isn't mapped separately.
  - Tier → volume and Spotlight weight (1/2/4/8/16); Rare adds an octave layer, Epic a harmony layer, Legendary both.
  - Eyes → pitch range (low/mid/high). Mouth → note shape (short/medium/long; missing = medium).
  - Body → tone colour family (meme, costume, outlaw, mystic, regal, street; missing = "bare", the role's plain default).
  - Head → filter brightness (dark/warm/bright/sparkling). Aura → effect (distortion, echo, chorus, shimmer, phaser; missing or "Clean" = dry).
  - Background → reverb room (small/medium/large/hall). Side → pan left/right. Accessory → bell/chime/glass sparkle layer.
  - The ten 1:1 Legendaries (only Base + Tier traits) get hand-designed signatures in `LEGENDARY_SIGNATURES`.
- Pattern format (`web/lib/music.ts`, same as the contract): step i = bits [4i, 4i+3]; bit 3 on/off, bits 0–2 scale degree 0–7. For drums the degree picks the drum (kick, snare, hat, tom, open hat).
- Every Movement locks notes to one scale (pentatonic/modal) so anything sounds good. `/lab` uses C minor pentatonic at 90 bpm.
- Audio engine in `web/lib/engine.ts` (Tone.js), loaded only after a user tap. Master limiter on output; shared reverb buses per room size.
- `/lab` is the sound test page: Random band (4 Chogs per role, random test loops) and "Hear alone" by token ID. Its loops are random and labelled as not onchain.

## Design
- Use the Impeccable skill (`/impeccable init` creates product.md and design.md).
- Concept: a dark concert stage, spotlights, real Chog portraits pulsing on their notes.
- Anti-references: gradient SaaS heroes, generic cards, emoji headings, lorem ipsum.
- Main Stage fits one viewport, desktop and mobile.

## Local dev
Everything runs on this Mac. Nothing is sent to Monad.
- `scripts/dev-chain.sh`: starts anvil forking Monad mainnet at a fixed block (`FORK_BLOCK`, default 115840000) as chain id 31337 on port 8545, and leaves it running in the background. It then:
  - deploys `MockEntropyV2` (local randomness, dev only) and Chogstra via `contracts/script/Deploy.s.sol`, pointing at the REAL Chog Genesis and $CHOG contracts, with startTime = the fork's current time;
  - uses anvil impersonation to move real Chogs into anvil's test accounts: #0 gets Halo (1667, Legendary), the first Skull and the first Common from `web/data/chogs.json` (61 and 3 at the default block); #1 gets the next Common (4);
  - moves real $CHOG from a large holder (10,000 to #0, 2,000 to #1) for testing tips;
  - writes addresses and tokenIds to `web/.env.local` (`NEXT_PUBLIC_*`) and `contracts/.env.local`, inside a marked block so other lines survive. Both files are gitignored.
- `scripts/dev-chain.sh stop`: stops anvil. Its state and log are in `.dev-chain/` (gitignored).
- `scripts/dev-next-day.sh`: +24h. `--close` also closes the movement that just ended and delivers a random mock Entropy seed. `--spotlight` also resolves its Spotlight.
- `contracts/script/Deploy.s.sol` reads `CHOG_NFT`, `CHOG_TOKEN`, `ENTROPY` and `START_TIME` from the environment. On the fork, send transactions with `cast send --unlocked --from <anvil account>`. Anvil prints its public test keys when it starts.
- Web app: `npm --prefix web run dev`, then open http://localhost:3000. `NEXT_PUBLIC_CHAIN_ID` (31337 local fork, 143 Monad mainnet) picks the chain at build time. The "Dev: Account #0/#1" mock wallets exist only when it is 31337.
- After contract changes, regenerate the web ABI: `(cd contracts && forge build) && node web/scripts/gen-abi.mjs`.
- Anvil runs Ethereum gas rules. Monad charges more for cold storage and account access (see the gas skill), so treat local gas numbers as a lower bound.

## Hosted demo (Monad testnet)
- Live at https://chogstra.vercel.app (Vercel project safwaandks-projects/chogstra, deployed from `web/` with the user's approval). Build env: NEXT_PUBLIC_CHAIN_ID=10143 plus the addresses below.
- Testnet contracts (from `contracts/script/DeployTestnet.s.sol`, block 73571287): Chogstra 0xc1a5423eb0889db0bbb6b93c8201ffdd8cc029d1, MockChog 0xb095539fab7515d308f86baea46b163df388255e (open mint, same tokenIds), mock $CHOG 0x19ba01858cd63875c3d9e4fb483261954a48856a, MockEntropyV2 0x92f863254fd45ed51b7768befa140996c7cd264a. Deployer 0xd1c1D7143C98fD823666b7BA626c900ff7C8f058 holds Chogs 1667, 61, 3, 4 and 10,000 mock $CHOG.
- Daily draws need someone to call `closeMovement` and then `mockReveal` on MockEntropyV2 (Pyth Entropy's testnet address doesn't answer V2 calls).
- The app reads contract state through Multicall3 (no log scans; public RPCs cap eth_getLogs at 100 blocks) and throttles RPC to 10 req/s (public limit is 15/s).

## Build order
1. Contracts + tests on testnet with MockChog.
2. Metadata dump + sound prototype (must sound good before UI work).
3. Wallet + My Chogs + Composer + perform().
4. Stage playing real onchain parts.
5. Entropy movement close, Spotlight.
6. Mainnet deploy, /guest mode, provably fair Spotlight (Pyth Entropy).
7. Indexer, leaderboards, $CHOG tips, share cards.
