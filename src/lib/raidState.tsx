"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { useAccount, useReadContracts, useWatchContractEvent } from "wagmi";
import { chainConfig, isLive, raidRules } from "@/lib/site-config";
import { fromUsdg, hydraAbi } from "@/lib/hydraAbi";
import {
  applyHit,
  makeAddress,
  mulberry32,
  rollBuy,
  rollDelay,
  seedRaid,
  YOU,
  type Boss,
  type Kill,
  type RaidSnapshot,
} from "@/lib/sim";

/**
 * Everything the boss canvas needs, in a mutable box.
 *
 * The canvas runs its own 60fps loop and must never be re-rendered by React —
 * a remount drops the WebGL context and the shader restarts. So the values it
 * animates on live in a ref that callbacks write to and the render loop reads,
 * and the component itself renders exactly once.
 */
export type Visuals = {
  /** 1 at full health, 0 at death. */
  hp: number;
  heads: number;
  /** Bumped on every landed hit so the loop can kick without polling. */
  hitSeq: number;
  /** Non-zero while the death sequence is playing. */
  death: number;
  deathSeq: number;
};

export type Pop = {
  id: string;
  damage: number;
  isYou: boolean;
  heavy: boolean;
  /** Percent offsets inside the stage, so popups land on the beast. */
  x: number;
  y: number;
};

type RaidContextValue = {
  state: RaidSnapshot;
  /** ms since mount, ticking at 1Hz. Seeded history carries negative stamps. */
  elapsed: number;
  /** False during SSR and the first client render; true from then on. */
  mounted: boolean;
  /** True when a real contract is configured and being read. */
  live: boolean;
  /** The most recent kill, held for the death overlay, then cleared. */
  killFlash: Kill | null;
  pops: Pop[];
  /** Bumped on every landed hit; cheap trigger for one-shot animations. */
  hitSeq: number;
  visuals: RefObject<Visuals>;
  strike: (amountUsdg: number) => void;
  /** Your address when connected, otherwise undefined. */
  address: `0x${string}` | undefined;
};

const RaidContext = createContext<RaidContextValue | null>(null);

/**
 * One deterministic starting arena, computed at module load so the server and
 * the client produce byte-identical first frames. Timestamps in it are
 * relative to mount and negative, which is what keeps `ago()` deterministic
 * during SSR — nothing here calls `Date.now()`.
 */
const SEED = seedRaid();

const DEATH_MS = 3200;

/**
 * Hydration flag without a setState in an effect. The server snapshot is
 * false and the client snapshot is true, so the first client render still
 * matches the HTML and the second one has the live clock.
 */
const noopSubscribe = () => () => {};

