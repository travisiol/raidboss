"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";
import { useRaid, useYourStake } from "@/lib/raidState";
import { leaderboard } from "@/lib/sim";
import { pct, short, shortAddress, usdg } from "@/lib/format";
import { raidRules } from "@/lib/site-config";
import { Label } from "@/components/ui/Label";

/**
 * Who is owed what.
 *
 * A leaderboard here is not a vanity board — it is the payout table, and it is
 * live, so every row's third column is real money that moves when anybody
 * hits. Showing damage without showing what the damage is currently worth
 * would be the one place on the page where a number is decorative, so the
 * USDG column is the one set in gold and the damage column supports it.
 *
 * Your own row is pinned to the bottom whenever you are outside the top ten,
 * because "where am I" should never require scrolling a list that reorders
 * itself twice a second.
 */
export function DamageBoard() {
  const { state, address } = useRaid();
  const stake = useYourStake();

  const payout =
    (state.boss.pot * (10_000 - raidRules.carryBps)) / 10_000;
  const rows = leaderboard(state, 10);
  const you = address ? address.toLowerCase() : "you";
  const inTop = rows.some((row) => row.wallet === you);

  return (
    <div className="slab flex h-[420px] flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between pb-3">
        <Label>Damage board</Label>
        <span className="type-label text-bone-muted">
          {Object.keys(state.damage).length} wallets
        </span>
      </div>

      <div className="type-label grid grid-cols-[24px_1fr_72px_84px] gap-2 border-b border-rule pb-2 text-bone-muted">
        <span>#</span>
        <span>Wallet</span>
        <span className="text-right">Damage</span>
        <span className="text-right">Owed</span>
      </div>

      <ol className="thin-scroll -mr-2 flex-1 overflow-y-auto pr-2">
        {rows.map((row, index) => (
          <Row
            key={row.wallet}
            rank={index + 1}
            wallet={row.wallet}
            damage={row.damage}
            share={row.share}
            owed={payout * row.share}
            isYou={row.wallet === you}
          />
        ))}
        {rows.length === 0 && (
          <li className="type-data py-6 text-center text-bone-muted">
            Nobody has hit this one yet.
          </li>
        )}
      </ol>

      {!inTop && (
        <div className="mt-2 border-t border-venom/30 pt-2">
          <Row
            rank={0}
            wallet={you}
            damage={stake.damage}
            share={stake.share}
            owed={stake.projected}
            isYou
          />
        </div>
      )}

      <p className="type-data border-t border-rule pt-3 text-bone-muted">
        Owed is {(10_000 - raidRules.carryBps) / 100}% of the pot split pro
        rata. It moves every time anyone hits.
      </p>
    </div>
  );
}

function Row({
  rank,
  wallet,
  damage,
  share,
  owed,
  isYou,
}: {
  rank: number;
  wallet: string;
  damage: number;
  share: number;
  owed: number;
  isYou: boolean;
}) {
  return (
    <motion.li
      layout
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        "relative grid grid-cols-[24px_1fr_72px_84px] items-center gap-2 border-b border-rule/50 py-2",
        isYou && "bg-venom/5",
      )}
    >
      {/* Share drawn behind the row, so rank is felt before it is read. */}
      <span
        aria-hidden
        className={clsx(
          "absolute inset-y-0 left-0 -z-0",
          isYou ? "bg-venom/12" : "bg-bone/5",
        )}
        style={{ width: `${Math.min(100, share * 100)}%` }}
      />
      <span
        className={clsx(
          "type-data relative",
          rank === 1 ? "text-gold" : "text-bone-muted",
        )}
      >
        {rank === 0 ? "—" : rank}
      </span>
      <span
        className={clsx(
          "type-data relative truncate",
          isYou ? "text-venom" : "text-bone-soft",
        )}
      >
        {isYou ? "you" : shortAddress(wallet)}
        <span className="ml-2 text-bone-muted">{pct(share)}</span>
      </span>
      <span
        className={clsx(
          "type-figure-sm relative text-right",
          isYou ? "text-venom" : "text-bone",
        )}
      >
        {short(damage)}
      </span>
      <span className="type-figure-sm relative text-right text-gold">
        {usdg(owed)}
      </span>
    </motion.li>
  );
}
