// src/app/MyMarketOrders.tsx
"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { type Address, formatUnits, BaseError } from "viem";
import { useTokenRegistryContext } from "./TokenRegistryContext";
import { getP2PAddress, getDeploymentBlock } from "./config";

// --- Config ---

// 2. Add 'cancelOrReduceOrder' ABI
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

// 3. Add all 3 event ABIs (OrderCreated, OrderReducedOrCancelled, OrderFilled)
const p2pOrderEventsAbi = [
  {
    type: "event",
    name: "OrderCreated",
    // ... (ABI as before)
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
    // ... (ABI as before)
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
    // ... (ABI as before)
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

// ... (Order and Fill types as before) ...
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

export function MyMarketOrders({ marketId }: { marketId: string }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { tokenInfoMap } = useTokenRegistryContext();
  const client = usePublicClient({ chainId: chainId });

  const [openOrders, setOpenOrders] = useState<OrderMap>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 4. State for managing which order is being cancelled
  const [cancellingOrderId, setCancellingOrderId] = useState<bigint | null>(
    null
  );

  // 5. Add wagmi hooks for cancelling
  const {
    data: cancelHash,
    status: cancelStatus,
    error: cancelError,
    writeContract: cancelWriteContract,
  } = useWriteContract();

  const { isLoading: isCancelling, isSuccess: isCancelled } =
    useWaitForTransactionReceipt({ hash: cancelHash });

  // 6. Refetch orders when a cancel is successful
  useEffect(() => {
    if (isCancelled) {
      setCancellingOrderId(null); // Reset loading state
      // Refetch logic (simple way is to just re-run the main fetch)
      if (client && address) {
        fetchMyLogs(client, address);
      }
    }
  }, [isCancelled, client, address]);

  // 7. Extracted fetch logic into its own function
  const fetchMyLogs = async (client: any, address: Address) => {
    setIsLoading(true);
    setError(null);
    try {
      // Get current block and deployment block from config
      const latestBlock = await client.getBlockNumber();
      const fromBlock = getDeploymentBlock(chainId);

      // 1. Fetch all orders CREATED by user for this market
      const createdLogs = await client.getLogs({
        address: getP2PAddress(chainId),
        event: p2pOrderEventsAbi[0], // OrderCreated
        args: {
          marketId: marketId as `0x${string}`,
          maker: address, // <-- Filter by connected user!
        },
        fromBlock,
        toBlock: latestBlock,
      });

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
        args: {
          marketId: marketId as `0x${string}`,
        },
        fromBlock,
        toBlock: latestBlock,
      });

      const filledLogs = await client.getLogs({
        address: getP2PAddress(chainId),
        event: p2pOrderEventsAbi[2], // OrderFilled
        args: {
          marketId: marketId as `0x${string}`,
        },
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

  // 8. Main useEffect now just calls the fetch function
  useEffect(() => {
    if (client && address && marketId) {
      fetchMyLogs(client, address);

      // Also refresh every 10 seconds to catch fills by others
      const interval = setInterval(() => {
        fetchMyLogs(client, address);
      }, 10000);

      return () => clearInterval(interval);
    } else {
      setOpenOrders(new Map());
    }
  }, [client, address, chainId, marketId]);

  // 9. Handle function for the cancel button
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

  const openOrdersArray = Array.from(openOrders.values());

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
      {!isConnected ? (
        <p style={{ fontSize: "0.875rem", padding: "1rem", color: "var(--text-muted)" }}>
          Connect wallet to view your orders
        </p>
      ) : !marketId ? (
        <p style={{ fontSize: "0.875rem", padding: "1rem" }}>Market ID not found.</p>
      ) : isLoading && openOrdersArray.length === 0 ? (
        <div style={{ fontSize: "0.875rem", padding: "1rem" }}>Loading orders...</div>
      ) : error ? (
        <div className="error-message">Error: {error}</div>
      ) : openOrdersArray.length === 0 ? (
        <p style={{ fontSize: "0.875rem", padding: "1rem", color: "var(--text-muted)" }}>
          No active orders
        </p>
      ) : (
        <>
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.6fr 1.2fr 1fr 0.8fr",
              padding: "0.5rem 0.5rem 0.375rem",
              fontSize: "0.6875rem",
              fontWeight: "600",
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border-color)",
              textTransform: "uppercase",
            }}
          >
            <div style={{ textAlign: "left" }}>ID</div>
            <div style={{ textAlign: "left" }}>Price</div>
            <div style={{ textAlign: "right" }}>Size</div>
            <div style={{ textAlign: "right" }}>Action</div>
          </div>

          <div style={{ overflow: "auto", flex: 1 }}>
            {openOrdersArray.map((order) => {
              const decimals0 = tokenInfoMap[order.token0]?.decimals ?? 18;
              const size = formatUnits(order.remainingAmount0, decimals0);
              const priceDisplay = formatPriceRange(order);
              const isThisOneCancelling =
                (isCancelling || cancelStatus === "pending") &&
                cancellingOrderId === order.orderId;

              return (
                <div
                  key={order.orderId.toString()}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "0.6fr 1.2fr 1fr 0.8fr",
                    padding: "0.375rem 0.5rem",
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ textAlign: "left", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    #{order.orderId.toString()}
                  </div>
                  <div style={{ textAlign: "left" }}>{priceDisplay}</div>
                  <div style={{ textAlign: "right" }}>
                    {formatToMaxDecimals(size, 4)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <button
                      onClick={() => handleCancelOrder(order)}
                      disabled={isThisOneCancelling}
                      style={{
                        background: "rgba(239, 68, 68, 0.2)",
                        border: "1px solid #ef4444",
                        borderRadius: "0.25rem",
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.6875rem",
                        color: "#ef4444",
                        cursor: isThisOneCancelling ? "not-allowed" : "pointer",
                        transition: "all 0.15s",
                        opacity: isThisOneCancelling ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isThisOneCancelling) {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                      }}
                    >
                      {isThisOneCancelling ? "Cancelling..." : "Cancel"}
                    </button>
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
