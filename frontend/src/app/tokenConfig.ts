import { type Address } from "viem";
import { TOKEN_ADDRESSES } from "./config";

// Define a type for the token info
export type TokenInfo = { decimals: number; symbol: string };

// Update the map type and content - using addresses from central config
export const tokenInfoMap: Record<Address, TokenInfo> = {
  [TOKEN_ADDRESSES.USDC]: { decimals: 6, symbol: "USDC" },
  [TOKEN_ADDRESSES.PEPE]: { decimals: 18, symbol: "PEPE" },
  [TOKEN_ADDRESSES.WETH]: { decimals: 18, symbol: "WETH" },
};
