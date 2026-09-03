# RAIDBOSS

One boss, one health bar, one pot. Every buy is a hit; when the bar hits zero
the pot is split between everyone who hit it, and a bigger boss takes its
place.

`RAIDBOSS` is three strings in `src/lib/site-config.ts` — `name`, `wordmark`,
`ticker` — plus the `NEXT_PUBLIC_RAID_*` env prefix. Nothing else spells the
name out.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · wagmi v3 + viem ·
framer-motion · TypeScript. Injected wallets only, Robinhood Chain, no backend,
no 3D library.

## The rules

Damage is denominated in the same unit as the buy: **one USDG spent is one
point of damage**. That single equivalence is what makes the page readable — a
bar of 250,000 is a boss that dies after 250,000 USDG of buying, and the pot on
the table is always the fee share of that.

| | | |
| --- | --- | --- |
| Fee into the pot | 3% | of every buy, in USDG |
| Boss I | 250,000 | health |
| Each boss after | 1.75× | the one before, with a heavier crown |
| Biggest single hit | 8% | of a boss's health |
| Carried forward | 10% | of a dead pot seeds the next one |

All five live in `raidRules` and are env-overridable. **They must match
whatever actually enforces them** — the site derives every forecast, every
label and the simulation itself from them.

**Why the hit cap exists.** It is a game rule, not a safety rail. Without it a
single wallet ends a boss on its own and there is no raid to watch, no board to
climb and no reason for anyone else to swing. At 8% a boss needs at least
thirteen hits to fall.

**Why there is no killing-blow bonus.** Pure pro-rata means there is nothing to
snipe and no reason to stop hitting early.

## Three ways to run it

One rules engine, three sources. The mode is picked from what is configured,
and the page states which one it is in at all times.

| Mode | Needs | What the strike button does |
| --- | --- | --- |
| `sim` | nothing | Hits a local boss. Labelled SIMULATION everywhere. |
| `pool` | token + pool + quote token | Opens the venue with the amount filled in. The buy lands as damage on its own when the chain confirms it. |
| `contract` | a raid contract | Approve, then strike, in the app. |

**`pool` is the mode to launch in.** It needs nothing deployed but the token
and its pool: `src/lib/poolRaid.ts` watches USDG transfers into the pool,
treats each as a buy, and replays them through the same `applyHit` the
simulation uses. The health bar, the pot, the board and the graveyard are all
derived from that one fold, so none of them can drift from each other or from
the rules as written.

Its one honest caveat, stated on the page: liquidity adds look like buys on
chain and get counted with them. Removing that ambiguity is most of the
argument for eventually deploying `src/lib/raidAbi.ts`.

## Payouts

`/#payouts` is the bill. For every dead boss it writes out address, damage,
share and USDG owed, sorted by what is owed, exportable as CSV or JSON.

It exists because until a contract pays winners out on its own, a person does
— and a person needs a list of addresses and amounts, not a leaderboard. It is
public on purpose: the split is derived from damage that is already on chain,
so publishing the table is the difference between "trust me, I paid people" and
a receipt anyone can audit against the transfers that follow it.

## The dragon

`src/lib/dragonShader.ts` is a raymarched signed-distance field in a single
WebGL fragment shader. No three.js, no model files: eighteen tapered capsules,
seven ellipsoids and three thin triangles for the wing membranes.

**Why a shader and not a sprite.** A health bar is an abstraction, and the
thing it describes has to be present enough that draining it feels like damage
rather than like a progress indicator. The two things a sprite cannot do are
the two that matter: carry a continuous, non-quantised state, and react on the
same frame a hit lands.

Health is legible off the body three ways over — the head sinks and the wings
fold as the bar drains, the seams run from dull ember to white-hot, and the
membranes tatter. On a muted autoplaying clip the bar may be off-screen and the
silhouette still says how far along the kill is. A hit throws the jaw open and
a ring across the floor.

### What it cost to get there

Worth writing down, because every one of these cost an hour:

- **The compiler is the binding constraint, not the GPU.** A first draft with
  loops and nested branches in the distance function linked fine and then never
  returned from its first `drawArrays` — ANGLE hands the translated HLSL to fxc,
  and fxc sits for minutes on a function inlined into eight call sites. Hand-
  unrolled, hoisted and cut to five call sites, it compiles in 13ms.
