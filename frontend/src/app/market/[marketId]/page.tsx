// frontend/src/app/market/[marketId]/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { type Address } from "viem";

// --- 1. Import your token config and the new chart component ---
import { tokenInfoMap } from "@/app/tokenConfig";
import LightweightMarketChart from "@/app/LightweightMarketChart";

// Import your existing components
import { FillOrderForm } from "@/app/FillOrderForm";
import { CreateOrderForm } from "@/app/CreateOrderForm";
import { OrderList } from "@/app/OrderList";
import { CancelReduceOrderForm } from "@/app/CancelReduceOrderForm";

export default function MarketPage({
  params,
}: {
  params: { marketId: string };
}) {
  const searchParams = useSearchParams();

  // --- 2. Get token addresses from URL (like your other forms) ---
  const token0 = searchParams.get("token0") as Address | undefined;
  const token1 = searchParams.get("token1") as Address | undefined;
  const marketId = params.marketId;

  // --- 3. Look up symbols from your tokenConfig ---
  const symbol0 = token0 ? tokenInfoMap[token0]?.symbol : undefined; // e.g., "WETH"
  const symbol1 = token1 ? tokenInfoMap[token1]?.symbol : undefined; // e.g., "USDC"

  if (!token0 || !token1 || !symbol0 || !symbol1) {
    return (
      <div>
        Error: Token addresses or symbols not found. Check URL and
        tokenConfig.ts.
      </div>
    );
  }

  // --- 4. Prepare symbols for Pyth ---
  // Pyth uses "ETH", not "WETH". This maps it correctly.
  const chartBaseSymbol = symbol0 === "WETH" ? "ETH" : symbol0;
  const chartQuoteSymbol = symbol1 === "WETH" ? "ETH" : symbol1;

  return (
    <div>
      <h2>
        Market: {symbol0} / {symbol1}
      </h2>
      <p style={{ fontFamily: "monospace", fontSize: "12px", color: "#888" }}>
        Market ID: {marketId}
      </p>
      <hr style={{ margin: "20px 0" }} />

      {/* --- 5. Add the Lightweight Chart Component --- */}
      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <LightweightMarketChart
          baseSymbol={chartBaseSymbol}
          quoteSymbol={chartQuoteSymbol}
          chartType="Candlestick" // Or "Line", "Area"
          interval="60" // e.g., 60 for 1 hour. "D" for 1 day.
        />
      </div>
      <hr style={{ margin: "20px 0" }} />

      {/* --- Your existing components --- */}
      <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
        <div style={{ flex: 1 }}>
          <OrderList marketId={marketId} />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <CreateOrderForm defaultToken0={token0} defaultToken1={token1} />
          <FillOrderForm defaultToken0={token0} defaultToken1={token1} />
          <CancelReduceOrderForm
            defaultToken0={token0}
            defaultToken1={token1}
          />
        </div>
      </div>
    </div>
  );
}
