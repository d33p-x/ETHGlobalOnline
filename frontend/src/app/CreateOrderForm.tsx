// src/app/CreateOrderForm.tsx
"use client";
import { foundry } from "wagmi/chains";
import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt, // <--- 1. Fixed import
  useReadContract, // <--- 1. Fixed import
  useBalance,
} from "wagmi";
import {
  type Address,
  BaseError,
  parseUnits, // <--- 2. Fixed import
  formatUnits, // <--- 2. Fixed import
  maxUint256,
} from "viem";
import { erc20Abi } from "viem";
import { tokenInfoMap } from "@/app/tokenConfig"; // <-- 1. Import
import { type TokenInfo } from "@/app/tokenConfig"; // (Optional, but good practice)

// ... (Config and ABI remain the same) ...
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

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

// 3. --- Fix for token map ---
// Define a type for the token info
// type TokenInfo = { decimals: number; symbol: string };

// Update the map type and content

export function CreateOrderForm({
  defaultToken0,
  defaultToken1,
}: {
  defaultToken0: Address;
  defaultToken1: Address;
}) {
  const { address: userAddress, isConnected, chain } = useAccount();

  const [amount0, setAmount0] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [needsApproval, setNeedsApproval] = useState(false);

  const token0 = defaultToken0;
  const token1 = defaultToken1;
  // 3. Get decimals from the new 'tokenInfoMap'
  const token0Decimals = tokenInfoMap[token0]?.decimals ?? 18;

  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useBalance({
    address: userAddress,
    token: token0,
    chainId: foundry.id,
    query: {
      enabled: isConnected && !!token0 && token0 !== "0x",
    },
  });

  useEffect(() => {
    if (!isLoadingBalance) {
      console.log("Balance Data:", balanceData);
      if (balanceError) {
        console.error("Balance Error:", balanceError);
      }
    }
  }, [balanceData, isLoadingBalance, balanceError]);

  const {
    data: allowance,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance,
    error: allowanceError,
    status: allowanceStatus,
  } = useReadContract({
    // <--- Was missing
    address: token0,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      userAddress && p2pContractAddress
        ? [userAddress, p2pContractAddress]
        : undefined,
    chainId: foundry.id,
    query: {
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

  useEffect(() => {
    console.log("Allowance Hook Status:", allowanceStatus);
    if (isLoadingAllowance) {
      console.log("Allowance: Loading...");
    }
    if (allowance !== undefined) {
      console.log("Allowance Value:", allowance, typeof allowance);
    }
    if (allowanceError) {
      console.error("Allowance Error:", allowanceError);
    }
  }, [allowance, isLoadingAllowance, allowanceError, allowanceStatus]);

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

  const { isLoading: isApproving, isSuccess: isApproved } =
    useWaitForTransactionReceipt({ hash: approveHash }); // <--- Was missing
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: createOrderHash }); // <--- Was missing

  useEffect(() => {
    console.log(
      `Checking needsApproval: allowance=${allowance}, amount0=${amount0}, token0Decimals=${token0Decimals}`
    );
    if (allowance === undefined || !amount0 || !token0Decimals) {
      if (needsApproval) {
        console.log(
          "Setting needsApproval to false (inputs missing or allowance undefined)"
        );
        setNeedsApproval(false);
      }
      return;
    }

    try {
      const requiredAmount = parseUnits(amount0, token0Decimals); // <--- Was missing
      const shouldNeedApproval = allowance < requiredAmount;
      console.log(
        `Allowance check: Required=${requiredAmount}, Has=${allowance}, ShouldNeedApproval=${shouldNeedApproval}`
      );
      if (needsApproval !== shouldNeedApproval) {
        console.log(`Setting needsApproval to ${shouldNeedApproval}`);
        setNeedsApproval(shouldNeedApproval);
      }
    } catch (error) {
      console.error("Error parsing amount for allowance check:", error);
      if (needsApproval) {
        console.log("Setting needsApproval to false (parse error)");
        setNeedsApproval(false);
      }
    }
  }, [
    allowance,
    amount0,
    token0Decimals,
    userAddress,
    p2pContractAddress,
    needsApproval,
  ]);

  useEffect(() => {
    if (isApproved) {
      refetchAllowance();
    }
  }, [isApproved, refetchAllowance]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token0 || !amount0) return;

    approveWriteContract({
      address: token0,
      abi: erc20Abi,
      functionName: "approve",
      args: [p2pContractAddress, maxUint256],
    });
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsApproval || !token0 || !token1 || !amount0) return;

    try {
      const formattedAmount0 = parseUnits(amount0, token0Decimals); // <--- Was missing
      const formattedMaxPrice = maxPrice ? parseUnits(maxPrice, 18) : 0n; // <--- Was missing
      const formattedMinPrice = minPrice ? parseUnits(minPrice, 18) : 0n; // <--- Was missing

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
    }
  };

  return (
    <form onSubmit={needsApproval ? handleApprove : handleCreateOrder}>
      {/* 3. Get symbol from the new 'tokenInfoMap' */}
      <h3>Create Order (Sell {tokenInfoMap[token0]?.symbol ?? "Token"})</h3>
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
                  ? `${formatUnits(balanceData.value, balanceData.decimals)} ${
                      // <--- Was missing
                      balanceData.symbol
                    }`
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
