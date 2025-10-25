// src/app/MarketList.tsx
"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWatchContractEvent, useChainId } from "wagmi";
import { type Address } from "viem";
import { getP2PAddress } from "./config";
import Link from "next/link"; // <-- 1. Import Link
import { getTokenInfoMap } from "./tokenConfig"; // <-- 1. Import

// ... (p2pAddress and p2pAbi remain the same) ...


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
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);
  const tokenInfoMap = getTokenInfoMap(chainId);

  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { chain } = useAccount();
  const client = usePublicClient({
    chainId: chain?.id ?? chainId,
  });

  // ... (useEffect and useWatchContractEvent hooks remain exactly the same) ...

  useEffect(() => {
    if (!client || client.chain.id !== chainId) {
      if (client) {
        console.warn(
          `Client chain ID is ${client.chain.id}, expected ${chainId}. Waiting for connection to Anvil.`
        );
        setError(
          `Please connect your wallet to the Anvil network (Chain ID ${chainId}).`
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
          address: p2pAddress,
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
  }, [client, p2pAddress, chainId]);

  // Watch for new markets in real-time (works with DRPC)
  useWatchContractEvent({
    chainId: chainId,
    address: p2pAddress,
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
          // Check if market already exists
          if (prevMarkets.find((m) => m.marketId === newMarket.marketId)) {
            return prevMarkets;
          }
          return [...prevMarkets, newMarket];
        });
      }
    },
    onError(error) {
      console.error("Error watching contract events:", error);
    },
  });

  if (isLoading) {
    return <div>Loading markets...</div>;
  }

  return (
    <div style={{
      background: "var(--bg-card)",
      padding: "2rem",
      borderRadius: "1rem",
      border: "1px solid var(--border-color)",
      boxShadow: "var(--shadow-lg)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <span style={{ fontSize: "1.5rem" }}>💹</span>
        <h3 style={{ margin: 0 }}>Available Markets</h3>
        {markets.length > 0 && (
          <span style={{
            marginLeft: "auto",
            padding: "0.25rem 0.75rem",
            background: "rgba(59, 130, 246, 0.2)",
            border: "1px solid var(--accent-primary)",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: "600",
            color: "var(--accent-secondary)"
          }}>
            {markets.length} {markets.length === 1 ? "Market" : "Markets"}
          </span>
        )}
      </div>

      {error && <p className="error-message">{error}</p>}
      {markets.length === 0 && !error ? (
        <div style={{
          textAlign: "center",
          padding: "3rem 1rem",
          color: "var(--text-muted)"
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
          <p>No markets created yet</p>
          <p style={{ fontSize: "0.875rem" }}>Create your first market below to get started</p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1rem"
        }}>
          {markets.map((market) => {
            // 2. Look up symbols
            const symbol0 = tokenInfoMap[market.token0]?.symbol ?? "Token0";
            const symbol1 = tokenInfoMap[market.token1]?.symbol ?? "Token1";

            return (
              <Link
                key={market.marketId}
                href={`/market/${market.marketId}?token0=${market.token0}&token1=${market.token1}`}
                className="market-link"
              >
                <div style={{
                  padding: "1.5rem",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "0.75rem",
                  transition: "all 0.3s ease",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-primary)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}>
                  <div style={{
                    fontSize: "1.25rem",
                    fontWeight: "700",
                    marginBottom: "0.75rem",
                    background: "linear-gradient(135deg, #00f5ff 0%, #ff0080 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text"
                  }}>
                    {symbol0} / {symbol1}
                  </div>
                  <div style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    fontFamily: "monospace",
                    wordBreak: "break-all"
                  }}>
                    {market.marketId.substring(0, 16)}...
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
