/**
 * RAIDBOSS — one boss, one health bar, one pot.
 *
 * The name lives in exactly three strings below (`name`, `wordmark`,
 * `ticker`). Nothing else in the codebase spells it out, so renaming the
 * project is a three-line edit plus the env var prefix.
 */
export const siteConfig = {
  /** All-caps lockup: metadata, nav, OG image. */
  name: "RAIDBOSS",
  /** Title-case form used where the wordmark is set as a word, not a mark. */
  wordmark: "Raid Boss",
  ticker: "$RAID",
  tagline: "Every buy is a hit.",
  description:
    "A boss stands on chain with a public health bar. Every buy of $RAID lands as damage and pays a fee into the pot. At zero health the pot is split between everyone who hit it — pro rata to damage dealt — and a bigger boss takes its place.",
  seoDescription:
    "A boss with a live health bar. Every buy deals damage, every kill splits the pot in USDG, and the next boss is bigger.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://raidboss.example",
  x: envOrNull(process.env.NEXT_PUBLIC_RAID_X),
  discord: envOrNull(process.env.NEXT_PUBLIC_RAID_DISCORD),
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
  feeBps: envNum(process.env.NEXT_PUBLIC_RAID_FEE_BPS, 300),

  /** Health of the first boss, in damage points (= USDG of buy volume). */
  baseHealth: envNum(process.env.NEXT_PUBLIC_RAID_BASE_HEALTH, 250_000),

  /**
   * Each boss is this much bigger than the one before. Boss N has
   * `baseHealth * growth^(N-1)` health, so the run visibly escalates instead
   * of resetting.
   */
  growth: envNum(process.env.NEXT_PUBLIC_RAID_GROWTH, 1.75),

  /**
   * Share of a dead boss's pot that seeds the next one, in basis points. The
   * rest is paid out. Without a seed the first hitters on a fresh boss are
   * swinging at an empty pot, which is the least interesting moment in the
   * loop; a small carry means there is always something on the table.
   */
  carryBps: envNum(process.env.NEXT_PUBLIC_RAID_CARRY_BPS, 1000),

  /**
   * No single buy may deal more than this share of a boss's max health, in
   * basis points. This is a game rule, not a safety rail: without it one
   * wallet can one-shot a boss and there is no raid, no leaderboard and
   * nothing to watch. At 800 bps a boss needs at least thirteen hits to die.
   */
  maxHitBps: envNum(process.env.NEXT_PUBLIC_RAID_MAX_HIT_BPS, 800),

  /** Bosses to climb before the model is at its heaviest crown. */
  tierDepth: 6,
} as const;

/** Health of boss number `n` (1-indexed). */
export function healthForBoss(n: number): number {
  return Math.round(raidRules.baseHealth * raidRules.growth ** (n - 1));
}

/**
 * How far up the ladder boss `n` is, 0 to 1.
 *
 * The shader reads this to size the crown: an older boss carries heavier
 * horns, so its rank is legible from the skull alone at any distance and in
 * any crop. It is a continuous value rather than a count because the model
 * grows the same three pairs instead of sprouting new ones — a head can only
 * carry so many before they stop reading as horns and start reading as a bush.
 */
export function tierForBoss(n: number): number {
  return Math.min(1, Math.max(0, (n - 1) / raidRules.tierDepth));
}

const RANKS = [
  "Whelp",
  "Drake",
  "Wyrm",
  "Ancient",
  "Elder",
  "Primeval",
  "Titan",
] as const;

/**
 * The name for that rank. Ladders that only count get boring at boss nine;
 * a word that changes is the cheapest way to make the eleventh kill feel
 * different from the third, and it is what a clip caption writes itself with.
 */
export function rankForBoss(n: number): string {
  return RANKS[Math.min(Math.max(n - 1, 0), RANKS.length - 1)];
}

/** The largest single hit allowed against boss number `n`. */
export function maxHitForBoss(n: number): number {
  return Math.round((healthForBoss(n) * raidRules.maxHitBps) / 10_000);
}

/**
 * Chain surface. Every address is env-driven so no placeholder can ship
 * hardcoded.
 */
export const chainConfig = {
  /** Optional. A purpose-built raid contract, if one is ever deployed. */
  contractAddress: envOrNull(
    process.env.NEXT_PUBLIC_RAID_CONTRACT_ADDRESS,
  ) as `0x${string}` | null,
  /** The token itself. Holding it is what puts a wallet in the raid. */
  tokenAddress: envOrNull(
    process.env.NEXT_PUBLIC_RAID_TOKEN_ADDRESS,
  ) as `0x${string}` | null,
  /** The pool buys flow through. This is what makes POOL mode possible. */
  poolAddress: envOrNull(
    process.env.NEXT_PUBLIC_RAID_POOL_ADDRESS,
  ) as `0x${string}` | null,
  /** The quote token. Damage is denominated in it. */
  usdgAddress: envOrNull(
    process.env.NEXT_PUBLIC_USDG_ADDRESS,
  ) as `0x${string}` | null,
  /** Block the raid starts counting from. Everything before it is ignored. */
  startBlock: BigInt(process.env.NEXT_PUBLIC_RAID_START_BLOCK ?? "0"),
  /** Where the strike button sends a buyer. Prefilled with the amount. */
  dexUrl: envOrNull(process.env.NEXT_PUBLIC_RAID_DEX_URL),
  isLive: process.env.NEXT_PUBLIC_RAID_LIVE === "true",
} as const;

/**
 * How the raid gets its state. Three sources, one rules engine.
 *
 *   CONTRACT  a purpose-built raid contract reports the arena directly.
 *   POOL      no custom contract at all: the site watches quote-token
 *             transfers into the pool, treats each as a buy, and replays them
 *             through the same `applyHit` the simulation uses. This is the
 *             mode that makes the thing playable with nothing deployed but a
 *             token and a pool, which is the situation almost every project
 *             is actually in.
 *   SIM       nothing configured. The rules run locally and say so.
 *
 * POOL is deliberately listed second, not last: it is the default expectation
 * for a launch, and CONTRACT is the upgrade, not the other way round.
 */
export type RaidMode = "contract" | "pool" | "sim";

export const raidMode: RaidMode = !chainConfig.isLive
  ? "sim"
  : chainConfig.contractAddress && chainConfig.usdgAddress
    ? "contract"
    : chainConfig.tokenAddress &&
        chainConfig.poolAddress &&
        chainConfig.usdgAddress
      ? "pool"
      : "sim";

/**
 * True when the numbers on screen come off a chain. Everything user-facing
 * branches on this one flag rather than checking addresses in components.
 */
export const isLive = raidMode !== "sim";

/**
 * A caveat POOL mode owes the reader.
 *
 * Counting quote-token transfers into the pool counts buys, and it also
 * counts anyone adding liquidity, because on chain those look the same. The
 * site says so rather than quietly overstating damage; a purpose-built
 * contract is what removes the ambiguity, and that is most of the argument
 * for deploying one.
 */
export const poolModeCaveat =
  "Damage is read from USDG going into the pool. Liquidity adds look like buys on chain and are counted with them.";
