
// frontend/src/app/useTokenRegistry.ts
"use client";

import { useState, useEffect } from "react";
import { usePublicClient, useChainId, useReadContracts } from "wagmi";
import { type Address, erc20Abi } from "viem";
import { getP2PAddress, getDeploymentBlock } from "./config";
import { type TokenInfo } from "./tokenConfig";

const p2pEventAbi = [
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

export function useTokenRegistry() {
  const [tokenInfoMap, setTokenInfoMap] = useState<Record<Address, TokenInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const chainId = useChainId();
  const client = usePublicClient({ chainId });
  const p2pAddress = getP2PAddress(chainId);
  const deploymentBlock = getDeploymentBlock(chainId);

  useEffect(() => {
    if (!client) return;

    const fetchTokenRegistry = async () => {
      setIsLoading(true);
      try {
        const priceFeedLogs = await client.getLogs({
          address: p2pAddress,
          event: p2pEventAbi[0],
          fromBlock: deploymentBlock,
          toBlock: "latest",
        });

        const uniqueTokens = [
          ...new Map(
            priceFeedLogs.map((log) => [log.args.tokenAddress, log.args])
          ).values(),
        ];

        const contracts = uniqueTokens.flatMap((token) => [
          {
            address: token.tokenAddress!,
            abi: erc20Abi,
            functionName: "symbol",
          },
          {
            address: token.tokenAddress!,
            abi: erc20Abi,
            functionName: "decimals",
          },
        ]);

        // The results will be null if the contract call fails
        const results = await client.multicall({ contracts: contracts as any });

        const newMap: Record<Address, TokenInfo> = {};
        for (let i = 0; i < uniqueTokens.length; i++) {
          const token = uniqueTokens[i];
          const symbol = results[i * 2].result as string;
          const decimals = results[i * 2 + 1].result as number;
          if (symbol && decimals !== undefined) {
            newMap[token.tokenAddress!] = {
              symbol,
              decimals,
              priceFeedId: token.priceFeedId!,
            };
          }
        }

        setTokenInfoMap(newMap);
      } catch (error) {
        console.error("Error fetching token registry:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokenRegistry();
  }, [client, chainId, p2pAddress, deploymentBlock]);

  return { tokenInfoMap, isLoading };
}
