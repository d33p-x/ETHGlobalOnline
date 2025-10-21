"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { type Address, BaseError } from "viem";

// --- Contract Address ---
// ⚠️ UPDATE THIS with your deployed P2P.sol contract address
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

// --- ABI for createMarket ---
// The minimal ABI just for the createMarket function
const p2pAbi = [
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { name: "_token0", type: "address" },
      { name: "_token1", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export function CreateMarketForm() {
  // --- Form State ---
  // Default to WETH and USDC from deploy script
  const [token0, setToken0] = useState<Address>("0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"); // WETH
  const [token1, setToken1] = useState<Address>("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"); // USDC

  // --- Wagmi Hook ---
  const { writeContract, data: hash, status, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });
  // --- Handle Submit Function ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // The arguments are already in the correct format (Address)
    writeContract({
      address: p2pContractAddress,
      abi: p2pAbi,
      functionName: "createMarket",
      args: [token0, token1],
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Create Market</h3>
      <div style={{ marginBottom: "10px", padding: "10px", backgroundColor: "#f0f0f0", color: "#000" }}>
        <small style={{ color: "#000" }}>
          <strong>Instructions:</strong>
          <br />
          1. Default addresses are WETH and USDC from deploy script
          <br />
          2. You can change to other tokens (USDC, PEPE, or WETH)
          <br />
          3. Make sure you're connected to Anvil (Chain ID: 31337)
        </small>
      </div>
      <div>
        <label>
          Token 0 (e.g., WETH):
          <input
            type="text"
            value={token0}
            onChange={(e) => setToken0(e.target.value as Address)}
            placeholder="0x... (from deploy script output)"
            style={{ width: "400px" }}
          />
        </label>
      </div>
      <div>
        <label>
          Token 1 (e.g., USDC):
          <input
            type="text"
            value={token1}
            onChange={(e) => setToken1(e.target.value as Address)}
            placeholder="0x... (from deploy script output)"
            style={{ width: "400px" }}
          />
        </label>
      </div>

      <button type="submit" disabled={status === "pending" || !token0 || !token1}>
        {status === "pending" ? "Confirming..." : "Create Market"}
      </button>

      {/* --- Feedback Section --- */}
      <div>
        {status === "pending" && <p>Waiting for wallet approval...</p>}
        {isConfirming && <p>Transaction sent, confirming...</p>}
        {isConfirmed && (
          <p style={{ color: "green" }}>
            Market created successfully! Check the Market List above.
            <br />
            Transaction hash: {hash}
          </p>
        )}
        {status === "error" && (
          <div style={{ color: "red" }}>
            <p><strong>Error:</strong> {(error as BaseError)?.shortMessage || error?.message}</p>
            <details>
              <summary>Full error details</summary>
              <pre style={{ fontSize: "10px", overflow: "auto" }}>
                {JSON.stringify(error, null, 2)}
              </pre>
            </details>
            <p>
              <strong>Common issues:</strong>
              <br />
              - Tokens don't have price feeds set (check deploy script ran correctly)
              <br />
              - Wrong contract address (check P2P contract was deployed)
              <br />
              - Not connected to Anvil network (Chain ID should be 31337)
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
