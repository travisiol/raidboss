/**
 * The raid, when there is no contract to read it from.
 *
 * With `NEXT_PUBLIC_HYDRA_CONTRACT_ADDRESS` unset the site still has to show
 * a boss taking damage, because a health bar that never moves communicates
 * nothing about a product whose entire idea is a health bar that moves. So
 * this file runs the same rules locally and the UI labels it SIMULATION
 * everywhere it shows. Nothing here touches a wallet, a chain or a balance,
 * and every write control stays disabled until the real address is set.
 *
 * The one thing it takes seriously is the shape of the traffic. A raid where
 * every buy is the same size looks fake in about four seconds; real flow is
 * mostly small with a long right tail, arrives in bursts, and speeds up as a
 * boss gets close to death because that is when the pot is worth racing for.
 * All three of those are modelled below.
 */

import { healthForBoss, maxHitForBoss, raidRules } from "@/lib/site-config";

/** Deterministic PRNG, so the server and the client seed the same arena. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller, for the log-normal buy sizes. */
function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const HEX = "0123456789abcdef";

export function makeAddress(rand: () => number): string {
  let out = "0x";
  for (let i = 0; i < 40; i += 1) out += HEX[Math.floor(rand() * 16)];
  return out;
}

/**
 * A buy size in USDG. Median lands near 320 with a long tail, and one buy in
 * twenty is a whale that moves the bar visibly on its own.
 */
export function rollBuy(rand: () => number): number {
  const base = Math.exp(Math.log(320) + 1.15 * gaussian(rand));
  const whale = rand() < 0.05 ? 6 + rand() * 9 : 1;
  return Math.max(25, Math.round(base * whale));
}

/**
 * Delay to the next hit, in ms. Bursts are modelled as a coin flip on a much
 * shorter gap, and `urgency` (0 at full health, 1 at death) compresses
 * everything as the kill gets close.
 */
export function rollDelay(rand: () => number, urgency: number): number {
  const burst = rand() < 0.32;
  const base = burst ? 220 + rand() * 380 : 700 + rand() * 2100;
  return Math.round(base * (1 - 0.55 * urgency));
}

export type Hit = {
  id: string;
  wallet: string;
  damage: number;
  /** Health remaining after this hit landed. */
  healthLeft: number;
  /** Milliseconds relative to mount. Seeded history is negative. */
  at: number;
  isYou: boolean;
  /** A hit worth more than 2% of the bar gets called out in the feed. */
  heavy: boolean;
};

export type Boss = {
  id: number;
  maxHealth: number;
  health: number;
  pot: number;
  heads: number;
  /** Milliseconds relative to mount. Negative for a boss already standing. */
  spawnedAt: number;
};

export type Kill = {
  bossId: number;
  maxHealth: number;
  pot: number;
  hitters: number;
  killer: string;
  /** Milliseconds relative to mount. */
  killedAt: number;
  durationMs: number;
  /** What the connected wallet took from this corpse, if anything. */
  yourShare: number;
};

export type RaidSnapshot = {
  boss: Boss;
  /** Newest first, capped — this is a feed, not a ledger. */
  hits: Hit[];
  /** Damage dealt to the *current* boss, by wallet. */
  damage: Record<string, number>;
  kills: Kill[];
  yourWallet: string;
  yourPending: number;
  totalDamageDealt: number;
  totalPaidOut: number;
};

export const FEED_LIMIT = 60;

/** The wallet the local player hits as while the raid is simulated. */
export const YOU = "you";

export function potFor(damage: number): number {
  return (damage * raidRules.feeBps) / 10_000;
}

export function makeBoss(id: number, seededPot: number, at: number): Boss {
  const maxHealth = healthForBoss(id);
  return {
    id,
    maxHealth,
    health: maxHealth,
    pot: seededPot,
    heads: Math.min(raidRules.baseHeads + (id - 1), 9),
    spawnedAt: at,
  };
}

/**
 * Applies one hit to a snapshot and returns the next one, plus whether the
 * boss died. Pure, and shared by the simulation ticker and the local player's
 * strike so both go through exactly the same rules.
 */
