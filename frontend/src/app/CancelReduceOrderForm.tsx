// src/app/CancelReduceOrderForm.tsx
"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
// ... (other imports)
import { type Address, BaseError, parseUnits } from "viem";

// ... (Config, ABI, Decimals Map remain the same) ...
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const p2pAbi = [
  {
    type: "function",
    name: "cancelOrReduceOrder",
    inputs: [
      { name: "_token0", type: "address" },
      { name: "_token1", type: "address" },
      { name: "_amount0Close", type: "uint256" },
      { name: "_orderId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const tokenDecimalsMap: Record<Address, number> = {
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0": 6, // USDC
  "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9": 18, // PEPE
  "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9": 18, // WETH
};

// 1. Accept props from the market page
export function CancelReduceOrderForm({
  defaultToken0,
  defaultToken1,
}: {
  defaultToken0: Address;
  defaultToken1: Address;
}) {
  const { isConnected } = useAccount();

  // 2. Remove internal state for tokens
  // const [token0, setToken0] = useState<Address>(...);
  // const [token1, setToken1] = useState<Address>(...);
  const [amount0Close, setAmount0Close] = useState("");
  const [orderId, setOrderId] = useState("");

  // 3. Use the 'defaultToken0' prop directly
  const token0 = defaultToken0;
  const token1 = defaultToken1;
  const token0Decimals = tokenDecimalsMap[token0] ?? 18;

  // ... (Wagmi hooks remain the same) ...
  const {
    data: cancelReduceHash,
    error: cancelReduceError,
    status: cancelReduceStatus,
    writeContract: cancelReduceWriteContract,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: cancelReduceHash });

  // 4. Handler now uses the 'token0' and 'token1' props
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !token0 || !token1 || !amount0Close || !orderId) return; // Use props

    try {
      const formattedAmount0Close = parseUnits(amount0Close, token0Decimals);
      const formattedOrderId = BigInt(orderId);

      cancelReduceWriteContract({
        address: p2pContractAddress,
        abi: p2pAbi,
        functionName: "cancelOrReduceOrder",
        args: [
          token0, // Use prop
          token1, // Use prop
          formattedAmount0Close,
          formattedOrderId,
        ],
      });
    } catch (err) {
      console.error("Formatting/submission error:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Cancel / Reduce Order</h3>

      {/* 5. Remove the input fields for token0 and token1 */}
      {/* <div>
        <label>
          Token Sold in Order (token0):
          <input ... />
        </label>
      </div>
      <div>
        <label>
          Token Bought in Order (token1):
          <input ... />
        </label>
      </div> */}

      <div>
        <label>
          Order ID to Modify:
          <input
            type="number"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g., 1 (from Order Book)"
          />
        </label>
      </div>
      <div>
        <label>
          Amount to Cancel/Reduce (amount0Close):
          <input
            type="text"
            value={amount0Close}
            onChange={(e) => setAmount0Close(e.target.value)}
            placeholder={`e.g., 0.5 (${token0Decimals} decimals)`}
          />
        </label>
      </div>

      {/* ... (Submit button and Feedback section remain the same) ... */}
      <button
        type="submit"
        disabled={
          isConfirming ||
          !isConnected ||
          !amount0Close ||
          !orderId ||
          !token0 ||
          !token1
        }
      >
        {isConfirming ? "Confirming..." : "Cancel / Reduce Order"}
      </button>

      {/* --- Feedback Section --- */}
      {cancelReduceStatus === "pending" && (
        <p>Waiting for confirmation in wallet...</p>
      )}
      {isConfirming && <p>Processing transaction...</p>}
      {isConfirmed && (
        <p className="success-message">
          Order cancelled/reduced successfully! Transaction hash:{" "}
          {cancelReduceHash}
        </p>
      )}
      {cancelReduceStatus === "error" && (
        <p className="error-message">
          Error:{" "}
          {(cancelReduceError as BaseError)?.shortMessage ||
            cancelReduceError?.message}
        </p>
      )}
    </form>
  );
}
