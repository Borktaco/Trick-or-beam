# TRICK OR BEAM — Choices made during the build

Every decision below was made autonomously where the prompt left room.
Nothing here was asked of the player.

## Art approach
- **All in-game sprites are drawn procedurally in Canvas 2D code** (glossy
  gradient blobs, costumes, aliens, props, tiles) instead of AI sprite sheets.
  Why: guaranteed character consistency, zero magenta-cutout edge artifacts,
  tiny file size, and smooth 60fps with no texture loading. The "squishy jelly
  blob" look is very achievable with radial gradients + squash & stretch.
- **AI-generated art is used where it matters most**: the title key art and
  the 13 story illustrations (opening, one per level, ending) in
  `assets/`. Consistent style language was used for all 13.
- The 180×180 home-screen icon is drawn with PIL (exact pixel size, crisp).

## Engine & structure
- Single self-contained `index.html` (all CSS + JS inline), plus a flat
  `assets/` folder. No build step, no engines, no libraries.
- Fixed 60Hz timestep accumulator for updates; rendering each rAF with
  camera culling (only tiles/props near the camera are drawn).
- DOM for all menus/HUD (title, profiles, map, story, pause, shop, book,
  achievements, complete screen); Canvas only for gameplay. This keeps text
  crisp, buttons big, and touch handling simple.
- Halloween clock: 1 game-minute = 12 real seconds, so each 30-minute level
  lasts ~6 real minutes. Time-out never fails the level — it finishes with
  fewer stars and counts toward the "Fashionably Late" achievement.

## Gameplay simplifications (kept the spirit, cut the fiddly bits)
- **Levels are compact** (~40×26 tiles, 3–6 minutes each) rather than 5–10
  minutes. All required elements are present: 2–4 jars, 3 Golden Candy Corns,
  checkpoints, escape chase, star rating, first-time hint.
- **Jars per level**: each level's named friend (where the story names one)
  plus 1–3 "neighbor kid" jars (Pebbles, Mochi, Waffles…) worth +25 candy.
  Level 9 ("rescue every remaining friend") has 4 neighbor jars; Level 10 is
  the switch/candy/beam finale with no jars.
- **Alien patrols** are generated around hand-placed spawn points (ping-pong
  / loop / circle / spin-in-place) rather than per-alien authored paths.
- **Escape chase**: after the last rescue, the exit unlocks and a searchlight
  saucer actively hunts you with sweeping beams until you reach the exit.
- **Gadgets sold as throw modes**: Whoopee Cushion / Glow Stick / Blob Balloon
  are selectable THROW ammo types (one purchase, infinite use) instead of
  separate placeable items — one clean system.
- **Hiding** is automatic when you stand still inside a hiding spot (eyes peek
  out); ACTION toggles pop-out. Jar rescue is hold-ACTION for 2s with a
  progress bar.
- **Vampire "see hidden paths in dark rooms"**: simplified — the flashlight
  radius is generous and the vampire glide covers gaps; no separate hidden-path
  layer.
- **Apple bobbing**: mash ACTION 6 times near the tub for +30 candy.
- **Hay wagons / lily pads**: ride by standing on them; you count as hidden
  while riding. They follow waypoint loops.
- **Conveyors** (Level 6) move Pip *and* aliens.
- **Captain Zorb** = fast grabber with front + rear vision cones.
- **Queen Glorpa** (Level 10) patrols the bridge with a big cone; objectives:
  flip 3 switches → deposit 60 candy at the candy mountain → hold ACTION 3s
  at the beam controls → ending cinematic.
- **Caught**: beam-up animation, respawn at last lamp post, drop half carried
  candy as pickups worth their share. No lives, no game over.
- **Stars**: 1 each for rescuing all jars, never being caught, all 3 golden
  corns (min 1). Best times saved per level.

## Audio
- 100% Web Audio API, no audio files. ~30 named SFX (squish steps, crunch,
  clang, warbles, ?/! stings, jar pop, cheers, power sounds, star chimes…).
- Generative music sequencer: theremin-style lead, plucked bass, bells, light
  drums; per-level key; chase mode speeds up + adds drums; heartbeat when an
  alien is close to spotting you; music ducks under story speech.
- Sound unlocks on the first tap (TAP TO PLAY), per Safari's rule. Separate
  music/SFX sliders in Settings.

## Save
- `localStorage` key `trickorbeam_save_v1`, every read/write in try/catch.
  4 named profiles (double-click a profile to rename), each with progress,
  candy, costumes, throw loadout, hats/colors/trails, settings, best times,
  stats, treat-book entries, achievements.

## Not finished / known limitations
- **No live browser playtest was possible** (subagent has no live browser).
  A headless Node smoke test simulated all 10 levels (walk, hide, all 8
  powers, throwing, rescues, caught/respawn, escape, mothership objectives,
  level finish) with zero errors, and `node --check` passes — but a human
  should still play Level 1 on an iPad before calling it done.
- Map rows are slightly ragged in places (39 vs 40 chars); the parser pads
  safely with wall tiles, so this is cosmetic only.
- Story panels use slow CSS Ken Burns pan/zoom + typed text; no per-panel
  bounce animation on characters (panels are single stills).
- No screenshots were taken (parent handles browser verification).
- Difficulty balance (alien speeds, detection rates) is tuned by feel in code;
  Easy Mode widens the margin.
- The game was not published to GitHub — per instructions, no publishing.

## Verification addendum (Milo, Oct 2 2026)
- Drove the real game in headless Chromium at 1194x834 (iPad Pro landscape):
  title -> TAP TO PLAY -> 4 profiles -> town map -> Level 1 -> opening story ->
  level story -> NEW ALIEN card -> gameplay -> pause menu. All screens render,
  canvas animates at full size, keyboard movement works, pause/resume works.
- Screenshot sweep of all 10 levels: each level loads, renders its distinct
  look, aliens patrol, HUD/objective counters show correctly.
- **Bug found and fixed:** `glossBlob()` threw `ReferenceError: ex is not
  defined` whenever Pip hid (the peeking-eyes branch used a variable scoped to
  the non-hidden branch). Fixed by giving the hidden branch its own eye-offset
  variable. Re-ran the full sweep: **zero console errors** on all 10 levels,
  hiding verified working (button flips to POP OUT, drone cone passes over).
- iPad meta tags, 180x180 touch icon, fullscreen-landscape manifest, portrait
  warning screen, and localStorage save wrappers all confirmed present.
- Not done: publishing to GitHub (needs Alec's approval + GitHub connection);
  human playtest on a real iPad (recommended before kids play); difficulty
  balance is tuned by feel.
