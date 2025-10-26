// src/app/Header.tsx
"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { NetworkSelector } from "./components/NetworkSelector";
import { NetworkStatusBadge } from "./components/WalletStatus";
import { baseSepolia } from "wagmi/chains";
import { useEffect } from "react";

function WalletConnect() {
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
    <div style={walletStyles.container}>
      {account.status === "connected" ? (
        <div style={walletStyles.connectedWrapper}>
          <div style={walletStyles.addressBadge}>
            <span style={walletStyles.walletIcon}>👛</span>
            <span style={walletStyles.addressText}>
              {account.addresses[0].substring(0, 6)}...
              {account.addresses[0].substring(account.addresses[0].length - 4)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => disconnect()}
            style={walletStyles.disconnectButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
            }}
          >
            <span style={walletStyles.disconnectIcon}>⏏</span>
          </button>
        </div>
      ) : (
        connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            type="button"
            style={walletStyles.connectButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #00f5ff 0%, #60a5fa 100%)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 245, 255, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #00d4e5 0%, #5094e0 100%)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 245, 255, 0.3)";
            }}
          >
            <span style={walletStyles.walletIcon}>🔗</span>
            <span>{connector.name}</span>
          </button>
        ))
      )}
      {status === "pending" && (
        <div style={walletStyles.statusText}>
          <span style={walletStyles.spinner}>⏳</span> Connecting...
        </div>
      )}
      {error && (
        <div style={walletStyles.errorText}>
          ⚠️ {error.message}
        </div>
      )}
    </div>
  );
}

const walletStyles = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  } as React.CSSProperties,
  connectedWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  } as React.CSSProperties,
  addressBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    background: "linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(96, 165, 250, 0.1) 100%)",
    border: "1px solid rgba(0, 245, 255, 0.3)",
    borderRadius: "0.75rem",
    backdropFilter: "blur(10px)",
    boxShadow: "0 2px 8px rgba(0, 245, 255, 0.1)",
  } as React.CSSProperties,
  walletIcon: {
    fontSize: "1rem",
  } as React.CSSProperties,
  addressText: {
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "#00f5ff",
    fontFamily: "monospace",
  } as React.CSSProperties,
  disconnectButton: {
    padding: "0.5rem 0.75rem",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "0.5rem",
    color: "#ef4444",
    fontSize: "1.25rem",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  disconnectIcon: {
    display: "inline-block",
  } as React.CSSProperties,
  connectButton: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.625rem 1.5rem",
    background: "linear-gradient(135deg, #00d4e5 0%, #5094e0 100%)",
    border: "none",
    borderRadius: "0.75rem",
    color: "white",
    fontSize: "0.9375rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(0, 245, 255, 0.3)",
  } as React.CSSProperties,
  statusText: {
    fontSize: "0.875rem",
    color: "#00f5ff",
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
  } as React.CSSProperties,
  spinner: {
    display: "inline-block",
    animation: "spin 1s linear infinite",
  } as React.CSSProperties,
  errorText: {
    fontSize: "0.875rem",
    color: "#ef4444",
    padding: "0.5rem 1rem",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "0.5rem",
  } as React.CSSProperties,
};

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
        <NetworkStatusBadge />
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
