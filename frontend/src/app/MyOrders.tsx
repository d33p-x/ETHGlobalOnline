// src/app/MyOrders.tsx
"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract, // 1. Import write hooks
  useWaitForTransactionReceipt,
} from "wagmi";
import { foundry } from "wagmi/chains";
import { type Address, type Log, formatUnits, BaseError } from "viem";
import { tokenInfoMap } from "./tokenConfig";

// --- Config ---
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

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
  const client = usePublicClient({ chainId: foundry.id });

  const [openOrders, setOpenOrders] = useState<OrderMap>(new Map());
  const [filledOrders, setFilledOrders] = useState<Fill[]>([]);
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
      // 1. Fetch all orders CREATED by user
      const createdLogs = await client.getLogs({
        address: p2pContractAddress,
        event: p2pOrderEventsAbi[0], // OrderCreated
        args: {
          maker: address, // <-- Filter by connected user!
        },
        fromBlock: 0n,
        toBlock: "latest",
      });

      // 2. Fetch all orders FILLED by user (as taker)
      const filledLogsAsTaker = await client.getLogs({
        address: p2pContractAddress,
        event: p2pOrderEventsAbi[2], // OrderFilled
        args: {
          taker: address, // <-- Filter by connected user!
        },
        fromBlock: 0n,
        toBlock: "latest",
      });

      // ... (rest of the log processing logic is the same) ...
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
      const myOrderIds = new Set<bigint>();

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
        myOrderIds.add(orderId);
      }

      const reducedLogs = await client.getLogs({
        address: p2pContractAddress,
        event: p2pOrderEventsAbi[1], // OrderReducedOrCancelled
        fromBlock: 0n,
        toBlock: "latest",
      });

      const filledLogs = await client.getLogs({
        address: p2pContractAddress,
        event: p2pOrderEventsAbi[2], // OrderFilled
        fromBlock: 0n,
        toBlock: "latest",
      });

      for (const log of reducedLogs) {
        const orderId = log.args.orderId;
        if (orderId !== undefined && myOpenOrders.has(orderId)) {
          const order = myOpenOrders.get(orderId)!;
          order.remainingAmount0 -= log.args.amount0Closed!;
        }
      }

      for (const log of filledLogs) {
        const orderId = log.args.orderId;
        if (orderId !== undefined && myOpenOrders.has(orderId)) {
          const order = myOpenOrders.get(orderId)!;
          order.remainingAmount0 -= log.args.amount0Filled!;
        }
      }

      myOpenOrders.forEach((order) => {
        if (order.remainingAmount0 <= 0n) {
          myOpenOrders.delete(order.orderId);
        }
      });

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
    if (client && address) {
      fetchMyLogs(client, address);
    } else {
      setOpenOrders(new Map());
      setFilledOrders([]);
    }
  }, [client, address]);

  // 9. Handle function for the cancel button
  const handleCancelOrder = (order: Order) => {
    setCancellingOrderId(order.orderId); // Set loading state for this row

    cancelWriteContract({
      address: p2pContractAddress,
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

  if (!isConnected) {
    return <div>Please connect your wallet to see your orders.</div>;
  }

  // ... (Loading and Error states as before) ...
  if (isLoading && openOrders.size === 0) {
    return <div>Loading your orders...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }

  const openOrdersArray = Array.from(openOrders.values());

  return (
    <div>
      <h2>My Open Orders</h2>
      {cancelStatus === "pending" && <p>Waiting for wallet confirmation...</p>}
      {isCancelling && <p>Processing cancellation...</p>}
      {isCancelled && (
        <p style={{ color: "green" }}>Order cancelled successfully!</p>
      )}
      {cancelStatus === "error" && (
        <p style={{ color: "red" }}>
          Error:{" "}
          {(cancelError as BaseError)?.shortMessage || cancelError?.message}
        </p>
      )}

      {openOrdersArray.length === 0 ? (
        <p>You have no active orders.</p>
      ) : (
        <table border={1} style={{ fontSize: "12px", width: "100%" }}>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Pair</th>
              <th>Remaining Amount</th>
              <th>Min Price (USD)</th>
              <th>Max Price (USD)</th>
              <th>Action</th> {/* 10. Add Action column */}
            </tr>
          </thead>
          <tbody>
            {openOrdersArray.map((order) => {
              const symbol0 = tokenInfoMap[order.token0]?.symbol ?? "TKN0";
              const symbol1 = tokenInfoMap[order.token1]?.symbol ?? "TKN1";
              const decimals0 = tokenInfoMap[order.token0]?.decimals ?? 18;
              const isThisOneCancelling =
                (isCancelling || cancelStatus === "pending") &&
                cancellingOrderId === order.orderId;

              return (
                <tr key={order.orderId.toString()}>
                  <td>{order.orderId.toString()}</td>
                  <td>
                    {symbol0}/{symbol1}
                  </td>
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
                  {/* 11. Add Cancel button */}
                  <td>
                    <button
                      onClick={() => handleCancelOrder(order)}
                      disabled={isThisOneCancelling}
                    >
                      {isThisOneCancelling ? "Cancelling..." : "Cancel"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <hr style={{ margin: "20px 0" }} />

      <h2>My Trade History (as Taker)</h2>
      {/* ... (rest of the component is the same) ... */}
      {filledOrders.length === 0 ? (
        <p>You have not filled any orders as a taker.</p>
      ) : (
        <table border={1} style={{ fontSize: "12px", width: "100%" }}>
          <thead>
            <tr>
              <th>Order ID Filled</th>
              <th>Pair</th>
              <th>Amount Bought</th>
              <th>Amount Spent</th>
            </tr>
          </thead>
          <tbody>
            {filledOrders.map((fill) => {
              const symbol0 = tokenInfoMap[fill.token0]?.symbol ?? "TKN0";
              const symbol1 = tokenInfoMap[fill.token1]?.symbol ?? "TKN1";
              const decimals0 = tokenInfoMap[fill.token0]?.decimals ?? 18;
              const decimals1 = tokenInfoMap[fill.token1]?.decimals ?? 18;
              return (
                <tr key={fill.log.logIndex}>
                  <td>{fill.orderId.toString()}</td>
                  <td>
                    {symbol0}/{symbol1}
                  </td>
                  <td>
                    {formatUnits(fill.amount0Filled, decimals0)} {symbol0}
                  </td>
                  <td>
                    {formatUnits(fill.amount1Spent, decimals1)} {symbol1}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
