// src/app/Header.tsx
"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";

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
  const { isConnected } = useAccount(); // <-- 1. Get connection status

  return (
    <header className="header-container">
      <Link href="/" className="header-link">
        <h1 className="header-title">P2P Exchange</h1>
      </Link>

      {/* 3. Add new link */}
      {isConnected && (
        <Link href="/my-orders" className="header-nav-link">
          My Orders
        </Link>
      )}

      <WalletConnect />
    </header>
  );
}
