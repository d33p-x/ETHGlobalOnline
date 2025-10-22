// src/app/MarketList.tsx
"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWatchContractEvent } from "wagmi";
import { foundry } from "wagmi/chains";
import { type Address, type Log } from "viem";
import Link from "next/link"; // <-- 1. Import Link
import { tokenInfoMap } from "./tokenConfig"; // <-- 1. Import

// ... (p2pContractAddress and p2pAbi remain the same) ...
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const p2pAbi = [
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: false },
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

  const { chain } = useAccount();
  const client = usePublicClient({
    chainId: chain?.id ?? foundry.id,
  });

  // ... (useEffect and useWatchContractEvent hooks remain exactly the same) ...

  useEffect(() => {
    if (!client || client.chain.id !== foundry.id) {
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
      setIsLoading(false);
      return;
    }

    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log(
          `Fetching historical market logs from chain ${client.chain.id}...`
        );
        const logs = await client.getLogs({
          address: p2pContractAddress,
          event: p2pAbi[0],
          fromBlock: 0n,
          toBlock: "latest",
        });

        const parsedMarkets = logs.map((log) => ({
          marketId: log.args.marketId!,
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
  }, [client]);

  useWatchContractEvent({
    chainId: foundry.id,
    address: p2pContractAddress,
    abi: p2pAbi,
    eventName: "MarketCreated",
    onLogs(logs) {
      console.log("New market created!", logs);
      for (const log of logs) {
        if (!log.args) {
          console.warn("Received log without args:", log);
          continue;
        }
        const newMarket = {
          marketId: log.args.marketId!,
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
      <h3>Available Markets (Click to View)</h3>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {markets.length === 0 && !error ? (
        <p>No markets created yet on the Anvil network.</p>
      ) : (
        <ul>
          {markets.map((market) => {
            // 2. Look up symbols
            const symbol0 = tokenInfoMap[market.token0]?.symbol ?? "Token0";
            const symbol1 = tokenInfoMap[market.token1]?.symbol ?? "Token1";

            return (
              <Link
                key={market.marketId}
                href={`/market/${market.marketId}?token0=${market.token0}&token1=${market.token1}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <li
                  style={{
                    fontFamily: "monospace",
                    fontSize: "12px",
                    padding: "8px",
                    border: "1px solid #333",
                    marginBottom: "5px",
                    borderRadius: "4px",
                  }}
                >
                  {/* 3. Display symbols */}
                  <strong>
                    Pair: {symbol0} / {symbol1}
                  </strong>
                  <br />
                  <span style={{ fontSize: "10px" }}>
                    Market ID: {market.marketId.substring(0, 10)}...
                    <br />
                    Tokens: {market.token0} / {market.token1}
                  </span>
                </li>
              </Link>
            );
          })}
        </ul>
      )}
    </div>
  );
}
