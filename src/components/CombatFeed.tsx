"use client";

import { AnimatePresence, motion } from "framer-motion";
import { clsx } from "clsx";
import { useRaid } from "@/lib/raidState";
import { ago, short, shortAddress } from "@/lib/format";
import { maxHitForBoss } from "@/lib/site-config";
import { Label } from "@/components/ui/Label";

/**
 * Every hit, as it lands.
 *
 * The feed is the proof that the bar is not decorative — a number moving on
 * its own is a widget, the same number with an address and a timestamp beside
 * it is a market. Each row carries a miniature bar scaled to the largest hit
 * the rules allow, rather than to the boss's full health: against the full bar
 * every legal hit is a sliver and the column reads as noise, while against the
 * cap the same rows show the shape of the raid — mostly small, the occasional
 * whale going to the limit.
 */
export function CombatFeed() {
  const { state, elapsed, mounted } = useRaid();
  const cap = maxHitForBoss(state.boss.id);

  return (
    <div className="slab flex h-[420px] flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between pb-3">
        <Label>Combat log</Label>
        <span className="type-label flex items-center gap-1.5 text-bone-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-jade breathe" />
          {state.hits.length} recent
        </span>
      </div>

      <ol className="thin-scroll -mr-2 flex-1 overflow-y-auto pr-2">
        <AnimatePresence initial={false}>
          {state.hits.map((hit) => {
            const reach = Math.min(1, hit.damage / cap);
            return (
              <motion.li
                key={hit.id}
                layout
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className={clsx(
                  "relative flex items-center gap-3 border-b border-rule/60 py-2",
                  hit.isYou && "bg-venom/5",
                )}
              >
                <span
                  aria-hidden
                  className={clsx(
                    "h-6 w-0.5 shrink-0",
                    hit.isYou
                      ? "bg-venom"
                      : hit.heavy
                        ? "bg-blood"
                        : "bg-rule-strong",
                  )}
                />

                <span
                  className={clsx(
                    "type-data w-[92px] shrink-0 truncate",
                    hit.isYou ? "text-venom" : "text-bone-soft",
                  )}
                >
                  {hit.isYou ? "you" : shortAddress(hit.wallet)}
                </span>

                {/* The hit, drawn against the cap. See the note below. */}
                <span className="relative h-1.5 flex-1 bg-abyss/70">
                  <span
                    className={clsx(
                      "absolute inset-y-0 left-0",
                      hit.isYou ? "bg-venom" : "bg-blood/70",
                    )}
                    style={{ width: `${Math.max(2, reach * 100)}%` }}
                  />
                </span>

                <span
                  className={clsx(
                    "type-figure-sm w-[70px] shrink-0 text-right",
                    hit.isYou ? "text-venom" : "text-bone",
                  )}
                >
                  {short(hit.damage)}
                </span>

                <span
                  className="type-data w-[34px] shrink-0 text-right text-bone-muted"
                  suppressHydrationWarning
                >
                  {mounted ? ago(hit.at, elapsed) : "—"}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      <p className="type-data border-t border-rule pt-3 text-bone-muted">
        Bars are drawn against the biggest hit the rules allow — {short(cap)}
        on this boss. A full row is a wallet swinging at the cap.
      </p>
    </div>
  );
}
