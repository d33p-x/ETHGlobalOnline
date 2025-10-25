"use client";

import { useAccount, useSwitchChain, useChainId } from "wagmi";
import { foundry, baseSepolia } from "wagmi/chains";

export function NetworkSelector() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) {
    return null;
  }

  const networks = [
    { id: foundry.id, name: "Local Anvil", emoji: "🏠" },
    { id: baseSepolia.id, name: "Base Sepolia", emoji: "🌐" },
  ];

  const currentNetwork = networks.find((n) => n.id === chainId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">Network:</span>
      <div className="flex gap-2">
        {networks.map((network) => {
          const isActive = chainId === network.id;
          return (
            <button
              key={network.id}
              onClick={() => switchChain({ chainId: network.id })}
              disabled={isActive || isPending}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }
                ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {network.emoji} {network.name}
            </button>
          );
        })}
      </div>
      {isPending && (
        <span className="text-xs text-gray-400 animate-pulse">Switching...</span>
      )}
    </div>
  );
}
