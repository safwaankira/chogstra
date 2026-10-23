---
version: 1
slug: "web-app-page-tsx"
primary_target: "web/app/page.tsx"
related_targets: ["web/app/hall/hall.tsx","web/app/hall/stage.tsx","web/app/hall/composer.tsx","web/app/hall/wallet.tsx"]
---

# Surface: main hall (/)

Mode: Experience. The live song is the work; the visitor is inside it from the first viewport. Holders compose and perform; everyone else listens, applauds and tips.

Constraints: styling and layout only. Contract calls, data loading and audio logic stay as they are. No fake data. Fonts are the only new dependency allowed. Must fit one 1440x900 viewport on desktop and work on mobile (390 wide).

## Direction contract

THESIS: The page is a concert hall at night. The Stage owns the room and the Chogs are the band on it. It refuses the dashboard arrangement (header, stat tiles, a grid of equal cards, a form in a sidebar).

OWN-WORLD: Purple-black house dark (#0b0814 to #120c22), with Monad purple #836EF9 as stage light. Warm white spill (#fff3e0 at low alpha) for spotlights. A floor plane of lacquered wood-black with a soft reflection. Big Shoulders Display (marquee lettering) for headings; Geist for UI; Geist Mono only for numbers and addresses. Chog portraits are lit objects, not cards: no borders, a pool of light under each.

STORY: You see and hear the band, understand that each Chog is an instrument playing its owner's loop, and if you hold a Chog you step up and write your part.

FIRST VIEWPORT: A marquee header across the top: "Movement N" huge at the left; key, tempo and mood as chips; the live Encore Pot; a countdown. The Stage fills about 70% of the width: four role risers (drums, bass, chords, melody) with big portrait tiles. A composer console on the right, styled as a mixing desk. Before audio starts, the stage is dimmed under a centred "Enter the hall" door CTA.

FORM: Pinned by the brief (dark concert hall), so no roll ran. Ordered-list position: n/a (brief-pinned). seed: none (unavailable)

Signature interaction: portraits throw light on their notes. The tile's floor pool and halo pulse in its role colour, and the composer's playhead sweeps the step grid in time.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
