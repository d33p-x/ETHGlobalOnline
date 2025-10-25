// frontend/src/app/market/[marketId]/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { type Address } from "viem";
import { useState, useEffect } from "react";
import { usePublicClient, useChainId } from "wagmi";
import { getP2PAddress, getDeploymentBlock } from "@/app/config";
import { p2pAbi } from "@/lib/contracts/abis";

// --- 1. Import your token config and the new chart component ---
import { useTokenRegistryContext } from "@/app/TokenRegistryContext";
import LightweightMarketChart from "@/app/LightweightMarketChart";
import { WrapUnwrapButton } from "@/app/WrapUnwrap";

// Import your existing components
import { TradingInterface } from "@/app/TradingInterface";
import { MarketDataTabs } from "@/app/MarketDataTabs";
import { MyOrders } from "@/app/MyOrders";
import { MyTrades } from "@/app/MyTrades";

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
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);
  const client = usePublicClient({ chainId });
  const { tokenInfoMap, isLoading } = useTokenRegistryContext();

  const marketId = params.marketId;

  const [availableMarkets, setAvailableMarkets] = useState<AvailableMarket[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [token0, setToken0] = useState<Address | undefined>();
  const [token1, setToken1] = useState<Address | undefined>();
  const [fetchingMarket, setFetchingMarket] = useState(true);
  const [marketStats, setMarketStats] = useState({
    price: "0.00",
    priceChange24h: "0.00",
    priceChangePercent24h: 0,
    volume24h: "0.00",
    liquidity: "0.00",
  });
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  // --- 3. Look up symbols from your tokenConfig (network-aware) ---
  const symbol0 = token0 ? tokenInfoMap[token0]?.symbol : undefined; // e.g., "WETH"
  const symbol1 = token1 ? tokenInfoMap[token1]?.symbol : undefined; // e.g., "USDC"

  const isWethMarket = symbol0 === "WETH" || symbol1 === "WETH";
  const wethAddress = symbol0 === "WETH" ? token0 : token1;

  // --- 4. Prepare symbols for Pyth (before useEffect that uses them) ---
  // Pyth uses "ETH", not "WETH". This maps it correctly.
  const chartBaseSymbol = symbol0 === "WETH" ? "ETH" : symbol0;
  const chartQuoteSymbol = symbol1 === "WETH" ? "ETH" : symbol1;

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

  // Fetch market stats (price, volume, liquidity)
  useEffect(() => {
    const fetchMarketStats = async () => {
      if (!client || !p2pAddress || !marketId || !token1) return;

      try {
        // Fetch market data from the contract
        const marketData = await client.readContract({
          address: p2pAddress,
          abi: p2pAbi,
          functionName: "markets",
          args: [marketId as `0x${string}`],
        });

        const totalLiquidity = marketData[6]; // totalLiquidity is at index 6
        const decimals0 = marketData[2]; // decimals0 is at index 2
        const decimals1 = marketData[3]; // decimals1 is at index 3

        // Format liquidity in token0 (WETH)
        const liquidityFormatted = (Number(totalLiquidity) / 10 ** decimals0).toLocaleString(undefined, {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        });

        // Fetch 24h volume from OrderFilled events
        const deploymentBlock = getDeploymentBlock(chainId);
        const currentBlock = await client.getBlockNumber();

        // Calculate blocks for ~24 hours (assuming ~12 second block time)
        const blocksPerDay = Math.floor((24 * 60 * 60) / 12);
        const fromBlock = currentBlock - BigInt(blocksPerDay);

        const orderFilledLogs = await client.getLogs({
          address: p2pAddress,
          event: p2pAbi.find(e => e.type === "event" && e.name === "OrderFilled"),
          args: {
            marketId: marketId as `0x${string}`,
          },
          fromBlock: fromBlock > deploymentBlock ? fromBlock : deploymentBlock,
          toBlock: "latest",
        });

        // Calculate 24h volume (sum of amount1Spent)
        let volume24h = BigInt(0);
        for (const log of orderFilledLogs) {
          volume24h += log.args.amount1Spent || BigInt(0);
        }

        const volumeFormatted = (Number(volume24h) / 10 ** decimals1).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });

        // Fetch current oracle price from Pyth (same as chart)
        // Map symbols for Pyth (WETH -> ETH)
        const baseSymbolForPyth = chartBaseSymbol; // Already mapped: WETH -> ETH
        const quoteSymbolForPyth = chartQuoteSymbol; // Already mapped

        let oraclePrice = "0.00";
        try {
          const pythApiBaseUrl = "https://benchmarks.pyth.network/v1/shims/tradingview";
          const now = Math.floor(Date.now() / 1000);
          const oneHourAgo = now - 3600;

          const basePythSymbol = `Crypto.${baseSymbolForPyth}/USD`;
          const quotePythSymbol = `Crypto.${quoteSymbolForPyth}/USD`;

          const [baseRes, quoteRes] = await Promise.all([
            fetch(`${pythApiBaseUrl}/history?symbol=${basePythSymbol}&resolution=60&from=${oneHourAgo}&to=${now}`),
            fetch(`${pythApiBaseUrl}/history?symbol=${quotePythSymbol}&resolution=60&from=${oneHourAgo}&to=${now}`)
          ]);

          if (baseRes.ok && quoteRes.ok) {
            const baseData = await baseRes.json();
            const quoteData = await quoteRes.json();

            if (baseData.s === "ok" && quoteData.s === "ok" && baseData.c && quoteData.c &&
                baseData.c.length > 0 && quoteData.c.length > 0) {
              // Get latest close prices
              const basePrice = baseData.c[baseData.c.length - 1];
              const quotePrice = quoteData.c[quoteData.c.length - 1];

              if (quotePrice !== 0) {
                const calculatedPrice = basePrice / quotePrice;
                oraclePrice = calculatedPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
              }
            }
          }
        } catch (error) {
          console.error("Error fetching oracle price:", error);
        }

        setMarketStats({
          price: oraclePrice,
          priceChange24h: "0.00", // TODO: Calculate from historical data
          priceChangePercent24h: 0, // TODO: Calculate from historical data
          volume24h: volumeFormatted,
          liquidity: liquidityFormatted,
        });
      } catch (error) {
        console.error("Error fetching market stats:", error);
      }
    };

    fetchMarketStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchMarketStats, 30000);
    return () => clearInterval(interval);
  }, [client, p2pAddress, marketId, chainId, token1, chartBaseSymbol, chartQuoteSymbol]);

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

  // Detect screen width for responsive layout
  useEffect(() => {
    const checkScreenWidth = () => {
      setIsNarrowScreen(window.innerWidth < 1400);
    };

    // Check on mount
    checkScreenWidth();

    // Add resize listener
    window.addEventListener("resize", checkScreenWidth);

    return () => {
      window.removeEventListener("resize", checkScreenWidth);
    };
  }, []);

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

  return (
    <div className="market-page-container">
      {/* Professional Market Header */}
      <div
        style={{
          background: "rgba(26, 34, 65, 0.6)",
          border: "1px solid rgba(59, 130, 246, 0.2)",
          borderRadius: "0.75rem",
          padding: "0.75rem 1rem",
          marginBottom: "0.5rem",
          backdropFilter: "blur(10px)",
          position: "relative",
          zIndex: 100,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "2rem",
            flexWrap: "wrap",
          }}
        >
          {/* Left Side - Market Info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              flex: 1,
            }}
          >
            {/* Market Pair with Dropdown */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <h1
                style={{
                  fontSize: "1rem",
                  fontWeight: "700",
                  color: "#f1f5f9",
                  margin: 0,
                  letterSpacing: "0.02em",
                }}
              >
                {symbol0}/{symbol1}
              </h1>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  fontSize: "0.625rem",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  boxShadow: "none",
                }}
              >
                ▼
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && availableMarkets.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 0.5rem)",
                    left: 0,
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.5rem",
                    padding: "0.5rem",
                    minWidth: "160px",
                    maxHeight: "300px",
                    overflowY: "auto",
                    zIndex: 10000,
                    boxShadow: "var(--shadow-lg)",
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
                          padding: "0.5rem",
                          background: isCurrentMarket ? "rgba(59, 130, 246, 0.15)" : "transparent",
                          border: "none",
                          borderRadius: "0.375rem",
                          color: isCurrentMarket ? "var(--accent-secondary)" : "var(--text-secondary)",
                          fontSize: "0.8125rem",
                          fontWeight: "500",
                          cursor: isCurrentMarket ? "default" : "pointer",
                          textAlign: "left",
                          transition: "all 0.15s ease",
                          marginBottom: "0.25rem",
                          boxShadow: "none",
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrentMarket) {
                            e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrentMarket) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        {market.symbol0}/{market.symbol1}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ width: "1px", height: "1.5rem", background: "var(--border-color)" }} />

            {/* Price */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", fontWeight: "500" }}>
                Price
              </span>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: "700",
                  color: marketStats.priceChangePercent24h >= 0 ? "var(--success)" : "var(--error)",
                  lineHeight: 1,
                }}
              >
                ${marketStats.price}
              </div>
            </div>

            {/* 24h Volume */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", fontWeight: "500" }}>
                24h Volume ({symbol1})
              </span>
              <span style={{ color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: "600" }}>
                {marketStats.volume24h}
              </span>
            </div>

            {/* Liquidity */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", fontWeight: "500" }}>
                Liquidity ({symbol0})
              </span>
              <span style={{ color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: "600" }}>
                {marketStats.liquidity}
              </span>
            </div>
          </div>

          {/* Right Side - Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {isWethMarket && wethAddress && (
              <WrapUnwrapButton wethAddress={wethAddress} />
            )}
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          flex: 1,
          minHeight: 0,
        }}
      >
        {isNarrowScreen ? (
          <>
            {/* Narrow Screen Layout */}
            {/* Top Row: Chart | Trading Interface */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 380px",
                gap: "0.5rem",
              }}
            >
              {/* Left: Chart */}
              <div
                style={{
                  minWidth: 0,
                  height: "calc(100vh - 520px)",
                  minHeight: "400px",
                  maxHeight: "600px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: "0.75rem",
                  overflow: "hidden",
                  background: "#1a2241",
                }}
              >
                {chartBaseSymbol && chartQuoteSymbol && (
                  <LightweightMarketChart
                    baseSymbol={chartBaseSymbol}
                    quoteSymbol={chartQuoteSymbol}
                    chartType="Candlestick"
                    interval="60"
                  />
                )}
              </div>

              {/* Right: Trading Interface */}
              <div
                style={{
                  minWidth: 0,
                  height: "calc(100vh - 520px)",
                  minHeight: "400px",
                  maxHeight: "600px",
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

            {/* Middle Row: Market Data Tabs (Order Book / Recent Trades) - Full Width */}
            <div
              style={{
                height: "300px",
                minHeight: "250px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <MarketDataTabs marketId={marketId} />
            </div>
          </>
        ) : (
          <>
            {/* Wide Screen Layout */}
            {/* Top Row: Chart | Market Data | Trading */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 380px 380px",
                gap: "0.5rem",
              }}
            >
              {/* Left: Chart */}
              <div
                style={{
                  minWidth: 0,
                  height: "calc(100vh - 320px)",
                  minHeight: "500px",
                  maxHeight: "700px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: "0.75rem",
                  overflow: "hidden",
                  background: "#1a2241",
                }}
              >
                {chartBaseSymbol && chartQuoteSymbol && (
                  <LightweightMarketChart
                    baseSymbol={chartBaseSymbol}
                    quoteSymbol={chartQuoteSymbol}
                    chartType="Candlestick"
                    interval="60"
                  />
                )}
              </div>

              {/* Middle: Market Data Tabs (Order Book / Recent Trades) */}
              <div
                style={{
                  minWidth: 0,
                  height: "calc(100vh - 320px)",
                  minHeight: "500px",
                  maxHeight: "700px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <MarketDataTabs marketId={marketId} />
              </div>

              {/* Right: Trading Interface */}
              <div
                style={{
                  minWidth: 0,
                  height: "calc(100vh - 320px)",
                  minHeight: "500px",
                  maxHeight: "700px",
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
          </>
        )}

        {/* Bottom Row: My Orders | My Trades */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            height: "220px",
            minHeight: "180px",
          }}
        >
          {/* My Orders */}
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "1rem",
              border: "1px solid var(--border-color)",
              overflow: "hidden",
              boxShadow: "var(--shadow-lg)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "0.75rem 1rem",
                borderBottom: "1px solid var(--border-color)",
                background: "var(--bg-tertiary)",
                fontSize: "0.8125rem",
                fontWeight: "600",
                color: "var(--text-primary)",
              }}
            >
              My Orders
            </div>
            <MyOrders marketId={marketId} />
          </div>

          {/* My Trades */}
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "1rem",
              border: "1px solid var(--border-color)",
              overflow: "hidden",
              boxShadow: "var(--shadow-lg)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "0.75rem 1rem",
                borderBottom: "1px solid var(--border-color)",
                background: "var(--bg-tertiary)",
                fontSize: "0.8125rem",
                fontWeight: "600",
                color: "var(--text-primary)",
              }}
            >
              My Trades
            </div>
            <MyTrades marketId={marketId} />
          </div>
        </div>
      </div>
    </div>
  );
}
