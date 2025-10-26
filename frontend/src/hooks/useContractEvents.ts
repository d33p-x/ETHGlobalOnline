// Shared hook for fetching and processing contract events

import { useState, useEffect } from "react";
import { usePublicClient, useChainId, useWatchContractEvent } from "wagmi";
import { type Address } from "viem";
import { p2pAbi } from "@/lib/contracts/abis";
import { getP2PAddress, getDeploymentBlock } from "@/app/config";

export type Order = {
  orderId: bigint;
  maker: Address;
  token0: Address;
  token1: Address;
  initialAmount0: bigint;
  remainingAmount0: bigint;
  maxPrice: bigint;
  minPrice: bigint;
  decimals0?: number;
  decimals1?: number;
};

interface UseMarketOrdersProps {
  marketId: string | undefined;
  enabled?: boolean;
}

export function useMarketOrders({ marketId, enabled = true }: UseMarketOrdersProps) {
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);
  const client = usePublicClient({ chainId });

  const [orders, setOrders] = useState<Map<bigint, Order>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track when historical fetch is complete and the sync point block number
  const [historicalSyncComplete, setHistoricalSyncComplete] = useState(false);
  const [syncBlockNumber, setSyncBlockNumber] = useState<bigint>(0n);

  // Track processed events to prevent duplicates (using txHash-logIndex as key)
  const [processedEvents, setProcessedEvents] = useState<Set<string>>(new Set());

  // Fetch historical events
  useEffect(() => {
    if (!client || !p2pAddress || !marketId || !enabled) {
      setOrders(new Map());
      setIsLoading(false);
      setHistoricalSyncComplete(false);
      return;
    }

    const fetchOrderLogs = async () => {
      setIsLoading(true);
      setError(null);
      setHistoricalSyncComplete(false);

      try {
        const latestBlock = await client.getBlockNumber();
        const fromBlock = getDeploymentBlock(chainId);

        // Fetch all order-related events
        const [createdLogs, reducedLogs, filledLogs] = await Promise.all([
          client.getLogs({
            address: p2pAddress,
            event: p2pAbi[1], // OrderCreated
            args: { marketId: marketId as `0x${string}` },
            fromBlock,
            toBlock: latestBlock,
          }),
          client.getLogs({
            address: p2pAddress,
            event: p2pAbi[3], // OrderReducedOrCancelled
            args: { marketId: marketId as `0x${string}` },
            fromBlock,
            toBlock: latestBlock,
          }),
          client.getLogs({
            address: p2pAddress,
            event: p2pAbi[2], // OrderFilled
            args: { marketId: marketId as `0x${string}` },
            fromBlock,
            toBlock: latestBlock,
          }),
        ]);

        // Build order map and track processed events
        const initialOrders = new Map<bigint, Order>();
        const newProcessedEvents = new Set<string>();

        // Process creations
        for (const log of createdLogs) {
          // Track this event as processed
          const eventId = `${log.transactionHash}-${log.logIndex}`;
          newProcessedEvents.add(eventId);

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
              orderId,
              maker,
              token0,
              token1,
              initialAmount0: amount0,
              remainingAmount0: amount0,
              maxPrice,
              minPrice,
            });
          }
        }

        // Process reductions/cancellations
        for (const log of reducedLogs) {
          // Track this event as processed
          const eventId = `${log.transactionHash}-${log.logIndex}`;
          newProcessedEvents.add(eventId);

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
              order.remainingAmount0 = 0n;
            }
            if (order.remainingAmount0 === 0n) {
              initialOrders.delete(orderId);
            }
          }
        }

        // Process fills
        for (const log of filledLogs) {
          // Track this event as processed
          const eventId = `${log.transactionHash}-${log.logIndex}`;
          newProcessedEvents.add(eventId);

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
              order.remainingAmount0 = 0n;
            }
            if (order.remainingAmount0 === 0n) {
              initialOrders.delete(orderId);
            }
          }
        }

        // Filter out any orders with zero remaining amount (safety check)
        for (const [orderId, order] of initialOrders.entries()) {
          if (order.remainingAmount0 === 0n) {
            initialOrders.delete(orderId);
          }
        }

        setOrders(initialOrders);
        setProcessedEvents(newProcessedEvents);
        setSyncBlockNumber(latestBlock);
        setHistoricalSyncComplete(true);
      } catch (err: any) {
        setError(`Failed to fetch orders: ${err.shortMessage || err.message}`);
        setOrders(new Map());
        setHistoricalSyncComplete(true); // Allow retries
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderLogs();
  }, [client, marketId, p2pAddress, chainId, enabled]);

  // Watch for new OrderCreated events (only after historical sync is complete)
  useWatchContractEvent({
    address: p2pAddress,
    abi: p2pAbi,
    eventName: "OrderCreated",
    args: marketId ? { marketId: marketId as `0x${string}` } : undefined,
    enabled: !!marketId && enabled && historicalSyncComplete,
    onLogs(logs) {
      setOrders((prevOrders) => {
        const newOrders = new Map(prevOrders);

        for (const log of logs) {
          // Check for duplicate events
          const eventId = `${log.transactionHash}-${log.logIndex}`;

          setProcessedEvents((prev) => {
            if (prev.has(eventId)) {
              // Already processed, skip
              return prev;
            }

            // Mark as processed
            const updated = new Set(prev);
            updated.add(eventId);
            return updated;
          });

          // Skip if already processed
          if (processedEvents.has(eventId)) {
            continue;
          }

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
            newOrders.set(orderId, {
              orderId,
              maker,
              token0,
              token1,
              initialAmount0: amount0,
              remainingAmount0: amount0,
              maxPrice,
              minPrice,
            });
          }
        }
        return newOrders;
      });
    },
  });

  // Watch for OrderReducedOrCancelled events (only after historical sync is complete)
  useWatchContractEvent({
    address: p2pAddress,
    abi: p2pAbi,
    eventName: "OrderReducedOrCancelled",
    args: marketId ? { marketId: marketId as `0x${string}` } : undefined,
    enabled: !!marketId && enabled && historicalSyncComplete,
    onLogs(logs) {
      setOrders((prevOrders) => {
        const newOrders = new Map(prevOrders);

        for (const log of logs) {
          // Check for duplicate events
          const eventId = `${log.transactionHash}-${log.logIndex}`;

          setProcessedEvents((prev) => {
            if (prev.has(eventId)) {
              // Already processed, skip
              return prev;
            }

            // Mark as processed
            const updated = new Set(prev);
            updated.add(eventId);
            return updated;
          });

          // Skip if already processed
          if (processedEvents.has(eventId)) {
            continue;
          }

          const { orderId, amount0Closed } = log.args;

          if (
            orderId !== undefined &&
            amount0Closed !== undefined &&
            newOrders.has(orderId)
          ) {
            const existingOrder = newOrders.get(orderId)!;
            const updatedOrder = { ...existingOrder };

            if (updatedOrder.remainingAmount0 >= amount0Closed) {
              updatedOrder.remainingAmount0 -= amount0Closed;
            } else {
              updatedOrder.remainingAmount0 = 0n;
            }

            if (updatedOrder.remainingAmount0 === 0n) {
              newOrders.delete(orderId);
            } else {
              newOrders.set(orderId, updatedOrder);
            }
          }
        }
        return newOrders;
      });
    },
  });

  // Watch for OrderFilled events (only after historical sync is complete)
  useWatchContractEvent({
    address: p2pAddress,
    abi: p2pAbi,
    eventName: "OrderFilled",
    args: marketId ? { marketId: marketId as `0x${string}` } : undefined,
    enabled: !!marketId && enabled && historicalSyncComplete,
    onLogs(logs) {
      setOrders((prevOrders) => {
        const newOrders = new Map(prevOrders);

        for (const log of logs) {
          // Check for duplicate events
          const eventId = `${log.transactionHash}-${log.logIndex}`;

          setProcessedEvents((prev) => {
            if (prev.has(eventId)) {
              // Already processed, skip
              return prev;
            }

            // Mark as processed
            const updated = new Set(prev);
            updated.add(eventId);
            return updated;
          });

          // Skip if already processed
          if (processedEvents.has(eventId)) {
            continue;
          }

          const { orderId, amount0Filled } = log.args;

          if (
            orderId !== undefined &&
            amount0Filled !== undefined &&
            newOrders.has(orderId)
          ) {
            const existingOrder = newOrders.get(orderId)!;
            const updatedOrder = { ...existingOrder };

            if (updatedOrder.remainingAmount0 >= amount0Filled) {
              updatedOrder.remainingAmount0 -= amount0Filled;
            } else {
              updatedOrder.remainingAmount0 = 0n;
            }

            if (updatedOrder.remainingAmount0 === 0n) {
              newOrders.delete(orderId);
            } else {
              newOrders.set(orderId, updatedOrder);
            }
          }
        }
        return newOrders;
      });
    },
  });

  // Periodic refresh to ensure data stays in sync (every 30 seconds)
  useEffect(() => {
    if (!client || !p2pAddress || !marketId || !enabled || !historicalSyncComplete) {
      return;
    }

    const refreshOrders = async () => {
      try {
        const latestBlock = await client.getBlockNumber();
        const fromBlock = getDeploymentBlock(chainId);

        // Fetch all order-related events
        const [createdLogs, reducedLogs, filledLogs] = await Promise.all([
          client.getLogs({
            address: p2pAddress,
            event: p2pAbi[1], // OrderCreated
            args: { marketId: marketId as `0x${string}` },
            fromBlock,
            toBlock: latestBlock,
          }),
          client.getLogs({
            address: p2pAddress,
            event: p2pAbi[3], // OrderReducedOrCancelled
            args: { marketId: marketId as `0x${string}` },
            fromBlock,
            toBlock: latestBlock,
          }),
          client.getLogs({
            address: p2pAddress,
            event: p2pAbi[2], // OrderFilled
            args: { marketId: marketId as `0x${string}` },
            fromBlock,
            toBlock: latestBlock,
          }),
        ]);

        // Rebuild order map from scratch
        const refreshedOrders = new Map<bigint, Order>();
        const newProcessedEvents = new Set<string>();

        // Process creations
        for (const log of createdLogs) {
          const eventId = `${log.transactionHash}-${log.logIndex}`;
          newProcessedEvents.add(eventId);

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
            refreshedOrders.set(orderId, {
              orderId,
              maker,
              token0,
              token1,
              initialAmount0: amount0,
              remainingAmount0: amount0,
              maxPrice,
              minPrice,
            });
          }
        }

        // Process reductions/cancellations
        for (const log of reducedLogs) {
          const eventId = `${log.transactionHash}-${log.logIndex}`;
          newProcessedEvents.add(eventId);

          const orderId = log.args.orderId;
          const amountClosed = log.args.amount0Closed;
          if (
            orderId !== undefined &&
            amountClosed !== undefined &&
            refreshedOrders.has(orderId)
          ) {
            const order = refreshedOrders.get(orderId)!;
            if (order.remainingAmount0 >= amountClosed) {
              order.remainingAmount0 -= amountClosed;
            } else {
              order.remainingAmount0 = 0n;
            }
            if (order.remainingAmount0 === 0n) {
              refreshedOrders.delete(orderId);
            }
          }
        }

        // Process fills
        for (const log of filledLogs) {
          const eventId = `${log.transactionHash}-${log.logIndex}`;
          newProcessedEvents.add(eventId);

          const orderId = log.args.orderId;
          const amountFilled = log.args.amount0Filled;
          if (
            orderId !== undefined &&
            amountFilled !== undefined &&
            refreshedOrders.has(orderId)
          ) {
            const order = refreshedOrders.get(orderId)!;
            if (order.remainingAmount0 >= amountFilled) {
              order.remainingAmount0 -= amountFilled;
            } else {
              order.remainingAmount0 = 0n;
            }
            if (order.remainingAmount0 === 0n) {
              refreshedOrders.delete(orderId);
            }
          }
        }

        // Filter out any orders with zero remaining amount (safety check)
        for (const [orderId, order] of refreshedOrders.entries()) {
          if (order.remainingAmount0 === 0n) {
            refreshedOrders.delete(orderId);
          }
        }

        setOrders(refreshedOrders);
        setProcessedEvents(newProcessedEvents);
        setSyncBlockNumber(latestBlock);
      } catch (err) {
        console.error("Error refreshing orders:", err);
        // Don't update error state, just log - real-time watchers will continue working
      }
    };

    // Refresh every 30 seconds
    const interval = setInterval(refreshOrders, 30000);

    return () => clearInterval(interval);
  }, [client, marketId, p2pAddress, chainId, enabled, historicalSyncComplete]);

  return {
    orders,
    isLoading,
    error,
  };
}

