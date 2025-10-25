// src/app/Header.tsx
"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { NetworkSelector } from "./components/NetworkSelector";
import { baseSepolia } from "wagmi/chains";
import { useEffect } from "react";

function WalletConnect() {
  // ... (this component remains the same)
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  // Auto-switch to Base Sepolia when connected to wrong network
  useEffect(() => {
    if (account.isConnected && account.chainId !== baseSepolia.id) {
      switchChain({ chainId: baseSepolia.id });
    }
  }, [account.isConnected, account.chainId, switchChain]);

  return (
    <div className="margin-left-auto">
      {account.status === "connected" ? (
        <div className="connected-account">
          <span>
            {account.addresses[0].substring(0, 6)}...
            {account.addresses[0].substring(account.addresses[0].length - 4)}
          </span>
          <button type="button" onClick={() => disconnect()}>
            Disconnect
          </button>
        </div>
      ) : (
        connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            type="button"
          >
            {connector.name}
          </button>
        ))
      )}
      {status === "pending" && <div>Connecting...</div>}
      {error && <div>{error.message}</div>}
    </div>
  );
}

export function Header() {
  const { isConnected } = useAccount();

  return (
    <header className="site-header">
      <Link href="/" style={styles.logoLink}>
        <h1 style={styles.logo}>
          <span style={styles.logoGradient}>p33rX</span>
        </h1>
      </Link>

      <div className="site-header-nav">
        <Link
          href="/markets"
          style={styles.navLink}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(0, 245, 255, 0.1)";
            e.currentTarget.style.borderColor = "rgba(0, 245, 255, 0.3)";
            e.currentTarget.style.color = "#00f5ff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "transparent";
            e.currentTarget.style.color = "#94a3b8";
          }}
        >
          Markets
        </Link>
        {isConnected && (
          <Link
            href="/my-orders"
            style={styles.navLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0, 245, 255, 0.1)";
              e.currentTarget.style.borderColor = "rgba(0, 245, 255, 0.3)";
              e.currentTarget.style.color = "#00f5ff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            My Orders
          </Link>
        )}
      </div>

      <div className="site-header-right">
        <NetworkSelector />
        <WalletConnect />
      </div>
    </header>
  );
}

const styles = {
  logoLink: {
    textDecoration: "none",
    transition: "all 0.3s ease",
  },
  logo: {
    margin: 0,
    fontSize: "2rem",
    fontWeight: "900",
    letterSpacing: "-0.03em",
    position: "relative" as const,
    display: "inline-block",
  },
  logoGradient: {
    background: "linear-gradient(135deg, #00f5ff 0%, #60a5fa 50%, #a855f7 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    filter: "drop-shadow(0 0 20px rgba(0, 245, 255, 0.3))",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.625rem 1.5rem",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "0.5rem",
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: "0.9375rem",
    fontWeight: "600",
    transition: "all 0.3s ease",
    position: "relative" as const,
  },
};
