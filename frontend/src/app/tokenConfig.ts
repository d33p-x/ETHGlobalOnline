import { type Address } from "viem";

// Define a type for the token info
export type TokenInfo = { decimals: number; symbol: string };

// Update the map type and content
export const tokenInfoMap: Record<Address, TokenInfo> = {
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0": { decimals: 6, symbol: "USDC" },
  "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9": {
    decimals: 18,
    symbol: "PEPE",
  },
  "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9": {
    decimals: 18,
    symbol: "WETH",
  },
};
