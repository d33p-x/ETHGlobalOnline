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

  const isOnWrongNetwork = chainId !== baseSepolia.id;

  // Only show controls if on wrong network
  if (!isOnWrongNetwork) {
    return null;
  }

  return (
    <div style={styles.container}>
      <button
        onClick={() => switchChain({ chainId: baseSepolia.id })}
        disabled={isPending}
        style={{
          ...styles.switchButton,
          opacity: isPending ? 0.6 : 1,
          cursor: isPending ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!isPending) {
            e.currentTarget.style.background = "rgba(59, 130, 246, 0.3)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        🔄 Switch Network
      </button>
      <button
        onClick={addBaseSepoliaToMetaMask}
        disabled={addingNetwork}
        style={{
          ...styles.addButton,
          opacity: addingNetwork ? 0.6 : 1,
          cursor: addingNetwork ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!addingNetwork) {
            e.currentTarget.style.background = "rgba(168, 85, 247, 0.3)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(168, 85, 247, 0.15)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        ➕ Add Network
      </button>
      {(isPending || addingNetwork) && (
        <span style={styles.statusText}>
          {isPending ? "Switching..." : "Adding..."}
        </span>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  switchButton: {
    padding: "0.5rem 1rem",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
    border: "1px solid rgba(59, 130, 246, 0.4)",
    background: "rgba(59, 130, 246, 0.2)",
    color: "#60a5fa",
  },
  addButton: {
    padding: "0.5rem 1rem",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
    border: "1px solid rgba(168, 85, 247, 0.4)",
    background: "rgba(168, 85, 247, 0.15)",
    color: "#a855f7",
  },
  statusText: {
    fontSize: "0.8125rem",
    color: "#94a3b8",
  },
};
