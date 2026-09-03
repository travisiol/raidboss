/**
 * HYDRA — one boss, one health bar, one pot.
 *
 * The name lives in exactly three strings below (`name`, `wordmark`,
 * `ticker`). Nothing else in the codebase spells it out, so renaming the
 * project is a three-line edit plus the env var prefix.
 */
export const siteConfig = {
  /** All-caps lockup: metadata, nav, OG image. */
  name: "HYDRA",
  /** Title-case form used where the wordmark is set as a word, not a mark. */
  wordmark: "Hydra",
  ticker: "$HYDRA",
  tagline: "Every buy is a hit.",
  description:
    "A boss stands on chain with a public health bar. Every buy of $HYDRA lands as damage and pays a fee into the pot. At zero health the pot is split between everyone who hit it — pro rata to damage dealt — and a bigger boss takes its place.",
  seoDescription:
    "A boss with a live health bar. Every buy deals damage, every kill splits the pot in USDG, and the next boss is bigger.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hydra.example",
  x: envOrNull(process.env.NEXT_PUBLIC_HYDRA_X),
  discord: envOrNull(process.env.NEXT_PUBLIC_HYDRA_DISCORD),
} as const;

function envOrNull(value: string | undefined): string | null {
  return value && value.trim().length > 0 ? value : null;
}

function envNum(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * The rules of the raid.
 *
 * These are the numbers a player has to be able to recite after ten seconds
 * on the page, so they are stated once here and read everywhere — the copy in
 * `HowItWorks`, the damage preview in `StrikePanel` and the simulation all
 * derive from this object rather than repeating literals.
 *
 * Damage is denominated in the same unit as the buy: one USDG spent is one
 * point of damage. That equivalence is the reason the whole thing is legible
 * — a health bar of 250,000 is a boss that dies after 250,000 USDG of buys,
 * and the pot on the table is always `feeBps` of that.
 */
export const raidRules = {
  /** Fee taken from every buy, in basis points. Collected as USDG. */
  feeBps: envNum(process.env.NEXT_PUBLIC_HYDRA_FEE_BPS, 300),

  /** Health of the first boss, in damage points (= USDG of buy volume). */
  baseHealth: envNum(process.env.NEXT_PUBLIC_HYDRA_BASE_HEALTH, 250_000),

  /**
   * Each boss is this much bigger than the one before. Boss N has
   * `baseHealth * growth^(N-1)` health, so the run visibly escalates instead
   * of resetting.
   */
  growth: envNum(process.env.NEXT_PUBLIC_HYDRA_GROWTH, 1.75),

  /**
   * Share of a dead boss's pot that seeds the next one, in basis points. The
   * rest is paid out. Without a seed the first hitters on a fresh boss are
   * swinging at an empty pot, which is the least interesting moment in the
   * loop; a small carry means there is always something on the table.
   */
  carryBps: envNum(process.env.NEXT_PUBLIC_HYDRA_CARRY_BPS, 1000),

  /**
   * No single buy may deal more than this share of a boss's max health, in
   * basis points. This is a game rule, not a safety rail: without it one
   * wallet can one-shot a boss and there is no raid, no leaderboard and
   * nothing to watch. At 800 bps a boss needs at least thirteen hits to die.
   */
  maxHitBps: envNum(process.env.NEXT_PUBLIC_HYDRA_MAX_HIT_BPS, 800),

  /** Heads on boss N: this many, plus one per boss cleared. Drives the model. */
  baseHeads: 3,
} as const;

/** Health of boss number `n` (1-indexed). */
export function healthForBoss(n: number): number {
  return Math.round(raidRules.baseHealth * raidRules.growth ** (n - 1));
}

/** Heads on boss number `n` (1-indexed), capped at what the model can hold. */
export function headsForBoss(n: number): number {
  return Math.min(raidRules.baseHeads + (n - 1), 9);
}

/** The largest single hit allowed against boss number `n`. */
export function maxHitForBoss(n: number): number {
  return Math.round((healthForBoss(n) * raidRules.maxHitBps) / 10_000);
}

/**
 * Chain surface. Every address is env-driven so no placeholder can ship
 * hardcoded. With `contractAddress` unset the app runs the raid as a labelled
 * simulation and every write button is disabled — see `lib/raidState`.
 */
export const chainConfig = {
  contractAddress: envOrNull(
    process.env.NEXT_PUBLIC_HYDRA_CONTRACT_ADDRESS,
  ) as `0x${string}` | null,
  tokenAddress: envOrNull(
    process.env.NEXT_PUBLIC_HYDRA_TOKEN_ADDRESS,
  ) as `0x${string}` | null,
  usdgAddress: envOrNull(
    process.env.NEXT_PUBLIC_USDG_ADDRESS,
  ) as `0x${string}` | null,
  isLive: process.env.NEXT_PUBLIC_HYDRA_LIVE === "true",
} as const;

/**
 * True only when a real raid can be read and written. Everything user-facing
 * branches on this one flag rather than checking addresses in components.
 */
export const isLive =
  chainConfig.isLive &&
  chainConfig.contractAddress !== null &&
  chainConfig.tokenAddress !== null &&
  chainConfig.usdgAddress !== null;
