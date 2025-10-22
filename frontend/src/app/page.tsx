// src/app/page.tsx
"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { CreateMarketForm } from "./CreateMarketForm";
import { MarketList } from "./MarketList";
import { Debug } from "./Debug";

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
      <CreateMarketForm />
    </>
  );
}

export default App;
