"use client";

import { useAccount, useReadContracts } from "wagmi";
import { erc20Abi } from "@/lib/raidAbi";
import { chainConfig, isLive } from "@/lib/site-config";

/**
 * What the connected wallet holds.
 *
 * Holding the token is what puts a wallet in the raid, so this is the one
 * chain read the page does on the viewer's behalf rather than on the boss's.
 * It is deliberately separate from damage: damage is what you did to *this*
 * boss and resets when it dies, holdings are what you kept. A wallet can hold
 * a large bag and be owed nothing, and that distinction is worth showing
 * rather than blurring.
 */
export function useHolder() {
  const { address, isConnected } = useAccount();
  const token = chainConfig.tokenAddress;

  const reads = useReadContracts({
    contracts:
      token && address
        ? [
            { address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] },
            { address: token, abi: erc20Abi, functionName: "decimals" },
            { address: token, abi: erc20Abi, functionName: "symbol" },
          ]
        : [],
    query: { enabled: isLive && !!token && !!address, refetchInterval: 20_000 },
  });

  const raw =
    reads.data?.[0]?.status === "success"
      ? (reads.data[0].result as bigint)
      : null;
  const decimals =
    reads.data?.[1]?.status === "success"
      ? Number(reads.data[1].result as number)
      : 18;
  const symbol =
    reads.data?.[2]?.status === "success"
      ? (reads.data[2].result as string)
      : null;

  const balance = raw === null ? null : Number(raw) / 10 ** decimals;

  return {
    /** Null until a balance has actually been read — never guessed as zero. */
    balance,
    symbol,
    decimals,
    isConnected,
    address,
    /** A wallet is in the raid once it holds any of the token at all. */
    isHolder: balance !== null && balance > 0,
    isLoading: reads.isLoading,
  };
}

/**
 * Where to send someone to buy, with the amount already filled in.
 *
 * The site cannot swap on a wallet's behalf without a router address and a
 * router ABI, and inventing either would be worse than honest: a button that
 * opens the real venue with the right number in it does the job, and the buy
 * lands as damage on its own when the chain sees it. If a router is wired up
 * later this is the only place that has to change.
 */
export function buyUrl(amountUsdg: number): string | null {
  if (!chainConfig.dexUrl) return null;
  const amount = String(Math.max(0, Math.round(amountUsdg * 100) / 100));
  return chainConfig.dexUrl.includes("{amount}")
    ? chainConfig.dexUrl.replace("{amount}", amount)
    : chainConfig.dexUrl;
}
