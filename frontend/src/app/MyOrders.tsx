// src/app/MyOrders.tsx
"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { type Address, type Log, formatUnits, BaseError } from "viem";
import { useTokenRegistryContext } from "./TokenRegistryContext";
import { getP2PAddress, getDeploymentBlock } from "./config";

// --- Config ---

// Add 'cancelOrReduceOrder' ABI
const p2pAbi = [
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

// Add all 3 event ABIs (OrderCreated, OrderReducedOrCancelled, OrderFilled)
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
  maker: Address;
  token0: Address;
  token1: Address;
  remainingAmount0: bigint;
  initialAmount0: bigint;
  maxPrice: bigint;
  minPrice: bigint;
};
type OrderMap = Map<bigint, Order>;

type Fill = {
  log: Log;
  orderId: bigint;
  amount0Filled: bigint;
  amount1Spent: bigint;
  taker: Address;
  token0: Address;
  token1: Address;
};

export function MyOrders() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { tokenInfoMap } = useTokenRegistryContext();
  const client = usePublicClient({ chainId: chainId });

  const [openOrders, setOpenOrders] = useState<OrderMap>(new Map());
  const [filledOrders, setFilledOrders] = useState<Fill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for managing which order is being cancelled
  const [cancellingOrderId, setCancellingOrderId] = useState<bigint | null>(
    null
  );

  // Add wagmi hooks for cancelling
  const {
    data: cancelHash,
    status: cancelStatus,
    error: cancelError,
    writeContract: cancelWriteContract,
  } = useWriteContract();

  const { isLoading: isCancelling, isSuccess: isCancelled } =
    useWaitForTransactionReceipt({ hash: cancelHash });

  // Refetch orders when a cancel is successful
  useEffect(() => {
    if (isCancelled) {
      setCancellingOrderId(null); // Reset loading state
      // Refetch logic (simple way is to just re-run the main fetch)
      if (client && address) {
        fetchMyLogs(client, address);
      }
    }
  }, [isCancelled, client, address]);

  // Extracted fetch logic into its own function
  const fetchMyLogs = async (client: any, address: Address) => {
    setIsLoading(true);
    setError(null);
    try {
      // Get current block and deployment block from config
      const latestBlock = await client.getBlockNumber();
      const fromBlock = getDeploymentBlock(chainId);

      // 1. Fetch all orders CREATED by user (across ALL markets)
      const createdLogs = await client.getLogs({
        address: getP2PAddress(chainId),
        event: p2pOrderEventsAbi[0], // OrderCreated
        args: {
          maker: address, // <-- Filter by connected user!
        },
        fromBlock,
        toBlock: latestBlock,
      });

      // 2. Fetch all orders FILLED by user (as taker)
      const filledLogsAsTaker = await client.getLogs({
        address: getP2PAddress(chainId),
        event: p2pOrderEventsAbi[2], // OrderFilled
        args: {
          taker: address, // <-- Filter by connected user!
        },
        fromBlock,
        toBlock: latestBlock,
      });

      const myFills: Fill[] = filledLogsAsTaker.map((log: any) => ({
        log: log,
        orderId: log.args.orderId!,
        amount0Filled: log.args.amount0Filled!,
        amount1Spent: log.args.amount1Spent!,
        taker: log.args.taker!,
        token0: log.args.token0!,
        token1: log.args.token1!,
      }));
      setFilledOrders(myFills);

      // --- Process Open Orders ---
      const myOpenOrders: OrderMap = new Map();

      for (const log of createdLogs) {
        const orderId = log.args.orderId!;

        myOpenOrders.set(orderId, {
          orderId: orderId,
          maker: log.args.maker!,
          token0: log.args.token0!,
          token1: log.args.token1!,
          initialAmount0: log.args.amount0!,
          remainingAmount0: log.args.amount0!,
          maxPrice: log.args.maxPrice!,
          minPrice: log.args.minPrice!,
        });
      }

      const reducedLogs = await client.getLogs({
        address: getP2PAddress(chainId),
        event: p2pOrderEventsAbi[1], // OrderReducedOrCancelled
        fromBlock,
        toBlock: latestBlock,
      });

      const filledLogs = await client.getLogs({
        address: getP2PAddress(chainId),
        event: p2pOrderEventsAbi[2], // OrderFilled
        fromBlock,
        toBlock: latestBlock,
      });

      console.log(`Processing ${reducedLogs.length} reduction/cancellation logs`);
      for (const log of reducedLogs) {
        const orderId = log.args.orderId;
        if (orderId !== undefined && myOpenOrders.has(orderId)) {
          const order = myOpenOrders.get(orderId)!;
          const amountClosed = log.args.amount0Closed!;
          console.log(`Reducing order ${orderId}: ${order.remainingAmount0} - ${amountClosed}`);
          order.remainingAmount0 -= amountClosed;
          console.log(`New remaining amount: ${order.remainingAmount0}`);
        }
      }

      console.log(`Processing ${filledLogs.length} fill logs`);
      for (const log of filledLogs) {
        const orderId = log.args.orderId;
        if (orderId !== undefined && myOpenOrders.has(orderId)) {
          const order = myOpenOrders.get(orderId)!;
          const amountFilled = log.args.amount0Filled!;
          console.log(`Filling order ${orderId}: ${order.remainingAmount0} - ${amountFilled}`);
          order.remainingAmount0 -= amountFilled;
          console.log(`New remaining amount: ${order.remainingAmount0}`);
        }
      }

      console.log(`Checking for orders to delete...`);
      myOpenOrders.forEach((order) => {
        if (order.remainingAmount0 <= 0n) {
          console.log(`Deleting order ${order.orderId} with remaining amount ${order.remainingAmount0}`);
          myOpenOrders.delete(order.orderId);
        }
      });

      console.log(`Final order count: ${myOpenOrders.size}`);

      setOpenOrders(myOpenOrders);
    } catch (err: any) {
      console.error("Error fetching my logs:", err);
      setError(`Failed to fetch orders: ${err.shortMessage || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Main useEffect now just calls the fetch function
  useEffect(() => {
    if (client && address) {
      fetchMyLogs(client, address);

      // Also refresh every 10 seconds to catch fills by others
      const interval = setInterval(() => {
        fetchMyLogs(client, address);
      }, 10000);

      return () => clearInterval(interval);
    } else {
      setOpenOrders(new Map());
      setFilledOrders([]);
    }
  }, [client, address, chainId]);

  // Handle function for the cancel button
  const handleCancelOrder = (order: Order) => {
    setCancellingOrderId(order.orderId); // Set loading state for this row

    cancelWriteContract({
      address: getP2PAddress(chainId),
      abi: p2pAbi,
      functionName: "cancelOrReduceOrder",
      args: [
        order.token0,
        order.token1,
        order.remainingAmount0, // <-- Pass the full remaining amount to cancel
        order.orderId,
      ],
    });
  };

  // Helper function to format numbers to max decimals
  function formatToMaxDecimals(value: string, maxDecimals: number = 4): string {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    const fixed = num.toFixed(maxDecimals);
    return parseFloat(fixed).toString();
  }

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

  if (!isConnected) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyStateIcon}>🔒</div>
          <h3 style={styles.emptyStateTitle}>Connect Your Wallet</h3>
          <p style={styles.emptyStateText}>Please connect your wallet to see your orders and trade history.</p>
        </div>
      </div>
    );
  }

  if (isLoading && openOrders.size === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyStateIcon}>⏳</div>
          <h3 style={styles.emptyStateTitle}>Loading...</h3>
          <p style={styles.emptyStateText}>Fetching your orders and trade history</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyStateIcon}>⚠️</div>
          <h3 style={styles.emptyStateTitle}>Error</h3>
          <p style={styles.emptyStateText}>{error}</p>
        </div>
      </div>
    );
  }

  const openOrdersArray = Array.from(openOrders.values());

  return (
    <div style={styles.container}>
      {/* Status Messages */}
      {cancelStatus === "pending" && (
        <div style={styles.statusMessage}>⏳ Waiting for wallet confirmation...</div>
      )}
      {isCancelling && (
        <div style={styles.statusMessage}>⏳ Processing cancellation...</div>
      )}
      {isCancelled && (
        <div style={styles.successMessage}>✅ Order cancelled successfully!</div>
      )}
      {cancelStatus === "error" && (
        <div style={styles.errorMessage}>
          ❌ Error: {(cancelError as BaseError)?.shortMessage || cancelError?.message}
        </div>
      )}

      {/* Open Orders Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>My Open Orders</h2>

        {openOrdersArray.length === 0 ? (
          <div style={styles.card}>
            <div style={styles.emptyState}>
              <div style={styles.emptyStateIcon}>📋</div>
              <h3 style={styles.emptyStateTitle}>No Active Orders</h3>
              <p style={styles.emptyStateText}>You don't have any open orders at the moment.</p>
            </div>
          </div>
        ) : (
          <div style={styles.card}>
            {/* Header */}
            <div style={styles.tableHeader}>
              <div style={{ ...styles.headerCell, flex: "0 0 80px" }}>Order ID</div>
              <div style={{ ...styles.headerCell, flex: "0 0 120px" }}>Market</div>
              <div style={{ ...styles.headerCell, flex: 1 }}>Price Range</div>
              <div style={{ ...styles.headerCell, flex: "0 0 150px", textAlign: "right" }}>Remaining</div>
              <div style={{ ...styles.headerCell, flex: "0 0 120px", textAlign: "right" }}>Action</div>
            </div>

            {/* Order Rows */}
            <div style={styles.tableBody}>
              {openOrdersArray.map((order) => {
                const symbol0 = tokenInfoMap[order.token0]?.symbol ?? "TKN0";
                const symbol1 = tokenInfoMap[order.token1]?.symbol ?? "TKN1";
                const decimals0 = tokenInfoMap[order.token0]?.decimals ?? 18;
                const priceRange = formatPriceRange(order);
                const isThisOneCancelling =
                  (isCancelling || cancelStatus === "pending") &&
                  cancellingOrderId === order.orderId;

                return (
                  <div key={order.orderId.toString()} style={styles.tableRow}>
                    <div style={{ ...styles.cell, flex: "0 0 80px", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                      #{order.orderId.toString()}
                    </div>
                    <div style={{ ...styles.cell, flex: "0 0 120px" }}>
                      <span style={styles.pairBadge}>{symbol0}/{symbol1}</span>
                    </div>
                    <div style={{ ...styles.cell, flex: 1, color: "#60a5fa" }}>
                      {priceRange}
                    </div>
                    <div style={{ ...styles.cell, flex: "0 0 150px", textAlign: "right" }}>
                      <span style={styles.amountText}>
                        {formatToMaxDecimals(formatUnits(order.remainingAmount0, decimals0), 4)} {symbol0}
                      </span>
                    </div>
                    <div style={{ ...styles.cell, flex: "0 0 120px", textAlign: "right" }}>
                      <button
                        onClick={() => handleCancelOrder(order)}
                        disabled={isThisOneCancelling}
                        style={{
                          ...styles.cancelButton,
                          opacity: isThisOneCancelling ? 0.5 : 1,
                          cursor: isThisOneCancelling ? "not-allowed" : "pointer",
                        }}
                      >
                        {isThisOneCancelling ? "Cancelling..." : "Cancel"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Trade History Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>My Trade History</h2>

        {filledOrders.length === 0 ? (
          <div style={styles.card}>
            <div style={styles.emptyState}>
              <div style={styles.emptyStateIcon}>💱</div>
              <h3 style={styles.emptyStateTitle}>No Trade History</h3>
              <p style={styles.emptyStateText}>You haven't filled any orders as a taker yet.</p>
            </div>
          </div>
        ) : (
          <div style={styles.card}>
            {/* Header */}
            <div style={styles.tableHeader}>
              <div style={{ ...styles.headerCell, flex: "0 0 80px" }}>Order ID</div>
              <div style={{ ...styles.headerCell, flex: "0 0 120px" }}>Market</div>
              <div style={{ ...styles.headerCell, flex: 1, textAlign: "right" }}>Amount Bought</div>
              <div style={{ ...styles.headerCell, flex: 1, textAlign: "right" }}>Amount Spent</div>
            </div>

            {/* Trade Rows */}
            <div style={styles.tableBody}>
              {filledOrders.map((fill) => {
                const symbol0 = tokenInfoMap[fill.token0]?.symbol ?? "TKN0";
                const symbol1 = tokenInfoMap[fill.token1]?.symbol ?? "TKN1";
                const decimals0 = tokenInfoMap[fill.token0]?.decimals ?? 18;
                const decimals1 = tokenInfoMap[fill.token1]?.decimals ?? 18;

                return (
                  <div key={fill.log.logIndex} style={styles.tableRow}>
                    <div style={{ ...styles.cell, flex: "0 0 80px", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                      #{fill.orderId.toString()}
                    </div>
                    <div style={{ ...styles.cell, flex: "0 0 120px" }}>
                      <span style={styles.pairBadge}>{symbol0}/{symbol1}</span>
                    </div>
                    <div style={{ ...styles.cell, flex: 1, textAlign: "right", color: "#10b981" }}>
                      <span style={styles.amountText}>
                        {formatToMaxDecimals(formatUnits(fill.amount0Filled, decimals0), 4)} {symbol0}
                      </span>
                    </div>
                    <div style={{ ...styles.cell, flex: 1, textAlign: "right", color: "#ef4444" }}>
                      <span style={styles.amountText}>
                        {formatToMaxDecimals(formatUnits(fill.amount1Spent, decimals1), 4)} {symbol1}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "2rem",
  } as React.CSSProperties,

  section: {
    marginBottom: "2rem",
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "var(--text-primary)",
    marginBottom: "1rem",
  } as React.CSSProperties,

  card: {
    background: "var(--bg-card)",
    borderRadius: "1rem",
    border: "1px solid var(--border-color)",
    overflow: "hidden",
    boxShadow: "var(--shadow-lg)",
  } as React.CSSProperties,

  tableHeader: {
    display: "flex",
    padding: "1rem 1.5rem",
    background: "var(--bg-tertiary)",
    borderBottom: "1px solid var(--border-color)",
  } as React.CSSProperties,

  headerCell: {
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as React.CSSProperties,

  tableBody: {
    display: "flex",
    flexDirection: "column" as const,
  } as React.CSSProperties,

  tableRow: {
    display: "flex",
    padding: "1rem 1.5rem",
    borderBottom: "1px solid var(--border-color)",
    transition: "background 0.2s ease",
    alignItems: "center",
  } as React.CSSProperties,

  cell: {
    fontSize: "0.9375rem",
    color: "var(--text-primary)",
  } as React.CSSProperties,

  pairBadge: {
    display: "inline-block",
    padding: "0.25rem 0.625rem",
    background: "rgba(59, 130, 246, 0.1)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: "0.375rem",
    color: "#60a5fa",
    fontSize: "0.875rem",
    fontWeight: "600",
  } as React.CSSProperties,

  amountText: {
    fontFamily: "monospace",
    fontWeight: "500",
  } as React.CSSProperties,

  cancelButton: {
    padding: "0.5rem 1rem",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid #ef4444",
    borderRadius: "0.5rem",
    color: "#ef4444",
    fontSize: "0.875rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
  } as React.CSSProperties,

  emptyState: {
    padding: "3rem 2rem",
    textAlign: "center" as const,
  } as React.CSSProperties,

  emptyStateIcon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  } as React.CSSProperties,

  emptyStateTitle: {
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    marginBottom: "0.5rem",
  } as React.CSSProperties,

  emptyStateText: {
    fontSize: "0.9375rem",
    color: "var(--text-muted)",
    margin: 0,
  } as React.CSSProperties,

  statusMessage: {
    padding: "1rem 1.5rem",
    background: "rgba(59, 130, 246, 0.1)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: "0.75rem",
    color: "#60a5fa",
    fontSize: "0.9375rem",
    marginBottom: "1.5rem",
  } as React.CSSProperties,

  successMessage: {
    padding: "1rem 1.5rem",
    background: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    borderRadius: "0.75rem",
    color: "#10b981",
    fontSize: "0.9375rem",
    marginBottom: "1.5rem",
  } as React.CSSProperties,

  errorMessage: {
    padding: "1rem 1.5rem",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "0.75rem",
    color: "#ef4444",
    fontSize: "0.9375rem",
    marginBottom: "1.5rem",
  } as React.CSSProperties,
};
