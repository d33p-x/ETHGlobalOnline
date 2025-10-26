// frontend/src/app/TradesList.tsx
"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent, useChainId } from "wagmi";
import { type Address, formatUnits } from "viem";
import { getP2PAddress, getDeploymentBlock } from "./config";
import { TableSkeleton } from "@/app/components/Skeleton";

// --- Config ---

// ABI for OrderFilled event
const orderFilledEventAbi = [
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
] as const;

// Define a type for trade/fill
type Trade = {
  orderId: bigint;
  token0: Address;
  token1: Address;
  amount0Filled: bigint;
  amount1Spent: bigint;
  taker: Address;
  blockNumber: bigint;
  transactionHash: string;
  timestamp?: number; // Optional: we'll try to get this from the block
};

// Helper function to format numbers to max 4 decimals
function formatToMaxDecimals(value: string, maxDecimals: number = 4): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  const fixed = num.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}

// Helper function to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000; // timestamp is in seconds, convert to ms
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export function TradesList({ marketId }: { marketId: string }) {
  const chainId = useChainId();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decimals0 = 18;
  const decimals1 = 6; // Assuming USDC or similar

  const client = usePublicClient({ chainId: chainId });

  // --- Fetch historical OrderFilled events ---
  useEffect(() => {
    if (!client || !marketId) {
      setTrades([]);
      setIsLoading(false);
      return;
    }

    const fetchTradeLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Get current block number
        const latestBlock = await client.getBlockNumber();

        // Get deployment block from config
        const fromBlock = getDeploymentBlock(chainId);

        const filledLogs = await client.getLogs({
          address: getP2PAddress(chainId),
          event: orderFilledEventAbi[0],
          args: {
            marketId: marketId as `0x${string}`,
          },
          fromBlock,
          toBlock: latestBlock,
        });

        // Convert logs to Trade objects
        const tradesData: Trade[] = [];
        for (const log of filledLogs) {
          const {
            orderId,
            token0,
            token1,
            amount0Filled,
            amount1Spent,
            taker,
          } = log.args;

          if (
            orderId !== undefined &&
            token0 &&
            token1 &&
            amount0Filled !== undefined &&
            amount1Spent !== undefined &&
            taker &&
            log.blockNumber &&
            log.transactionHash
          ) {
            tradesData.push({
              orderId,
              token0,
              token1,
              amount0Filled,
              amount1Spent,
              taker,
              blockNumber: log.blockNumber,
              transactionHash: log.transactionHash,
            });
          }
        }

        // Sort by block number descending (most recent first)
        tradesData.sort(
          (a, b) => Number(b.blockNumber) - Number(a.blockNumber)
        );

        // Keep only the most recent 50 trades
        const recentTrades = tradesData.slice(0, 50);

        // Fetch timestamps for the recent trades
        const tradesWithTimestamps = await Promise.all(
          recentTrades.map(async (trade) => {
            try {
              const block = await client.getBlock({ blockNumber: trade.blockNumber });
              return {
                ...trade,
                timestamp: Number(block.timestamp),
              };
            } catch {
              // If we can't fetch the timestamp, return trade without it
              return trade;
            }
          })
        );

        setTrades(tradesWithTimestamps);
      } catch (err: any) {
        console.error("Error fetching trade logs:", err);
        setError(`Failed to fetch trades: ${err.shortMessage || err.message}`);
        setTrades([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTradeLogs();
  }, [client, marketId]);

  // --- Watch for new OrderFilled events ---
  useWatchContractEvent({
    address: getP2PAddress(chainId),
    abi: orderFilledEventAbi,
    eventName: "OrderFilled",
    args: {
      marketId: marketId as `0x${string}`,
    },
    enabled: !!marketId,
    onLogs(logs) {
      setTrades((prevTrades) => {
        const newTrades = [...prevTrades];
        for (const log of logs) {
          const {
            orderId,
            token0,
            token1,
            amount0Filled,
            amount1Spent,
            taker,
          } = log.args;

          if (
            orderId !== undefined &&
            token0 &&
            token1 &&
            amount0Filled !== undefined &&
            amount1Spent !== undefined &&
            taker &&
            log.blockNumber &&
            log.transactionHash
          ) {
            // Check if this transaction hash already exists to prevent duplicates
            const exists = prevTrades.some(
              (t) => t.transactionHash === log.transactionHash
            );
            if (!exists) {
              // Add new trade at the beginning with current timestamp (as it just happened)
              newTrades.unshift({
                orderId,
                token0,
                token1,
                amount0Filled,
                amount1Spent,
                taker,
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                timestamp: Math.floor(Date.now() / 1000), // Current time in seconds
              });
            }
          }
        }
        // Keep only the most recent 50 trades
        return newTrades.slice(0, 50);
      });
    },
  });

  // Calculate price for each trade
  const getPrice = (trade: Trade): string => {
    if (trade.amount0Filled === 0n) return "N/A";
    const price =
      Number(formatUnits(trade.amount1Spent, decimals1)) /
      Number(formatUnits(trade.amount0Filled, decimals0));
    return formatToMaxDecimals(price.toString());
  };

  // Helper function to get Basescan URL
  const getBasescanUrl = (type: "tx" | "address", value: string): string => {
    const baseUrl = "https://sepolia.basescan.org";
    return type === "tx" ? `${baseUrl}/tx/${value}` : `${baseUrl}/address/${value}`;
  };

  return (
    <div
      style={{
        padding: "0.5rem",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg-card)",
      }}
    >

      {!marketId ? (
        <p style={{ fontSize: "0.875rem", padding: "1rem" }}>Market ID not found.</p>
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={4} />
      ) : error ? (
        <div className="error-message">Error: {error}</div>
      ) : trades.length === 0 ? (
        <p style={{ fontSize: "0.875rem", padding: "1rem" }}>No trades yet.</p>
      ) : (
        <>
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 0.8fr",
              padding: "0.5rem 0.5rem 0.375rem",
              fontSize: "0.6875rem",
              fontWeight: "600",
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border-color)",
              textTransform: "uppercase",
            }}
          >
            <div style={{ textAlign: "left" }}>Price</div>
            <div style={{ textAlign: "right" }}>Amount</div>
            <div style={{ textAlign: "right" }}>Total</div>
            <div style={{ textAlign: "right" }}>Time</div>
          </div>

          <div style={{ overflow: "auto", flex: 1 }}>
            {trades.map((trade, index) => {
              const price = getPrice(trade);
              const relativeTime = trade.timestamp ? formatRelativeTime(trade.timestamp) : "—";
              const exactTime = trade.timestamp ? new Date(trade.timestamp * 1000).toLocaleString() : undefined;

              return (
                <div
                  key={`${trade.transactionHash}-${index}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 0.8fr",
                    padding: "0.375rem 0.5rem",
                    fontSize: "0.75rem",
                    color: "#10b981",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(16, 185, 129, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                  onClick={() => window.open(getBasescanUrl("tx", trade.transactionHash), "_blank")}
                >
                  <div style={{ textAlign: "left" }}>{price}</div>
                  <div style={{ textAlign: "right" }}>
                    {formatToMaxDecimals(formatUnits(trade.amount0Filled, decimals0))}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {formatToMaxDecimals(formatUnits(trade.amount1Spent, decimals1))}
                  </div>
                  <div
                    style={{ textAlign: "right", fontSize: "0.7rem", color: "var(--text-muted)" }}
                    title={exactTime}
                  >
                    {relativeTime}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
