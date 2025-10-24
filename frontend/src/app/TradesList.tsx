// frontend/src/app/TradesList.tsx
"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { foundry } from "wagmi/chains";
import { type Address, formatUnits } from "viem";

// --- Config ---
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

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
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decimals0 = 18;
  const decimals1 = 6; // Assuming USDC or similar

  const client = usePublicClient({ chainId: foundry.id });

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
        const filledLogs = await client.getLogs({
          address: p2pContractAddress,
          event: orderFilledEventAbi[0],
          args: {
            marketId: marketId as `0x${string}`,
          },
          fromBlock: 0n,
          toBlock: "latest",
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
            log.blockNumber
          ) {
            tradesData.push({
              orderId,
              token0,
              token1,
              amount0Filled,
              amount1Spent,
              taker,
              blockNumber: log.blockNumber,
            });
          }
        }

        // Sort by block number descending (most recent first)
        tradesData.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));

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
    address: p2pContractAddress,
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
            log.blockNumber
          ) {
            // Add new trade at the beginning
            newTrades.unshift({
              orderId,
              token0,
              token1,
              amount0Filled,
              amount1Spent,
              taker,
              blockNumber: log.blockNumber,
            });
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
                <th>Order ID</th>
                <th>Price</th>
                <th>Amount</th>
                <th>Total</th>
                <th>Taker</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => (
                <tr key={`${trade.orderId}-${trade.blockNumber}-${index}`}>
                  <td>{trade.orderId.toString()}</td>
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
                  <td>{trade.taker.substring(0, 8)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
