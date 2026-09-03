"use client";

import { useRaid } from "@/lib/raidState";
import { Rolling } from "@/components/ui/Stat";
import { full, short, usdg } from "@/lib/format";
import { raidRules, siteConfig } from "@/lib/site-config";

/**
 * The statement, placed under the arena rather than above it.
 *
 * A landing page normally explains before it demonstrates. This one has a
 * three-dimensional thing losing health at the top of the viewport, and no
 * paragraph competes with that, so the paragraph goes second and gets to be
 * shorter for it — by the time anyone reads this they have already watched the
 * mechanic run, and the copy only has to name what they saw.
 */
export function Pitch() {
  const { state } = useRaid();

  return (
    <section className="border-t border-rule bg-abyss">
      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <div className="pitch">
          <h2 className="type-hero text-bone">
            Every
            <br />
            buy is
            <br />
            <span className="text-blood glow-blood">a hit</span>
          </h2>
        </div>

        <div className="flex flex-col justify-between gap-10">
          <div className="max-w-xl">
            <p className="type-body text-bone">
              {siteConfig.description}
            </p>
            <p className="type-body mt-5 text-bone-soft">
              There is no bonus for the killing blow, so there is nothing to
              snipe and no reason to wait. A wallet that opened the fight and a
              wallet that closed it are paid by the same rule: damage over total
              damage, times the pot. The only way to be owed more is to have hit
              harder.
            </p>
            <p className="type-body mt-5 text-bone-soft">
              You are buying a token. The pot is a rebate on the fee you and
              everyone else paid to get in — it is not a yield, it is not a
              return, and it does not make the position safe. What it is, is
              legible: a number you can watch accrue and a rule you can check.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
            <Figure label="Bosses down" value={String(state.boss.id - 1)} />
            <Figure
              label="Paid out"
              value={<Rolling value={state.totalPaidOut} format={usdg} />}
              tone="text-gold"
            />
            <Figure
              label="Damage dealt"
              value={<Rolling value={state.totalDamageDealt} format={short} />}
            />
            <Figure
              label="Fee to the pot"
              value={`${raidRules.feeBps / 100}%`}
              tone="text-venom"
            />
          </dl>

          <p className="type-data text-bone-muted">
            Health is denominated in USDG of buying — a boss on{" "}
            {full(raidRules.baseHealth)} falls after {full(raidRules.baseHealth)}{" "}
            USDG has passed through it.
          </p>
        </div>
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  tone = "text-bone",
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="bg-pit p-4">
      <p className="type-label text-bone-muted">{label}</p>
      <p className={`type-figure mt-2 ${tone}`}>{value}</p>
    </div>
  );
}
