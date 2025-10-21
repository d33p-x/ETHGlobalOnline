// frontend/src/app/OrderList.tsx
"use client";

// 1. Import useState
import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { foundry } from "wagmi/chains"; // Your chain config
import { type Address, type Log, formatUnits } from "viem";

// --- Config ---
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Ensure this is correct!

// ABI including ONLY the order-related events
const p2pOrderEventsAbi = [
  // ... (ABI remains the same)
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

// 2. Remove all props
export function OrderList() {
  // 3. Add internal state for marketId, orders, loading, and error
  const [marketId, setMarketId] = useState("");
  const [orders, setOrders] = useState<OrderMap>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 4. Hardcode decimals for now, since props were removed
  const decimals0 = 18;

  const client = usePublicClient({ chainId: foundry.id }); // Assuming Anvil

  // --- Fetch historical events for the selected market ---
  useEffect(() => {
    // 5. Check for marketId from state
    if (!client || !marketId) {
      setOrders(new Map()); // Clear orders if no market selected
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

        // ... (rest of your log fetching and processing logic remains the same)
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
          if (log.args.orderId && log.args.maker) {
            initialOrders.set(log.args.orderId, {
              orderId: log.args.orderId,
              maker: log.args.maker,
              token0: log.args.token0!,
              token1: log.args.token1!,
              initialAmount0: log.args.amount0!,
              remainingAmount0: log.args.amount0!, // Start with full amount
              maxPrice: log.args.maxPrice!,
              minPrice: log.args.minPrice!,
            });
          }
        }

        // Process reductions/cancellations
        for (const log of reducedLogs) {
          const orderId = log.args.orderId;
          const amountClosed = log.args.amount0Closed;
          if (orderId && amountClosed && initialOrders.has(orderId)) {
            const order = initialOrders.get(orderId)!;
            if (order.remainingAmount0 >= amountClosed) {
              order.remainingAmount0 -= amountClosed;
            } else {
              console.warn(
                `Order ${orderId}: amountClosed ${amountClosed} > remaining ${order.remainingAmount0}`
              );
              order.remainingAmount0 = 0n; // Set to zero if discrepancy
            }
            // If remaining is zero after reduction, remove it (or mark as cancelled)
            if (order.remainingAmount0 === 0n) {
              initialOrders.delete(orderId);
            }
          }
        }

        // Process fills
        for (const log of filledLogs) {
          const orderId = log.args.orderId;
          const amountFilled = log.args.amount0Filled;
          if (orderId && amountFilled && initialOrders.has(orderId)) {
            const order = initialOrders.get(orderId)!;
            if (order.remainingAmount0 >= amountFilled) {
              order.remainingAmount0 -= amountFilled;
            } else {
              console.warn(
                `Order ${orderId}: amountFilled ${amountFilled} > remaining ${order.remainingAmount0}`
              );
              order.remainingAmount0 = 0n; // Set to zero if discrepancy
            }
            // If remaining is zero after fill, remove it
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
    // Refetch when the marketId (from state) changes
  }, [client, marketId]);

  // --- TODO: Add useWatchContractEvent hooks here ---
  // ...

  const orderArray = Array.from(orders.values());

  return (
    <div>
      {/* 6. Add the input field here */}
      <h3>View Orders for Market</h3>
      <label>
        Enter Market ID:
        <input
          type="text"
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
          placeholder="0x..."
          style={{ width: "400px" }}
        />
      </label>

      {/* 7. Update conditional rendering logic */}
      {!marketId ? (
        <p>Enter a Market ID above to view orders.</p>
      ) : isLoading ? (
        <div>Loading orders for market {marketId.substring(0, 10)}...</div>
      ) : error ? (
        <div style={{ color: "red" }}>Error loading orders: {error}</div>
      ) : orderArray.length === 0 ? (
        <p>No active orders found for this market.</p>
      ) : (
        <>
          <h4>Orders for Market {marketId.substring(0, 10)}...</h4>
          <table border={1} style={{ fontSize: "12px", width: "100%" }}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Maker</th>
                {/* 8. Use hardcoded decimals */}
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
                  {/* 8. Use hardcoded decimals */}
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
