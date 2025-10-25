import { type Address } from "viem";
import { foundry, baseSepolia } from "wagmi/chains";

/**
 * Central Configuration File
 * Network-specific contract addresses
 */

type NetworkConfig = {
  p2pAddress: Address;
  deploymentBlock?: bigint; // Optional: block where P2P contract was deployed
  tokens: {
    WETH: Address;
    USDC: Address;
    LINK: Address;
    USDT: Address;
    cbDOGE: Address;
    cbBTC: Address;
    SHIB: Address;
    AERO: Address;
    cbXRP: Address;
    PEPE: Address;
  };
};

/**
 * Contract addresses by network
 * Update Base Sepolia addresses after deployment
 */
const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  // Local Anvil (Foundry)
  [foundry.id]: {
    p2pAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    deploymentBlock: 0n, // Local chain starts from 0
    tokens: {
      WETH: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
      USDC: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      LINK: "0x0000000000000000000000000000000000000000", // Not deployed locally
      USDT: "0x0000000000000000000000000000000000000000", // Not deployed locally
      cbDOGE: "0x0000000000000000000000000000000000000000", // Not deployed locally
      cbBTC: "0x0000000000000000000000000000000000000000", // Not deployed locally
      SHIB: "0x0000000000000000000000000000000000000000", // Not deployed locally
      AERO: "0x0000000000000000000000000000000000000000", // Not deployed locally
      cbXRP: "0x0000000000000000000000000000000000000000", // Not deployed locally
      PEPE: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    },
  },
  // Base Sepolia (update P2P address after deployment!)
  [baseSepolia.id]: {
    p2pAddress: "0x2a942237037394852f34cBA4Fcec3dF00Ff0aa6A", // TODO: Update after deploy-sepolia.sh
    deploymentBlock: 30000000n, // Approximate deployment block
    tokens: {
      // Real Base Sepolia tokens (DO NOT CHANGE)
      WETH: "0x4200000000000000000000000000000000000006",
      USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      LINK: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
      // Mock tokens (UPDATE after deploy-tokens.sh)
      USDT: "0x5Fe161a97511aa3C185cBfFDCf281Fd510411343", // TODO: Update
      cbDOGE: "0x58c445B391c553A216DEfEd1631997eddF604B49", // TODO: Update
      cbBTC: "0xA4d20763EB35092bdd5B2545079AACF048fA96B7", // TODO: Update
      SHIB: "0x7f24751c3aECdCC72981CBF9bbdefAD11094AB2D", // TODO: Update
      AERO: "0x67Abb24DAC2b03550F6594909917a5BBDFDbEDb2", // TODO: Update
      cbXRP: "0xbB792AfFD9152d17E0772e2B7CcE48A17103E59d", // TODO: Update
      PEPE: "0x69F2ecec8707359204dea8249b64a5a3d3e1aE05", // TODO: Update
    },
  },
};

/**
 * Get P2P contract address for the current chain
 */
export function getP2PAddress(chainId: number): Address {
  const config = NETWORK_CONFIGS[chainId];
  if (!config) {
    throw new Error(`No configuration found for chain ID ${chainId}`);
  }
  return config.p2pAddress;
}

/**
 * Get token addresses for the current chain
 */
export function getTokenAddresses(chainId: number) {
  const config = NETWORK_CONFIGS[chainId];
  if (!config) {
    throw new Error(`No configuration found for chain ID ${chainId}`);
  }
  return config.tokens;
}

/**
 * Get deployment block for the current chain
 * Returns the configured deployment block or undefined if not set
 */
export function getDeploymentBlock(chainId: number): bigint | undefined {
  const config = NETWORK_CONFIGS[chainId];
  if (!config) {
    throw new Error(`No configuration found for chain ID ${chainId}`);
  }
  return config.deploymentBlock;
}

/**
 * Automatically fetch the deployment block by finding the first event from the P2P contract
 * This is useful when the deployment block is not configured
 *
 * @param client - Viem public client
 * @param chainId - Chain ID
 * @returns The block number of the first contract event, or a fallback value
 */
export async function fetchDeploymentBlock(
  client: any,
  chainId: number
): Promise<bigint> {
  const configuredBlock = getDeploymentBlock(chainId);

  // If we have a configured block, use it
  if (configuredBlock !== undefined) {
    return configuredBlock;
  }

  // Otherwise, try to find the first event from the contract
  try {
    const p2pAddress = getP2PAddress(chainId);
    const latestBlock = await client.getBlockNumber();

    // Simple approach: try fetching logs from increasingly larger ranges
    // until we find the first event
    const searchRanges = [
      latestBlock - 10000n, // Last 10k blocks
      latestBlock - 100000n, // Last 100k blocks
      latestBlock - 1000000n, // Last 1M blocks
      0n, // From genesis (fallback)
    ];

    for (const startBlock of searchRanges) {
      if (startBlock < 0n) continue;

      try {
        // Try to fetch any event from the contract
        const logs = await client.getLogs({
          address: p2pAddress,
          fromBlock: startBlock,
          toBlock: latestBlock,
        });

        if (logs.length > 0) {
          // Find the earliest block
          const deploymentBlock = logs.reduce(
            (earliest: bigint, log: any) =>
              log.blockNumber < earliest ? log.blockNumber : earliest,
            logs[0].blockNumber
          );
          console.log(`Auto-detected deployment block: ${deploymentBlock}`);
          return deploymentBlock;
        }
      } catch (err) {
        console.warn(`Failed to fetch logs from block ${startBlock}:`, err);
        continue;
      }
    }

    // If we still haven't found anything, return a reasonable default
    console.warn("Could not auto-detect deployment block, using fallback");
    return 0n;
  } catch (err) {
    console.error("Error fetching deployment block:", err);
    return 0n; // Fallback to genesis
  }
}

/**
 * Get the starting block for log queries
 * Uses configured deployment block if available, otherwise returns a safe default
 */
export function getStartBlock(chainId: number, latestBlock?: bigint): bigint {
  const deploymentBlock = getDeploymentBlock(chainId);

  if (deploymentBlock !== undefined) {
    return deploymentBlock;
  }

  // If no deployment block configured and we have latest block,
  // use a reasonable lookback (e.g., last 100k blocks)
  if (latestBlock !== undefined && latestBlock > 100000n) {
    return latestBlock - 100000n;
  }

  // Fallback to 0
  return 0n;
}

/**
 * Legacy exports for backward compatibility
 * These use Foundry chain by default
 */
export const P2P_CONTRACT_ADDRESS: Address =
  NETWORK_CONFIGS[foundry.id].p2pAddress;
export const TOKEN_ADDRESSES = NETWORK_CONFIGS[foundry.id].tokens;
