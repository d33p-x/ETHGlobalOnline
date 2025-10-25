import { type Address } from "viem";
import { TOKEN_ADDRESSES, getTokenAddresses } from "./config";

// Define a type for the token info
export type TokenInfo = { decimals: number; symbol: string };

// Token metadata (same across all networks)
const TOKEN_METADATA = {
  WETH: { decimals: 18, symbol: "WETH" },
  USDC: { decimals: 6, symbol: "USDC" },
  LINK: { decimals: 18, symbol: "LINK" },
  USDT: { decimals: 6, symbol: "USDT" },
  cbDOGE: { decimals: 8, symbol: "cbDOGE" },
  cbBTC: { decimals: 8, symbol: "cbBTC" },
  SHIB: { decimals: 18, symbol: "SHIB" },
  AERO: { decimals: 18, symbol: "AERO" },
  cbXRP: { decimals: 6, symbol: "cbXRP" },
  PEPE: { decimals: 18, symbol: "PEPE" },
} as const;

/**
 * Get token info map for a specific chain
 */
export function getTokenInfoMap(chainId: number): Record<Address, TokenInfo> {
  const tokenAddresses = getTokenAddresses(chainId);
  const map: Record<Address, TokenInfo> = {};

  // Add all tokens that are deployed (not zero address)
  Object.entries(tokenAddresses).forEach(([symbol, address]) => {
    if (address !== "0x0000000000000000000000000000000000000000") {
      const key = symbol as keyof typeof TOKEN_METADATA;
      if (TOKEN_METADATA[key]) {
        map[address] = TOKEN_METADATA[key];
      }
    }
  });

  return map;
}

/**
 * Legacy export for backward compatibility (uses Foundry chain)
 */
export const tokenInfoMap: Record<Address, TokenInfo> = {
  [TOKEN_ADDRESSES.WETH]: TOKEN_METADATA.WETH,
  [TOKEN_ADDRESSES.USDC]: TOKEN_METADATA.USDC,
  [TOKEN_ADDRESSES.PEPE]: TOKEN_METADATA.PEPE,
  // Other tokens only included if deployed locally
};
