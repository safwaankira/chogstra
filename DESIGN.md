---
name: CHOGSTRA
description: 1,969 Chogs, one live onchain song. A concert hall at night where every Chog is an instrument.
colors:
  house: "#0b0814"
  house-2: "#120c22"
  house-3: "#1b1333"
  stage-floor: "#0d0919"
  line: "#2a2045"
  ink: "#f4efff"
  ink-2: "#c9bfe6"
  ink-3: "#9a8fbd"
  monad: "#836ef9"
  monad-hi: "#a796ff"
  monad-deep: "#6a55e8"
  monad-press: "#5c47d6"
  spill: "#fff3e0"
  gel-drums: "#ffb547"
  gel-bass: "#ff6f9c"
  gel-chords: "#62d4ff"
  gel-melody: "#b8f36b"
  ok: "#9ff0b4"
  warn: "#ffcf6e"
  bad: "#ff8a8a"
typography:
  display:
    fontFamily: "Big Shoulders, Impact, sans-serif"
    fontSize: "clamp(2.75rem, 6.2vw, 5.5rem)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Big Shoulders, Impact, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.025em"
  title:
    fontFamily: "Big Shoulders, Impact, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.12em"
  stat:
    fontFamily: "Big Shoulders, Impact, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  role-label:
    fontFamily: "Big Shoulders, Impact, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "0.18em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.35
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: "tnum"
rounded:
  cell: "5px"
  focus: "6px"
  plinth: "14px"
  panel: "16px"
  portrait: "18px"
  console: "22px"
  stage: "28px"
  pill: "9999px"
spacing:
  cell-gap: "3px"
  chip-gap: "6px"
  tile-gap: "12px"
  page: "16px"
  riser: "24px"
  page-wide: "24px"
components:
  button-perform:
    backgroundColor: "{colors.monad}"
    textColor: "#ffffff"
    typography: "{typography.title}"
    rounded: "{rounded.panel}"
    padding: "12px 0"
    width: "100%"
  button-perform-disabled:
    backgroundColor: "{colors.house-3}"
    textColor: "{colors.ink-3}"
  button-enter-hall:
    backgroundColor: "{colors.monad}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "20px 40px"
  button-pill:
    backgroundColor: "{colors.monad-deep}"
    textColor: "#ffffff"
    typography: "{typography.ui}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "32px"
  button-pill-hover:
    backgroundColor: "{colors.monad-press}"
  button-quiet:
    backgroundColor: "{colors.house-3}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
  chip-setting:
    backgroundColor: "{colors.house-3}"
    textColor: "{colors.ink-2}"
    typography: "{typography.ui}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  badge-spotlight:
    backgroundColor: "{colors.spill}"
    textColor: "{colors.house}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  badge-yours:
    backgroundColor: "{colors.monad-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  stage:
    backgroundColor: "{colors.stage-floor}"
    rounded: "{rounded.stage}"
  console:
    backgroundColor: "{colors.house-2}"
    rounded: "{rounded.console}"
    padding: "16px"
  actions-panel:
    backgroundColor: "{colors.house-3}"
    rounded: "{rounded.panel}"
    padding: "12px"
    width: "256px"
  input-tip:
    backgroundColor: "{colors.house}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  sequencer-cell:
    backgroundColor: "{colors.house-3}"
    rounded: "{rounded.cell}"
  sequencer-cell-downbeat:
    backgroundColor: "{colors.line}"
  wallet-bar:
    backgroundColor: "{colors.house-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "4px 6px 4px 12px"
---

# Design System: CHOGSTRA

## Overview

**Creative North Star: "The Hall at Night"**

CHOGSTRA is a concert hall after dark. The house is a deep purple-black; Monad purple hangs over it as the rig light; warm white spill marks whoever is in the Spotlight; and every Chog on the Stage throws light in its band role's gel colour each time it plays a note. Nothing on the main screen is a card in a grid. The Stage is a room with a lacquered floor and two risers, the portraits are lit objects standing on it, and the console beside it is the desk where a holder writes their part.

Density is concert-poster loud at the top (a marquee "Movement N" in condensed display caps) and instrument-quiet everywhere else: small Geist UI text, pill controls, hairline dividers. Light carries the hierarchy, not boxes. Radial washes, floor pools, glow rings, beams and reflections do the work that borders and shadows-on-cards do in a dashboard. Motion comes from the music. Pulses fire on real notes from the audio engine, and the only ambient loop is the Spotlight beam breathing.

The world rejects what PRODUCT.md names: generic SaaS dashboards, gradient hero sections, plain cards, emoji headings and walls of monospace.

