// src/app/MarketList.tsx
"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWatchContractEvent,
  useChainId,
} from "wagmi";
import { type Address, formatUnits } from "viem";
import { getP2PAddress, getDeploymentBlock } from "./config";
import Link from "next/link";
import { useTokenRegistryContext } from "./TokenRegistryContext";
import { CreateMarketModal } from "./CreateMarketModal";
import { p2pAbi } from "@/lib/contracts/abis";

type Market = {
  marketId: string;
  token0: Address;
  token1: Address;
  totalLiquidity: bigint;
  volume24h: bigint;
  activeOrders: number;
};

type PriceData = {
  [marketId: string]: {
    price: number;
    priceChange24h: number;
  };
};

export function MarketList() {
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);
  const { tokenInfoMap, isLoading: isLoadingRegistry } = useTokenRegistryContext();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [priceData, setPriceData] = useState<PriceData>({});

  const { chain } = useAccount();
  const client = usePublicClient({
    chainId: chain?.id ?? chainId,
  });

  useEffect(() => {
    if (!client || client.chain.id !== chainId) {
      if (client) {
        console.warn(
          `Client chain ID is ${client.chain.id}, expected ${chainId}. Waiting for connection.`
        );
        setError(
          `Please connect your wallet to the correct network (Chain ID ${chainId}).`
        );
      } else {
        console.warn("Public client not available yet.");
      }
      setIsLoading(false);
      return;
    }

    const fetchMarketsWithStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const latestBlock = await client.getBlockNumber();
        const fromBlock = getDeploymentBlock(chainId);

        // Fetch market creation events with chunking to avoid RPC limits
        const chunkSize = BigInt(10000); // Fetch in chunks of 10000 blocks
        const allMarketLogs: any[] = [];
        const allOrderLogs: any[] = [];
        const allFillLogs: any[] = [];
        const allCancelLogs: any[] = [];

        for (let currentBlock = fromBlock; currentBlock <= latestBlock; currentBlock += chunkSize) {
          const toBlock = currentBlock + chunkSize - 1n > latestBlock ? latestBlock : currentBlock + chunkSize - 1n;

          const [marketLogs, orderLogs, fillLogs, cancelLogs] = await Promise.all([
            client.getLogs({
              address: p2pAddress,
              event: p2pAbi[0], // MarketCreated
              fromBlock: currentBlock,
              toBlock,
            }),
            client.getLogs({
              address: p2pAddress,
              event: p2pAbi[1], // OrderCreated
              fromBlock: currentBlock,
              toBlock,
            }),
            client.getLogs({
              address: p2pAddress,
              event: p2pAbi[2], // OrderFilled
              fromBlock: currentBlock,
              toBlock,
            }),
            client.getLogs({
              address: p2pAddress,
              event: p2pAbi[3], // OrderReducedOrCancelled
              fromBlock: currentBlock,
              toBlock,
            }),
          ]);

          allMarketLogs.push(...marketLogs);
          allOrderLogs.push(...orderLogs);
          allFillLogs.push(...fillLogs);
          allCancelLogs.push(...cancelLogs);
        }

        const marketLogs = allMarketLogs;
        const orderLogs = allOrderLogs;
        const fillLogs = allFillLogs;
        const cancelLogs = allCancelLogs;

        // Calculate stats for each market
        const marketsWithStats = marketLogs.map((log) => {
          const marketId = log.args.marketId!;

          // Calculate total liquidity (sum of all active orders)
          const marketOrders = orderLogs.filter(
            (o) => o.args.marketId === marketId
          );
          const marketFills = fillLogs.filter(
            (f) => f.args.marketId === marketId
          );
          const marketCancels = cancelLogs.filter(
            (c) => c.args.marketId === marketId
          );

          // Track order amounts
          const orderAmounts = new Map<bigint, bigint>();
          marketOrders.forEach((o) => {
            orderAmounts.set(o.args.orderId!, o.args.amount0!);
          });

          // Subtract fills
          marketFills.forEach((f) => {
            const current = orderAmounts.get(f.args.orderId!) || 0n;
            orderAmounts.set(
              f.args.orderId!,
              current >= f.args.amount0Filled!
                ? current - f.args.amount0Filled!
                : 0n
            );
          });

          // Subtract cancels
          marketCancels.forEach((c) => {
            const current = orderAmounts.get(c.args.orderId!) || 0n;
            orderAmounts.set(
              c.args.orderId!,
              current >= c.args.amount0Closed!
                ? current - c.args.amount0Closed!
                : 0n
            );
          });

          // Sum remaining liquidity
          let totalLiquidity = 0n;
          let activeOrders = 0;
          orderAmounts.forEach((amount) => {
            if (amount > 0n) {
              totalLiquidity += amount;
              activeOrders++;
            }
          });

          // Calculate 24h volume (sum of all fills)
          const volume24h = marketFills.reduce(
            (sum, f) => sum + (f.args.amount1Spent || 0n),
            0n
          );

          return {
            marketId,
            token0: log.args.token0!,
            token1: log.args.token1!,
            totalLiquidity,
            volume24h,
            activeOrders,
          };
        });

        setMarkets(marketsWithStats);
        console.log("Fetched markets with stats:", marketsWithStats);
      } catch (err: any) {
        console.error("Error fetching market data:", err);
        setError(
          `Failed to fetch market data: ${err.shortMessage || err.message}`
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarketsWithStats();
  }, [client, p2pAddress, chainId]);

  // Fetch Pyth prices every 10 seconds
  useEffect(() => {
    if (markets.length === 0) return;

    const fetchPrices = async () => {
      try {
        const pricePromises = markets.map(async (market) => {
          const priceFeedId0 = tokenInfoMap[market.token0]?.priceFeedId;
          const priceFeedId1 = tokenInfoMap[market.token1]?.priceFeedId;

          if (!priceFeedId0 || !priceFeedId1) {
            return { marketId: market.marketId, price: 0, priceChange24h: 0 };
          }

          try {
            const response = await fetch(
              `https://hermes.pyth.network/api/latest_price_feeds?ids[]=${priceFeedId0}&ids[]=${priceFeedId1}`
            );
            const data = await response.json();

            if (data && data.length >= 2) {
              const price0 = parseFloat(data[0].price.price) * Math.pow(10, data[0].price.expo);
              const price1 = parseFloat(data[1].price.price) * Math.pow(10, data[1].price.expo);
              const currentPrice = price0 / price1;

              // Get 24h change (if available from Pyth)
              const prev0 = data[0].ema_price?.price ? parseFloat(data[0].ema_price.price) * Math.pow(10, data[0].ema_price.expo) : price0;
              const prev1 = data[1].ema_price?.price ? parseFloat(data[1].ema_price.price) * Math.pow(10, data[1].ema_price.expo) : price1;
              const prevPrice = prev0 / prev1;
              const priceChange24h = ((currentPrice - prevPrice) / prevPrice) * 100;

              return {
                marketId: market.marketId,
                price: currentPrice,
                priceChange24h,
              };
            }
          } catch (err) {
            console.error(`Error fetching price for market ${market.marketId}:`, err);
          }

          return { marketId: market.marketId, price: 0, priceChange24h: 0 };
        });

        const prices = await Promise.all(pricePromises);
        const priceMap: PriceData = {};
        prices.forEach((p) => {
          priceMap[p.marketId] = {
            price: p.price,
            priceChange24h: p.priceChange24h,
          };
        });
        setPriceData(priceMap);
      } catch (err) {
        console.error("Error fetching prices:", err);
      }
    };

    // Fetch immediately
    fetchPrices();

    // Then fetch every 10 seconds
    const interval = setInterval(fetchPrices, 10000);

    return () => clearInterval(interval);
  }, [markets, tokenInfoMap]);

  // Watch for new markets in real-time
  useWatchContractEvent({
    chainId: chainId,
    address: p2pAddress,
    abi: p2pAbi,
    eventName: "MarketCreated",
    onLogs(logs) {
      console.log("New market created!", logs);
      for (const log of logs) {
        if (!log.args) continue;
        const newMarket = {
          marketId: log.args.marketId!,
          token0: log.args.token0!,
          token1: log.args.token1!,
          totalLiquidity: 0n,
          volume24h: 0n,
          activeOrders: 0,
        };
        setMarkets((prevMarkets) => {
          if (prevMarkets.find((m) => m.marketId === newMarket.marketId)) {
            return prevMarkets;
          }
          return [...prevMarkets, newMarket];
        });
      }
    },
    onError(error) {
      console.error("Error watching contract events:", error);
    },
  });

  if (isLoading || isLoadingRegistry) {
    return (
      <div style={styles.loadingContainer}>
        <svg
          style={styles.loadingIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
        <p style={styles.loadingText}>Loading markets...</p>
      </div>
    );
  }

  return (
    <>
      <div style={styles.container}>
        {/* Header with Create Button */}
        <div style={styles.headerSection}>
          <div style={styles.titleGroup}>
            <svg
              style={styles.titleIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <h3 style={styles.title}>Available Markets</h3>
            {markets.length > 0 && (
              <span style={styles.badge}>
                {markets.length} {markets.length === 1 ? "Market" : "Markets"}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            style={styles.createButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 8px 16px rgba(59, 130, 246, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(59, 130, 246, 0.3)";
            }}
          >
            + Create Market
          </button>
        </div>

        {error && <p className="error-message">{error}</p>}
        {markets.length === 0 && !error ? (
          <div style={styles.emptyState}>
            <svg
              style={styles.emptyIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12h.01" />
            </svg>
            <p style={styles.emptyTitle}>No markets created yet</p>
            <p style={styles.emptySubtitle}>
              Click "Create Market" to get started
            </p>
          </div>
        ) : (
          <div style={styles.marketsList}>
            {markets.map((market) => {
              const symbol0 = tokenInfoMap[market.token0]?.symbol ?? "???";
              const symbol1 = tokenInfoMap[market.token1]?.symbol ?? "???";
              const decimals0 = tokenInfoMap[market.token0]?.decimals ?? 18;
              const decimals1 = tokenInfoMap[market.token1]?.decimals ?? 6;
              const price = priceData[market.marketId]?.price ?? 0;
              const priceChange = priceData[market.marketId]?.priceChange24h ?? 0;

              return (
                <Link
                  key={market.marketId}
                  href={`/market/${market.marketId}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={styles.marketCard}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.5)";
                      e.currentTarget.style.transform = "translateX(4px)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 24px rgba(59, 130, 246, 0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.2)";
                      e.currentTarget.style.transform = "translateX(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Market Pair */}
                    <div>
                      <div style={styles.marketPair}>
                        {symbol0} / {symbol1}
                      </div>
                      <div style={styles.marketId}>
                        {market.marketId.substring(0, 10)}...
                        {market.marketId.substring(market.marketId.length - 8)}
                      </div>
                    </div>

                    {/* Price */}
                    <div>
                      <div style={styles.statLabel}>Price</div>
                      <div style={styles.priceValue}>
                        {price > 0 ? (
                          <>
                            <div style={styles.priceMain}>
                              {price.toFixed(price < 1 ? 6 : 2)}{" "}
                              <span style={styles.priceToken}>{symbol1}</span>
                            </div>
                            {priceChange !== 0 && (
                              <span
                                style={{
                                  ...styles.priceChange,
                                  color: priceChange > 0 ? "#10b981" : "#ef4444",
                                }}
                              >
                                {priceChange > 0 ? "+" : ""}
                                {priceChange.toFixed(2)}% 24h
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ opacity: 0.5 }}>Loading...</span>
                        )}
                      </div>
                    </div>

                    {/* Liquidity */}
                    <div>
                      <div style={styles.statLabel}>Liquidity</div>
                      <div style={styles.liquidityValue}>
                        {market.totalLiquidity > 0n
                          ? `${parseFloat(formatUnits(market.totalLiquidity, decimals0)).toFixed(2)} ${symbol0}`
                          : "-"}
                      </div>
                    </div>

                    {/* Volume */}
                    <div>
                      <div style={styles.statLabel}>Volume</div>
                      <div style={styles.volumeValue}>
                        {market.volume24h > 0n
                          ? `${parseFloat(formatUnits(market.volume24h, decimals1)).toFixed(2)} ${symbol1}`
                          : "-"}
                      </div>
                    </div>

                    {/* Active Orders */}
                    <div>
                      <div style={styles.statLabel}>Orders</div>
                      <div style={styles.ordersValue}>
                        {market.activeOrders}
                      </div>
                    </div>

                    {/* Arrow Icon */}
                    <div style={styles.arrowIcon}>→</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <CreateMarketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        existingMarkets={markets}
      />
    </>
  );
}

const styles = {
  loadingContainer: {
    background: "rgba(30, 40, 73, 0.4)",
    padding: "3rem 2rem",
    borderRadius: "1rem",
    border: "1px solid rgba(59, 130, 246, 0.2)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
    textAlign: "center" as const,
    backdropFilter: "blur(10px)",
  },
  loadingIcon: {
    width: "48px",
    height: "48px",
    color: "#60a5fa",
    marginBottom: "1rem",
    animation: "spin 2s linear infinite",
  },
  loadingText: {
    color: "#cbd5e1",
    fontSize: "1rem",
  },
  container: {
    background: "rgba(30, 40, 73, 0.4)",
    padding: "2rem",
    borderRadius: "1rem",
    border: "1px solid rgba(59, 130, 246, 0.2)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
    backdropFilter: "blur(10px)",
  },
  headerSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "2rem",
    flexWrap: "wrap" as const,
    gap: "1rem",
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  titleIcon: {
    width: "28px",
    height: "28px",
    color: "#60a5fa",
  },
  title: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "#f1f5f9",
    letterSpacing: "-0.01em",
  },
  badge: {
    padding: "0.375rem 0.875rem",
    background:
      "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
    border: "1px solid rgba(59, 130, 246, 0.4)",
    borderRadius: "9999px",
    fontSize: "0.8125rem",
    fontWeight: "600",
    color: "#60a5fa",
  },
  createButton: {
    padding: "0.75rem 1.5rem",
    background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
    color: "white",
    border: "none",
    borderRadius: "0.5rem",
    fontSize: "0.9375rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "4rem 2rem",
    color: "#94a3b8",
  },
  emptyIcon: {
    width: "64px",
    height: "64px",
    color: "#64748b",
    marginBottom: "1rem",
    margin: "0 auto 1rem auto",
  },
  emptyTitle: {
    fontSize: "1.125rem",
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: "0.5rem",
  },
  emptySubtitle: {
    fontSize: "0.9375rem",
    color: "#94a3b8",
  },
  marketsList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  marketCard: {
    padding: "1.5rem",
    background: "rgba(26, 34, 65, 0.6)",
    border: "1px solid rgba(59, 130, 246, 0.2)",
    borderRadius: "0.75rem",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr auto",
    gap: "2rem",
    alignItems: "center",
    backdropFilter: "blur(10px)",
  },
  marketPair: {
    fontSize: "1.25rem",
    fontWeight: "700",
    background:
      "linear-gradient(135deg, #00f5ff 0%, #a855f7 50%, #ff0080 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    marginBottom: "0.25rem",
  },
  marketId: {
    fontSize: "0.75rem",
    color: "#64748b",
    fontFamily: "monospace",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    marginBottom: "0.25rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  liquidityValue: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#10b981",
  },
  volumeValue: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#60a5fa",
  },
  ordersValue: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#f59e0b",
  },
  priceValue: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#f1f5f9",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
  },
  priceMain: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.25rem",
  },
  priceToken: {
    fontSize: "0.75rem",
    fontWeight: "500",
    color: "#94a3b8",
  },
  priceChange: {
    fontSize: "0.75rem",
    fontWeight: "500",
  },
  arrowIcon: {
    fontSize: "1.5rem",
    color: "#94a3b8",
  },
};