export function RaidProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const [state, setState] = useState<RaidSnapshot>(SEED);
  const [elapsed, setElapsed] = useState(0);
  const [killFlash, setKillFlash] = useState<Kill | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [hitSeq, setHitSeq] = useState(0);

  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  /*
   * The epoch every relative timestamp is measured from. It has to be
   * readable during render (the live path rebases the chain's absolute
   * `spawnedAt` against it), which a ref is not allowed to be, and it must be
   * fixed for the life of the provider — a lazy initialiser is both.
   */
  const [mountEpoch] = useState(() => Date.now());
  const now = useCallback(() => Date.now() - mountEpoch, [mountEpoch]);

  const visuals = useRef<Visuals>({
    hp: SEED.boss.health / SEED.boss.maxHealth,
    heads: SEED.boss.heads,
    hitSeq: 0,
    death: 0,
    deathSeq: 0,
  });

  /*
   * The authoritative snapshot for anything that arrives asynchronously.
   * `land` is the only writer of `state`, and it updates this on the same
   * line, so two hits landing inside one React batch still compose.
   */
  const stateRef = useRef<RaidSnapshot>(SEED);

  /* ---- Clock ----------------------------------------------------------- */

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Date.now() - mountEpoch);
    }, 1000);
    return () => window.clearInterval(id);
  }, [mountEpoch]);

  /* ---- Landing a hit --------------------------------------------------- */

  const land = useCallback(
    (wallet: string, amount: number) => {
      const result = applyHit(stateRef.current, wallet, amount, now());
      stateRef.current = result.next;
      setState(result.next);
      setHitSeq((n) => n + 1);

      const box = visuals.current;
      const hit = result.next.hits[0];
      box.hp = result.next.boss.health / result.next.boss.maxHealth;
      box.heads = result.next.boss.heads;
      box.hitSeq += 1;

      if (hit) {
        setPops((current) =>
          [
            ...current,
            {
              id: hit.id,
              damage: hit.damage,
              isYou: hit.isYou,
              heavy: hit.heavy,
              x: 30 + Math.random() * 40,
              y: 24 + Math.random() * 34,
            },
          ].slice(-7),
        );
        window.setTimeout(() => {
          setPops((current) => current.filter((pop) => pop.id !== hit.id));
        }, 1250);
      }

      if (result.killed) {
        box.death = 1;
        box.deathSeq += 1;
        box.hp = 0;
        setKillFlash(result.killed);
        // The corpse sinks through the first two thirds of the sequence and
        // the next boss rises through the last third, so health has to be back
        // up before the shader stops sinking — otherwise a fresh boss surfaces
        // with its heads already dead.
        window.setTimeout(() => {
          box.hp = 1;
          box.heads = stateRef.current.boss.heads;
        }, DEATH_MS * 0.6);
        window.setTimeout(() => {
          box.death = 0;
        }, DEATH_MS);
        window.setTimeout(() => setKillFlash(null), DEATH_MS + 2400);
      }
    },
    [now],
  );

  /* ---- The simulation -------------------------------------------------- */

  useEffect(() => {
    if (isLive) return;
    // Seeded from the clock so two tabs do not run the same "random" raid,
    // but only after mount — the first frame is always the shared seed.
    const rand = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
    const wallets = Array.from({ length: 52 }, () => makeAddress(rand));
    let timer = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const current = stateRef.current;
      const urgency = 1 - current.boss.health / current.boss.maxHealth;
      // The arena is frozen while the death sequence plays; picking straight
      // back up would spawn the next boss underneath the overlay.
      const paused = visuals.current.death > 0;
      if (!paused) {
        land(wallets[Math.floor(rand() * wallets.length)], rollBuy(rand));
      }
      timer = window.setTimeout(
        tick,
        paused ? DEATH_MS : rollDelay(rand, urgency),
      );
    };

    timer = window.setTimeout(tick, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [land]);

  /* ---- The chain ------------------------------------------------------- */

  /*
   * Inert until the contract address is set. `currentBoss` is one call for the
   * whole arena so the bar, the pot and the hit count can never disagree with
   * each other, and the result is *derived* into the snapshot rather than
   * copied into state — a chain read is not an event, and mirroring it into
   * useState only creates a second copy that can lag the first.
   */
  const chainReads = useReadContracts({
    contracts: isLive
      ? [
          {
            address: chainConfig.contractAddress!,
            abi: hydraAbi,
            functionName: "currentBoss",
          },
          {
            address: chainConfig.contractAddress!,
            abi: hydraAbi,
            functionName: "leaderboard",
            args: [20n],
          },
        ]
      : [],
    query: { enabled: isLive, refetchInterval: 6000 },
  });

  const chainBoss = useMemo<Boss | null>(() => {
    const result = chainReads.data?.[0];
    if (!isLive || result?.status !== "success") return null;
    const raw = result.result as {
      id: number;
      maxHealth: bigint;
      health: bigint;
      pot: bigint;
      spawnedAt: bigint;
    };
    return {
      id: raw.id,
      maxHealth: fromUsdg(raw.maxHealth),
      health: fromUsdg(raw.health),
      pot: fromUsdg(raw.pot),
      heads: Math.min(raidRules.baseHeads + (raw.id - 1), 9),
      spawnedAt: Number(raw.spawnedAt) * 1000 - mountEpoch,
    };
  }, [chainReads.data, mountEpoch]);

  const chainDamage = useMemo<Record<string, number> | null>(() => {
    const result = chainReads.data?.[1];
    if (!isLive || result?.status !== "success") return null;
    const [wallets, amounts] = result.result as [
      readonly `0x${string}`[],
      readonly bigint[],
    ];
    const damage: Record<string, number> = {};
    wallets.forEach((wallet, index) => {
      damage[wallet.toLowerCase()] = fromUsdg(amounts[index] ?? 0n);
    });
    return damage;
  }, [chainReads.data]);

  // The canvas reads a ref, so the chain has to push into it; a ref write in
  // an effect is the supported way round.
  useEffect(() => {
    if (!chainBoss) return;
    visuals.current.hp = chainBoss.health / Math.max(1, chainBoss.maxHealth);
    visuals.current.heads = chainBoss.heads;
  }, [chainBoss]);

  useWatchContractEvent({
    address: chainConfig.contractAddress ?? undefined,
    abi: hydraAbi,
    eventName: "Hit",
    enabled: isLive,
    onLogs: (logs) => {
      for (const log of logs) {
        const args = log.args as { wallet?: string; damage?: bigint };
        if (!args.wallet || args.damage === undefined) continue;
        land(args.wallet.toLowerCase(), fromUsdg(args.damage));
      }
    },
  });

  /* ---- The player ------------------------------------------------------ */

  const strike = useCallback(
    (amountUsdg: number) => {
      if (!Number.isFinite(amountUsdg) || amountUsdg <= 0) return;
      // Live mode routes through the contract in `StrikePanel`; this path is
      // the simulated hit, and is labelled as such wherever it is offered.
      if (isLive) return;
      land(YOU, amountUsdg);
    },
    [land],
  );

  const snapshot = useMemo<RaidSnapshot>(
    () =>
      chainBoss
        ? { ...state, boss: chainBoss, damage: chainDamage ?? state.damage }
        : state,
    [state, chainBoss, chainDamage],
  );

  const value = useMemo<RaidContextValue>(
    () => ({
      state: snapshot,
      elapsed,
      mounted,
      live: isLive,
      killFlash,
      pops,
      hitSeq,
      visuals,
      strike,
      address,
    }),
    [snapshot, elapsed, mounted, killFlash, pops, hitSeq, strike, address],
  );

  return <RaidContext.Provider value={value}>{children}</RaidContext.Provider>;
}

export function useRaid(): RaidContextValue {
  const context = useContext(RaidContext);
  if (!context) throw new Error("useRaid must be used inside <RaidProvider>");
  return context;
}

/** Your damage on the current boss, and what it is currently worth. */
export function useYourStake() {
  const { state, address } = useRaid();
  const key = address ? address.toLowerCase() : YOU;
  const damage = state.damage[key] ?? state.damage[YOU] ?? 0;
  const total = Object.values(state.damage).reduce((sum, d) => sum + d, 0);
  const share = total > 0 ? damage / total : 0;
  const payout = (state.boss.pot * (10_000 - raidRules.carryBps)) / 10_000;
  return { damage, share, projected: payout * share, total };
}
