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
};

function formatToMaxDecimals(value: string, maxDecimals: number = 4): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  const fixed = num.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}

export function AllMyOrders() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { tokenInfoMap } = useTokenRegistryContext();
  const client = usePublicClient({ chainId: chainId });
  const router = useRouter();

  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "trades">("orders");
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
      if (client && address) {
        fetchMyData(client, address);
      }
    }
  }, [isCancelled, client, address]);

  const fetchMyData = async (client: any, address: Address) => {
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

      setOpenOrders(Array.from(ordersMap.values()));

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

      const tradesData: Trade[] = myTradeLogs.map((log: any) => ({
        orderId: log.args.orderId!,
        marketId: log.args.marketId!,
        token0: log.args.token0!,
        token1: log.args.token1!,
        amount0Filled: log.args.amount0Filled!,
        amount1Spent: log.args.amount1Spent!,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
      }));

      tradesData.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
      setTrades(tradesData.slice(0, 50));
    } catch (err: any) {
      console.error("Error fetching my data:", err);
      setError(`Failed to fetch data: ${err.shortMessage || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (client && address) {
      fetchMyData(client, address);
      const interval = setInterval(() => {
        fetchMyData(client, address);
      }, 10000);
      return () => clearInterval(interval);
    } else {
      setOpenOrders([]);
      setTrades([]);
    }
  }, [client, address, chainId]);

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

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>My Trading Activity</h1>
        <p style={styles.subtitle}>View and manage your orders and trade history across all markets</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabHeader}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "orders" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("orders")}
        >
          Open Orders ({openOrders.length})
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "trades" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("trades")}
        >
          Trade History ({trades.length})
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {isLoading && openOrders.length === 0 && trades.length === 0 ? (
          <div style={styles.loading}>Loading...</div>
        ) : error ? (
          <div style={styles.error}>Error: {error}</div>
        ) : activeTab === "orders" ? (
          openOrders.length === 0 ? (
            <div style={styles.emptyState}>
              <h3 style={styles.emptyTitle}>No Open Orders</h3>
              <p style={styles.emptyText}>You don't have any active orders</p>
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
          )
        ) : (
          trades.length === 0 ? (
            <div style={styles.emptyState}>
              <h3 style={styles.emptyTitle}>No Trade History</h3>
              <p style={styles.emptyText}>You haven't made any trades yet</p>
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
          )
        )}
      </div>
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

  tabHeader: {
    display: "flex",
    borderBottom: "2px solid var(--border-color)",
    marginBottom: "2rem",
  } as React.CSSProperties,

  tab: {
    padding: "1rem 2rem",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-muted)",
    fontSize: "0.9375rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    marginBottom: "-2px",
  } as React.CSSProperties,

  tabActive: {
    color: "var(--accent-secondary)",
    borderBottom: "2px solid var(--accent-secondary)",
  } as React.CSSProperties,

  content: {
    minHeight: "400px",
  } as React.CSSProperties,

  tableContainer: {
    background: "var(--bg-card)",
    borderRadius: "0.75rem",
    border: "1px solid var(--border-color)",
    overflow: "hidden",
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  } as React.CSSProperties,

  tableHeader: {
    background: "var(--bg-tertiary)",
    borderBottom: "1px solid var(--border-color)",
  } as React.CSSProperties,

  th: {
    padding: "1rem",
    textAlign: "left" as const,
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
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