**Key Characteristics:**
- Purple-black house surfaces stepped in three tones; light is the only accent material.
- Monad purple is stage light and the primary action; warm spill is reserved for the Spotlight.
- Four role gels (drums amber, bass pink, chords cyan, melody lime) are the only other hues, and each one always means its role.
- Big Shoulders in uppercase for every marquee moment; Geist for UI; Geist Mono only for machine values.
- Portraits are borderless lit objects: drop shadow, floor pool, glow ring on the note, reflection below.
- Motion is driven by the song clock and fully respects reduced motion.

## Colors

A night-house palette: three purple-black surface steps, lavender-tinted inks, one purple light source, one warm spill and four stage gels.

### Primary
- **Monad Stage Light** (monad): The rig wash over the Stage (34% in the top radial), the two big CTAs (Enter the hall, Perform onchain), the console heading lamp, focus-within rings and the "Hear it in the song" toggle when on. White text sits on it only at display size (3.8:1, large text).
- **Monad High** (monad-hi): Focus outline (2px, 3px offset), the "Movement" number in the marquee, the wordmark, the featured-tile ring and its purple beam in the Result state, and the "an instrument" accent in the Spectate pitch.
- **Monad Deep** (monad-deep): The fill behind every small white label: pill buttons (Connect, Applaud, Tip), the selected Chog picker pill, the "Yours" badge, and the Result banner. It exists for contrast: white on it measures 5.2:1, where white on Monad Stage Light at small sizes fails.

### Secondary
- **Warm Spill** (spill): Spotlight only. The two warm rig spots (16%), the floor sheen (7%), the Spotlight beam (30%), the Spotlight badge fill (house text on it, 18:1) and the tip sparks.

### Tertiary
- **Drums Amber Gel** (gel-drums), **Bass Pink Gel** (gel-bass), **Chords Cyan Gel** (gel-chords), **Melody Lime Gel** (gel-melody): The light each role throws. Each one colours the role lamp dot, the tile's floor pool, glow ring and applause sparks, the console's role name, trait bullets, channel meter, lit sequencer cells and playhead. All four read at 7.5:1 or better on the house surfaces.

### Neutral
- **House** (house): Page background, scrollbar track, tip input well, text on the Spotlight badge.
- **House Raised** (house-2): The wallet bar, and the base the console's vertical gradient settles toward.
- **House Lifted** (house-3): Chips, quiet buttons, unlit sequencer cells, the actions panel, portrait placeholders, disabled CTAs and the back-riser plinth (70%).
- **Stage Floor** (stage-floor): The Stage's own ground, and the ring offset for the featured tile so the ring floats on the floor colour.
- **Hairline** (line): Console section dividers, downbeat sequencer cells (every fourth step, 80%), the toggle track, the scrollbar thumb.
- **Ink** (ink): Headings, values, names. **Ink Soft** (ink-2): body copy and chip text (10:1 on house-3). **Ink Dim** (ink-3): labels, units, captions, empty-state silhouettes (5.9:1 on house-3, so it stays legible as text).
- **Status** (ok, warn, bad): Transaction outcomes, the waiting-for-draw chip and dev-wallet buttons only.

### Named Rules
**The Stage Light Rule.** Purple is light, not paint. Surfaces stay house-dark; Monad purple appears as a wash, a lamp, a focus ring or the single primary action in view.

**The Gel Means Role Rule.** A gel colour always names a band role. Never use a gel for status, decoration or a second accent.

**The Small White Text Rule.** White text under display size sits on Monad Deep (5.2:1). Monad Stage Light carries white only on display-size CTA labels.

**The Spill Is Earned Rule.** Warm white spill marks the Spotlight. It is never a general highlight.

## Typography

**Display Font:** Big Shoulders (weights 700, 800, 900, via next/font; fallback Impact, sans-serif)
**Body Font:** Geist (fallback system-ui, sans-serif)
**Label/Mono Font:** Geist Mono, for numbers and addresses only

**Character:** Condensed marquee caps against a calm, neutral grotesk. The display face is the poster on the front of the hall; Geist is the programme in your hand.

