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
        <Link href="/markets" style={styles.navLink}>
          Markets
        </Link>
        {isConnected && (
          <Link href="/my-orders" style={styles.navLink}>
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
    padding: "1.25rem 2rem",
    background: "rgba(20, 27, 58, 0.8)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(59, 130, 246, 0.2)",
    position: "sticky" as const,
    top: 0,
    zIndex: 100,
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
  },
  logoLink: {
    textDecoration: "none",
    transition: "transform 0.2s ease",
  },
  logo: {
    margin: 0,
    fontSize: "1.75rem",
    fontWeight: "800",
    letterSpacing: "-0.02em",
  },
  logoGradient: {
    background:
      "linear-gradient(135deg, #00f5ff 0%, #a855f7 50%, #ff0080 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginLeft: "1rem",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.625rem 1.25rem",
    background: "rgba(59, 130, 246, 0.1)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: "0.5rem",
    color: "#60a5fa",
    textDecoration: "none",
    fontSize: "0.9375rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
  },
  rightSection: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginLeft: "auto",
  },
};
