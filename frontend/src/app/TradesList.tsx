// frontend/src/app/TradesList.tsx
"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent, useChainId } from "wagmi";
import { type Address, formatUnits } from "viem";
import { getP2PAddress, getDeploymentBlock } from "./config";

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
      console.log(`Fetching trade logs for marketId: ${marketId}`);
      try {
        // Get current block number
        const latestBlock = await client.getBlockNumber();
        console.log(`Latest block: ${latestBlock}`);

        // Get deployment block from config
        const fromBlock = getDeploymentBlock(chainId);

        console.log(
          `Fetching trade logs from block ${fromBlock} to ${latestBlock}`
        );

        const filledLogs = await client.getLogs({
          address: getP2PAddress(chainId),
          event: orderFilledEventAbi[0],
          args: {
            marketId: marketId as `0x${string}`,
          },
          fromBlock,
          toBlock: latestBlock,
        });
        console.log(`Found ${filledLogs.length} OrderFilled logs`);

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
        setTrades(tradesData.slice(0, 50));
        console.log("Processed trades:", tradesData.length);
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
      console.log("New OrderFilled event(s) detected:", logs);
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
              // Add new trade at the beginning
              newTrades.unshift({
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
        background: "var(--bg-card)",
        padding: "1rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-md)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <h3 style={{ marginBottom: "0.75rem", fontSize: "1.125rem" }}>
        Recent Trades
      </h3>

      {!marketId ? (
        <p style={{ fontSize: "0.875rem" }}>Market ID not found.</p>
      ) : isLoading ? (
        <div style={{ fontSize: "0.875rem" }}>Loading trades...</div>
      ) : error ? (
        <div className="error-message">Error: {error}</div>
      ) : trades.length === 0 ? (
        <p style={{ fontSize: "0.875rem" }}>No trades yet.</p>
      ) : (
        <div style={{ overflow: "auto", flex: 1 }}>
          <table className="order-table">
            <thead>
              <tr>
                <th>Tx Hash</th>
                <th>Price</th>
                <th>Amount</th>
                <th>Total</th>
                <th>Taker</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => (
                <tr key={`${trade.transactionHash}-${index}`}>
                  <td>
                    <a
                      href={getBasescanUrl("tx", trade.transactionHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#00f5ff",
                        textDecoration: "none",
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      {trade.transactionHash.substring(0, 10)}...
                    </a>
                  </td>
                  <td>{getPrice(trade)}</td>
                  <td>
                    {formatToMaxDecimals(
                      formatUnits(trade.amount0Filled, decimals0)
                    )}
                  </td>
                  <td>
                    {formatToMaxDecimals(
                      formatUnits(trade.amount1Spent, decimals1)
                    )}
                  </td>
                  <td>
                    <a
                      href={getBasescanUrl("address", trade.taker)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#00f5ff",
                        textDecoration: "none",
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      {trade.taker.substring(0, 8)}...
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