### Hierarchy
- **Display** (900, clamp(2.75rem, 6.2vw, 5.5rem), line-height 0.82, uppercase): "Movement N" in the marquee header, once per screen. The number is set tabular in Monad High.
- **Headline** (900, 1.5–1.875rem, line-height 1, uppercase, slight tracking): The console heading, the role name on the instrument card (in its gel), the Spectate pitch, "Be the first to play" (2.25–3rem). The Enter the hall CTA runs larger (1.5rem, 2.25rem from 640px) with 0.1–0.14em tracking.
- **Title** (800, 1.25rem, 0.12em tracking, uppercase): The Perform and "You need a Chog" button labels. At 1rem with wide tracking: "Your part" and the actions-panel Chog name.
- **Stat** (800, 1.5rem, 1.875rem from 640px, tabular, line-height 1): Encore Pot, Next movement countdown, On stage count. Units follow in 700 at 1rem in Ink Dim.
- **Role label** (800, 0.875rem, 0.18em tracking, uppercase): Role zone names on the risers, beside a gel lamp dot; 0.75rem at 0.2em on the empty-stage silhouettes.
- **Body** (400, 0.875rem, relaxed leading): Door copy, Spectate explanation and empty-stage copy, max-width about 28rem.
- **UI** (500–600, 0.75rem): Pill buttons, chips, wallet bar, feed items, tile names.
- **Label** (400, 11px): Stat labels, tile applause captions, trait-to-sound rows, tip fine print. Eleven pixels is the floor; nothing functional goes below it.
- **Mono** (400, 11–14px, tabular): Wallet address, transaction hashes, block numbers, tip amount input, sequencer note names.

### Named Rules
**The Marquee Rule.** Big Shoulders is always uppercase and always 700 or heavier. It sets headings, role names, stats and CTA labels, never running text.

**The Mono Is For Machines Rule.** Geist Mono appears only on values a machine produced: addresses, hashes, block numbers, amounts and note names. Never for labels or prose.

## Layout

One screen, three states. On desktop (from 1024px) the page is locked to the viewport (100dvh, no page scroll): a nav row (wordmark plus tagline at left, wallet bar at right), the marquee header, then a two-column body with the Stage taking all remaining width and the console fixed at minmax(22rem, 25rem). The page gutter is 16px (24px from 640px), with a 16px gap between rows and columns. The console scrolls inside itself if it has to; the Stage never does.

The Stage stacks two risers, spaced evenly with a 24px gap: the back riser holds drums and bass (inset 5% and standing on a raised plinth); the front riser holds chords and melody. Each riser splits into two role zones from 640px. Tiles in a zone are sized as if the zone held at least three players, so lone players match their neighbours, and only a crowded zone shrinks. Portrait size also grows as the band shrinks: 190/210px (back/front) for up to 4 players, down to 112/132px for 13–16, each capped by viewport height (21vh down to 15vh) so both risers and captions fit on short screens. Tile gap is 12px.

The marquee header wraps: setting chips sit beside the title, stats align right. Below 640px the three stats become a three-column grid across the full width, the role zones stack to one column, the banner and feed flow above the stage instead of floating over its top edge, and the sequencer folds into two blocks of eight steps with the note labels repeated. Breakpoints are Tailwind's: 640px (sm), 768px (md, extra feed items), 1024px (lg, the viewport lock and two columns), 1280px (xl, larger instrument portrait).

## Elevation & Depth

Depth is light. Instead of stacked cards, the Stage is lit: radial washes from the rig above, a floor gradient with a sheen where the light lands, a front lip, and a plinth under the back riser. Objects on the Stage get shadows that fall downward onto the floor (long, negative-spread, near-black), and the Chog's own gel supplies the coloured light: the pool under it, the halo ring, and the playhead's glow. Outside the Stage the only lifted surfaces are the console (a top-lit inset highlight plus a deep drop) and the floating actions panel.

