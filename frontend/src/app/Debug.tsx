"use client";

import { useEffect } from "react";
import { usePublicClient } from "wagmi";
import { P2P_CONTRACT_ADDRESS } from "./config";



export function Debug() {
  const client = usePublicClient();

  useEffect(() => {
    if (!client) return;

    const checkDeployment = async () => {
      try {
        const code = await client.getBytecode({ address: P2P_CONTRACT_ADDRESS });
        console.log("=== DEBUG INFO ===");
        console.log("P2P Contract Address:", P2P_CONTRACT_ADDRESS);
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
  }, [client]);

  return null;
}
