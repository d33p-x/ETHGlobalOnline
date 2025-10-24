// src/app/SupportedTokens.tsx
"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { foundry } from "wagmi/chains";
import { type Address, erc20Abi } from "viem";
import { useReadContract } from "wagmi";
import { P2P_CONTRACT_ADDRESS } from "./config";

// --- Config ---
 // Your contract

// ABI for the new event
const p2pAbi = [
  {
    type: "event",
    name: "PriceFeedSet",
    inputs: [
      { name: "tokenAddress", type: "address", indexed: true },
      { name: "priceFeedId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: false },
    ],
    anonymous: false,
  },
] as const;

type TokenInfo = {
  address: Address;
  feedId: string;
};

/**
 * A small component to fetch and display token info dynamically
 */
function TokenRow({ address }: { address: Address }) {
  const { data: symbol, isLoading: isLoadingSymbol } = useReadContract({
    address: address,
    abi: erc20Abi,
    functionName: "symbol",
  });
  const { data: decimals, isLoading: isLoadingDecimals } = useReadContract({
    address: address,
    abi: erc20Abi,
    functionName: "decimals",
  });

  const isLoading = isLoadingSymbol || isLoadingDecimals;

  return (
    <li key={address}>
      <strong>{isLoading ? "..." : symbol}</strong> (
      {isLoading ? "..." : decimals?.toString()} decimals)
      <br />
      {address}
    </li>
  );
}

export function SupportedTokens() {
  const [tokens, setTokens] = useState<Map<Address, TokenInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const client = usePublicClient({ chainId: foundry.id });

  useEffect(() => {
    if (!client) return;

    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const logs = await client.getLogs({
          address: P2P_CONTRACT_ADDRESS,
          event: p2pAbi[0], // PriceFeedSet
          fromBlock: 0n,
          toBlock: "latest",
        });

        // Use a map to automatically handle duplicates
        // The last event for a token will overwrite previous ones
        const tokenMap = new Map<Address, TokenInfo>();
        for (const log of logs) {
          const { tokenAddress, priceFeedId } = log.args;
          if (tokenAddress && priceFeedId) {
            tokenMap.set(tokenAddress, {
              address: tokenAddress,
              feedId: priceFeedId,
            });
          }
        }
        setTokens(tokenMap);
      } catch (err: any) {
        console.error("Error fetching price feed logs:", err);
        setError(`Failed to fetch logs: ${err.shortMessage || err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [client]);

  const tokenArray = Array.from(tokens.values());

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <span style={{ fontSize: "1.5rem" }}>🪙</span>
        <h3 style={{ margin: 0 }}>Supported Tokens</h3>
      </div>
      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Tokens with price feeds configured
      </p>
      {isLoading ? (
        <div style={{
          textAlign: "center",
          padding: "2rem",
          color: "var(--text-muted)"
        }}>
          <div className="loading" style={{ fontSize: "2rem" }}>⏳</div>
          <p>Loading tokens...</p>
        </div>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : tokenArray.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "2rem 1rem",
          color: "var(--text-muted)",
          background: "var(--bg-tertiary)",
          borderRadius: "0.5rem",
          border: "1px dashed var(--border-color)"
        }}>
          <p>No price feeds configured yet</p>
        </div>
      ) : (
        <ul className="token-list">
          {tokenArray.map((info) => (
            <TokenRow key={info.address} address={info.address} />
          ))}
        </ul>
      )}
    </div>
  );
}
