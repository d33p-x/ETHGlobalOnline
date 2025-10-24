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
import { TradesList } from "@/app/TradesList";

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
    <div
      style={{
        padding: "1.5rem",
        minHeight: "calc(100vh - 80px)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {/* Header Section */}
      <div style={{ marginBottom: "0.5rem" }}>
        <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.75rem" }}>
          {symbol0} / {symbol1}
        </h2>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            color: "#888",
            margin: 0,
          }}
        >
          Market ID: {marketId}
        </p>
      </div>

      {/* Main Content Area: Chart | Forms on top, OrderBook below */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Top Row: Chart (66%) | Forms (33%) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "1rem",
            height: "60%",
            minHeight: 0,
          }}
        >
          {/* Chart - 66% width */}
          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <LightweightMarketChart
              baseSymbol={chartBaseSymbol}
              quoteSymbol={chartQuoteSymbol}
              chartType="Candlestick"
              interval="60"
            />
          </div>

          {/* Forms - 33% width, stacked vertically */}
          <div
            style={{
              minWidth: 320,
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              overflow: "auto",
            }}
          >
            <CreateOrderForm defaultToken0={token0} defaultToken1={token1} />
            <FillOrderForm defaultToken0={token0} defaultToken1={token1} />
          </div>
        </div>

        {/* Bottom Row: OrderBook (50%) | Trades (50%) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            height: "40%",
            minHeight: 0,
          }}
        >
          {/* OrderBook - left half */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
            }}
          >
            <OrderList marketId={marketId} />
          </div>

          {/* Recent Trades - right half */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
            }}
          >
            <TradesList marketId={marketId} />
          </div>
        </div>
      </div>
    </div>
  );
}
