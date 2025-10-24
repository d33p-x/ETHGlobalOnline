// frontend/src/app/OrderList.tsx
"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { foundry } from "wagmi/chains"; // Your chain config
import { type Address, type Log, formatUnits } from "viem";

// --- Config ---
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Ensure this is correct!

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
};

// Map to store orders, keyed by orderId
type OrderMap = Map<bigint, Order>;

export function OrderList({ marketId }: { marketId: string }) {
  const [orders, setOrders] = useState<OrderMap>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decimals0 = 18;

  const client = usePublicClient({ chainId: foundry.id });

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
        // 1. Fetch OrderCreated events
        const createdLogs = await client.getLogs({
          address: p2pContractAddress,
          event: p2pOrderEventsAbi[0], // OrderCreated
          args: {
            marketId: marketId as `0x${string}`, // Filter by marketId
          },
          fromBlock: 0n,
          toBlock: "latest",
        });
        console.log(`Found ${createdLogs.length} OrderCreated logs`);

        // 2. Fetch OrderReducedOrCancelled events
        const reducedLogs = await client.getLogs({
          address: p2pContractAddress,
          event: p2pOrderEventsAbi[1], // OrderReducedOrCancelled
          args: {
            marketId: marketId as `0x${string}`, // Filter by marketId
          },
          fromBlock: 0n,
          toBlock: "latest",
        });
        console.log(`Found ${reducedLogs.length} OrderReducedOrCancelled logs`);

        // 3. Fetch OrderFilled events
        const filledLogs = await client.getLogs({
          address: p2pContractAddress,
          event: p2pOrderEventsAbi[2], // OrderFilled
          args: {
            marketId: marketId as `0x${string}`, // Filter by marketId
          },
          fromBlock: 0n,
          toBlock: "latest",
        });
        console.log(`Found ${filledLogs.length} OrderFilled logs`);

        // --- Process logs to build current order state ---
        const initialOrders: OrderMap = new Map();

        // Process creations first
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
            initialOrders.set(orderId, {
              orderId: orderId,
              maker: maker,
              token0: token0,
              token1: token1,
              initialAmount0: amount0,
              remainingAmount0: amount0, // Start with full amount
              maxPrice: maxPrice,
              minPrice: minPrice,
            });
          }
        }

        // Process reductions/cancellations
        for (const log of reducedLogs) {
          const orderId = log.args.orderId;
          const amountClosed = log.args.amount0Closed;
          if (
            orderId !== undefined &&
            amountClosed !== undefined &&
            initialOrders.has(orderId)
          ) {
            const order = initialOrders.get(orderId)!;
            if (order.remainingAmount0 >= amountClosed) {
              order.remainingAmount0 -= amountClosed;
            } else {
              console.warn(
                `Order ${orderId}: amountClosed ${amountClosed} > remaining ${order.remainingAmount0}`
              );
              order.remainingAmount0 = 0n; // Set to zero if discrepancy
            }
            if (order.remainingAmount0 === 0n) {
              initialOrders.delete(orderId);
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
    address: p2pContractAddress,
    abi: p2pOrderEventsAbi,
    eventName: "OrderCreated",
    args: {
      marketId: marketId as `0x${string}`,
    },
    enabled: !!marketId, // Only watch if marketId is set
    onLogs(logs) {
      console.log("New OrderCreated event(s) detected:", logs);
      setOrders((prevOrders) => {
        // Use a new Map based on previous state for immutability
        const newOrders = new Map(prevOrders);
        for (const log of logs) {
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
            // Add the new order to the map
            newOrders.set(orderId, {
              orderId,
              maker,
              token0,
              token1,
              initialAmount0: amount0,
              remainingAmount0: amount0, // New order starts with full amount
              maxPrice,
              minPrice,
            });
          }
        }
        return newOrders; // Return the new state
      });
    },
  });

  /**
   * Watch for new OrderReducedOrCancelled events
   */
  useWatchContractEvent({
    address: p2pContractAddress,
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
    address: p2pContractAddress,
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

  return (
    <div>
      <h3>Order Book</h3>

      {!marketId ? (
        <p>Market ID not found.</p>
      ) : isLoading ? (
        <div>Loading orders for market {marketId.substring(0, 10)}...</div>
      ) : error ? (
        <div className="error-message">Error loading orders: {error}</div>
      ) : orderArray.length === 0 ? (
        <p>No active orders found for this market.</p>
      ) : (
        <>
          <h4>Orders for Market {marketId.substring(0, 10)}... (Live)</h4>
          <table border={1} className="order-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Maker</th>
                <th>Remaining Amount</th>
                <th>Min Price (USD)</th>
                <th>Max Price (USD)</th>
              </tr>
            </thead>
            <tbody>
              {orderArray.map((order) => (
                <tr key={order.orderId.toString()}>
                  <td>{order.orderId.toString()}</td>
                  <td>{order.maker.substring(0, 10)}...</td>
                  <td>{formatUnits(order.remainingAmount0, decimals0)}</td>
                  <td>
                    {order.minPrice > 0n
                      ? formatUnits(order.minPrice, 18)
                      : "N/A"}
                  </td>
                  <td>
                    {order.maxPrice > 0n
                      ? formatUnits(order.maxPrice, 18)
                      : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
