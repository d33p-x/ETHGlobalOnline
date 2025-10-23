// src/app/page.tsx
"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { CreateMarketForm } from "./CreateMarketForm";
import { MarketList } from "./MarketList";
import { Debug } from "./Debug";
import { SupportedTokens } from "./SupportedTokens"; // <-- 1. Import
// Renamed the main component to 'WalletConnect' for clarity

function App() {
  return (
    <>
      <Debug />

      <hr />
      {/* The home page now shows the MarketList and CreateMarketForm.
        All other forms are moved to the dynamic market page.
      */}
      <MarketList />
      <hr />
      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ flex: 1 }}>
          <CreateMarketForm />
        </div>
        <div style={{ flex: 1 }}>
          <SupportedTokens /> {/* <-- 3. Add the new component */}
        </div>
      </div>
    </>
  );
}

export default App;
