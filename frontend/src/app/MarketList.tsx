"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { type Address, type Log } from "viem";

// --- Config ---
// ⚠️ Make sure this is your deployed contract address
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

// We need the ABI for the *event* this time
const p2pAbi = [
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "markteId", type: "bytes32", indexed: false },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
    ],
    anonymous: false,
  },
] as const;

// Define a type for our market object
type Market = {
  marketId: string;
  token0: Address;
  token1: Address;
};

export function MarketList() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const client = usePublicClient();

  // 1. --- Fetch historical events on page load ---
  useEffect(() => {
    if (!client) return;

    const fetchLogs = async () => {
      try {
        console.log("Fetching historical market logs...");
        const logs = await client.getLogs({
          address: p2pContractAddress,
          event: p2pAbi[0],
          // --- FIX 1 ---
          fromBlock: BigInt(0), // Use BigInt(0) instead of 0n
          // --- END FIX 1 ---
          toBlock: "latest",
        });

        // This .map() should now have the correct types
        const parsedMarkets = logs.map((log) => ({
          marketId: log.args.markteId!,
          token0: log.args.token0!,
          token1: log.args.token1!,
        }));

        setMarkets(parsedMarkets);
        console.log("Fetched markets:", parsedMarkets);
      } catch (err) {
        console.error("Error fetching logs:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [client]);

  // 2. --- Listen for new events in real-time ---
  useWatchContractEvent({
    address: p2pContractAddress,
    abi: p2pAbi,
    eventName: "MarketCreated",
    // --- FIX 2 ---
    // Remove the `Log[]` type. `logs` will now be correctly
    // inferred as GetLogsReturnType<typeof p2pAbi, "MarketCreated">
    onLogs(logs) {
      // --- END FIX 2 ---
      console.log("New market created!", logs);

      // Loop through logs just in case (though it's often one)
      for (const log of logs) {
        const newMarket = {
          marketId: log.args.markteId!,
          token0: log.args.token0!,
          token1: log.args.token1!,
        };
        // Use functional update to safely add to the list
        setMarkets((prevMarkets) => {
          // Avoid adding duplicates if the event fires multiple times
          if (prevMarkets.find((m) => m.marketId === newMarket.marketId)) {
            return prevMarkets;
          }
          return [...prevMarkets, newMarket];
        });
      }
    },
  });

  if (isLoading) {
    return <div>Loading markets...</div>;
  }

  return (
    <div>
      <h3>Available Markets</h3>
      {markets.length === 0 ? (
        <p>No markets created yet.</p>
      ) : (
        <ul>
          {markets.map((market) => (
            <li key={market.marketId}>
              <strong>Market:</strong> {market.token0} / {market.token1}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
