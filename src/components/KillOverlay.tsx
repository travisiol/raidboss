"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRaid } from "@/lib/raidState";
import { duration, full, short, usdg } from "@/lib/format";
import { healthForBoss } from "@/lib/site-config";
import { mulberry32 } from "@/lib/sim";
import { roman } from "@/components/HealthBar";
import { shortAddress } from "@/lib/format";

/**
 * The payoff.
 *
 * This is the four seconds the whole product is built to produce, and the only
 * moment the page stops being an instrument and becomes a title card. It
 * carries exactly four numbers — what the boss was worth, how many people
 * split it, what you took, and how big the next one is — because that is what
 * somebody clipping this needs on screen, and a fifth number would cost the
 * clip its legibility.
 */
export function KillOverlay() {
  const { killFlash, address } = useRaid();

  /*
   * Loot streaks, seeded off the boss that just died rather than off
   * Math.random. Same scatter every time boss VII falls, which nobody will
   * ever notice, in exchange for a render that is a pure function of its
   * props — the streaks are recomputed on every re-render this overlay takes,
   * and an impure one would reshuffle them mid-animation.
   */
  const streaks = useMemo(() => {
    if (!killFlash) return [];
    const rand = mulberry32(killFlash.bossId * 7919 + 13);
    return Array.from({ length: 26 }, (_, index) => ({
      id: index,
      left: rand() * 100,
      delay: rand() * 0.5,
      duration: 0.9 + rand() * 0.8,
      height: 40 + rand() * 130,
    }));
  }, [killFlash]);

  return (
    <AnimatePresence>
      {killFlash && (
        <motion.div
          key={killFlash.bossId}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32 }}
        >
          <motion.div
            className="absolute inset-0 bg-abyss/86 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* The white frame of the kill, gone in a fifth of a second. */}
          <motion.div
            className="absolute inset-0 bg-bone"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />

          <div aria-hidden className="absolute inset-0 overflow-hidden">
            {streaks.map((streak) => (
              <motion.span
                key={streak.id}
                className="absolute w-px bg-gradient-to-b from-transparent via-gold to-transparent"
                style={{ left: `${streak.left}%`, height: streak.height }}
                initial={{ top: "-20%", opacity: 0 }}
                animate={{ top: "110%", opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: streak.duration,
                  delay: streak.delay,
                  ease: "easeIn",
                }}
              />
            ))}
          </div>

          <motion.div
            className="relative px-6 text-center"
            initial={{ scale: 0.86, y: 18 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="type-label text-blood">
              Hydra {roman(killFlash.bossId)} · down in{" "}
              {duration(killFlash.durationMs)}
            </p>

            <h2 className="type-hero mt-3 text-bone">Boss down</h2>

            <div className="mt-8 flex flex-wrap items-start justify-center gap-x-12 gap-y-6">
              <Figure
                label="Pot split"
                value={usdg(killFlash.pot)}
                unit="USDG"
                tone="text-gold glow-gold"
              />
              <Figure
                label="Between"
                value={full(killFlash.hitters)}
                unit="wallets"
                tone="text-bone"
              />
              <Figure
                label="Your take"
                value={
                  killFlash.yourShare > 0 ? usdg(killFlash.yourShare) : "0.00"
                }
                unit="USDG"
                tone={
                  killFlash.yourShare > 0
                    ? "text-venom glow-venom"
                    : "text-bone-muted"
                }
              />
            </div>

            <p className="type-data mt-8 text-bone-muted">
              Killing blow by{" "}
              <span className="text-bone">
                {killFlash.killer === "you"
                  ? "you"
                  : shortAddress(killFlash.killer)}
              </span>
              {address && killFlash.killer.toLowerCase() === address.toLowerCase()
                ? " — that was your wallet."
                : "."}
            </p>

            <motion.p
              className="type-title mt-10 text-bone-soft"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.6 }}
            >
              Hydra{" "}
              <span className="text-blood">{roman(killFlash.bossId + 1)}</span>{" "}
              rising ·{" "}
              <span className="text-bone">
                {short(healthForBoss(killFlash.bossId + 1))}
              </span>{" "}
              health
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Figure({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="type-label text-bone-muted">{label}</span>
      <span className={`type-count ${tone}`}>{value}</span>
      <span className="type-label text-bone-muted">{unit}</span>
    </div>
  );
}