// Helper function to check if a market has liquidity
export async function checkMarketLiquidity(
  client: any,
  p2pAddress: Address,
  marketId: string,
  chainId: number
): Promise<boolean> {
  try {
    const latestBlock = await client.getBlockNumber();
    const fromBlock = getDeploymentBlock(chainId);

    const [createdLogs, cancelledLogs, filledLogs] = await Promise.all([
      client.getLogs({
        address: p2pAddress,
        event: p2pAbi[1], // OrderCreated
        args: { marketId: marketId as `0x${string}` },
        fromBlock,
        toBlock: latestBlock,
      }),
      client.getLogs({
        address: p2pAddress,
        event: p2pAbi[3], // OrderReducedOrCancelled
        args: { marketId: marketId as `0x${string}` },
        fromBlock,
        toBlock: latestBlock,
      }),
      client.getLogs({
        address: p2pAddress,
        event: p2pAbi[2], // OrderFilled
        args: { marketId: marketId as `0x${string}` },
        fromBlock,
        toBlock: latestBlock,
      }),
    ]);

    const orderMap = new Map<bigint, { remainingAmount0: bigint }>();

    for (const log of createdLogs) {
      const orderId = log.args.orderId!;
      const amount0 = log.args.amount0!;
      orderMap.set(orderId, { remainingAmount0: amount0 });
    }

    for (const log of cancelledLogs) {
      const orderId = log.args.orderId!;
      const amount0Closed = log.args.amount0Closed!;
      const existing = orderMap.get(orderId);
      if (existing) {
        existing.remainingAmount0 -= amount0Closed;
        if (existing.remainingAmount0 <= 0n) {
          orderMap.delete(orderId);
        }
      }
    }

    for (const log of filledLogs) {
      const orderId = log.args.orderId!;
      const amount0Filled = log.args.amount0Filled!;
      const existing = orderMap.get(orderId);
      if (existing) {
        existing.remainingAmount0 -= amount0Filled;
        if (existing.remainingAmount0 <= 0n) {
          orderMap.delete(orderId);
        }
      }
    }

    return Array.from(orderMap.values()).some((order) => order.remainingAmount0 > 0n);
  } catch (error) {
    return false;
  }
}
