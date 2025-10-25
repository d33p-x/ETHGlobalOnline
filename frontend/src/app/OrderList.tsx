// frontend/src/app/OrderList.tsx
"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent, useChainId } from "wagmi";
import { type Address, formatUnits } from "viem";
import { getP2PAddress, getDeploymentBlock } from "./config";

// --- Config ---
// Ensure this is correct!

// ABI including ONLY the order-related events
const p2pOrderEventsAbi = [
  {
    type: "event",
    name: "OrderCreated",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true }, // Indexed
      { name: "maker", type: "address", indexed: true }, // Indexed
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
      { name: "marketId", type: "bytes32", indexed: true }, // Indexed
      { name: "maker", type: "address", indexed: false }, // Not indexed here based on last discussion
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
      { name: "orderId", type: "uint256", indexed: true }, // Indexed
      { name: "amount0Closed", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OrderFilled",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true }, // Indexed
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
      { name: "orderId", type: "uint256", indexed: true }, // Indexed
      { name: "amount0Filled", type: "uint256", indexed: false },
      { name: "amount1Spent", type: "uint256", indexed: false },
      { name: "taker", type: "address", indexed: true }, // Indexed
    ],
    anonymous: false,
  },
] as const;

// Define a type for your order structure
type Order = {
  orderId: bigint; // Use bigint for uint256
  maker: Address;
  token0: Address;
  token1: Address;
  initialAmount0: bigint;
  remainingAmount0: bigint; // Track remaining amount after fills/reductions
  maxPrice: bigint;
  minPrice: bigint;
  decimals0?: number; // Store token0 decimals
  decimals1?: number; // Store token1 decimals
};

// Map to store orders, keyed by orderId
type OrderMap = Map<bigint, Order>;

// Helper function to format numbers to max 4 decimals
function formatToMaxDecimals(value: string, maxDecimals: number = 4): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  // Convert to fixed decimal, then remove trailing zeros
  const fixed = num.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}

