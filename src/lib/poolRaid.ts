"use client";

import { useEffect, useRef, useState } from "react";
import { parseAbiItem, type Address, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { chainConfig, raidMode } from "@/lib/site-config";
import { fromUsdg } from "@/lib/raidAbi";

/**
 * The raid, read off a plain token and a plain pool.
 *
 * This is the mode that makes the site playable without deploying anything.
 * A buy is USDG moving into the pool, so watching one ERC-20 event on the
 * quote token is enough to reconstruct the whole arena: who hit, how hard, in
 * what order. Those buys are then replayed through exactly the same
 * `applyHit` the simulation uses, which is the point — there is one rules
 * engine in this codebase and three ways of feeding it, so the health bar can
 * never mean one thing on a chain and another in a preview.
 *
 * Two things it is honest about:
 *
 *   It counts liquidity adds as buys, because on chain they are the same
 *   event. `poolModeCaveat` says so on the page.
 *
 *   It reads history from `startBlock`, so the raid begins when you say it
 *   begins rather than at the token's genesis. Set that to the block the
 *   pool opened.
 */

const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export type Buy = {
  wallet: string;
  /** USDG, as a plain number. One USDG is one point of damage. */
  amount: number;
  /** Unix ms. Block timestamps, so the ordering is the chain's, not ours. */
  at: number;
  /** Deduplication key: a log is uniquely identified by tx plus index. */
  key: string;
};

/** Blocks per `getLogs` call. Public RPCs commonly refuse much more. */
const CHUNK = 2_000n;
/** Ceiling on the backfill, so a long-running raid cannot hang the page. */
const MAX_CHUNKS = 60;

type State = {
  buys: Buy[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** Blocks scanned, for the honest "still catching up" line in the UI. */
  scannedTo: bigint | null;
};

async function fetchRange(
  client: PublicClient,
  usdg: Address,
  pool: Address,
  from: bigint,
  to: bigint,
): Promise<Buy[]> {
  const logs = await client.getLogs({
    address: usdg,
    event: TRANSFER,
    args: { to: pool },
    fromBlock: from,
    toBlock: to,
  });

  // Block timestamps come from the blocks, not the logs, so they are fetched
  // once per distinct block rather than once per transfer.
  const blocks = new Map<bigint, number>();
  for (const log of logs) {
    if (log.blockNumber === null || blocks.has(log.blockNumber)) continue;
    const block = await client.getBlock({ blockNumber: log.blockNumber });
    blocks.set(log.blockNumber, Number(block.timestamp) * 1000);
  }

  return logs.flatMap((log) => {
    const value = log.args.value;
    const wallet = log.args.from;
    if (value === undefined || !wallet) return [];
    return [
      {
        wallet: wallet.toLowerCase(),
        amount: fromUsdg(value),
        at: blocks.get(log.blockNumber ?? 0n) ?? Date.now(),
        key: `${log.transactionHash}-${log.logIndex}`,
      },
    ];
  });
}

/**
 * Every buy since `startBlock`, oldest first, plus everything that lands
 * while the page is open. Inert unless the mode is POOL.
 */
export function usePoolBuys(): State {
  const client = usePublicClient();
  const [state, setState] = useState<State>({
    buys: [],
    status: raidMode === "pool" ? "loading" : "idle",
    error: null,
    scannedTo: null,
  });
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (raidMode !== "pool" || !client) return;
    const usdg = chainConfig.usdgAddress as Address;
    const pool = chainConfig.poolAddress as Address;
    let cancelled = false;

    const push = (incoming: Buy[]) => {
      const fresh = incoming.filter((buy) => !seen.current.has(buy.key));
      if (fresh.length === 0) return;
      for (const buy of fresh) seen.current.add(buy.key);
      setState((current) => ({
        ...current,
        buys: [...current.buys, ...fresh].sort((a, b) => a.at - b.at),
      }));
    };

    const backfill = async () => {
      try {
        const head = await client.getBlockNumber();
        let from =
          chainConfig.startBlock > 0n
            ? chainConfig.startBlock
            : head > 50_000n
              ? head - 50_000n
              : 0n;

        for (let i = 0; i < MAX_CHUNKS && from <= head; i += 1) {
          if (cancelled) return;
          const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n;
          push(await fetchRange(client, usdg, pool, from, to));
          setState((current) => ({ ...current, scannedTo: to }));
          from = to + 1n;
        }
        if (!cancelled) {
          setState((current) => ({ ...current, status: "ready" }));
        }
      } catch (error) {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    };

    void backfill();

    // Live tail. Watching is separate from the backfill on purpose: a buy that
    // lands mid-backfill still arrives, and the dedupe key sorts out the
    // overlap rather than the two paths having to coordinate.
    const unwatch = client.watchEvent({
      address: usdg,
      event: TRANSFER,
      args: { to: pool },
      onLogs: (logs) => {
        push(
          logs.flatMap((log) => {
            const value = log.args.value;
            const wallet = log.args.from;
            if (value === undefined || !wallet) return [];
            return [
              {
                wallet: wallet.toLowerCase(),
                amount: fromUsdg(value),
                at: Date.now(),
                key: `${log.transactionHash}-${log.logIndex}`,
              },
            ];
          }),
        );
      },
    });

    return () => {
      cancelled = true;
      unwatch();
    };
  }, [client]);

  return state;
}
