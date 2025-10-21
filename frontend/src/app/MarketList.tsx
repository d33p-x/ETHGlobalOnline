"use client";

import { useEffect, useState } from "react";
// 1. Import chains and Chain type
import { useAccount, usePublicClient, useWatchContractEvent } from "wagmi";
import { foundry } from "wagmi/chains"; // Import your foundry chain config
import { type Address, type Log, formatUnits, numberToHex } from "viem"; // Import numberToHex

// --- Config ---
// ⚠️ Make sure this is your deployed contract address
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // From your logs

const p2pAbi = [
  // ... (keep your event ABI the same)
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

type Market = {
  marketId: string;
  token0: Address;
  token1: Address;
};

export function MarketList() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2. Get the connected account's chain
  const { chain } = useAccount();

  // 3. Explicitly get the client for the connected chain OR foundry if disconnected
  const client = usePublicClient({
    chainId: chain?.id ?? foundry.id, // Use connected chain or default to foundry
  });

  // --- Fetch historical events ---
  useEffect(() => {
    // Ensure we have a client configured for the correct chain (Anvil)
    if (!client || client.chain.id !== foundry.id) {
      // Don't fetch if client is not ready or not on Anvil
      // You could set an error message here if needed
      if (client) {
        console.warn(
          `Client chain ID is ${client.chain.id}, expected ${foundry.id}. Waiting for connection to Anvil.`
        );
        setError(
          `Please connect your wallet to the Anvil network (Chain ID ${foundry.id}).`
        );
      } else {
        console.warn("Public client not available yet.");
      }
      setIsLoading(false); // Stop loading indicator
      return;
    }

    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null); // Clear previous errors
      try {
        console.log(
          `Fetching historical market logs from chain ${client.chain.id}...`
        );
        const logs = await client.getLogs({
          address: p2pContractAddress,
          event: p2pAbi[0],
          // 4. Use numberToHex for block numbers in RPC calls
          fromBlock: BigInt(0), // Explicitly format as hex string "0x0"
          toBlock: "latest",
        });

        const parsedMarkets = logs.map((log) => ({
          marketId: log.args.markteId!,
          token0: log.args.token0!,
          token1: log.args.token1!,
        }));

        setMarkets(parsedMarkets);
        console.log("Fetched markets:", parsedMarkets);
      } catch (err: any) {
        console.error("Error fetching logs:", err);
        setError(
          `Failed to fetch market logs: ${err.shortMessage || err.message}`
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
    // 5. Re-run when the client (specifically its chain ID) changes
  }, [client]);

  // --- Listen for new events ---
  useWatchContractEvent({
    // Only watch if connected to the correct chain
    chainId: foundry.id, // Ensure watcher is attached to Anvil
    address: p2pContractAddress,
    abi: p2pAbi,
    eventName: "MarketCreated",
    onLogs(logs) {
      console.log("New market created!", logs);
      for (const log of logs) {
        // Ensure log has args before proceeding
        if (!log.args) {
          console.warn("Received log without args:", log);
          continue;
        }
        const newMarket = {
          marketId: log.args.markteId!,
          token0: log.args.token0!,
          token1: log.args.token1!,
        };
        setMarkets((prevMarkets) => {
          if (prevMarkets.find((m) => m.marketId === newMarket.marketId)) {
            return prevMarkets;
          }
          return [...prevMarkets, newMarket];
        });
      }
    },
    onError(error) {
      console.error("Error watching contract events:", error);
      setError(`Error listening for new markets: ${error.message}`);
    },
  });

  if (isLoading) {
    return <div>Loading markets...</div>;
  }

  return (
    <div>
      <h3>Available Markets</h3>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {markets.length === 0 && !error ? (
        <p>No markets created yet on the Anvil network.</p>
      ) : (
        <ul>
          {markets.map((market) => (
            <li
              key={market.marketId}
              style={{ fontFamily: "monospace", fontSize: "12px" }}
            >
              <strong>Market ID:</strong> {market.marketId.substring(0, 10)}...
              | <strong>Pair:</strong> {market.token0} / {market.token1}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
