import { type Address } from "viem";

/**
 * Central Configuration File
 * Update contract addresses here when deploying to new networks
 */

/**
 * P2P DEX Contract Address
 * Update this with your deployed P2P.sol contract address
 */
export const P2P_CONTRACT_ADDRESS: Address =
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

/**
 * Known Token Addresses (from deployment)
 */
export const TOKEN_ADDRESSES = {
  USDC: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as Address,
  PEPE: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as Address,
  WETH: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" as Address,
} as const;
