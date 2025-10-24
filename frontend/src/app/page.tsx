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
      <div className="two-column-layout">
        <div className="column">
          <CreateMarketForm />
        </div>
        <div className="column">
          <SupportedTokens /> {/* <-- 3. Add the new component */}
        </div>
      </div>
    </>
  );
}

export default App;
