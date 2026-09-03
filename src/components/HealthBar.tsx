"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { useRaid } from "@/lib/raidState";
import { full, short } from "@/lib/format";

const ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Boss numbers are set in roman: it reads as a tier, and it reads at 480p. */
export function roman(value: number): string {
  let n = Math.max(1, Math.floor(value));
  let out = "";
  for (const [amount, glyph] of ROMAN) {
    while (n >= amount) {
      out += glyph;
      n -= amount;
    }
  }
  return out;
}

/**
 * The boss frame.
 *
 * Three stacked layers do the work. `hp-fill` is the truth and moves in 190ms.
 * `hp-chip` is the same number on a slower, delayed transition, so for about
 * three quarters of a second after a hit there is a pale wedge showing exactly
 * how much was just taken off — the bite, not the result. `hp-edge` is a
 * two-pixel highlight riding the front of the fill so the eye can find "now"
 * on a bar that is a metre wide on a projector and forty pixels on a phone.
 *
 * The delta readout beside the numbers is the same information in text for
 * anyone who cannot rely on the colour.
 */
export function HealthBar() {
  const { state, hitSeq } = useRaid();
  const { boss } = state;
  const fraction = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
  const percent = fraction * 100;

  const [delta, setDelta] = useState(0);
  const previous = useRef(boss.health);
  const [struck, setStruck] = useState(false);

  useEffect(() => {
    const drop = previous.current - boss.health;
    previous.current = boss.health;
    if (drop <= 0) return;
    setDelta(drop);
    setStruck(true);
    const clear = window.setTimeout(() => setStruck(false), 360);
    const fade = window.setTimeout(() => setDelta(0), 1400);
    return () => {
      window.clearTimeout(clear);
      window.clearTimeout(fade);
    };
  }, [boss.health, hitSeq]);

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="type-title text-bone">
            Hydra <span className="text-blood">{roman(boss.id)}</span>
          </h1>
          <span className="type-label text-bone-muted">
            {boss.heads} heads
          </span>
        </div>

        <div className="flex items-baseline gap-2 tabular-nums">
          {delta > 0 && (
            <span key={delta} className="type-figure-sm rise text-venom">
              −{short(delta)}
            </span>
          )}
          <span className="type-figure text-blood-bright glow-blood">
            {short(boss.health)}
          </span>
          <span className="type-figure-sm text-bone-muted">
            / {short(boss.maxHealth)}
          </span>
        </div>
      </div>

      <div
        className={clsx("hp-track mt-2 h-9 sm:h-11", struck && "shake")}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.round(boss.maxHealth)}
        aria-valuenow={Math.round(boss.health)}
        aria-label={`Boss ${boss.id} health: ${full(boss.health)} of ${full(boss.maxHealth)}`}
      >
        <div className="hp-chip" style={{ width: `${percent}%` }} />
        <div className="hp-fill" style={{ width: `${percent}%` }} />
        <div className="hp-edge" style={{ left: `calc(${percent}% - 1px)` }} />
        <div className="hp-hatch" />

        {/* Decile ticks. A bar with no scale cannot be read, only watched. */}
        <div className="pointer-events-none absolute inset-0 flex">
          {Array.from({ length: 9 }, (_, index) => (
            <span
              key={index}
              className="flex-1 border-r border-abyss/45"
              style={{ borderRightWidth: index === 4 ? 2 : 1 }}
            />
          ))}
          <span className="flex-1" />
        </div>

        <span className="type-label absolute inset-y-0 right-2 flex items-center text-bone/70 mix-blend-difference">
          {percent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
