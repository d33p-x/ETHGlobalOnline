import { cookieStorage, createConfig, createStorage, http, fallback } from "wagmi";
import { foundry, baseSepolia } from "wagmi/chains";
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
      [baseSepolia.id]: fallback([
        http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL, {
          timeout: 10_000,
          retryCount: 3,
        }),
        http("https://sepolia.base.org", {
          timeout: 10_000,
          retryCount: 3,
        }),
        http("https://base-sepolia.blockpi.network/v1/rpc/public", {
          timeout: 10_000,
          retryCount: 3,
        }),
      ]),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
