"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { useRaid } from "@/lib/raidState";
import { roman } from "@/components/HealthBar";
import { SectionHead } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { full, pct, short, shortAddress, usdg } from "@/lib/format";
import { raidRules } from "@/lib/site-config";

/**
 * The bill.
 *
 * Until a contract pays winners out on its own, a person does it — and a
 * person needs a list of addresses and amounts, not a leaderboard. This is
 * that list, per corpse, sorted by what is owed, exportable as CSV for a
 * disperser or as JSON for a script.
 *
 * It is public on purpose. The split is derived from damage that is already
 * on chain, so anybody can check the arithmetic; publishing the table is the
 * difference between "trust me, I paid people" and a receipt anyone can audit
 * against the transfers that follow it. Hiding it behind an admin page would
 * make the payout unverifiable without making it any more private.
 */
export function PayoutLedger() {
  const { state, mode } = useRaid();
  const [open, setOpen] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const kills = state.kills;
  const kill = kills[open];

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied("clipboard blocked");
      window.setTimeout(() => setCopied(null), 2400);
    }
  };

  const csv = kill
    ? ["address,damage,share,owed_usdg"]
        .concat(
          kill.splits.map(
            (row) =>
              `${row.wallet},${row.damage.toFixed(2)},${row.share.toFixed(6)},${row.owed.toFixed(2)}`,
          ),
        )
        .join("\n")
    : "";

  const json = kill
    ? JSON.stringify(
        {
          boss: kill.bossId,
          potUsdg: Number(kill.pot.toFixed(2)),
          hitters: kill.hitters,
          payouts: kill.splits.map((row) => ({
            address: row.wallet,
            usdg: Number(row.owed.toFixed(2)),
          })),
        },
        null,
        2,
      )
    : "";

  return (
    <section id="payouts" className="border-t border-rule bg-abyss">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead
          index="Payouts"
          title="Who is owed what, on every corpse"
          lede={`The pot is split ${(10_000 - raidRules.carryBps) / 100}% pro rata to damage. This is that division, written out — the same table whether a contract pays it or a person does.`}
        />

        {kills.length === 0 ? (
          <p className="type-body mt-10 text-bone-muted">
            Nothing has died yet. The first kill writes the first bill.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-[240px_1fr]">
            {/* Which corpse */}
            <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {kills.map((entry, index) => (
                <li key={entry.bossId}>
                  <button
                    type="button"
                    onClick={() => setOpen(index)}
                    className={clsx(
                      "w-full min-w-[150px] border px-4 py-3 text-left transition-colors",
                      index === open
                        ? "border-venom/60 bg-venom/10"
                        : "border-rule hover:border-rule-strong",
                    )}
                  >
                    <span className="type-title block text-bone">
                      Boss {roman(entry.bossId)}
                    </span>
                    <span className="type-data block text-gold">
                      {usdg(entry.pot)} USDG
                    </span>
                    <span className="type-data block text-bone-muted">
                      {entry.hitters} wallets
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            {kill && (
              <div className="slab p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
                  <div>
                    <p className="type-label text-bone-muted">
                      Boss {roman(kill.bossId)} · to distribute
                    </p>
                    <p className="type-count mt-1 text-gold glow-gold">
                      {usdg(kill.pot)}
                    </p>
                    <p className="type-data text-bone-muted">
                      USDG across {full(kill.hitters)} wallets
                      {kill.splits.length < kill.hitters &&
                        ` · showing the top ${kill.splits.length}`}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => copy(csv, "CSV")}
                      className="px-3 py-2"
                    >
                      {copied === "CSV" ? "Copied" : "Copy CSV"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => copy(json, "JSON")}
                      className="px-3 py-2"
                    >
                      {copied === "JSON" ? "Copied" : "Copy JSON"}
                    </Button>
                  </div>
                </div>

                {copied === "clipboard blocked" && (
                  <p className="type-data mt-3 text-blood-bright">
                    The browser refused clipboard access. Select the table and
                    copy it by hand.
                  </p>
                )}

                <div className="type-label mt-4 grid grid-cols-[1fr_84px_64px_96px] gap-2 border-b border-rule pb-2 text-bone-muted">
                  <span>Address</span>
                  <span className="text-right">Damage</span>
                  <span className="text-right">Share</span>
                  <span className="text-right">Owed</span>
                </div>

                <ol className="thin-scroll max-h-[360px] overflow-y-auto">
                  {kill.splits.map((row, index) => (
                    <li
                      key={row.wallet}
                      className="grid grid-cols-[1fr_84px_64px_96px] items-center gap-2 border-b border-rule/50 py-2"
                    >
                      <span
                        className="type-data truncate text-bone-soft"
                        title={row.wallet}
                      >
                        <span className="mr-2 text-bone-muted">
                          {index + 1}
                        </span>
                        {row.wallet === "you"
                          ? "you"
                          : shortAddress(row.wallet)}
                      </span>
                      <span className="type-data text-right text-bone">
                        {short(row.damage)}
                      </span>
                      <span className="type-data text-right text-bone-muted">
                        {pct(row.share)}
                      </span>
                      <span className="type-figure-sm text-right text-gold">
                        {usdg(row.owed)}
                      </span>
                    </li>
                  ))}
                </ol>

                <p className="type-data mt-4 border-t border-rule pt-3 text-bone-muted">
                  {mode === "sim"
                    ? "These addresses are generated locally — the raid on screen is simulated, and so is this bill."
                    : "Addresses are the wallets the chain recorded buying against this boss. Check the split against those transfers before sending anything."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
