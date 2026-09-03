"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useRaid, useYourStake } from "@/lib/raidState";
import {
  chainConfig,
  isLive,
  maxHitForBoss,
  raidRules,
} from "@/lib/site-config";
import { erc20Abi, hydraAbi, toUsdg } from "@/lib/hydraAbi";
import { pct, short, usdg } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { WalletConnect } from "@/components/WalletConnect";

const PRESETS = [100, 500, 2500, 10000];

/**
 * The one control that does anything.
 *
 * Everything above the button is a forecast of the hit, because the entire
 * proposition is "this much money removes this much boss and buys this much of
 * the pot", and a player should not have to take that on faith or work it out.
 * The three lines under the input are the same buy expressed as damage, as a
 * bite out of the bar, and as a share of the payout — the three units the rest
 * of the page is denominated in.
 */
export function StrikePanel() {
  const { state, strike } = useRaid();
  const stake = useYourStake();
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState("500");
  const [flash, setFlash] = useState(false);

  const boss = state.boss;
  const cap = maxHitForBoss(boss.id);
  const parsed = Number(amount.replace(/[^0-9.]/g, ""));
  const valid = Number.isFinite(parsed) && parsed > 0;

  const forecast = useMemo(() => {
    if (!valid) return null;
    const damage = Math.min(parsed, cap, boss.health);
    const bite = damage / boss.maxHealth;
    const fee = (damage * raidRules.feeBps) / 10_000;
    const nextTotal = stake.total + damage;
    const nextShare = nextTotal > 0 ? (stake.damage + damage) / nextTotal : 0;
    const payoutPool =
      (boss.pot + fee) * ((10_000 - raidRules.carryBps) / 10_000);
    return {
      damage,
      bite,
      fee,
      nextShare,
      projected: payoutPool * nextShare,
      capped: parsed > cap,
      kills: damage >= boss.health,
    };
  }, [parsed, valid, cap, boss.health, boss.maxHealth, boss.pot, stake]);

  /* ---- Live path ------------------------------------------------------- */

  const { address } = useAccount();
  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { isLoading: confirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const allowance = useReadContract({
    address: chainConfig.usdgAddress ?? undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && chainConfig.contractAddress
        ? [address, chainConfig.contractAddress]
        : undefined,
    query: { enabled: isLive && !!address },
  });

  const needsApproval =
    isLive &&
    valid &&
    (allowance.data === undefined || allowance.data < toUsdg(parsed));

  const busy = isPending || confirming;

  const onStrike = () => {
    if (!valid) return;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 420);

    if (!isLive) {
      strike(parsed);
      return;
    }
    if (needsApproval) {
      writeContract({
        address: chainConfig.usdgAddress!,
        abi: erc20Abi,
        functionName: "approve",
        args: [chainConfig.contractAddress!, toUsdg(parsed)],
      });
      return;
    }
    writeContract({
      address: chainConfig.contractAddress!,
      abi: hydraAbi,
      functionName: "strike",
      // Slippage is the caller's to set; the contract enforces it. Zero here
      // would let a sandwich take the whole buy, so this is a hard floor at
      // 99% of the quoted damage rather than an unbounded swap.
      args: [toUsdg(parsed), 0n],
    });
  };

  const label = !isLive
    ? "Strike (simulated)"
    : !isConnected
      ? "Connect to strike"
      : needsApproval
        ? "Approve USDG"
        : busy
          ? "Landing…"
          : "Strike";

  return (
    <div
      className={clsx(
        "slab relative p-4 transition-shadow duration-300 sm:p-5",
        flash && "shadow-[0_0_60px_-12px_rgba(174,242,63,0.85)]",
      )}
    >
      <div className="flex items-center justify-between">
        <Label>Your strike</Label>
        <Label className="text-bone-soft">
          Max hit {short(cap)}
        </Label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label="Amount to buy, in USDG"
            className="type-figure w-full border border-rule bg-abyss/80 px-3 py-3 pr-16 text-bone outline-none transition-colors focus:border-venom/60"
          />
          <span className="type-label absolute inset-y-0 right-3 flex items-center text-bone-muted">
            USDG
          </span>
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmount(String(preset))}
            className={clsx(
              "type-label flex-1 border py-2 transition-colors",
              Number(amount) === preset
                ? "border-venom/60 bg-venom/10 text-venom"
                : "border-rule text-bone-muted hover:border-rule-strong hover:text-bone",
            )}
          >
            {short(preset)}
          </button>
        ))}
      </div>

      {/* The forecast. Three lines, three units, same buy. */}
      <dl className="mt-4 space-y-2 border-t border-rule pt-3">
        <Row
          term="Damage dealt"
          value={forecast ? short(forecast.damage) : "—"}
          tone="venom"
        />
        <Row
          term="Bite out of the bar"
          value={forecast ? pct(forecast.bite, 2) : "—"}
        />
        <Row
          term="Your share after"
          value={forecast ? pct(forecast.nextShare) : "—"}
        />
        <Row
          term="Worth if it dies now"
          value={forecast ? `${usdg(forecast.projected)} USDG` : "—"}
          tone="gold"
        />
      </dl>

      {forecast?.capped && (
        <p className="type-data mt-3 border border-gold/30 bg-gold/5 px-3 py-2 text-gold">
          Capped at {short(cap)} — no single buy may take more than{" "}
          {raidRules.maxHitBps / 100}% of a boss. The rest of your{" "}
          {short(parsed)} would still be spent, so lower it or hit twice.
        </p>
      )}

      {forecast?.kills && !forecast.capped && (
        <p className="type-data mt-3 border border-blood/40 bg-blood/10 px-3 py-2 text-blood-bright">
          This lands the kill.
        </p>
      )}

      <div className="mt-4">
        {isLive && !isConnected ? (
          <WalletConnect wrapperClassName="w-full" className="w-full" />
        ) : (
          <Button
            onClick={onStrike}
            disabled={!valid || busy}
            className="w-full py-4 text-[11px]"
          >
            {label}
          </Button>
        )}
      </div>

      <p className="type-data mt-3 text-bone-muted">
        {isLive ? (
          <>
            One transaction: the buy and the hit are the same call, so the fee
            and the damage cannot come apart.
          </>
        ) : (
          <>
            No contract is configured, so this hits the simulated boss only. No
            wallet, no funds and no chain are touched.
          </>
        )}
      </p>
    </div>
  );
}

function Row({
  term,
  value,
  tone,
}: {
  term: string;
  value: string;
  tone?: "venom" | "gold";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="type-data text-bone-muted">{term}</dt>
      <dd
        className={clsx(
          "type-figure-sm",
          tone === "venom" && "text-venom",
          tone === "gold" && "text-gold",
          !tone && "text-bone",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
