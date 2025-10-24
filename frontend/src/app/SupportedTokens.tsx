// src/app/SupportedTokens.tsx
"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { foundry } from "wagmi/chains";
import { type Address, erc20Abi } from "viem";
import { useReadContract } from "wagmi";

// --- Config ---
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Your contract

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
          address: p2pContractAddress,
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
      <h3>Supported Tokens</h3>
      <p>Tokens with a price feed set in the contract.</p>
      {isLoading ? (
        <p>Loading tokens...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : tokenArray.length === 0 ? (
        <p>No price feeds have been set yet.</p>
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
