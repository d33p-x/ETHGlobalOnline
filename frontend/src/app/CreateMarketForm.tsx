"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { type Address, BaseError } from "viem";
import { P2P_CONTRACT_ADDRESS, TOKEN_ADDRESSES } from "./config";

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
  // Default to WETH and USDC from config
  const [token0, setToken0] = useState<Address>(TOKEN_ADDRESSES.WETH);
  const [token1, setToken1] = useState<Address>(TOKEN_ADDRESSES.USDC);

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
      address: P2P_CONTRACT_ADDRESS,
      abi: p2pAbi,
      functionName: "createMarket",
      args: [token0, token1],
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Create Market</h3>
      <div>
        <label>
          Token 0 (e.g., WETH):
          <input
            type="text"
            value={token0}
            onChange={(e) => setToken0(e.target.value as Address)}
            placeholder="0x... (from deploy script output)"
            className="form-input-wide"
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
            className="form-input-wide"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={status === "pending" || !token0 || !token1}
      >
        {status === "pending" ? "Confirming..." : "Create Market"}
      </button>

      {/* --- Feedback Section --- */}
      <div>
        {status === "pending" && <p>Waiting for wallet approval...</p>}
        {isConfirming && <p>Transaction sent, confirming...</p>}
        {isConfirmed && (
          <p className="success-message">
            Market created successfully! Check the Market List above.
            <br />
            Transaction hash: {hash}
          </p>
        )}
        {status === "error" && (
          <div className="error-message">
            <p>
              <strong>Error:</strong>{" "}
              {(error as BaseError)?.shortMessage || error?.message}
            </p>
            <details>
              <summary>Full error details</summary>
              <pre className="error-details">
                {JSON.stringify(error, null, 2)}
              </pre>
            </details>
            <p>
              <strong>Common issues:</strong>
              <br />
              - Tokens don't have price feeds set (check deploy script ran
              correctly)
              <br />
              - Wrong contract address (check P2P contract was deployed)
              <br />- Not connected to Anvil network (Chain ID should be 31337)
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