### Shadow Vocabulary
- **Portrait drop** (`box-shadow: 0 14px 28px -12px rgba(0,0,0,0.9)`): Every Stage portrait. The instrument card portrait uses `0 12px 30px -10px rgba(0,0,0,0.9)`.
- **Note glow ring** (`box-shadow: 0 0 0 2px var(--gel), 0 10px 30px 2px color-mix(in oklab, var(--gel) 65%, transparent)`): The halo that flashes on each note; resting opacity 0.
- **Console** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 24px 48px -24px rgba(0,0,0,0.9)`): The desk surface.
- **Floating panel** (`box-shadow: 0 18px 40px -10px rgba(0,0,0,0.9), inset 0 2px 0 var(--gel)`): The actions panel, with its role gel as a 2px top edge.
- **Primary light** (`box-shadow: 0 10px 30px -10px var(--monad)`): The Perform button; Enter the hall uses `0 18px 44px -14px var(--monad), 0 4px 12px rgba(0,0,0,0.5)`; the Result banner uses `0 8px 24px -8px var(--monad)`.
- **Lamp dot** (`box-shadow: 0 2px 10px <gel>`): The 8px role lamps and the console heading lamp.
- **Badge lift** (`box-shadow: 0 3px 10px rgba(0,0,0,0.5)`): Spotlight and Yours badges over portraits.

### Named Rules
**The Lit Object Rule.** A portrait has no decorative border. It stands on the floor with a drop shadow, a gel pool and a reflection. A ring or outline appears only as state: the Monad High ring for your featured Chog, a dashed Ink Dim outline for a preview that isn't onchain.

**The Light Falls Down Rule.** Shadows fall toward the floor (positive y, negative spread). Coloured glow comes only from Monad purple or a role gel.

## Shapes

Soft, generous rounding everywhere, scaled to the object: the Stage is the biggest round (28px), the console next (22px), portraits 18px (their glow ring 20px), panels and big buttons 16px, sequencer cells 5px. Every small control, chip, badge, input and the wallet bar is a full pill. Floor pools and empty-seat shadows are flat ellipses (50% radius). The Spotlight beam is the one hard geometry: a trapezoid cone (top 44–56%, base full width) blurred 6px. Role silhouettes are 2px round-capped line drawings of each instrument (drum, bass guitar, keyboard, microphone) on an 80×76 grid.

## Components

### Marquee Header
Concert-poster top line. "Movement N" in Display on the left, setting chips beside it, three Stats on the right. Chips are house-3 pills (4px 12px) with an Ink Dim label and a 600 Ink value; the "Waiting for today's draw" chip swaps to warn at 15% with a pulsing 6px dot. Stats stack an 11px Ink Dim label over a Stat-style number; the Encore Pot counts up to new values over 700ms with a cubic ease-out.

### Wallet Bar
Disconnected: one Monad Deep pill per wallet (32px high, 12px semibold). Dev wallets on the local fork are warn-ringed ghosts. Connected: a house-2 pill holding the mono address, the $CHOG balance (tabular mono), an optional bad-tinted "Switch to" pill and a quiet Disconnect. Before mount it renders a same-height placeholder so nothing jumps.

### Stage
The room. A Stage-floor surface (28px round) with the three-light rig gradient above, the lacquered floor across the bottom 36% (masked in from the top), a 2px front lip, and a plinth under the back riser. A banner and feed row floats over the top edge from 640px: house pills at 85% in Ink Soft, and new feed items enter with feed-in.

### Stage Tile
- **Portrait:** square, 18px round, house-3 placeholder, portrait drop. When the viewer can act, the tile is a button that lifts 2px on hover and focus.
- **Floor pool:** an ellipse 135% of the tile's width, 36px tall, sitting 20px below the portrait, a radial of the gel at 60% that pulses to full on each note.
- **Glow ring:** the gel halo (see Elevation) at opacity 0, flashing to 1 on each note.
- **Reflection:** the same portrait flipped below at 14% opacity, masked to fade within 55%.
- **Caption:** short name (Ink, 12px medium) and applause count or part status (11px Ink Dim, tabular).
- **States:** an earlier-movement part desaturates to 70%; a preview gets the dashed outline; your featured Chog gets the Monad High ring and a purple beam.

### Spotlight Beam and Badge
A blurred trapezoid cone dropping 200px from above the tile, warm spill at 30% (Monad High at 34% for your featured Chog), breathing between 0.55 and 0.85 opacity over 5s. The badge is a spill pill on the top edge of the portrait: 11px bold uppercase in house, with an inline 12px star SVG. Under 120px of tile width the word goes screen-reader-only and only the star shows.

### Actions Panel
A 256px house-3 dialog anchored under the tapped tile, aligned left, centre or right to stay inside the Stage. The gel shows as a 2px top edge. It holds the Chog name (title style), the full-width Applaud pill (Monad Deep, and transparent Ink Dim once applauded), and a hairline-separated tip form: a house pill input with a mono amount and a "$CHOG" unit, a 36px Tip pill, and the 90/10 split in 11px. Escape or a click outside closes it. Confirmed applause bursts ten gel sparks; a confirmed tip bursts spill sparks.

### Hall Doors
Two translucent half-panels (house-2 tone at 58%, 1.5px backdrop blur, half saturation) over the dimmed band, with inner-edge shadows. Centred above them: honest copy about who is playing (Body, Ink Soft), the Enter the hall pill, and "Tap to turn the sound on." The tap starts audio, and the panels slide apart in 900ms.

### Empty Stage
The four role silhouettes in Ink Dim at 60%, each over a purple floor-pool ellipse and labelled in role-label caps, then "Be the first to play" (Headline) and state-specific copy. While the doors are closed, only the silhouettes show.

### Console
The desk. A 22px panel with a vertical gradient from #1a1230 through #110b20 to #0e0a1b, the console shadow, and 16px padding. The heading is "Your console" in Headline with a Monad lamp dot. In Spectate it shows the "Every Chog is an instrument" pitch and a disabled "You need a Chog to play" block. In Compose it shows the Chog picker (radio pills with a 24px round portrait; Monad Deep when selected), then the instrument card: an 8px channel meter, the portrait over a blurred gel halo, the role name in its gel, and trait-to-sound rows (a gel bullet, the trait value in Ink Dim, the result in Ink Soft). Hairline dividers separate the card, the part and Perform.

### Step Sequencer and Playhead
An 8-row by 16-step grid of square cells, 5px round, with 3px gaps. Unlit cells are house-3, downbeats (every fourth step) are line at 80%, and lit cells fill with the gel and a `0 2px 12px` gel glow (150ms transition). Note names sit at the left in 11px mono. The grid has one tab stop, and the arrow keys move between cells. The playhead is a column of gel light (38% to 12% vertical gradient with a soft gel shadow) that steps across in time with the song clock, hidden until audio runs. On phones the grid folds into two blocks of eight.

### Perform Control
A full-width 16px-round Monad block with a Title-style label and primary light; it presses to 0.99. A receipt line above it names the Chog, role, note count and target Movement. Disabled with no notes (house-3, Ink Dim, no glow), with a hint below. Under it, the "Hear it in the song" toggle (a 36×20 track, Monad when on) and quiet Load and Clear pills.

### Transaction Status
One 12px line per transaction: estimating (Ink Dim), signing (Ink Soft), pending (warn, with the mono short hash), confirmed (ok, with the mono block number and hash), error (bad, with the message and hash). Nothing shows success without a confirmed receipt.

### Motion Grammar
- **Note pulse** (320ms, cubic-bezier(0.16, 1, 0.3, 1)): fired by the engine on each real note. The portrait scales from 1.06 and brightness 1.35 back to rest, the glow ring fades from 1 to 0, the pool from 1 to 0.6, and the channel meter drops from full to 0.18. With reduced motion the portrait scale and brightness are skipped; the opacity flashes and the meter stay as information.
- **Doors** 900ms expo-out slide; **sparks** 700ms; **feed-in** 500ms (fade, 6px drop, de-blur); **beam breathe** 5s ease-in-out loop; **count-up** 700ms cubic-out.
- **Reduced motion:** the beam, sparks, feed-in and the busy/waiting pulses stop, the tile hover lift is removed, the portrait scale on notes is skipped (the glow ring and floor pool still fade), the doors open in 1ms, and the count-up jumps to its value.
- **Hover never lightens behind white text:** pills deepen from Monad Deep to Monad Press (6.3:1); Perform and Enter the hall deepen from Monad to Monad Deep (5.2:1).
- **Press feedback:** 0.95 on pills, 0.98 on Enter the hall, 0.99 on Perform.

### Known Open Items
- The console is not yet a full mixing-desk channel strip. It has a single gel channel meter but no faders, knobs or desk hardware. The last finish review scored the "mixing desk" direction as partial.
- There is no Result share card yet. Result is currently the banner, the featured ring and the purple beam on the Stage.

## Do's and Don'ts

### Do:
- **Do** keep every surface on the house steps (house, house-2, house-3, stage-floor) and let Monad purple arrive as light: washes at 18–34%, lamps, focus rings and one primary action.
- **Do** put small white text on Monad Deep (5.2:1); reserve Monad Stage Light fills behind white for display-size labels.
- **Do** colour anything role-specific with its gel through the `--gel` custom property, so the tile, panel, sparks, meter, cells and playhead all agree.
- **Do** light portraits instead of framing them: portrait drop, gel floor pool, glow ring on the note, 14% reflection.
- **Do** drive pulses from real engine notes and the bar clock; gate every scale, translate and loop behind `prefers-reduced-motion`.
- **Do** use Big Shoulders in uppercase at 700–900 for marquee moments and Geist Mono only for addresses, hashes, amounts and note names, with tabular numbers on every changing figure.
- **Do** keep functional text at 11px or larger and controls at 32px or taller.

### Don't:
- **Don't** build the dashboard arrangement: a header of stat tiles over a grid of equal cards with a form in a sidebar.
- **Don't** use gradient hero sections, gradient text, plain bordered cards, emoji headings or walls of monospace text.
- **Don't** use a gel colour for anything but its role, or warm spill for anything but the Spotlight.
- **Don't** put decorative borders on portraits; rings and outlines are state only (featured, preview).
- **Don't** add idle ambient animation beyond the Spotlight beam; motion answers the music or the user.
- **Don't** show a success state, count or badge that a confirmed transaction or real onchain read didn't produce.
