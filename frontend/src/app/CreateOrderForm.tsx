"use client";
import { foundry } from "wagmi/chains"; // Make sure foundry is imported
import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useBalance,
} from "wagmi";
import {
  type Address,
  BaseError,
  parseUnits,
  formatUnits,
  maxUint256,
} from "viem";
import { erc20Abi } from "viem"; // Viem includes standard ABIs

// --- Config ---
// ⚠️ Make sure this matches your deployed P2P contract
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Example, update if needed

// ABI for P2P createOrder function
const p2pAbi = [
  {
    type: "function",
    name: "createOrder",
    inputs: [
      { name: "_token0", type: "address" },
      { name: "_token1", type: "address" },
      { name: "_amount0", type: "uint256" },
      { name: "_maxPrice", type: "uint256" },
      { name: "_minPrice", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
// @todo change the 0n to 0n again in all files
// --- Hardcoded Decimals (Based on DeployLocal.s.sol) ---
// Ideally, fetch this dynamically from the Market struct or token contract
const tokenDecimalsMap: Record<Address, number> = {
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0": 6, // USDC
  "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9": 18, // PEPE
  "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9": 18, // WETH
};

export function CreateOrderForm() {
  const { address: userAddress, isConnected, chain } = useAccount(); // Add chain

  // --- Form State ---
  const [token0, setToken0] = useState<Address>(
    "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" // Default WETH
  );
  const [token1, setToken1] = useState<Address>(
    "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" // Default USDC
  );
  const [amount0, setAmount0] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [needsApproval, setNeedsApproval] = useState(false);

  // --- Get Token 0 Decimals ---
  const token0Decimals = tokenDecimalsMap[token0] ?? 18; // Default to 18 if unknown

  // --- Get User Balance ---
  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useBalance({
    // Added balanceError
    address: userAddress,
    token: token0, // Address of the token to check balance for
    chainId: foundry.id, // Explicitly target Anvil
    query: {
      enabled: isConnected && !!token0 && token0 !== "0x", // Only run if connected and token0 is set
    },
  });

  // Add a log to see what the balance hook returns
  useEffect(() => {
    if (!isLoadingBalance) {
      console.log("Balance Data:", balanceData);
      if (balanceError) {
        console.error("Balance Error:", balanceError);
      }
    }
  }, [balanceData, isLoadingBalance, balanceError]);

  // --- Check Allowance ---
  const {
    data: allowance,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance, // Add isLoading state
    error: allowanceError, // Add error state
    status: allowanceStatus, // Add status state
  } = useReadContract({
    address: token0,
    abi: erc20Abi,
    functionName: "allowance",
    // Ensure args are valid before enabling the query
    args:
      userAddress && p2pContractAddress
        ? [userAddress, p2pContractAddress]
        : undefined,
    chainId: foundry.id, // Explicitly target Anvil
    query: {
      // Enable only when all necessary pieces are available
      enabled:
        isConnected &&
        !!userAddress &&
        !!token0 &&
        token0 !== "0x" &&
        !!p2pContractAddress &&
        !!amount0 &&
        chain?.id === foundry.id,
    },
  });

  // --- Add Logging for Allowance Hook Results ---
  useEffect(() => {
    console.log("Allowance Hook Status:", allowanceStatus);
    if (isLoadingAllowance) {
      console.log("Allowance: Loading...");
    }
    if (allowance !== undefined) {
      console.log("Allowance Value:", allowance, typeof allowance); // Log value and type
    }
    if (allowanceError) {
      console.error("Allowance Error:", allowanceError);
    }
  }, [allowance, isLoadingAllowance, allowanceError, allowanceStatus]);
  // --- End Logging ---

  // --- Wagmi Hooks for Writing Contracts ---
  const {
    data: approveHash,
    error: approveError,
    status: approveStatus,
    writeContract: approveWriteContract,
  } = useWriteContract();

  const {
    data: createOrderHash,
    error: createOrderError,
    status: createOrderStatus,
    writeContract: createOrderWriteContract,
  } = useWriteContract();

  // --- Monitor Transaction Confirmation ---
  const { isLoading: isApproving, isSuccess: isApproved } =
    useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: createOrderHash });

  // --- Logic to check if approval is needed ---
  useEffect(() => {
    console.log(
      `Checking needsApproval: allowance=${allowance}, amount0=${amount0}, token0Decimals=${token0Decimals}`
    ); // Log inputs
    // Reset needsApproval if inputs are missing or allowance hasn't loaded
    if (allowance === undefined || !amount0 || !token0Decimals) {
      if (needsApproval) {
        // Only update state if it changes
        console.log(
          "Setting needsApproval to false (inputs missing or allowance undefined)"
        );
        setNeedsApproval(false);
      }
      return;
    }

    try {
      const requiredAmount = parseUnits(amount0, token0Decimals);
      const shouldNeedApproval = allowance < requiredAmount;
      console.log(
        `Allowance check: Required=${requiredAmount}, Has=${allowance}, ShouldNeedApproval=${shouldNeedApproval}`
      );
      if (needsApproval !== shouldNeedApproval) {
        // Only update state if it changes
        console.log(`Setting needsApproval to ${shouldNeedApproval}`);
        setNeedsApproval(shouldNeedApproval);
      }
    } catch (error) {
      console.error("Error parsing amount for allowance check:", error);
      if (needsApproval) {
        // Only update state if it changes
        console.log("Setting needsApproval to false (parse error)");
        setNeedsApproval(false);
      }
    }
    // Add userAddress and p2pContractAddress as dependencies to ensure args are stable when checking
  }, [
    allowance,
    amount0,
    token0Decimals,
    userAddress,
    p2pContractAddress,
    needsApproval,
  ]); // Added needsApproval

  // --- Refetch allowance after approval succeeds ---
  useEffect(() => {
    if (isApproved) {
      refetchAllowance();
    }
  }, [isApproved, refetchAllowance]);

  // --- Handle Approve ---
  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token0 || !amount0) return;

    approveWriteContract({
      address: token0,
      abi: erc20Abi,
      functionName: "approve",
      args: [p2pContractAddress, maxUint256], // Approve "infinite" amount
    });
  };

  // --- Handle Create Order ---
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsApproval || !token0 || !token1 || !amount0) return;

    try {
      const formattedAmount0 = parseUnits(amount0, token0Decimals);
      // Prices are normalized to 18 decimals
      const formattedMaxPrice = maxPrice ? parseUnits(maxPrice, 18) : 0n; // Use 0n
      const formattedMinPrice = minPrice ? parseUnits(minPrice, 18) : 0n; // Use 0n

      createOrderWriteContract({
        address: p2pContractAddress,
        abi: p2pAbi,
        functionName: "createOrder",
        args: [
          token0,
          token1,
          formattedAmount0,
          formattedMaxPrice,
          formattedMinPrice,
        ],
      });
    } catch (err) {
      console.error("Formatting/submission error:", err);
      // Display error to user if needed
    }
  };

  return (
    <form onSubmit={needsApproval ? handleApprove : handleCreateOrder}>
      <h3>Create Order</h3>
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
          1. Enter Token 0 (to sell) and Token 1 (to buy) addresses from the
          Market List above.
          <br />
          2. Enter the amount of Token 0 you want to sell.
          <br />
          3. Your wallet balance for Token 0 will be shown.
          <br />
          4. You may need to click "Approve" first before creating the order.
          <br />
          5. Prices are optional (0 means no limit).
        </small>
      </div>
      <div>
        <label>
          Token to Sell (token0):
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
          Token to Buy (token1):
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
          Amount to Sell (amount0):
          <input
            type="text"
            value={amount0}
            onChange={(e) => setAmount0(e.target.value)}
            placeholder={`e.g., 1.5 (${token0Decimals} decimals)`}
          />
        </label>
        {isConnected && token0 && token0 !== "0x" && (
          <span
            style={{ marginLeft: "10px", fontSize: "small", color: "#aaa" }}
          >
            Balance:{" "}
            {isLoadingBalance
              ? "Loading..."
              : balanceError
                ? `Error: ${balanceError.message}`
                : balanceData
                  ? `${formatUnits(balanceData.value, balanceData.decimals)} ${balanceData.symbol}`
                  : "N/A"}
          </span>
        )}
      </div>
      <div>
        <label>
          Max Price (USD, 18 decimals):
          <input
            type="text"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="e.g., 3000.50 (Optional)"
          />
        </label>
      </div>
      <div>
        <label>
          Min Price (USD, 18 decimals):
          <input
            type="text"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="e.g., 2950.00 (Optional)"
          />
        </label>
      </div>

      {/* Add this section somewhere visible in the form for debugging */}
      <div
        style={{
          border: "1px dashed grey",
          padding: "5px",
          margin: "10px 0",
          fontSize: "10px",
        }}
      >
        <p>DEBUG:</p>
        <p>isConnected: {isConnected ? "true" : "false"}</p>
        <p>userAddress: {userAddress?.toString()}</p>
        <p>token0: {token0}</p>
        <p>amount0: {amount0}</p>
        <p>allowance Status: {allowanceStatus}</p>
        <p>allowance isLoading: {isLoadingAllowance ? "true" : "false"}</p>
        <p>
          allowance Value: {allowance?.toString()} ({typeof allowance})
        </p>
        <p>allowance Error: {allowanceError?.message}</p>
        <p>token0Decimals: {token0Decimals}</p>
        <p>needsApproval State: {needsApproval ? "true" : "false"}</p>
      </div>

      {/* --- Submit Button Logic --- */}
      <button
        type="submit"
        disabled={isApproving || isConfirming || !isConnected || !amount0}
      >
        {isApproving
          ? "Approving..."
          : needsApproval
            ? `Approve ${balanceData?.symbol ?? "Token"}`
            : isConfirming
              ? "Confirming Order..."
              : "Create Order"}
      </button>

      {/* --- Feedback Section --- */}
      {approveStatus === "pending" && (
        <p>Waiting for approval confirmation in wallet...</p>
      )}
      {isApproving && <p>Processing approval transaction...</p>}
      {isApproved && !needsApproval && (
        <p style={{ color: "green" }}>
          Approval successful! You can now create the order.
        </p>
      )}
      {approveStatus === "error" && (
        <p style={{ color: "red" }}>
          Approval Error:{" "}
          {(approveError as BaseError)?.shortMessage || approveError?.message}
        </p>
      )}

      {createOrderStatus === "pending" && (
        <p>Waiting for order creation confirmation in wallet...</p>
      )}
      {isConfirming && <p>Processing create order transaction...</p>}
      {isConfirmed && (
        <p style={{ color: "green" }}>
          Order created successfully! Transaction hash: {createOrderHash}
        </p>
      )}
      {createOrderStatus === "error" && (
        <p style={{ color: "red" }}>
          Create Order Error:{" "}
          {(createOrderError as BaseError)?.shortMessage ||
            createOrderError?.message}
        </p>
      )}
    </form>
  );
}
