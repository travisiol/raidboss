# HYDRA

One boss, one health bar, one pot. Every buy is a hit; when the bar hits zero
the pot is split between everyone who hit it, and a bigger boss takes its
place.

`HYDRA` is three strings in `src/lib/site-config.ts` — `name` for the all-caps
lockup, `wordmark` for the title-case form, `ticker` for `$HYDRA` — plus the
`NEXT_PUBLIC_HYDRA_*` env prefix. Nothing else spells the name out.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · wagmi v3 + viem ·
framer-motion · TypeScript. Injected wallets only, Robinhood Chain, no backend,
no 3D library.

## The rules

Damage is denominated in the same unit as the buy: **one USDG spent is one
point of damage**. That single equivalence is what makes the whole page
readable — a bar of 250,000 is a boss that dies after 250,000 USDG of buying,
and the pot on the table is always the fee share of that.

| | | |
| --- | --- | --- |
| Fee into the pot | 3% | of every buy, collected as USDG |
| Boss I | 250,000 | health |
| Each boss after | 1.75× | the one before, plus one head |
| Biggest single hit | 8% | of a boss's health |
| Carried forward | 10% | of a dead pot seeds the next one |

All five live in `raidRules` and are env-overridable. **They must match what
the deployed contract enforces** — the site derives every forecast, every
label and the simulation itself from them, so a mismatch shows up as the page
quoting damage the chain will not deal.

**Why the hit cap exists.** It is a game rule, not a safety rail. Without it a
single wallet ends a boss on its own and there is no raid to watch, no board to
climb and no reason for anyone else to swing. At 8% a boss needs at least
thirteen hits to fall.

**Why there is no killing-blow bonus.** Pure pro-rata means there is nothing to
snipe and no reason to stop hitting early. A wallet that opened the fight and
one that closed it are paid by the same rule.

## The boss is the product

`src/components/BossCanvas.tsx` is a raymarched signed-distance field in a
single WebGL fragment shader. No three.js, no model files, ~200 lines of GLSL.

**Why a shader and not a sprite.** A health bar is an abstraction, and the
thing it describes has to be present enough that draining it feels like damage
rather than like a progress indicator. The two things a sprite cannot do are
the two that matter: carry a continuous, non-quantised state, and react on the
same frame a hit lands.

**How the heads work.** The model is a core mass with N necks folded into N
angular sectors, so the marcher evaluates one neck no matter how many heads the
boss has — a nine-headed boss costs the same as a three-headed one. Health is
read off the body directly: `uHp * uHeads` is the fractional number of living
heads, so the outermost head withers and slumps as the bar drains.

That makes the creature a second, redundant copy of the health bar, and the
vein colour — teal at full health, arterial as it dies — a third. The
redundancy is deliberate: on a muted autoplaying clip the bar may be off-screen
and the silhouette still says how far along the kill is.

**Performance.** The shader measures its own frame time once a second and drops
render scale if it is missing 60fps. `prefers-reduced-motion` holds a still
frame. No WebGL at all falls back to a glow, and the page keeps its bar, its
pot and its board.

## The health bar

Three layers, and the middle one is the point. `hp-fill` is the truth and moves
in 190ms. `hp-chip` is the same number on a slower, delayed transition, so for
about three quarters of a second after a hit there is a pale wedge showing
exactly how much was just taken off — the bite, not the result. `hp-edge` is a
two-pixel highlight riding the front so the eye can find *now* on a bar that is
a metre wide on a projector and forty pixels on a phone.

Fighting games have used this for thirty years because it works at a glance and
it works on video.

## Simulation vs. chain

With `NEXT_PUBLIC_HYDRA_CONTRACT_ADDRESS` unset the site runs the same rules
locally and labels itself **SIMULATION** in the nav, in the arena and on the
strike button. Nothing touches a wallet, a chain or a balance, and every write
control is disabled.

This is not a mock for development convenience — a health bar that never moves
communicates nothing about a product whose entire idea is a health bar that
moves. `src/lib/sim.ts` models the shape of real traffic: log-normal buy sizes
with a long right tail, one buy in twenty a whale, arrivals in bursts, and the
whole thing speeding up as a boss nears death.

The starting arena is seeded deterministically (`seedRaid`, mulberry32) at
module load so the server and the client render byte-identical first frames.
Timestamps are relative to mount and negative, which is what keeps `ago()`
deterministic during SSR — nothing in the seed calls `Date.now()`.

Set all three addresses plus `NEXT_PUBLIC_HYDRA_LIVE=true` and the same
components read `currentBoss`, `leaderboard` and `Hit` logs instead. The tag
flips to LIVE on its own.

## The contract surface

`src/lib/hydraAbi.ts` is what the site expects, and it is speced around the
page rather than the other way round. `currentBoss` returns the whole arena in
one struct, one call, one block — reading the bar, the pot and the hit count
from separate views lets them disagree, and the page would show a state that
never existed on chain.

`strike(amountUsdg, minTokensOut)` does the buy and the hit in one call, so
there is no path that takes the token price without paying the fee and none
that damages the boss without buying.

`leaderboard(count)` is the one concession to gas: a contract cannot cheaply
sort, so it is expected to keep a bounded top-N window rather than an unbounded
sorted set.

## Colour is assigned, never decorative

Three meanings, three hues, and nothing else on the page is allowed to be
saturated:

- **VENOM** — you. Your damage, your strike, your share.
- **BLOOD** — the boss. Its health, and only its health.
- **GOLD** — the pot. USDG collected and waiting for a corpse.

On a black stage those three read from across a room and survive video
compression, which is the actual delivery format for this thing.

## Running it

```bash
npm run dev
```

Copy `.env.example` to `.env.local` before pointing it at anything real.

## Open decisions

- **The 10% carry.** It means a fresh boss always has something on it, at the
  cost of every payout being 90% of what was collected. Set
  `NEXT_PUBLIC_HYDRA_CARRY_BPS=0` for pure payout.
- **1.75× growth.** Ten bosses in, health is three orders of magnitude up.
  That is the drama and also the ceiling — it is worth deciding whether the
  ladder caps somewhere.
- **The chain values in `src/lib/chain.ts`** came from third-party sources and
  must be re-verified against the official docs before this points at real
  funds.
