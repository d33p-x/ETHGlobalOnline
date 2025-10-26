// Wallet Status Badge Component
"use client";

import { useAccount } from "wagmi";
import { baseSepolia } from "wagmi/chains";

export function NetworkStatusBadge() {
  const { isConnected, chainId, status } = useAccount();

  if (!isConnected) {
    return null;
  }

  const isCorrectNetwork = chainId === baseSepolia.id;
  const isConnecting = status === "reconnecting";

  // Only show if wrong network or connecting
  if (isCorrectNetwork && !isConnecting) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.375rem 0.75rem",
          background: "rgba(16, 185, 129, 0.1)",
          borderRadius: "0.5rem",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          fontSize: "0.75rem",
          fontWeight: "600",
        }}
      >
        <div
          style={{
            width: "0.375rem",
            height: "0.375rem",
            borderRadius: "50%",
            background: "#10b981",
          }}
        />
        <span style={{ color: "#10b981" }}>Base Sepolia</span>
      </div>
    );
  }

  // Determine badge color and text for wrong network or connecting
  let statusColor: string;
  let statusText: string;
  let dotColor: string;

  if (isConnecting) {
    statusColor = "rgba(251, 191, 36, 0.1)";
    statusText = "Connecting...";
    dotColor = "#fbbf24";
  } else {
    statusColor = "rgba(239, 68, 68, 0.1)";
    statusText = "Wrong Network";
    dotColor = "#ef4444";
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0.375rem 0.75rem",
        background: statusColor,
        borderRadius: "0.5rem",
        border: `1px solid ${dotColor}40`,
        fontSize: "0.75rem",
        fontWeight: "600",
      }}
    >
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: "0.375rem",
            height: "0.375rem",
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
          }}
        />
        {isConnecting && (
          <div
            style={{
              position: "absolute",
              width: "0.375rem",
              height: "0.375rem",
              borderRadius: "50%",
              background: dotColor,
              animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
            }}
          />
        )}
      </div>
      <span style={{ color: dotColor }}>{statusText}</span>
    </div>
  );
}

// Add ping animation to globals.css if not already there
// @keyframes ping {
//   75%, 100% {
//     transform: scale(2);
//     opacity: 0;
//   }
// }
