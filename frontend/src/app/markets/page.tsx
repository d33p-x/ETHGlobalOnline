// frontend/src/app/markets/page.tsx
"use client";

import { MarketList } from "@/app/MarketList";

export default function MarketsPage() {
  return (
    <div
      style={{
        padding: "2rem",
        minHeight: "calc(100vh - 80px)",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: "700",
            marginBottom: "0.5rem",
            color: "var(--text-primary)",
          }}
        >
          All Markets
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--text-secondary)",
            marginBottom: "2rem",
          }}
        >
          Explore all available trading pairs with zero slippage oracle pricing
        </p>
        <MarketList />
      </div>
    </div>
  );
}
