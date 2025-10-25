import { type Address } from "viem";

// Define a type for the token info, now including the price feed ID
export type TokenInfo = {
  decimals: number;
  symbol: string;
  priceFeedId: string;
};

/**
 * Placeholder function to get an empty token info map.
 * The actual map will be populated dynamically from contract events.
 */
export function getTokenInfoMap(chainId: number): Record<Address, TokenInfo> {
  // This will be replaced by the dynamic registry
  return {};
}
