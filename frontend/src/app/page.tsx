"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { CreateOrderForm } from "./CreateOrderForm";
import { CreateMarketForm } from "./CreateMarketForm";
import { FillOrderForm } from "./FillOrderForm";
import { MarketList } from "./MarketList";
import { Debug } from "./Debug";
import { OrderList } from "./OrderList";

function App() {
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <>
      <Debug />
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
      </div>
      <div>
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
      <hr />
      <MarketList />
      <hr />
      <OrderList />
      <hr />
      <CreateMarketForm />
      <hr />
      <CreateOrderForm /> {/* <-- Add this */}
      <hr />
      <FillOrderForm />
      <hr />
    </>
  );
}

export default App;