export function applyHit(
  state: RaidSnapshot,
  wallet: string,
  amount: number,
  at: number,
): { next: RaidSnapshot; killed: Kill | null } {
  const boss = state.boss;
  const cap = maxHitForBoss(boss.id);
  const damage = Math.min(amount, cap, boss.health);
  const healthLeft = Math.max(0, boss.health - damage);

  const hit: Hit = {
    id: `${boss.id}-${at}-${wallet.slice(-4)}`,
    wallet,
    damage,
    healthLeft,
    at,
    isYou: wallet === YOU,
    heavy: damage / boss.maxHealth > 0.02,
  };

  const damageMap = {
    ...state.damage,
    [wallet]: (state.damage[wallet] ?? 0) + damage,
  };
  const pot = boss.pot + potFor(damage);

  const next: RaidSnapshot = {
    ...state,
    boss: { ...boss, health: healthLeft, pot },
    hits: [hit, ...state.hits].slice(0, FEED_LIMIT),
    damage: damageMap,
    totalDamageDealt: state.totalDamageDealt + damage,
  };

  if (healthLeft > 0) return { next, killed: null };

  // Dead. Split the payout share of the pot pro rata to damage dealt, carry
  // the rest into the next boss, and open the next bar.
  const payout = (pot * (10_000 - raidRules.carryBps)) / 10_000;
  const carry = pot - payout;
  const total = Object.values(damageMap).reduce((sum, d) => sum + d, 0);
  const yourDamage = damageMap[YOU] ?? 0;
  const yourShare = total > 0 ? (payout * yourDamage) / total : 0;

  const kill: Kill = {
    bossId: boss.id,
    maxHealth: boss.maxHealth,
    pot: payout,
    hitters: Object.keys(damageMap).length,
    killer: wallet,
    killedAt: at,
    durationMs: at - boss.spawnedAt,
    yourShare,
  };

  return {
    next: {
      ...next,
      boss: makeBoss(boss.id + 1, carry, at),
      damage: {},
      kills: [kill, ...next.kills].slice(0, 12),
      yourPending: next.yourPending + yourShare,
      totalPaidOut: next.totalPaidOut + payout,
    },
    killed: kill,
  };
}

/**
 * A raid already in progress, built from a fixed seed so the server and the
 * client agree on the first frame. Lands on a mid-run boss rather than a
 * fresh one — a full health bar is the least informative state this page has.
 */
export function seedRaid(seed = 0x4d1d): RaidSnapshot {
  const rand = mulberry32(seed);
  const wallets = Array.from({ length: 46 }, () => makeAddress(rand));

  let state: RaidSnapshot = {
    boss: makeBoss(1, 0, 0),
    hits: [],
    damage: {},
    kills: [],
    yourWallet: YOU,
    yourPending: 0,
    totalDamageDealt: 0,
    totalPaidOut: 0,
  };

  // Walk backwards in time: three bosses fall, then the current one is worn
  // down to somewhere in the middle of its bar.
  let clock = -1000 * 60 * 84;

  const pushHit = () => {
    const wallet = wallets[Math.floor(rand() * wallets.length)];
    const amount = rollBuy(rand);
    clock += rollDelay(rand, 1 - state.boss.health / state.boss.maxHealth);
    const result = applyHit(state, wallet, amount, clock);
    state = result.next;
  };

  for (let bossIndex = 0; bossIndex < 3; bossIndex += 1) {
    let guard = 0;
    const startId = state.boss.id;
    while (state.boss.id === startId && guard < 4000) {
      pushHit();
      guard += 1;
    }
  }

  // Now bring the standing boss down to ~58% and finish on recent history.
  const target = state.boss.maxHealth * 0.58;
  let guard = 0;
  while (state.boss.health > target && guard < 6000) {
    pushHit();
    guard += 1;
  }

  // Re-base so the newest hit reads as a couple of seconds old at first paint.
  const newest = state.hits[0]?.at ?? 0;
  const shift = -2400 - newest;
  return {
    ...state,
    boss: { ...state.boss, spawnedAt: state.boss.spawnedAt + shift },
    hits: state.hits.map((hit) => ({ ...hit, at: hit.at + shift })),
    kills: state.kills.map((kill) => ({
      ...kill,
      killedAt: kill.killedAt + shift,
    })),
  };
}

/** Top `count` wallets on the current boss, with their share of the pot. */
export function leaderboard(
  state: RaidSnapshot,
  count: number,
): { wallet: string; damage: number; share: number }[] {
  const total = Object.values(state.damage).reduce((sum, d) => sum + d, 0);
  return Object.entries(state.damage)
    .map(([wallet, damage]) => ({
      wallet,
      damage,
      share: total > 0 ? damage / total : 0,
    }))
    .sort((a, b) => b.damage - a.damage)
    .slice(0, count);
}
