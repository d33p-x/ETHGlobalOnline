import { cookieStorage, createConfig, createStorage, http, fallback } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export function getConfig() {
  return createConfig({
    chains: [baseSepolia],
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
