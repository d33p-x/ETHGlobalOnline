// frontend/src/app/AllMyOrders.tsx
"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { type Address, formatUnits } from "viem";
import { useTokenRegistryContext } from "./TokenRegistryContext";
import { getP2PAddress, getDeploymentBlock } from "./config";
import { useRouter } from "next/navigation";

const cancelOrderAbi = [
  {
    type: "function",
    name: "cancelOrReduceOrder",
    inputs: [
      { name: "_token0", type: "address" },
      { name: "_token1", type: "address" },
      { name: "_amount0Close", type: "uint256" },
      { name: "_orderId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const p2pOrderEventsAbi = [
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

type Order = {
  orderId: bigint;
  marketId: string;
  maker: Address;
  token0: Address;
  token1: Address;
  remainingAmount0: bigint;
  initialAmount0: bigint;
  maxPrice: bigint;
  minPrice: bigint;
};

type Trade = {
  orderId: bigint;
  marketId: string;
  token0: Address;
  token1: Address;
  amount0Filled: bigint;
  amount1Spent: bigint;
  transactionHash: string;
  blockNumber: bigint;
  feePaid: bigint; // 0.2% of amount1Spent
};

type FilledOrder = {
  orderId: bigint;
  marketId: string;
  token0: Address;
  token1: Address;
  amount0Filled: bigint;
  amount1Received: bigint;
  transactionHash: string;
  blockNumber: bigint;
  timestamp?: number;
  feeEarned: bigint; // 0.15% of amount1Received
};

function formatToMaxDecimals(value: string, maxDecimals: number = 4): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  const fixed = num.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export function AllMyOrders() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { tokenInfoMap } = useTokenRegistryContext();
  const client = usePublicClient({ chainId: chainId });
  const router = useRouter();

  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [filledOrders, setFilledOrders] = useState<FilledOrder[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<bigint | null>(null);

  const {
    data: cancelHash,
    status: cancelStatus,
    error: cancelError,
    writeContract: cancelWriteContract,
  } = useWriteContract();

  const { isLoading: isCancelling, isSuccess: isCancelled } =
    useWaitForTransactionReceipt({ hash: cancelHash });

  useEffect(() => {
    if (isCancelled) {
      setCancellingOrderId(null);
      // Trigger re-fetch by updating a counter or similar
      // The main useEffect will handle the actual fetch
    }
  }, [isCancelled]);

  useEffect(() => {
    if (!client || !address) {
      setOpenOrders([]);
      setFilledOrders([]);
      setTrades([]);
      setError(null);
      return;
    }

    let isMounted = true;
    let abortController = new AbortController();

    const fetchMyData = async () => {
      // Prevent multiple simultaneous fetches
      if (isLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        const latestBlock = await client.getBlockNumber();
        const fromBlock = getDeploymentBlock(chainId);

        // Fetch all orders created by user (all markets)
        const createdLogs = await client.getLogs({
          address: getP2PAddress(chainId),
          event: p2pOrderEventsAbi[0],
          args: {
            maker: address,
          },
          fromBlock,
          toBlock: latestBlock,
        });

        // Build orders map
        const ordersMap = new Map<bigint, Order>();
        for (const log of createdLogs) {
          const orderId = log.args.orderId!;
          ordersMap.set(orderId, {
            orderId,
            marketId: log.args.marketId!,
            maker: log.args.maker!,
            token0: log.args.token0!,
            token1: log.args.token1!,
            initialAmount0: log.args.amount0!,
            remainingAmount0: log.args.amount0!,
            maxPrice: log.args.maxPrice!,
            minPrice: log.args.minPrice!,
          });
        }

        // Fetch cancellations/reductions
        const reducedLogs = await client.getLogs({
          address: getP2PAddress(chainId),
          event: p2pOrderEventsAbi[1],
          fromBlock,
          toBlock: latestBlock,
        });

        for (const log of reducedLogs) {
          const orderId = log.args.orderId;
          if (orderId !== undefined && ordersMap.has(orderId)) {
            const order = ordersMap.get(orderId)!;
            const amountClosed = log.args.amount0Closed!;
            order.remainingAmount0 -= amountClosed;
          }
        }

        // Fetch fills
        const filledLogs = await client.getLogs({
          address: getP2PAddress(chainId),
          event: p2pOrderEventsAbi[2],
          fromBlock,
          toBlock: latestBlock,
        });

        for (const log of filledLogs) {
          const orderId = log.args.orderId;
          if (orderId !== undefined && ordersMap.has(orderId)) {
            const order = ordersMap.get(orderId)!;
            const amountFilled = log.args.amount0Filled!;
            order.remainingAmount0 -= amountFilled;
          }
        }

        // Remove fully filled/cancelled orders
        ordersMap.forEach((order, orderId) => {
          if (order.remainingAmount0 <= 0n) {
            ordersMap.delete(orderId);
          }
        });

        // Only update state if component is still mounted
        if (isMounted) {
          setOpenOrders(Array.from(ordersMap.values()));
        }

        // Fetch trades where user was taker
        const myTradeLogs = await client.getLogs({
          address: getP2PAddress(chainId),
          event: p2pOrderEventsAbi[2],
          args: {
            taker: address,
          },
          fromBlock,
          toBlock: latestBlock,
        });

        const tradesData: Trade[] = myTradeLogs.map((log: any) => {
          const amount1Spent = log.args.amount1Spent!;
          // Buyer fee is 0.2% - calculate from total amount spent
          // feePaid = amount1Spent * 0.002
          const feePaid = (amount1Spent * 200n) / 100000n;

          return {
            orderId: log.args.orderId!,
            marketId: log.args.marketId!,
            token0: log.args.token0!,
            token1: log.args.token1!,
            amount0Filled: log.args.amount0Filled!,
            amount1Spent,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            feePaid,
          };
        });

        tradesData.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));

        // Only update state if component is still mounted
        if (isMounted) {
          setTrades(tradesData.slice(0, 50));
        }

        // Fetch filled orders where user was maker (their orders got filled)
        // Get all OrderIDs that belong to the user
        const userOrderIds = new Set(Array.from(ordersMap.keys()));
        createdLogs.forEach((log: any) => userOrderIds.add(log.args.orderId!));

        // Get all fills
        const allFillLogs = await client.getLogs({
          address: getP2PAddress(chainId),
          event: p2pOrderEventsAbi[2],
          fromBlock,
          toBlock: latestBlock,
        });

        // Filter fills that match user's orders
        const myFilledOrderLogs = allFillLogs.filter((log: any) =>
          userOrderIds.has(log.args.orderId!)
        );

        // Fetch timestamps for filled orders
        const filledOrdersData: FilledOrder[] = await Promise.all(
          myFilledOrderLogs.map(async (log: any) => {
            const amount1Received = log.args.amount1Spent!; // This is what the maker received
            // Seller bonus is 0.15% - calculate from amount received
            // feeEarned = amount1Received * 0.0015
            const feeEarned = (amount1Received * 150n) / 100000n;

            try {
              const block = await client.getBlock({ blockNumber: log.blockNumber });
              return {
                orderId: log.args.orderId!,
                marketId: log.args.marketId!,
                token0: log.args.token0!,
                token1: log.args.token1!,
                amount0Filled: log.args.amount0Filled!,
                amount1Received,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
                timestamp: Number(block.timestamp),
                feeEarned,
              };
            } catch {
              return {
                orderId: log.args.orderId!,
                marketId: log.args.marketId!,
                token0: log.args.token0!,
                token1: log.args.token1!,
                amount0Filled: log.args.amount0Filled!,
                amount1Received,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
                feeEarned,
              };
            }
          })
        );

        filledOrdersData.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));

        // Only update state if component is still mounted
        if (isMounted) {
          setFilledOrders(filledOrdersData.slice(0, 50));
        }

      } catch (err: any) {
        console.error("Error fetching my data:", err);
        if (isMounted) {
          setError(`Failed to fetch data: ${err.shortMessage || err.message}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchMyData();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchMyData();
    }, 10000); // Poll every 10 seconds

    // Cleanup function
    return () => {
      isMounted = false;
      abortController.abort();
      clearInterval(interval);
    };
  }, [client, address, chainId, isCancelled]);

  const handleCancelOrder = (order: Order) => {
    setCancellingOrderId(order.orderId);
    cancelWriteContract({
      address: getP2PAddress(chainId),
      abi: cancelOrderAbi,
      functionName: "cancelOrReduceOrder",
      args: [order.token0, order.token1, order.remainingAmount0, order.orderId],
    });
  };

  const formatPriceRange = (order: Order): string => {
    const minPriceNum = order.minPrice > 0n ? Number(formatUnits(order.minPrice, 18)) : 0;
    const maxPriceNum = order.maxPrice > 0n ? Number(formatUnits(order.maxPrice, 18)) : Infinity;

    if (maxPriceNum === Infinity) {
      return minPriceNum > 0 ? `${formatToMaxDecimals(minPriceNum.toString(), 4)} - Market` : "Market";
    } else if (minPriceNum === 0) {
      return `Market - ${formatToMaxDecimals(maxPriceNum.toString(), 4)}`;
    } else {
      return `${formatToMaxDecimals(minPriceNum.toString(), 4)} - ${formatToMaxDecimals(maxPriceNum.toString(), 4)}`;
    }
  };

  const getBasescanUrl = (tx: string): string => {
    return `https://sepolia.basescan.org/tx/${tx}`;
  };

  if (!isConnected) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <h2 style={styles.emptyTitle}>Connect Your Wallet</h2>
          <p style={styles.emptyText}>Please connect your wallet to view your orders and trades</p>
        </div>
      </div>
    );
  }

  // Calculate total fees earned by token
  const feesByToken = filledOrders.reduce((acc, order) => {
    const token1 = order.token1;
    if (!acc[token1]) {
      acc[token1] = 0n;
    }
    acc[token1] += order.feeEarned;
    return acc;
  }, {} as Record<Address, bigint>);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>My Trading Activity</h1>
        <p style={styles.subtitle}>View and manage your orders and trade history across all markets</p>
      </div>

      {/* Total Fees Earned Card */}
      {Object.keys(feesByToken).length > 0 && (
        <div style={styles.feesCard}>
          <div style={styles.feesCardHeader}>
            <span style={styles.feesIcon}>💰</span>
            <h3 style={styles.feesCardTitle}>Total Fees Earned</h3>
          </div>
          <div style={styles.feesBreakdown}>
            {Object.entries(feesByToken).map(([tokenAddress, totalFees]) => {
              const tokenInfo = tokenInfoMap[tokenAddress as Address];
              const symbol = tokenInfo?.symbol || "Unknown";
              const decimals = tokenInfo?.decimals || 18;
              const formattedAmount = formatToMaxDecimals(formatUnits(totalFees, decimals), 6);

              return (
                <div key={tokenAddress} style={styles.feeItem}>
                  <span style={styles.feeAmount}>+{formattedAmount} {symbol}</span>
                  <span style={styles.feeLabel}>Maker Rebates (0.15%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading && openOrders.length === 0 && filledOrders.length === 0 && trades.length === 0 ? (
        <div style={styles.loading}>Loading...</div>
      ) : error ? (
        <div style={styles.error}>Error: {error}</div>
      ) : (
        <>
          {/* Section 1: Open Orders */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Open Orders ({openOrders.length})</h2>
            {openOrders.length === 0 ? (
              <div style={styles.emptyStateSmall}>
                <p style={styles.emptyTextSmall}>No open orders</p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.th}>Market</th>
                    <th style={styles.th}>Order ID</th>
                    <th style={styles.th}>Price Range</th>
                    <th style={styles.th}>Size</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.map((order) => {
                    const symbol0 = tokenInfoMap[order.token0]?.symbol ?? "???";
                    const symbol1 = tokenInfoMap[order.token1]?.symbol ?? "???";
                    const decimals0 = tokenInfoMap[order.token0]?.decimals ?? 18;
                    const size = formatUnits(order.remainingAmount0, decimals0);
                    const priceDisplay = formatPriceRange(order);
                    const isThisOneCancelling =
                      (isCancelling || cancelStatus === "pending") &&
                      cancellingOrderId === order.orderId;

                    return (
                      <tr key={order.orderId.toString()} style={styles.tableRow}>
                        <td
                          style={{ ...styles.td, ...styles.marketCell }}
                          onClick={() => router.push(`/market/${order.marketId}`)}
                        >
                          {symbol0}/{symbol1}
                        </td>
                        <td style={styles.td}>#{order.orderId.toString()}</td>
                        <td style={styles.td}>{priceDisplay}</td>
                        <td style={styles.td}>{formatToMaxDecimals(size, 4)} {symbol0}</td>
                        <td style={styles.td}>
                          <button
                            onClick={() => handleCancelOrder(order)}
                            disabled={isThisOneCancelling}
                            style={{
                              ...styles.cancelButton,
                              ...(isThisOneCancelling ? styles.cancelButtonDisabled : {}),
                            }}
                          >
                            {isThisOneCancelling ? "Cancelling..." : "Cancel"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Section 2: Filled Orders (your orders that got filled) */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Filled Orders ({filledOrders.length})</h2>
            {filledOrders.length === 0 ? (
              <div style={styles.emptyStateSmall}>
                <p style={styles.emptyTextSmall}>No filled orders yet</p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.th}>Market</th>
                    <th style={styles.th}>Order ID</th>
                    <th style={styles.th}>Amount Sold</th>
                    <th style={styles.th}>Amount Received</th>
                    <th style={styles.th}>Fee Earned</th>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {filledOrders.map((filledOrder, index) => {
                    const symbol0 = tokenInfoMap[filledOrder.token0]?.symbol ?? "???";
                    const symbol1 = tokenInfoMap[filledOrder.token1]?.symbol ?? "???";
                    const decimals0 = tokenInfoMap[filledOrder.token0]?.decimals ?? 18;
                    const decimals1 = tokenInfoMap[filledOrder.token1]?.decimals ?? 18;
                    const relativeTime = filledOrder.timestamp ? formatRelativeTime(filledOrder.timestamp) : "—";
                    const exactTime = filledOrder.timestamp ? new Date(filledOrder.timestamp * 1000).toLocaleString() : undefined;

                    return (
                      <tr key={`${filledOrder.transactionHash}-${index}`} style={styles.tableRow}>
                        <td
                          style={{ ...styles.td, ...styles.marketCell }}
                          onClick={() => router.push(`/market/${filledOrder.marketId}`)}
                        >
                          {symbol0}/{symbol1}
                        </td>
                        <td style={styles.td}>#{filledOrder.orderId.toString()}</td>
                        <td style={styles.td}>
                          {formatToMaxDecimals(formatUnits(filledOrder.amount0Filled, decimals0), 4)} {symbol0}
                        </td>
                        <td style={styles.td}>
                          {formatToMaxDecimals(formatUnits(filledOrder.amount1Received, decimals1), 4)} {symbol1}
                        </td>
                        <td style={{ ...styles.td, color: "#10b981", fontWeight: "600" }}>
                          +{formatToMaxDecimals(formatUnits(filledOrder.feeEarned, decimals1), 6)} {symbol1}
                        </td>
                        <td style={{ ...styles.td, fontSize: "0.75rem", color: "var(--text-muted)" }} title={exactTime}>
                          {relativeTime}
                        </td>
                        <td style={styles.td}>
                          <button
                            onClick={() => window.open(getBasescanUrl(filledOrder.transactionHash), "_blank")}
                            style={styles.viewButton}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Section 3: Trade History (you as taker) */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Trade History ({trades.length})</h2>
            {trades.length === 0 ? (
              <div style={styles.emptyStateSmall}>
                <p style={styles.emptyTextSmall}>No trades yet</p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.th}>Market</th>
                    <th style={styles.th}>Order ID</th>
                    <th style={styles.th}>Amount Bought</th>
                    <th style={styles.th}>Amount Spent</th>
                    <th style={styles.th}>Fee Paid</th>
                    <th style={styles.th}>Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade, index) => {
                    const symbol0 = tokenInfoMap[trade.token0]?.symbol ?? "???";
                    const symbol1 = tokenInfoMap[trade.token1]?.symbol ?? "???";
                    const decimals0 = tokenInfoMap[trade.token0]?.decimals ?? 18;
                    const decimals1 = tokenInfoMap[trade.token1]?.decimals ?? 18;

                    return (
                      <tr key={`${trade.transactionHash}-${index}`} style={styles.tableRow}>
                        <td
                          style={{ ...styles.td, ...styles.marketCell }}
                          onClick={() => router.push(`/market/${trade.marketId}`)}
                        >
                          {symbol0}/{symbol1}
                        </td>
                        <td style={styles.td}>#{trade.orderId.toString()}</td>
                        <td style={styles.td}>
                          {formatToMaxDecimals(formatUnits(trade.amount0Filled, decimals0), 4)} {symbol0}
                        </td>
                        <td style={styles.td}>
                          {formatToMaxDecimals(formatUnits(trade.amount1Spent, decimals1), 4)} {symbol1}
                        </td>
                        <td style={{ ...styles.td, color: "#ef4444", fontWeight: "600" }}>
                          -{formatToMaxDecimals(formatUnits(trade.feePaid, decimals1), 6)} {symbol1}
                        </td>
                        <td style={styles.td}>
                          <button
                            onClick={() => window.open(getBasescanUrl(trade.transactionHash), "_blank")}
                            style={styles.viewButton}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    )}
  </div>
);
}

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem",
  } as React.CSSProperties,

  header: {
    marginBottom: "2rem",
  } as React.CSSProperties,

  title: {
    fontSize: "2rem",
    fontWeight: "700",
    color: "var(--text-primary)",
    marginBottom: "0.5rem",
  } as React.CSSProperties,

  subtitle: {
    fontSize: "1rem",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  feesCard: {
    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    borderRadius: "1rem",
    padding: "1.5rem",
    marginBottom: "2rem",
    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.1)",
  } as React.CSSProperties,

  feesCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1rem",
  } as React.CSSProperties,

  feesIcon: {
    fontSize: "1.5rem",
  } as React.CSSProperties,

  feesCardTitle: {
    fontSize: "1.25rem",
    fontWeight: "700",
    color: "#10b981",
    margin: 0,
  } as React.CSSProperties,

  feesBreakdown: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  } as React.CSSProperties,

  feeItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 1rem",
    background: "rgba(16, 185, 129, 0.05)",
    borderRadius: "0.5rem",
    border: "1px solid rgba(16, 185, 129, 0.2)",
  } as React.CSSProperties,

  feeAmount: {
    fontSize: "1.125rem",
    fontWeight: "700",
    color: "#10b981",
    fontFamily: "monospace",
  } as React.CSSProperties,

  feeLabel: {
    fontSize: "0.875rem",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  section: {
    marginBottom: "2rem",
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    marginBottom: "1rem",
  } as React.CSSProperties,

  emptyStateSmall: {
    padding: "2rem",
    textAlign: "center" as const,
  } as React.CSSProperties,

  emptyTextSmall: {
    color: "var(--text-muted)",
    fontSize: "0.875rem",
  } as React.CSSProperties,

  tableContainer: {
    background: "var(--bg-card)",
    borderRadius: "0.75rem",
    border: "1px solid var(--border-color)",
    overflow: "hidden",
    maxHeight: "400px",
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  } as React.CSSProperties,

  tableHeader: {
    background: "var(--bg-tertiary)",
    borderBottom: "1px solid var(--border-color)",
    position: "sticky" as const,
    top: 0,
    zIndex: 10,
  } as React.CSSProperties,

  th: {
    padding: "1rem",
    textAlign: "left" as const,
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    background: "var(--bg-tertiary)",
  } as React.CSSProperties,

  tableRow: {
    borderBottom: "1px solid var(--border-color)",
    transition: "background 0.15s",
    cursor: "default" as const,
  } as React.CSSProperties,

  td: {
    padding: "1rem",
    fontSize: "0.875rem",
    color: "var(--text-primary)",
  } as React.CSSProperties,

  marketCell: {
    color: "#3b82f6",
    cursor: "pointer",
    fontWeight: "600",
  } as React.CSSProperties,

  cancelButton: {
    background: "rgba(239, 68, 68, 0.2)",
    border: "1px solid #ef4444",
    borderRadius: "0.375rem",
    padding: "0.5rem 1rem",
    fontSize: "0.8125rem",
    color: "#ef4444",
    cursor: "pointer",
    transition: "all 0.15s",
    fontWeight: "600",
  } as React.CSSProperties,

  cancelButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,

  viewButton: {
    background: "rgba(59, 130, 246, 0.2)",
    border: "1px solid #3b82f6",
    borderRadius: "0.375rem",
    padding: "0.5rem 1rem",
    fontSize: "0.8125rem",
    color: "#3b82f6",
    cursor: "pointer",
    transition: "all 0.15s",
    fontWeight: "600",
  } as React.CSSProperties,

  loading: {
    textAlign: "center" as const,
    padding: "3rem",
    fontSize: "1rem",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  error: {
    textAlign: "center" as const,
    padding: "3rem",
    fontSize: "1rem",
    color: "#ef4444",
  } as React.CSSProperties,

  emptyState: {
    textAlign: "center" as const,
    padding: "4rem 2rem",
  } as React.CSSProperties,

  emptyTitle: {
    fontSize: "1.5rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    marginBottom: "0.5rem",
  } as React.CSSProperties,

  emptyText: {
    fontSize: "1rem",
    color: "var(--text-muted)",
  } as React.CSSProperties,
};
