"use client";

import { useAccount, useSwitchChain, useChainId } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { useState } from "react";

export function NetworkSelector() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [addingNetwork, setAddingNetwork] = useState(false);

  const addBaseSepoliaToMetaMask = async () => {
    try {
      setAddingNetwork(true);
      await window.ethereum?.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${baseSepolia.id.toString(16)}`,
            chainName: "Base Sepolia",
            nativeCurrency: {
              name: "Ether",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://sepolia.base.org"],
            blockExplorerUrls: ["https://sepolia.basescan.org"],
          },
        ],
      });
    } catch (error) {
      console.error("Failed to add network:", error);
    } finally {
      setAddingNetwork(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  const networks = [
    { id: baseSepolia.id, name: "Base Sepolia", emoji: "🌐" },
  ];

  const isOnWrongNetwork = chainId !== baseSepolia.id;

  return (
    <div style={styles.container}>
      <span style={styles.label}>Network:</span>
      <div style={styles.buttonGroup}>
        {networks.map((network) => {
          const isActive = chainId === network.id;
          return (
            <button
              key={network.id}
              onClick={() => switchChain({ chainId: network.id })}
              disabled={isActive || isPending}
              style={{
                ...styles.button,
                ...(isActive ? styles.activeButton : styles.inactiveButton),
                opacity: isPending ? 0.6 : 1,
                cursor: isActive || isPending ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isActive && !isPending) {
                  e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
                  e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.5)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(30, 40, 73, 0.4)";
                  e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.3)";
                }
              }}
            >
              {network.emoji} {network.name}
            </button>
          );
        })}
        {isOnWrongNetwork && (
          <button
            onClick={addBaseSepoliaToMetaMask}
            disabled={addingNetwork}
            style={{
              ...styles.button,
              ...styles.addNetworkButton,
              opacity: addingNetwork ? 0.6 : 1,
              cursor: addingNetwork ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!addingNetwork) {
                e.currentTarget.style.background = "rgba(168, 85, 247, 0.3)";
                e.currentTarget.style.borderColor = "rgba(168, 85, 247, 0.6)";
              }
            }}
            onMouseLeave={(e) => {
              if (!addingNetwork) {
                e.currentTarget.style.background = "rgba(168, 85, 247, 0.2)";
                e.currentTarget.style.borderColor = "rgba(168, 85, 247, 0.4)";
              }
            }}
          >
            ➕ Add Network
          </button>
        )}
      </div>
      {isPending && <span style={styles.pendingText}>Switching...</span>}
      {addingNetwork && <span style={styles.pendingText}>Adding network...</span>}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  label: {
    fontSize: "0.875rem",
    color: "#94a3b8",
    fontWeight: "500",
  },
  buttonGroup: {
    display: "flex",
    gap: "0.5rem",
  },
  button: {
    padding: "0.5rem 1rem",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
    border: "1px solid",
  },
  activeButton: {
    background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
    borderColor: "transparent",
    color: "white",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
  },
  inactiveButton: {
    background: "rgba(30, 40, 73, 0.4)",
    borderColor: "rgba(59, 130, 246, 0.3)",
    color: "#cbd5e1",
  },
  addNetworkButton: {
    background: "rgba(168, 85, 247, 0.2)",
    borderColor: "rgba(168, 85, 247, 0.4)",
    color: "#e9d5ff",
    fontWeight: "700",
  },
  pendingText: {
    fontSize: "0.8125rem",
    color: "#94a3b8",
    animation: "pulse 1.5s ease-in-out infinite",
  },
};
