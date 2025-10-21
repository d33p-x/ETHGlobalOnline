// config.ts
import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { defineChain } from "viem";

// Define local Anvil chain
export const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
});

// Set this to true when running locally with Anvil
const USE_LOCAL_ANVIL = process.env.NEXT_PUBLIC_USE_ANVIL === "true" || false;

export const config = createConfig({
  chains: USE_LOCAL_ANVIL ? [anvil, baseSepolia] : [baseSepolia],
  transports: {
    [anvil.id]: http(),
    [baseSepolia.id]: http(),
  },
});
