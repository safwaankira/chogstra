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
- Dump all 1,969 tokenURI JSONs once to /data/chogs.json. Never fetch IPFS live in the app.
- Deterministic trait → sound map in `lib/mapping.ts`:
  Body → instrument family, Eyes → octave/range, Mouth → timbre, Aura → effect, Background → pan/room, Tier → volume/solo eligibility.
- Every Movement locks notes to one scale (pentatonic/modal) so anything sounds good.
- Master limiter on output. Audio only starts after a user tap.

## Design
- Use the Impeccable skill (`/impeccable init` creates product.md and design.md).
- Concept: a dark concert stage, spotlights, real Chog portraits pulsing on their notes.
- Anti-references: gradient SaaS heroes, generic cards, emoji headings, lorem ipsum.
- Main Stage fits one viewport, desktop and mobile.

## Build order
1. Contracts + tests on testnet with MockChog.
2. Metadata dump + sound prototype (must sound good before UI work).
3. Wallet + My Chogs + Composer + perform().
4. Stage playing real onchain parts.
5. Entropy movement close, Spotlight.
6. Mainnet deploy, /guest mode, provably fair Spotlight (Pyth Entropy).
7. Indexer, leaderboards, $CHOG tips, share cards.
