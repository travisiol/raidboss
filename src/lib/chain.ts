import { defineChain } from "viem";

/**
 * Robinhood Chain network definition.
 *
 * Values below were gathered from public, third-party sources on 2026-08-27
 * (chainlist.org/chain/4663, trustswap.com/robinhood/network-details) because
 * the official docs.robinhood.com/chain domain could not be crawled directly
 * from this environment. Chain ID 4663 was corroborated by two independent
 * sources. RPC / explorer URLs are best-effort and MUST be re-verified
 * against https://docs.robinhood.com/chain before this app is pointed at
 * real funds. Robinhood Chain reportedly has no native gas token — gas is
 * paid in ETH, and there is no official airdrop token.
 *
 * Override via env vars in production once confirmed.
 */
export const ROBINHOOD_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_ROBINHOOD_CHAIN_ID ?? 4663,
);

const RPC_URL =
  process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ??
  "https://rpc.mainnet.chain.robinhood.com";

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_ROBINHOOD_EXPLORER_URL ??
  "https://robinhoodchain.blockscout.com";

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: EXPLORER_URL,
    },
  },
  testnet: false,
});
