// frontend/src/app/market/[marketId]/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { type Address } from "viem";

// --- 1. Import your token config and the new chart component ---
import { useTokenRegistryContext } from "@/app/TokenRegistryContext";
import LightweightMarketChart from "@/app/LightweightMarketChart";
import { WrapUnwrapButton } from "@/app/WrapUnwrap";

// Import your existing components
import { TradingInterface } from "@/app/TradingInterface";
import { OrderList } from "@/app/OrderList";
import { TradesList } from "@/app/TradesList";

export default function MarketPage({
  params,
}: {
  params: { marketId: string };
}) {
  const searchParams = useSearchParams();
  const { tokenInfoMap, isLoading } = useTokenRegistryContext();

  // --- 2. Get token addresses from URL (like your other forms) ---
  const token0 = searchParams.get("token0") as Address | undefined;
  const token1 = searchParams.get("token1") as Address | undefined;
  const marketId = params.marketId;

  // --- 3. Look up symbols from your tokenConfig (network-aware) ---
  const symbol0 = token0 ? tokenInfoMap[token0]?.symbol : undefined; // e.g., "WETH"
  const symbol1 = token1 ? tokenInfoMap[token1]?.symbol : undefined; // e.g., "USDC"

  const isWethMarket = symbol0 === "WETH" || symbol1 === "WETH";
  const wethAddress = symbol0 === "WETH" ? token0 : token1;

  if (isLoading) {
    return <div>Loading token information...</div>;
  }

  if (!token0 || !token1 || !symbol0 || !symbol1) {
    return (
      <div>
        Error: Token addresses or symbols not found. Check URL and contract
        events.
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.75rem" }}>
            {symbol0} / {symbol1}
          </h2>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              fontSize: "0.75rem",
              fontWeight: "600",
            }}
          >
            <span
              style={{
                padding: "0.25rem 0.75rem",
                background: "rgba(16, 185, 129, 0.2)",
                color: "#10b981",
                borderRadius: "9999px",
                border: "1px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              🎯 Zero Slippage
            </span>
          </div>
        </div>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            color: "#888",
            margin: "0 0 0.75rem 0",
          }}
        >
          Market ID: {marketId}
        </p>

        {/* Fee Info Banner */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1, display: "flex", gap: "0.75rem" }}>
            <div>
              <span style={{ color: "#94a3b8" }}>Maker Bonus: </span>
              <span style={{ color: "#10b981", fontWeight: "600" }}>
                +0.05%
              </span>
            </div>
            <div
              style={{
                width: "1px",
                background: "rgba(59, 130, 246, 0.2)",
              }}
            />
            <div>
              <span style={{ color: "#94a3b8" }}>Taker Fee: </span>
              <span style={{ color: "#60a5fa", fontWeight: "600" }}>0.10%</span>
            </div>
            <div
              style={{
                width: "1px",
                background: "rgba(59, 130, 246, 0.2)",
              }}
            />
            <div>
              <span style={{ color: "#94a3b8" }}>Net Spread: </span>
              <span style={{ color: "#cbd5e1", fontWeight: "600" }}>0.05%</span>
            </div>
          </div>
          {isWethMarket && wethAddress && (
            <WrapUnwrapButton wethAddress={wethAddress} />
          )}
        </div>
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

          {/* Trading Interface - 33% width */}
          <div
            style={{
              minWidth: 320,
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
            }}
          >
            <TradingInterface
              defaultToken0={token0}
              defaultToken1={token1}
              marketId={marketId}
            />
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
