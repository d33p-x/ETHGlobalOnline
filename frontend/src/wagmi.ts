import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { mainnet, sepolia, foundry, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export function getConfig() {
  return createConfig({
    chains: [foundry, baseSepolia],
    connectors: [
      injected(),
      // baseAccount(),
      // walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [foundry.id]: http("http://127.0.0.1:8545"),
      [baseSepolia.id]: http(
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
      ),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
