// Shared hook for Pyth price data fetching

import { useState, useEffect } from "react";
import { type Address } from "viem";
import { useChainId, useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { p2pAbi, pythAbi } from "@/lib/contracts/abis";
import { getP2PAddress } from "@/app/config";

interface UsePythPriceProps {
  priceFeedIds: string[];
  refreshInterval?: number; // in milliseconds, default 5000
  enabled?: boolean;
}

interface PythPriceData {
  priceUpdateArray: `0x${string}`[];
  fee: bigint;
}

export function usePythPrice({
  priceFeedIds,
  refreshInterval = 5000,
  enabled = true,
}: UsePythPriceProps) {
  const config = useConfig();
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);

  const [pythUpdateData, setPythUpdateData] = useState<PythPriceData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pythContractAddress, setPythContractAddress] =
    useState<Address | null>(null);

  // Fetch Pyth contract address once (always needed, even if auto-polling is disabled)
  useEffect(() => {
    if (!p2pAddress || pythContractAddress) return;

    const fetchPythContractAddress = async () => {
      try {
        const address = await readContract(config, {
          address: p2pAddress,
          abi: p2pAbi,
          functionName: "pyth",
          chainId,
        });
        setPythContractAddress(address);
      } catch (err) {
        setError("Failed to fetch Pyth contract address");
      }
    };

    fetchPythContractAddress();
    // Note: This runs regardless of 'enabled' state so fetchFreshPythData() works
  }, [p2pAddress, config, chainId, pythContractAddress]);

  // Fetch fresh price data
  const fetchFreshPythData = async (): Promise<PythPriceData | null> => {
    if (priceFeedIds.length === 0 || !pythContractAddress) {
      return null;
    }

    try {
      const priceFeedsUrl = `https://hermes.pyth.network/api/latest_vaas?${priceFeedIds
        .map((id) => `ids[]=${id}`)
        .join("&")}`;

      const response = await fetch(priceFeedsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Pyth data: ${response.statusText}`);
      }

      const pythData = await response.json();
      const priceUpdateArray = pythData.map(
        (vaa: string) =>
          ("0x" + Buffer.from(vaa, "base64").toString("hex")) as `0x${string}`
      );

      const fee = await readContract(config, {
        address: pythContractAddress,
        abi: pythAbi,
        functionName: "getUpdateFee",
        args: [priceUpdateArray],
        chainId,
      });

      return {
        priceUpdateArray,
        fee,
      };
    } catch (err) {
      throw err;
    }
  };

  // Fetch price data on interval
  useEffect(() => {
    if (!enabled || priceFeedIds.length === 0 || !pythContractAddress) {
      return;
    }

    const fetchPythData = async () => {
      // Only show loading on initial fetch
      if (!pythUpdateData) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchFreshPythData();
        if (data) {
          setPythUpdateData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch price data");
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchPythData();

    // Then fetch on interval
    const interval = setInterval(fetchPythData, refreshInterval);

    return () => clearInterval(interval);
  }, [priceFeedIds, pythContractAddress, enabled, refreshInterval, config, chainId]);

  return {
    pythUpdateData,
    isLoading,
    error,
    pythContractAddress,
    fetchFreshPythData,
  };
}
