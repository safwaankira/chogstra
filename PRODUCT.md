# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: Chog holders.** Monad NFT holders who own one or more of the 1,969 Chog Genesis NFTs. They come back during each 24-hour Movement to write or rewrite a 16-step loop for their Chog, hear it inside the shared song, and see who else is playing. When holder and judge needs conflict, holders win.
- **Secondary: hackathon judges (Chogathon 2026) and non-holders.** They listen to the live song, applaud and tip performing Chogs, and evaluate the entry. Judges get a dedicated door at `/guest` (planned): a temporary, clearly labelled Guest Chog that plays only in their browser. They experience the product the way a holder would.

## Product Purpose

CHOGSTRA is a live onchain concert. Every Chog's traits are its instrument; every holder writes that Chog's part as a 16-step loop onchain; all current parts play together as one song on Monad. The song is split into 24-hour Movements, each with a key, tempo and mood set by a Pyth Entropy draw. The draw also picks up to three Spotlight Chogs, who share that Movement's Encore Pot of $CHOG tips.

Success: holders return every Movement to perform (streaks), non-holders stay to listen, applaud and tip, and judges understand within a minute that the Chog NFT is essential.

## Positioning

The shared song: many holders, one live piece of music, with each NFT a distinct instrument whose sound comes deterministically from its traits. (Per CLAUDE.md, it does not lead with "history follows the token", which other Chogathon entries already do.)

## Operating Context

- Main page `/`: one screen with three states. **Spectate** (no wallet or no Chogs) has the live Stage playing and Perform disabled with "You need a Chog to play". **Compose** (wallet holds Chogs) lets you pick a Chog, see its instrument, edit the loop, preview it in the song and perform onchain. **Result** (after a confirmed perform) shows your Chog on the Stage playing your part.
- Audio starts only after a user tap ("Tap to enter the hall"). There is a master limiter on the output.
- `/lab` is an internal sound test page.
- Development runs against a local Monad mainnet fork (chain 31337) with dev wallets; mainnet (chain 143) comes later.
- Judges click everything twice.

## Capabilities and Constraints

- Contract calls: `perform`, `applaud` (once per address per Chog per Movement, never your own Chog), `tip` ($CHOG; 90% to the owner, 10% to the Encore Pot), `closeMovement`, `resolveSpotlight`, `settingFor`.
- Up to 16 Chogs play on the Stage at once, with balanced roles (drums, bass, chords, melody). Spotlight Chogs are always in; the rest rotate every 4 bars.
- Pattern: 16 steps, one note per step, locked to the Movement's scale.
- Terminology: Movement, Stage, part, loop, Spotlight, Encore Pot, applause, tip, performer, role.
- tokenId is not the display number (tokenId 409 is "CHOG #1870"). Always key on tokenId.
- Scope exclusions: no chat, marketplace, combat, staking-for-yield, AI agents, PFP maker or swap.
- Ask before adding any dependency or paid service.

## Brand Commitments

- Name: CHOGSTRA.
- Voice: playful, musical, confident.
- Monad purple `#836EF9` as the accent (named by the user for the concert hall redesign).
- Anti-references (user-stated): generic SaaS dashboards, gradient hero sections, plain cards, emoji headings, walls of monospace text.

## Evidence on Hand

- Real metadata and traits for all 1,969 Chogs: `web/data/chogs.json` (summary in `web/data/traits-summary.md`).
- Real Chog portraits on IPFS (loaded via the Filebase gateway).
- Live onchain data: parts, careers (streaks, applause, spotlights), Encore Pot, Movement setting, Performed events.
- None yet: testimonials, user counts, press, or mainnet deployment. Do not fabricate them.

## Product Principles

1. **No Chog, no sound.** The NFT is the instrument. Only Chogs perform onchain; everyone else can listen, applaud and tip.
2. **Real data only.** Every number, name, portrait and state comes from the chain or `chogs.json`. No placeholders, no hardcoded results, no success state without a real confirmed transaction.
3. **The song is the hero.** Whatever is on screen should make the shared, live music feel present.
4. **Holders first.** Design for the returning holder; judges and guests experience the same thing.

## Accessibility & Inclusion

Sensible defaults: WCAG AA contrast, full keyboard access, `prefers-reduced-motion` respected for pulses, glows and beams, and audio that never autoplays (it starts only after a tap).
