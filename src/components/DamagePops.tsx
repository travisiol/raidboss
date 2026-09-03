"use client";

import { AnimatePresence, motion } from "framer-motion";
import { clsx } from "clsx";
import { useRaid } from "@/lib/raidState";
import { short } from "@/lib/format";

/**
 * Damage numbers, thrown off the beast where the hit landed.
 *
 * The one rule is that your own hits look different from everyone else's:
 * theirs are small and bone-coloured, yours are venom, larger, and arrive with
 * a ring. In a feed moving at two hits a second, "which of these was me" is
 * the only question a player is actually asking, and colour answers it faster
 * than reading an address.
 */
export function DamagePops() {
  const { pops } = useRaid();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <AnimatePresence>
        {pops.map((pop) => (
          <motion.div
            key={pop.id}
            className="absolute"
            style={{ left: `${pop.x}%`, top: `${pop.y}%` }}
            initial={{ opacity: 0, y: 10, scale: pop.isYou ? 0.6 : 0.8 }}
            animate={{ opacity: 1, y: -58, scale: 1 }}
            exit={{ opacity: 0, y: -84, scale: 0.9 }}
            transition={{
              duration: 1.2,
              ease: [0.16, 1, 0.3, 1],
              opacity: { duration: 0.9, times: [0, 0.15, 1] },
            }}
          >
            {pop.isYou && (
              <span className="pulse-ring absolute -inset-6 rounded-full border border-venom/60" />
            )}
            <span
              className={clsx(
                "relative block font-[family-name:var(--font-display)] leading-none tabular-nums",
                pop.isYou
                  ? "glow-venom text-venom"
                  : pop.heavy
                    ? "text-bone glow-blood"
                    : "text-bone-soft",
                pop.isYou
                  ? "text-4xl sm:text-5xl"
                  : pop.heavy
                    ? "text-2xl sm:text-3xl"
                    : "text-lg sm:text-xl",
              )}
            >
              {short(pop.damage)}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
