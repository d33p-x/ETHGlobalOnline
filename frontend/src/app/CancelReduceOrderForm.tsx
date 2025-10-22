// frontend/src/app/CancelReduceOrderForm.tsx
"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { foundry } from "wagmi/chains"; // Your chain config
import { type Address, BaseError, parseUnits } from "viem";

// --- Config ---
// ⚠️ Make sure this matches your deployed P2P contract
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Example, update if needed

// ABI for P2P cancelOrReduceOrder function
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

// --- Hardcoded Decimals (Based on DeployLocal.s.sol) ---
// Ideally, fetch this dynamically from the Market struct or token contract
const tokenDecimalsMap: Record<Address, number> = {
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0": 6, // USDC
  "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9": 18, // PEPE
  "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9": 18, // WETH
};

export function CancelReduceOrderForm() {
  const { isConnected } = useAccount();

  // --- Form State ---
  const [token0, setToken0] = useState<Address>(
    "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" // Default WETH
  );
  const [token1, setToken1] = useState<Address>(
    "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" // Default USDC
  );
  const [amount0Close, setAmount0Close] = useState("");
  const [orderId, setOrderId] = useState("");

  // --- Get Token 0 Decimals ---
  const token0Decimals = tokenDecimalsMap[token0] ?? 18; // Default to 18 if unknown

  // --- Wagmi Hooks for Writing Contracts ---
  const {
    data: cancelReduceHash,
    error: cancelReduceError,
    status: cancelReduceStatus,
    writeContract: cancelReduceWriteContract,
  } = useWriteContract();

  // --- Monitor Transaction Confirmation ---
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: cancelReduceHash });

  // --- Handle Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !token0 || !token1 || !amount0Close || !orderId) return;

    try {
      const formattedAmount0Close = parseUnits(amount0Close, token0Decimals);
      const formattedOrderId = BigInt(orderId); // Convert orderId string to bigint

      cancelReduceWriteContract({
        address: p2pContractAddress,
        abi: p2pAbi,
        functionName: "cancelOrReduceOrder",
        args: [token0, token1, formattedAmount0Close, formattedOrderId],
      });
    } catch (err) {
      console.error("Formatting/submission error:", err);
      // Display error to user if needed
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Cancel / Reduce Order</h3>
      <div
        style={{
          marginBottom: "10px",
          padding: "10px",
          backgroundColor: "#f0f0f0",
          color: "#000",
        }}
      >
        <small style={{ color: "#000" }}>
          <strong>Instructions:</strong>
          <br />
          1. Enter the Token 0 (sold) and Token 1 (bought) addresses for the
          market.
          <br />
          2. Enter the Order ID you want to modify (from the Order List above).
          <br />
          3. Enter the amount of Token 0 you want to cancel/reduce. To cancel
          fully, enter the remaining amount.
          <br />
          4. Only the original order creator (maker) can cancel/reduce.
        </small>
      </div>
      <div>
        <label>
          Token Sold in Order (token0):
          <input
            type="text"
            value={token0}
            onChange={(e) => setToken0(e.target.value as Address)}
            placeholder="0x... (e.g., WETH address)"
            style={{ width: "400px" }}
          />
        </label>
      </div>
      <div>
        <label>
          Token Bought in Order (token1):
          <input
            type="text"
            value={token1}
            onChange={(e) => setToken1(e.target.value as Address)}
            placeholder="0x... (e.g., USDC address)"
            style={{ width: "400px" }}
          />
        </label>
      </div>
      <div>
        <label>
          Order ID to Modify:
          <input
            type="number" // Use number input for ID
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g., 1"
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

      {/* --- Submit Button Logic --- */}
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
        <p style={{ color: "green" }}>
          Order cancelled/reduced successfully! Transaction hash:{" "}
          {cancelReduceHash}
        </p>
      )}
      {cancelReduceStatus === "error" && (
        <p style={{ color: "red" }}>
          Error:{" "}
          {(cancelReduceError as BaseError)?.shortMessage ||
            cancelReduceError?.message}
        </p>
      )}
    </form>
  );
}
