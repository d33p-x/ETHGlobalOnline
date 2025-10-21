import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { mainnet, sepolia, foundry } from "wagmi/chains";
import { baseAccount, injected, walletConnect } from "wagmi/connectors";

export function getConfig() {
  return createConfig({
    chains: [mainnet, sepolia, foundry],
    connectors: [
      injected(),
      baseAccount(),
      // walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [mainnet.id]: http(),
      [sepolia.id]: http(),
      [foundry.id]: http("http://127.0.0.1:8545"),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