- **A bounding sphere is a surface unless you keep away from it.** Its distance
  falls to zero at its own shell, so returning that number to the marcher makes
  the invisible bound behave exactly like geometry. `BOUND_MARGIN` enters the
  detail branch early enough that the marcher never sees a value near its hit
  epsilon.
- **Uniforms belong to the program, not the context.** A `resize()` that
  early-returned when the canvas size was unchanged skipped the resolution
  upload on remount, leaving `uRes` at (0, 0) — every pixel divided by zero and
  the canvas rendered black.
- **`gl.finish()` does not block under ANGLE.** Timing a draw with it reports
  0.0ms and infinite frames per second. `readPixels` has to produce a value, so
  it cannot return early.
- **A paused rAF is not a slow GPU.** The adaptive resolution controller read
  the long measurement window of a backgrounded tab as two frames per second
  and collapsed the render to 165 pixels wide — permanently, until reload. It
  now measures the *median interval between frames* and throws away any gap
  over 200ms, which is the only signal that distinguishes a slow GPU (long but
  regular gaps) from a throttled one (a handful of enormous ones).
- **fxc has a cliff, and it is not where you expect.** Adding fangs, a socketed
  eye and curved horns took link time from 13ms to two seconds. The model was
  worth keeping, so the link is polled through `KHR_parallel_shader_compile`
  instead of blocking the main thread on `LINK_STATUS`.
- **`min-width: auto` on a grid item.** A poster-sized figure in a narrow
  column does not wrap or shrink — it prints on top of its neighbour. Every
  figure on this page is a display face at a viewport-relative size, so every
  one of them needed `min-w-0`.

Measured after all that: **70ns per pixel on an Intel UHD** — about 10ms for a
480×315 frame. Resolution is tuned from measured frame time in both directions,
targeting 30fps, because a boss standing in place breathing does not need 60
and the difference buys four times the pixels.

### `/lab`

A bench for the shader: renders exactly one frame per click, times a burst, and
prints ns/pixel, with sliders for health, tier, hit and death. Rendering one
frame rather than a loop is the point — an animating canvas never lets the page
go idle, and a page that never goes idle cannot be screenshotted or profiled.

Excluded from `robots.txt`. Delete the route before launch if you would rather
not ship it.

## The health bar

Three layers, and the middle one is the point. `hp-fill` is the truth and moves
in 190ms. `hp-chip` is the same number on a slower, delayed transition, so for
about three quarters of a second after a hit there is a pale wedge showing
exactly how much was just taken off — the bite, not the result. `hp-edge` is a
two-pixel highlight riding the front so the eye can find *now*.

Fighting games have used this for thirty years because it works at a glance and
it works on video.

## Simulation

With nothing configured the site runs the same rules locally and says
SIMULATION in the nav, in the arena and on the strike button. This is not a
mock for development convenience — a health bar that never moves communicates
nothing about a product whose entire idea is a health bar that moves.

`src/lib/sim.ts` models the shape of real traffic: log-normal buy sizes with a
long right tail, one buy in twenty a whale, arrivals in bursts, and the whole
thing speeding up as a boss nears death. The starting arena is seeded
deterministically so the server and the client render byte-identical first
frames; nothing in the seed calls `Date.now()`.

## Colour is assigned, never decorative

- **VENOM** — you. Your damage, your strike, your share.
- **BLOOD** — the boss. Its health, and only its health.
- **GOLD** — the pot. USDG collected and waiting for a corpse.

On a black stage those three read from across a room and survive video
compression, which is the actual delivery format for this thing.

## Running it

```bash
npm run dev
```

Copy `.env.example` to `.env.local` before pointing it at anything real. That
file documents each mode and what it needs.

## Open decisions

- **The name.** RAIDBOSS is a many-headed dragon and the model is a single-headed
  one. Three strings in `src/lib/site-config.ts` if you want it to match.
- **The 10% carry.** A fresh boss always has something on it, at the cost of
  every payout being 90% of what was collected. `NEXT_PUBLIC_RAID_CARRY_BPS=0`
  for pure payout.
- **1.75× growth.** Ten bosses in, health is three orders of magnitude up.
  That is the drama and also the ceiling — worth deciding whether it caps.
- **`src/lib/chain.ts`** came from third-party sources and must be re-verified
  against the official docs before this points at real funds.
