"use client";

import { useEffect } from "react";
import { usePublicClient, useChainId } from "wagmi";
import { getP2PAddress } from "./config";



export function Debug() {
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);
  const client = usePublicClient();

  useEffect(() => {
    if (!client) return;

    const checkDeployment = async () => {
      try {
        const code = await client.getBytecode({ address: p2pAddress });
        console.log("=== DEBUG INFO ===");
        console.log("P2P Contract Address:", p2pAddress);
        console.log("Contract has code:", code ? "YES" : "NO");
        console.log("Contract code length:", code?.length || 0);

        const blockNumber = await client.getBlockNumber();
        console.log("Current block number:", blockNumber);

        console.log("\nCheck the following:");
        console.log("1. Is Anvil running?");
        console.log("2. Did you run the deploy script?");
        console.log("3. Are you connected to the right network (Foundry/Anvil)?");
        console.log("4. Check browser console for transaction errors");
      } catch (err) {
        console.error("Debug check failed:", err);
      }
    };

    checkDeployment();
  }, [client, p2pAddress]);

  return null;
}
