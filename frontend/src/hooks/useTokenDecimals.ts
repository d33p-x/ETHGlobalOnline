// Shared hook for fetching and caching token decimals

import { useState, useCallback } from "react";
import { type Address } from "viem";
import { usePublicClient, useChainId } from "wagmi";
import { erc20DecimalsAbi } from "@/lib/contracts/abis";

const decimalsCache = new Map<Address, number>();

export function useTokenDecimals() {
  const chainId = useChainId();
  const client = usePublicClient({ chainId });
  const [localCache, setLocalCache] = useState<Map<Address, number>>(
    new Map(decimalsCache)
  );

  const getDecimals = useCallback(
    async (tokenAddress: Address): Promise<number> => {
      // Check cache first
      if (decimalsCache.has(tokenAddress)) {
        return decimalsCache.get(tokenAddress)!;
      }

      if (!client) {
        console.warn("Public client not available, using default decimals");
        return 18;
      }

      try {
        const decimals = (await client.readContract({
          address: tokenAddress,
          abi: erc20DecimalsAbi,
          functionName: "decimals",
        })) as number;

        // Update both global and local cache
        decimalsCache.set(tokenAddress, decimals);
        setLocalCache(new Map(decimalsCache));
        return decimals;
      } catch (err) {
        console.warn(
          `Failed to get decimals for ${tokenAddress}, using 18`,
          err
        );
        return 18; // Default fallback
      }
    },
    [client]
  );

  const getDecimalsBatch = useCallback(
    async (tokenAddresses: Address[]): Promise<Map<Address, number>> => {
      const results = new Map<Address, number>();
      await Promise.all(
        tokenAddresses.map(async (address) => {
          const decimals = await getDecimals(address);
          results.set(address, decimals);
        })
      );
      return results;
    },
    [getDecimals]
  );

  return { getDecimals, getDecimalsBatch, decimalsCache: localCache };
}
