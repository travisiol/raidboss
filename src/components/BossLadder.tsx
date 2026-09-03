"use client";

import { clsx } from "clsx";
import { useRaid } from "@/lib/raidState";
import { roman } from "@/components/HealthBar";
import { SectionHead } from "@/components/ui/Label";
import { ago, duration, full, short, shortAddress, usdg } from "@/lib/format";
import { healthForBoss, raidRules } from "@/lib/site-config";

const SHOWN = 10;

/**
 * The ladder, and the graveyard.
 *
 * Health compounds boss over boss, so ten rungs span three orders of
 * magnitude and a linear chart would draw the first four as nothing at all.
 * The bars are therefore logarithmic and say so — a chart that quietly
 * flattens an exponential to make it fit is the one kind of dishonesty this
 * page cannot afford, given that the exponential is the product.
 */
export function BossLadder() {
  const { state, elapsed, mounted } = useRaid();
  const current = state.boss.id;

  const rungs = Array.from({ length: SHOWN }, (_, index) => {
    const id = index + 1;
    const health = healthForBoss(id);
    return { id, health, pot: (health * raidRules.feeBps) / 10_000 };
  });

  const maxLog = Math.log(rungs[rungs.length - 1].health);
  const minLog = Math.log(rungs[0].health * 0.55);

  return (
    <section id="ladder" className="border-t border-rule bg-abyss">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead
          index="Ladder"
          title="It only gets bigger"
          lede={`Every kill raises the next boss by ${raidRules.growth}× and adds a pair of horns. The pot rises with it, because the pot is a fixed share of the health — a bigger boss is a bigger pot by construction, not by promise.`}
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          {/* ---- Escalation ------------------------------------------- */}
          <div className="slab p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <span className="type-label text-bone-muted">
                Health by boss · log scale
              </span>
              <span className="type-label text-blood">
                Standing: {roman(current)}
              </span>
            </div>

            <div className="mt-6 flex h-52 items-end gap-1.5 sm:gap-2">
              {rungs.map((rung) => {
                const height =
                  ((Math.log(rung.health) - minLog) / (maxLog - minLog)) * 100;
                const dead = rung.id < current;
                const now = rung.id === current;
                return (
                  <div
                    key={rung.id}
                    className="group flex flex-1 flex-col items-center justify-end gap-2"
                    title={`Boss ${roman(rung.id)} — ${full(rung.health)} health, ${usdg(rung.pot)} USDG pot`}
                  >
                    <span
                      className={clsx(
                        "type-data hidden transition-opacity sm:block",
                        now ? "text-blood" : "text-bone-muted opacity-0 group-hover:opacity-100",
                      )}
                    >
                      {short(rung.health)}
                    </span>
                    <span
                      className={clsx(
                        "w-full origin-bottom transition-all duration-500",
                        now && "bg-blood shadow-[0_0_26px_-4px_var(--blood)]",
                        dead && "bg-slab-lit",
                        !now && !dead && "bg-slab",
                      )}
                      style={{ height: `${Math.max(4, height)}%` }}
                    />
                    <span
                      className={clsx(
                        "type-label",
                        now ? "text-blood" : dead ? "text-bone-muted" : "text-bone-soft",
                      )}
                    >
                      {roman(rung.id)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-rule pt-4">
              <Mini
                label="Next boss"
                value={short(healthForBoss(current + 1))}
                hint="health"
              />
              <Mini
                label="Its pot"
                value={usdg((healthForBoss(current + 1) * raidRules.feeBps) / 10_000)}
                hint="USDG at full clear"
              />
              <Mini
                label="Paid out so far"
                value={usdg(state.totalPaidOut)}
                hint="across every kill"
              />
            </div>
          </div>

          {/* ---- Graveyard --------------------------------------------- */}
          <div className="slab flex flex-col p-5 sm:p-6">
            <span className="type-label text-bone-muted">Graveyard</span>

            <ol className="thin-scroll mt-4 flex-1 space-y-px overflow-y-auto">
              {state.kills.map((kill) => (
                <li
                  key={kill.bossId}
                  className="slab-flat flex items-center gap-4 px-4 py-3"
                >
                  <span className="type-title w-10 shrink-0 text-bone-muted">
                    {roman(kill.bossId)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="type-figure-sm text-gold">
                      {usdg(kill.pot)}{" "}
                      <span className="type-label text-bone-muted">USDG</span>
                    </p>
                    <p className="type-data truncate text-bone-muted">
                      {kill.hitters} wallets · stood {duration(kill.durationMs)}{" "}
                      · killed by{" "}
                      <span className="text-bone-soft">
                        {kill.killer === "you"
                          ? "you"
                          : shortAddress(kill.killer)}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {kill.yourShare > 0 ? (
                      <p className="type-figure-sm text-venom">
                        +{usdg(kill.yourShare)}
                      </p>
                    ) : (
                      <p className="type-data text-bone-muted">no hit</p>
                    )}
                    <p
                      className="type-data text-bone-muted"
                      suppressHydrationWarning
                    >
                      {mounted ? `${ago(kill.killedAt, elapsed)} ago` : "—"}
                    </p>
                  </div>
                </li>
              ))}
              {state.kills.length === 0 && (
                <li className="type-data py-8 text-center text-bone-muted">
                  Nothing has died yet.
                </li>
              )}
            </ol>

            <p className="type-data mt-4 border-t border-rule pt-3 text-bone-muted">
              Your line is what that corpse paid your wallet. Unclaimed loot
              sits in the contract until you pull it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Mini({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <p className="type-label text-bone-muted">{label}</p>
      <p className="type-figure mt-1.5 text-bone">{value}</p>
      <p className="type-data text-bone-muted">{hint}</p>
    </div>
  );
}
