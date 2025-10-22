// src/app/page.tsx
"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { CreateMarketForm } from "./CreateMarketForm";
import { MarketList } from "./MarketList";
import { Debug } from "./Debug";

// Renamed the main component to 'WalletConnect' for clarity
function WalletConnect() {
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div>
      <h2>Account</h2>
      <div>
        status: {account.status}
        <br />
        addresses: {JSON.stringify(account.addresses)}
        <br />
        chainId: {account.chainId}
      </div>

      {account.status === "connected" && (
        <button type="button" onClick={() => disconnect()}>
          Disconnect
        </button>
      )}

      <h2>Connect</h2>
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          type="button"
        >
          {connector.name}
        </button>
      ))}
      <div>{status}</div>
      <div>{error?.message}</div>
    </div>
  );
}

function App() {
  return (
    <>
      <Debug />
      <WalletConnect />
      <hr />
      {/* The home page now shows the MarketList and CreateMarketForm.
        All other forms are moved to the dynamic market page.
      */}
      <MarketList />
      <hr />
      <CreateMarketForm />
    </>
  );
}

export default App;