export function OrderList({ marketId }: { marketId: string }) {
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);

  const [orders, setOrders] = useState<OrderMap>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decimalsCache, setDecimalsCache] = useState<Map<Address, number>>(
    new Map()
  );

  const client = usePublicClient({ chainId });

  // Helper function to get token decimals
  const getTokenDecimals = async (tokenAddress: Address): Promise<number> => {
    // Check cache first
    if (decimalsCache.has(tokenAddress)) {
      return decimalsCache.get(tokenAddress)!;
    }

    try {
      const decimals = (await client.readContract({
        address: tokenAddress,
        abi: [
          {
            name: "decimals",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "uint8" }],
          },
        ],
        functionName: "decimals",
      })) as number;

      // Update cache
      setDecimalsCache((prev) => new Map(prev).set(tokenAddress, decimals));
      return decimals;
    } catch (err) {
      console.warn(`Failed to get decimals for ${tokenAddress}, using 18`);
      return 18; // Default fallback
    }
  };

  // --- Fetch historical events for the selected market ---
  useEffect(() => {
    if (!client || !marketId) {
      setOrders(new Map());
      setIsLoading(false);
      return;
    }

    const fetchOrderLogs = async () => {
      setIsLoading(true);
      setError(null);
      console.log(`Fetching order logs for marketId: ${marketId}`);
      try {
        // Get current block number
        const latestBlock = await client.getBlockNumber();
        console.log(`Latest block: ${latestBlock}`);

        // Get deployment block from config
        const fromBlock = getDeploymentBlock(chainId);

        console.log(`Fetching logs from block ${fromBlock} to ${latestBlock}`);

        // 1. Fetch OrderCreated events
        const createdLogs = await client.getLogs({
          address: p2pAddress,
          event: p2pOrderEventsAbi[0], // OrderCreated
          args: {
            marketId: marketId as `0x${string}`, // Filter by marketId
          },
          fromBlock,
          toBlock: latestBlock,
        });
        console.log(`Found ${createdLogs.length} OrderCreated logs`);

        // 2. Fetch OrderReducedOrCancelled events
        const reducedLogs = await client.getLogs({
          address: p2pAddress,
          event: p2pOrderEventsAbi[1], // OrderReducedOrCancelled
          args: {
            marketId: marketId as `0x${string}`, // Filter by marketId
          },
          fromBlock,
          toBlock: latestBlock,
        });
        console.log(`Found ${reducedLogs.length} OrderReducedOrCancelled logs`);

        // 3. Fetch OrderFilled events
        const filledLogs = await client.getLogs({
          address: p2pAddress,
          event: p2pOrderEventsAbi[2], // OrderFilled
          args: {
            marketId: marketId as `0x${string}`, // Filter by marketId
          },
          fromBlock,
          toBlock: latestBlock,
        });
        console.log(`Found ${filledLogs.length} OrderFilled logs`);

        // --- Process logs to build current order state ---
        const initialOrders: OrderMap = new Map();

        // First, collect all unique token addresses
        const uniqueTokens = new Set<Address>();
        for (const log of createdLogs) {
          if (log.args.token0) uniqueTokens.add(log.args.token0);
          if (log.args.token1) uniqueTokens.add(log.args.token1);
        }

        // Fetch decimals for all unique tokens in parallel
        await Promise.all(
          Array.from(uniqueTokens).map((token) => getTokenDecimals(token))
        );

        // Now process creations with cached decimals
        for (const log of createdLogs) {
          const {
            orderId,
            maker,
            token0,
            token1,
            amount0,
            maxPrice,
            minPrice,
          } = log.args;
          if (
            orderId !== undefined &&
            maker &&
            token0 &&
            token1 &&
            amount0 !== undefined &&
            maxPrice !== undefined &&
            minPrice !== undefined
          ) {
            // Get decimals from cache (already fetched above)
            const decimals0 = await getTokenDecimals(token0);
            const decimals1 = await getTokenDecimals(token1);

            initialOrders.set(orderId, {
              orderId: orderId,
              maker: maker,
              token0: token0,
              token1: token1,
              initialAmount0: amount0,
              remainingAmount0: amount0, // Start with full amount
              maxPrice: maxPrice,
              minPrice: minPrice,
              decimals0,
              decimals1,
            });
          }
        }

        // Process reductions/cancellations
        console.log(`OrderList: Processing ${reducedLogs.length} reduction/cancellation logs for market ${marketId}`);
        for (const log of reducedLogs) {
          const orderId = log.args.orderId;
          const amountClosed = log.args.amount0Closed;
          if (
            orderId !== undefined &&
            amountClosed !== undefined &&
            initialOrders.has(orderId)
          ) {
            const order = initialOrders.get(orderId)!;
            console.log(`OrderList: Reducing order ${orderId}: ${order.remainingAmount0} - ${amountClosed}`);
            if (order.remainingAmount0 >= amountClosed) {
              order.remainingAmount0 -= amountClosed;
            } else {
              console.warn(
                `Order ${orderId}: amountClosed ${amountClosed} > remaining ${order.remainingAmount0}`
              );
              order.remainingAmount0 = 0n; // Set to zero if discrepancy
            }
            if (order.remainingAmount0 === 0n) {
              console.log(`OrderList: Deleting order ${orderId} (fully cancelled/reduced)`);
              initialOrders.delete(orderId);
            } else {
              console.log(`OrderList: Order ${orderId} now has ${order.remainingAmount0} remaining`);
            }
          }
        }

        // Process fills
        for (const log of filledLogs) {
          const orderId = log.args.orderId;
          const amountFilled = log.args.amount0Filled;
          if (
            orderId !== undefined &&
            amountFilled !== undefined &&
            initialOrders.has(orderId)
          ) {
            const order = initialOrders.get(orderId)!;
            if (order.remainingAmount0 >= amountFilled) {
              order.remainingAmount0 -= amountFilled;
            } else {
              console.warn(
                `Order ${orderId}: amountFilled ${amountFilled} > remaining ${order.remainingAmount0}`
              );
              order.remainingAmount0 = 0n; // Set to zero if discrepancy
            }
            if (order.remainingAmount0 === 0n) {
              initialOrders.delete(orderId);
            }
          }
        }

        setOrders(initialOrders);
        console.log("Processed orders:", initialOrders);
      } catch (err: any) {
        console.error("Error fetching order logs:", err);
        setError(`Failed to fetch orders: ${err.shortMessage || err.message}`);
        setOrders(new Map()); // Clear orders on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderLogs();
  }, [client, marketId]);

  // --- START: Add useWatchContractEvent hooks here ---

  /**
   * Watch for new OrderCreated events
   */
  useWatchContractEvent({
    address: p2pAddress,
    abi: p2pOrderEventsAbi,
    eventName: "OrderCreated",
    args: {
      marketId: marketId as `0x${string}`,
    },
    enabled: !!marketId, // Only watch if marketId is set
    async onLogs(logs) {
      console.log("New OrderCreated event(s) detected:", logs);

      // Fetch decimals for new orders
      const ordersWithDecimals = await Promise.all(
        logs.map(async (log) => {
          const {
            orderId,
            maker,
            token0,
            token1,
            amount0,
            maxPrice,
            minPrice,
          } = log.args;

          if (
            orderId !== undefined &&
            maker &&
            token0 &&
            token1 &&
            amount0 !== undefined &&
            maxPrice !== undefined &&
            minPrice !== undefined
          ) {
            const decimals0 = await getTokenDecimals(token0);
            const decimals1 = await getTokenDecimals(token1);

            return {
              orderId,
              maker,
              token0,
              token1,
              initialAmount0: amount0,
              remainingAmount0: amount0,
              maxPrice,
              minPrice,
              decimals0,
              decimals1,
            };
          }
          return null;
        })
      );

      setOrders((prevOrders) => {
        const newOrders = new Map(prevOrders);
        for (const order of ordersWithDecimals) {
          if (order) {
            newOrders.set(order.orderId, order);
          }
        }
        return newOrders;
      });
    },
  });

  /**
   * Watch for new OrderReducedOrCancelled events
   */
  useWatchContractEvent({
    address: p2pAddress,
    abi: p2pOrderEventsAbi,
    eventName: "OrderReducedOrCancelled",
    args: {
      marketId: marketId as `0x${string}`,
    },
    enabled: !!marketId,
    onLogs(logs) {
      console.log("New OrderReducedOrCancelled event(s) detected:", logs);
      setOrders((prevOrders) => {
        const newOrders = new Map(prevOrders);
        for (const log of logs) {
          const { orderId, amount0Closed } = log.args;

          if (
            orderId !== undefined &&
            amount0Closed !== undefined &&
            newOrders.has(orderId)
          ) {
            const existingOrder = newOrders.get(orderId)!;
            // Create a *new* order object to ensure state immutability
            const updatedOrder = { ...existingOrder };

            if (updatedOrder.remainingAmount0 >= amount0Closed) {
              updatedOrder.remainingAmount0 -= amount0Closed;
            } else {
              console.warn(
                `Live Order ${orderId}: amountClosed ${amount0Closed} > remaining ${updatedOrder.remainingAmount0}`
              );
              updatedOrder.remainingAmount0 = 0n;
            }

            // If remaining amount is 0, remove the order from the list
            if (updatedOrder.remainingAmount0 === 0n) {
              newOrders.delete(orderId);
            } else {
              // Otherwise, update the map with the modified order
              newOrders.set(orderId, updatedOrder);
            }
          }
        }
        return newOrders;
      });
    },
  });

  /**
   * Watch for new OrderFilled events
   */
  useWatchContractEvent({
    address: p2pAddress,
    abi: p2pOrderEventsAbi,
    eventName: "OrderFilled",
    args: {
      marketId: marketId as `0x${string}`,
    },
    enabled: !!marketId,
    onLogs(logs) {
      console.log("New OrderFilled event(s) detected:", logs);
      setOrders((prevOrders) => {
        const newOrders = new Map(prevOrders);
        for (const log of logs) {
          const { orderId, amount0Filled } = log.args;

          if (
            orderId !== undefined &&
            amount0Filled !== undefined &&
            newOrders.has(orderId)
          ) {
            const existingOrder = newOrders.get(orderId)!;
            // Create a *new* order object
            const updatedOrder = { ...existingOrder };

            if (updatedOrder.remainingAmount0 >= amount0Filled) {
              updatedOrder.remainingAmount0 -= amount0Filled;
            } else {
              console.warn(
                // 1. --- THIS WAS THE FIX ---
                // Changed 'amountFilled' to 'amount0Filled' to match the destructured variable
                `Live Order ${orderId}: amountFilled ${amount0Filled} > remaining ${updatedOrder.remainingAmount0}`
              );
              updatedOrder.remainingAmount0 = 0n;
            }

            // If remaining amount is 0, remove the order
            if (updatedOrder.remainingAmount0 === 0n) {
              newOrders.delete(orderId);
            } else {
              // Otherwise, update it
              newOrders.set(orderId, updatedOrder);
            }
          }
        }
        return newOrders;
      });
    },
  });

  // --- END: Add useWatchContractEvent hooks here ---

  const orderArray = Array.from(orders.values());

  // Helper function to get Basescan URL
  const getBasescanUrl = (address: string): string => {
    return `https://sepolia.basescan.org/address/${address}`;
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
        Order Book
      </h3>

      {!marketId ? (
        <p style={{ fontSize: "0.875rem" }}>Market ID not found.</p>
      ) : isLoading ? (
        <div style={{ fontSize: "0.875rem" }}>Loading orders...</div>
      ) : error ? (
        <div className="error-message">Error: {error}</div>
      ) : orderArray.length === 0 ? (
        <p style={{ fontSize: "0.875rem" }}>No active orders.</p>
      ) : (
        <div style={{ overflow: "auto", flex: 1 }}>
          <table className="order-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Maker</th>
                <th>Amount</th>
                <th>Min</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              {orderArray.map((order) => (
                <tr key={order.orderId.toString()}>
                  <td>{order.orderId.toString()}</td>
                  <td>
                    <a
                      href={getBasescanUrl(order.maker)}
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
                      {order.maker.substring(0, 8)}...
                    </a>
                  </td>
                  <td>
                    {formatToMaxDecimals(
                      formatUnits(order.remainingAmount0, order.decimals0 ?? 18)
                    )}
                  </td>
                  <td>
                    {order.minPrice > 0n
                      ? formatToMaxDecimals(formatUnits(order.minPrice, 18))
                      : "N/A"}
                  </td>
                  <td>
                    {order.maxPrice > 0n
                      ? formatToMaxDecimals(formatUnits(order.maxPrice, 18))
                      : "N/A"}
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
