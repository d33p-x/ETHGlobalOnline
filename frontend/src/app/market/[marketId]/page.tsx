// frontend/src/app/market/[marketId]/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { type Address } from "viem";
import { useState, useEffect } from "react";
import { usePublicClient, useChainId } from "wagmi";
import { getP2PAddress, getDeploymentBlock } from "@/app/config";

// --- 1. Import your token config and the new chart component ---
import { useTokenRegistryContext } from "@/app/TokenRegistryContext";
import LightweightMarketChart from "@/app/LightweightMarketChart";
import { WrapUnwrapButton } from "@/app/WrapUnwrap";

// Import your existing components
import { TradingInterface } from "@/app/TradingInterface";
import { OrderList } from "@/app/OrderList";
import { TradesList } from "@/app/TradesList";

const p2pAbi = [
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: false },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "markets",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "decimals0", type: "uint8" },
      { name: "decimals1", type: "uint8" },
      { name: "headId", type: "uint256" },
      { name: "tailId", type: "uint256" },
      { name: "totalLiquidity", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

type AvailableMarket = {
  marketId: string;
  token0: Address;
  token1: Address;
  symbol0: string;
  symbol1: string;
};

export default function MarketPage({
  params,
}: {
  params: { marketId: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);
  const client = usePublicClient({ chainId });
  const { tokenInfoMap, isLoading } = useTokenRegistryContext();

  const [availableMarkets, setAvailableMarkets] = useState<AvailableMarket[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [token0, setToken0] = useState<Address | undefined>();
  const [token1, setToken1] = useState<Address | undefined>();
  const [fetchingMarket, setFetchingMarket] = useState(true);

  const marketId = params.marketId;

  // --- 3. Look up symbols from your tokenConfig (network-aware) ---
  const symbol0 = token0 ? tokenInfoMap[token0]?.symbol : undefined; // e.g., "WETH"
  const symbol1 = token1 ? tokenInfoMap[token1]?.symbol : undefined; // e.g., "USDC"

  const isWethMarket = symbol0 === "WETH" || symbol1 === "WETH";
  const wethAddress = symbol0 === "WETH" ? token0 : token1;

  // Fetch token addresses from contract using marketId
  useEffect(() => {
    const fetchMarketTokens = async () => {
      if (!client || !p2pAddress || !marketId) return;

      try {
        const marketData = await client.readContract({
          address: p2pAddress,
          abi: p2pAbi,
          functionName: "markets",
          args: [marketId as `0x${string}`],
        });

        setToken0(marketData[0]);
        setToken1(marketData[1]);
        setFetchingMarket(false);
      } catch (error) {
        console.error("Error fetching market data:", error);
        setFetchingMarket(false);
      }
    };

    fetchMarketTokens();
  }, [client, p2pAddress, marketId]);

  // Fetch available markets
  useEffect(() => {
    const fetchMarkets = async () => {
      if (!client || !p2pAddress) return;

      try {
        const deploymentBlock = getDeploymentBlock(chainId);
        const logs = await client.getLogs({
          address: p2pAddress,
          event: p2pAbi[0],
          fromBlock: deploymentBlock,
          toBlock: "latest",
        });

        const markets: AvailableMarket[] = logs.map((log) => {
          const { marketId, token0, token1 } = log.args;
          return {
            marketId: marketId as string,
            token0: token0 as Address,
            token1: token1 as Address,
            symbol0: tokenInfoMap[token0 as Address]?.symbol || "???",
            symbol1: tokenInfoMap[token1 as Address]?.symbol || "???",
          };
        });

        setAvailableMarkets(markets);
      } catch (error) {
        console.error("Error fetching markets:", error);
      }
    };

    fetchMarkets();
  }, [client, p2pAddress, chainId, tokenInfoMap]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isDropdownOpen]);

  if (isLoading || fetchingMarket) {
    return <div>Loading market information...</div>;
  }

  if (!token0 || !token1 || !symbol0 || !symbol1) {
    return (
      <div>
        Error: Market not found or invalid market ID.
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
      <div
        style={{
          background: "rgba(26, 34, 65, 0.6)",
          border: "1px solid rgba(59, 130, 246, 0.2)",
          borderRadius: "0.75rem",
          padding: "1.25rem 1.5rem",
          marginBottom: "1rem",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "2rem",
                fontWeight: "700",
                background: "linear-gradient(135deg, #00f5ff 0%, #60a5fa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {symbol0} / {symbol1}
            </h1>

            {/* Market Selector Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                style={{
                  background: "rgba(0, 245, 255, 0.1)",
                  border: "1px solid rgba(0, 245, 255, 0.3)",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  cursor: "pointer",
                  color: "#00f5ff",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0, 245, 255, 0.2)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(0, 245, 255, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(0, 245, 255, 0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <span>Switch Market</span>
                <span style={{ fontSize: "0.75rem" }}>▼</span>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && availableMarkets.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 0.5rem)",
                    left: 0,
                    background: "rgba(15, 23, 42, 0.98)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    borderRadius: "0.5rem",
                    padding: "0.5rem",
                    minWidth: "200px",
                    maxHeight: "400px",
                    overflowY: "auto",
                    zIndex: 1000,
                    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
                  }}
                >
                  {availableMarkets.map((market) => {
                    const isCurrentMarket = market.marketId === marketId;
                    return (
                      <button
                        key={market.marketId}
                        onClick={() => {
                          if (!isCurrentMarket) {
                            router.push(`/market/${market.marketId}`);
                          }
                          setIsDropdownOpen(false);
                        }}
                        disabled={isCurrentMarket}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          background: isCurrentMarket
                            ? "rgba(59, 130, 246, 0.2)"
                            : "transparent",
                          border: "none",
                          borderRadius: "0.375rem",
                          color: isCurrentMarket ? "#60a5fa" : "#cbd5e1",
                          fontSize: "0.875rem",
                          fontWeight: "500",
                          cursor: isCurrentMarket ? "default" : "pointer",
                          textAlign: "left",
                          transition: "all 0.2s ease",
                          marginBottom: "0.25rem",
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrentMarket) {
                            e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrentMarket) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        {market.symbol0} / {market.symbol1}
                        {isCurrentMarket && (
                          <span style={{ marginLeft: "0.5rem", color: "#10b981" }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <span
              style={{
                padding: "0.375rem 0.875rem",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                borderRadius: "0.5rem",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                fontSize: "0.8125rem",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontSize: "1rem" }}>🎯</span>
              Zero Slippage
            </span>
          </div>

          {isWethMarket && wethAddress && (
            <WrapUnwrapButton wethAddress={wethAddress} />
          )}
        </div>

        {/* Fee Info Row */}
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>Maker:</span>
            <span
              style={{
                color: "#10b981",
                fontWeight: "700",
                fontSize: "0.875rem",
              }}
            >
              +0.05%
            </span>
          </div>
          <div
            style={{
              width: "1px",
              height: "1rem",
              background: "rgba(148, 163, 184, 0.2)",
            }}
          />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>Taker:</span>
            <span
              style={{
                color: "#60a5fa",
                fontWeight: "700",
                fontSize: "0.875rem",
              }}
            >
              0.10%
            </span>
          </div>
          <div
            style={{
              width: "1px",
              height: "1rem",
              background: "rgba(148, 163, 184, 0.2)",
            }}
          />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>Spread:</span>
            <span
              style={{
                color: "#cbd5e1",
                fontWeight: "700",
                fontSize: "0.875rem",
              }}
            >
              0.05%
            </span>
          </div>
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
            alignItems: "stretch",
          }}
        >
          {/* Chart - 66% width */}
          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              borderRadius: "0.75rem",
              overflow: "hidden",
              background: "#1a2241",
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
