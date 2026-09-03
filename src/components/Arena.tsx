"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRaid, useYourStake } from "@/lib/raidState";
import { BossCanvas } from "@/components/BossCanvas";
import { DamagePops } from "@/components/DamagePops";
import { HealthBar } from "@/components/HealthBar";
import { StrikePanel } from "@/components/StrikePanel";
import { Rolling, Stat } from "@/components/ui/Stat";
import { LiveTag, SimTag } from "@/components/ui/Label";
import { duration, pct, short, usdg } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";

/**
 * The arena.
 *
 * One screen that has to answer four questions without being read: what is
 * dying, how far along it is, what is on the table, and how you join in. The
 * boss frame is pinned to the top the way a raid encounter puts it, the beast
 * owns the middle, and the pot and the strike sit along the bottom — so the
 * vertical order of the page is the causal order of the mechanic.
 */
export function Arena() {
  const { state, visuals, live, hitSeq, elapsed, mounted } = useRaid();
  const stake = useYourStake();
  const boss = state.boss;

  /*
   * A heavy hit kicks the boss frame. Replaying a CSS animation means removing
   * the class, forcing a reflow and putting it back — driving it through React
   * state instead would re-render the whole arena twice per shake for
   * something that never touches the DOM tree, only one class on one node.
   */
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || !state.hits[0]?.heavy) return;
    node.classList.remove("shake");
    void node.offsetWidth;
    node.classList.add("shake");
    const done = () => node.classList.remove("shake");
    node.addEventListener("animationend", done, { once: true });
    return () => node.removeEventListener("animationend", done);
  }, [hitSeq, state.hits]);

  /* Damage over the last half minute — the only figure on the page that says
     whether the raid is speeding up or dying down. */
  const rate = useMemo(() => {
    const window = 30_000;
    const since = elapsed - window;
    const total = state.hits
      .filter((hit) => hit.at >= since)
      .reduce((sum, hit) => sum + hit.damage, 0);
    return total / (window / 1000);
  }, [state.hits, elapsed]);

  const hitters = Object.keys(state.damage).length;
  const standing = elapsed - boss.spawnedAt;

  return (
    <section
      id="arena"
      className="stage vignette grain relative flex min-h-[880px] flex-col overflow-hidden lg:min-h-[94vh]"
    >
      <BossCanvas visuals={visuals} />
      <DamagePops />

      <div className="relative z-10 flex flex-1 flex-col">
        {/* ---- Boss frame ------------------------------------------------ */}
        <div className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6">
          <div ref={frameRef}>
            <HealthBar />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="type-data text-bone-soft">
              {siteConfig.tagline}{" "}
              <span className="text-bone-muted">
                Kill it, split the pot.
              </span>
            </p>
            {live ? <LiveTag /> : <SimTag />}
          </div>
        </div>

        {/* The beast gets the middle of the screen and nothing sits on it. */}
        <div className="min-h-[280px] flex-1" aria-hidden />

        {/* ---- Pot, stats, strike ---------------------------------------- */}
        <div className="mx-auto grid w-full max-w-[1400px] gap-3 px-4 pb-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="slab p-4 sm:p-5">
            {/* Six columns, and the pot takes two of them: it is the only
                figure here set at poster size, so it is the only one that
                needs a cell wide enough to hold nine glyphs of Anton. */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-6">
              <Stat
                label="Pot on the table"
                hint="USDG, paid on the kill"
                className="col-span-2 xl:col-span-2"
              >
                <Rolling
                  value={boss.pot}
                  format={usdg}
                  className="type-count text-gold glow-gold"
                />
              </Stat>

              <Stat label="Your damage" hint={`${pct(stake.share)} of the bar`}>
                <Rolling
                  value={stake.damage}
                  format={short}
                  className="type-figure text-venom"
                />
              </Stat>

              <Stat label="Your take if it dies now" hint="USDG">
                <Rolling
                  value={stake.projected}
                  format={usdg}
                  className="type-figure text-venom"
                />
              </Stat>

              <Stat label="Wallets in" hint="on this boss">
                <span className="type-figure text-bone">{hitters}</span>
              </Stat>

              <Stat label="Standing for" hint={`${short(rate)} dmg/s`}>
                <span className="type-figure text-bone" suppressHydrationWarning>
                  {mounted ? duration(standing) : "—"}
                </span>
              </Stat>
            </div>
          </div>

          <StrikePanel />
        </div>
      </div>
    </section>
  );
}
