// src/app/MarketList.tsx
"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWatchContractEvent, useChainId } from "wagmi";
import { type Address, formatUnits } from "viem";
import { getP2PAddress, getDeploymentBlock } from "./config";
import Link from "next/link";
import { getTokenInfoMap } from "./tokenConfig";
import { CreateMarketModal } from "./CreateMarketModal";

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
    type: "event",
    name: "OrderCreated",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
      { name: "amount0", type: "uint256", indexed: false },
      { name: "maxPrice", type: "uint256", indexed: false },
      { name: "minPrice", type: "uint256", indexed: false },
      { name: "orderId", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OrderFilled",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
      { name: "orderId", type: "uint256", indexed: true },
      { name: "amount0Filled", type: "uint256", indexed: false },
      { name: "amount1Spent", type: "uint256", indexed: false },
      { name: "taker", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OrderReducedOrCancelled",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: false },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
      { name: "orderId", type: "uint256", indexed: true },
      { name: "amount0Closed", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

type Market = {
  marketId: string;
  token0: Address;
  token1: Address;
  totalLiquidity: bigint;
  volume24h: bigint;
  activeOrders: number;
};

export function MarketList() {
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);
  const tokenInfoMap = getTokenInfoMap(chainId);

  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

        // Fetch market creation events
        const marketLogs = await client.getLogs({
          address: p2pAddress,
          event: p2pAbi[0], // MarketCreated
          fromBlock,
          toBlock: latestBlock,
        });

        // Fetch order events for stats
        const orderLogs = await client.getLogs({
          address: p2pAddress,
          event: p2pAbi[1], // OrderCreated
          fromBlock,
          toBlock: latestBlock,
        });

        const fillLogs = await client.getLogs({
          address: p2pAddress,
          event: p2pAbi[2], // OrderFilled
          fromBlock,
          toBlock: latestBlock,
        });

        const cancelLogs = await client.getLogs({
          address: p2pAddress,
          event: p2pAbi[3], // OrderReducedOrCancelled
          fromBlock,
          toBlock: latestBlock,
        });

        // Calculate stats for each market
        const marketsWithStats = marketLogs.map((log) => {
          const marketId = log.args.marketId!;

          // Calculate total liquidity (sum of all active orders)
          const marketOrders = orderLogs.filter(
            (o) => o.args.marketId === marketId
          );
          const marketFills = fillLogs.filter((f) => f.args.marketId === marketId);
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
              current >= f.args.amount0Filled! ? current - f.args.amount0Filled! : 0n
            );
          });

          // Subtract cancels
          marketCancels.forEach((c) => {
            const current = orderAmounts.get(c.args.orderId!) || 0n;
            orderAmounts.set(
              c.args.orderId!,
              current >= c.args.amount0Closed! ? current - c.args.amount0Closed! : 0n
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

  if (isLoading) {
    return (
      <div style={{
        background: "var(--bg-card)",
        padding: "2rem",
        borderRadius: "1rem",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-lg)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
        <p>Loading markets...</p>
      </div>
    );
  }

  return (
    <>
      <div style={{
        background: "var(--bg-card)",
        padding: "2rem",
        borderRadius: "1rem",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-lg)"
      }}>
        {/* Header with Create Button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>💹</span>
            <h3 style={{ margin: 0 }}>Available Markets</h3>
            {markets.length > 0 && (
              <span style={{
                padding: "0.25rem 0.75rem",
                background: "rgba(59, 130, 246, 0.2)",
                border: "1px solid var(--accent-primary)",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: "600",
                color: "var(--accent-secondary)"
              }}>
                {markets.length} {markets.length === 1 ? "Market" : "Markets"}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: "0.75rem 1.5rem",
              background: "var(--accent-primary)",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.9375rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            + Create Market
          </button>
        </div>

        {error && <p className="error-message">{error}</p>}
        {markets.length === 0 && !error ? (
          <div style={{
            textAlign: "center",
            padding: "3rem 1rem",
            color: "var(--text-muted)"
          }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
            <p>No markets created yet</p>
            <p style={{ fontSize: "0.875rem" }}>Click "Create Market" to get started</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {markets.map((market) => {
              const symbol0 = tokenInfoMap[market.token0]?.symbol ?? "???";
              const symbol1 = tokenInfoMap[market.token1]?.symbol ?? "???";
              const decimals0 = tokenInfoMap[market.token0]?.decimals ?? 18;
              const decimals1 = tokenInfoMap[market.token1]?.decimals ?? 6;

              return (
                <Link
                  key={market.marketId}
                  href={`/market/${market.marketId}?token0=${market.token0}&token1=${market.token1}`}
                  style={{ textDecoration: "none" }}
                >
                  <div style={{
                    padding: "1rem 1.5rem",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.5rem",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                    gap: "2rem",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-primary)";
                    e.currentTarget.style.transform = "translateX(4px)";
                    e.currentTarget.style.boxShadow = "var(--shadow-md)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    e.currentTarget.style.transform = "translateX(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}>
                    {/* Market Pair */}
                    <div>
                      <div style={{
                        fontSize: "1.25rem",
                        fontWeight: "700",
                        background: "linear-gradient(135deg, #00f5ff 0%, #ff0080 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text"
                      }}>
                        {symbol0} / {symbol1}
                      </div>
                      <div style={{
                        fontSize: "0.7rem",
                        color: "#64748b",
                        fontFamily: "monospace",
                        marginTop: "0.125rem",
                      }}>
                        {market.marketId.substring(0, 10)}...{market.marketId.substring(market.marketId.length - 8)}
                      </div>
                    </div>

                    {/* Liquidity */}
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.125rem" }}>
                        Liquidity
                      </div>
                      <div style={{ fontSize: "1rem", fontWeight: "600", color: "#10b981" }}>
                        {market.totalLiquidity > 0n
                          ? `${parseFloat(formatUnits(market.totalLiquidity, decimals0)).toFixed(2)} ${symbol0}`
                          : "-"}
                      </div>
                    </div>

                    {/* Volume */}
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.125rem" }}>
                        Volume
                      </div>
                      <div style={{ fontSize: "1rem", fontWeight: "600", color: "#3b82f6" }}>
                        {market.volume24h > 0n
                          ? `${parseFloat(formatUnits(market.volume24h, decimals1)).toFixed(2)} ${symbol1}`
                          : "-"}
                      </div>
                    </div>

                    {/* Active Orders */}
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.125rem" }}>
                        Orders
                      </div>
                      <div style={{ fontSize: "1rem", fontWeight: "600", color: "#f59e0b" }}>
                        {market.activeOrders}
                      </div>
                    </div>

                    {/* Arrow Icon */}
                    <div style={{ fontSize: "1.25rem", color: "#94a3b8" }}>
                      →
                    </div>
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
