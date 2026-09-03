/**
 * The raid surface the site expects from the deployed contract.
 *
 * The page is a live readout: it redraws the boss, the bar, the pot and the
 * leaderboard together, many times a second, and they have to agree with each
 * other. Reading them from four separate views means the bar can be one block
 * ahead of the pot and the page shows a state that never existed on chain. So
 * `currentBoss` returns the whole arena in one struct, one call, one block —
 * the same reason REGOLITH packs 999 parcels into a bitmap.
 *
 * `leaderboard` is the one concession to gas: a contract cannot cheaply sort,
 * so it is expected to keep a bounded top-N array (insertion into a fixed
 * window on each hit) rather than an unbounded sorted set. Anything below the
 * window is not shown as a rank, only as your own line via `damageOf`.
 *
 * Amounts are USDG, 6 decimals. Damage points share that scale: one USDG of
 * buy is one point of damage, so `health` and `pot` are directly comparable
 * and the site never has to convert between two units to draw the bar.
 *
 * If the deployed contract names these differently, this file is the only
 * place to change.
 */
export const raidAbi = [
  {
    type: "function",
    name: "currentBoss",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint32" },
          { name: "maxHealth", type: "uint128" },
          { name: "health", type: "uint128" },
          { name: "pot", type: "uint128" },
          { name: "hitters", type: "uint32" },
          { name: "spawnedAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "leaderboard",
    stateMutability: "view",
    inputs: [{ name: "count", type: "uint256" }],
    outputs: [
      { name: "wallets", type: "address[]" },
      { name: "damage", type: "uint128[]" },
    ],
  },
  {
    type: "function",
    name: "damageOf",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    /** USDG already won on dead bosses and waiting to be pulled. */
    type: "function",
    name: "pendingLoot",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    /**
     * Buy `$RAID` with `amountUsdg` and land the hit. `minTokensOut` is the
     * caller's slippage bound — the swap and the damage are the same
     * transaction on purpose, so there is no way to take the price without
     * taking the fee, and no way to damage the boss without buying.
     */
    type: "function",
    name: "strike",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountUsdg", type: "uint256" },
      { name: "minTokensOut", type: "uint256" },
    ],
    outputs: [{ name: "damage", type: "uint128" }],
  },
  {
    type: "function",
    name: "claimLoot",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "amount", type: "uint128" }],
  },
  {
    type: "event",
    name: "Hit",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "bossId", type: "uint32", indexed: true },
      { name: "damage", type: "uint128", indexed: false },
      { name: "healthLeft", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BossKilled",
    inputs: [
      { name: "bossId", type: "uint32", indexed: true },
      { name: "killer", type: "address", indexed: true },
      { name: "pot", type: "uint128", indexed: false },
      { name: "hitters", type: "uint32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BossSpawned",
    inputs: [
      { name: "bossId", type: "uint32", indexed: true },
      { name: "maxHealth", type: "uint128", indexed: false },
      { name: "seededPot", type: "uint128", indexed: false },
    ],
  },
] as const;

/** Minimal ERC-20 surface: balances for the holder panel, allowance for
 *  the contract path, and the two metadata calls the UI labels with. */
export const erc20Abi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** USDG is a 6-decimal dollar token; damage points share the scale. */
export const USDG_DECIMALS = 6;

/** Chain amount (6dp) to the plain number the UI works in. */
export function fromUsdg(value: bigint): number {
  return Number(value) / 10 ** USDG_DECIMALS;
}

/** Plain number back to a 6dp chain amount. */
export function toUsdg(value: number): bigint {
  return BigInt(Math.round(value * 10 ** USDG_DECIMALS));
}
