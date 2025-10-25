// src/app/Header.tsx
"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { NetworkSelector } from "./components/NetworkSelector";

function WalletConnect() {
  // ... (this component remains the same)
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();

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
    <header style={styles.header}>
      <Link href="/" style={styles.logoLink}>
        <h1 style={styles.logo}>
          <span style={styles.logoGradient}>p33rX</span>
        </h1>
      </Link>

      <div style={styles.navLinks}>
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

      <div style={styles.rightSection}>
        <NetworkSelector />
        <WalletConnect />
      </div>
    </header>
  );
}

const styles = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 2.5rem",
    background: "linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(26, 34, 65, 0.95))",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(0, 245, 255, 0.15)",
    position: "sticky" as const,
    top: 0,
    zIndex: 100,
    boxShadow: "0 4px 30px rgba(0, 0, 0, 0.3), 0 0 40px rgba(0, 245, 255, 0.05)",
  },
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
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginLeft: "3rem",
    flex: 1,
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
  rightSection: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
};
