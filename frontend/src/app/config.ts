import { type Address } from "viem";
import { baseSepolia } from "wagmi/chains";

/**
 * Central Configuration File
 * Network-specific contract addresses
 */

type NetworkConfig = {
  p2pAddress: Address;
  deploymentBlock?: bigint;
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
 */
const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  [baseSepolia.id]: {
    p2pAddress: "0x4F7e5b32E1C1eA49c597E840804CE898F53cC149",
    deploymentBlock: 32854371n,
    tokens: {
      WETH: "0x4200000000000000000000000000000000000006",
      USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      LINK: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
      USDT: "0x5Fe161a97511aa3C185cBfFDCf281Fd510411343",
      cbDOGE: "0x58c445B391c553A216DEfEd1631997eddF604B49",
      cbBTC: "0xA4d20763EB35092bdd5B2545079AACF048fA96B7",
      SHIB: "0x7f24751c3aECdCC72981CBF9bbdefAD11094AB2D",
      AERO: "0x67Abb24DAC2b03550F6594909917a5BBDFDbEDb2",
      cbXRP: "0xbB792AfFD9152d17E0772e2B7CcE48A17103E59d",
      PEPE: "0x69F2ecec8707359204dea8249b64a5a3d3e1aE05",
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
 */
export function getDeploymentBlock(chainId: number): bigint {
  const config = NETWORK_CONFIGS[chainId];
  if (!config) {
    throw new Error(`No configuration found for chain ID ${chainId}`);
  }
  return config.deploymentBlock ?? 0n;
}

/**
 * Legacy exports for backward compatibility
 */
export const P2P_CONTRACT_ADDRESS: Address =
  NETWORK_CONFIGS[baseSepolia.id].p2pAddress;
export const TOKEN_ADDRESSES = NETWORK_CONFIGS[baseSepolia.id].tokens;
