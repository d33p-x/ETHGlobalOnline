// src/app/Header.tsx
"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function WalletConnect() {
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div style={{ marginLeft: "auto" }}>
      {account.status === "connected" ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "1rem",
        borderBottom: "1px solid #333",
      }}
    >
      <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>P2P Exchange</h1>
      </Link>
      <WalletConnect />
    </header>
  );
}
