// src/app/FillOrderForm.tsx
"use client";
import { foundry } from "wagmi/chains";
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
import { erc20Abi } from "viem";
import { tokenInfoMap } from "@/app/tokenConfig"; // <-- 1. Import
import { type TokenInfo } from "@/app/tokenConfig"; // (Optional)

// --- Config ---
const p2pContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

// ABI for P2P fillOrderExactAmountIn function
const p2pAbi = [
  {
    type: "function",
    name: "fillOrderExactAmountIn",
    inputs: [
      { name: "priceUpdate", type: "bytes[]" },
      { name: "_token0", type: "address" },
      { name: "_token1", type: "address" },
      { name: "_amount1", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// type TokenInfo = { decimals: number; symbol: string };

export function FillOrderForm({
  defaultToken0,
  defaultToken1,
}: {
  defaultToken0: Address;
  defaultToken1: Address;
}) {
  const { address: userAddress, isConnected, chain } = useAccount();

  // --- Form State ---
  const [amount1, setAmount1] = useState("");
  const [needsApproval, setNeedsApproval] = useState(false);

  // --- Props ---
  const token0 = defaultToken0;
  const token1 = defaultToken1;
  const token1Decimals = tokenInfoMap[token1]?.decimals ?? 18;

  // --- Get User Balance ---
  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useBalance({
    address: userAddress,
    token: token1, // Check balance of token1 (the token being spent)
    chainId: foundry.id,
    query: {
      enabled: isConnected && !!token1 && token1 !== "0x",
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

  // --- Check Allowance ---
  const {
    data: allowance,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance,
    error: allowanceError,
    status: allowanceStatus,
  } = useReadContract({
    address: token1,
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
        !!token1 &&
        token1 !== "0x" &&
        !!p2pContractAddress &&
        !!amount1 &&
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
      console.log("Allowance Value:", allowance, typeof allowance);
    }
    if (allowanceError) {
      console.error("Allowance Error:", allowanceError);
    }
  }, [allowance, isLoadingAllowance, allowanceError, allowanceStatus]);

  // --- Wagmi Hooks for Writing Contracts ---
  const {
    data: approveHash,
    error: approveError,
    status: approveStatus,
    writeContract: approveWriteContract,
  } = useWriteContract();

  const {
    data: fillOrderHash,
    error: fillOrderError,
    status: fillOrderStatus,
    writeContract: fillOrderWriteContract,
  } = useWriteContract();

  // --- Monitor Transaction Confirmation ---
  const { isLoading: isApproving, isSuccess: isApproved } =
    useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: fillOrderHash });

  // --- Logic to check if approval is needed ---
  useEffect(() => {
    console.log(
      `Checking needsApproval: allowance=${allowance}, amount1=${amount1}, token1Decimals=${token1Decimals}`
    );
    if (allowance === undefined || !amount1 || !token1Decimals) {
      if (needsApproval) {
        console.log(
          "Setting needsApproval to false (inputs missing or allowance undefined)"
        );
        setNeedsApproval(false);
      }
      return;
    }

    try {
      const requiredAmount = parseUnits(amount1, token1Decimals);
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
    amount1,
    token1Decimals,
    userAddress,
    p2pContractAddress,
    needsApproval,
  ]);

  // --- Refetch allowance after approval succeeds ---
  useEffect(() => {
    if (isApproved) {
      refetchAllowance();
    }
  }, [isApproved, refetchAllowance]);

  // --- Handle Approve ---
  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token1 || !amount1) return;

    approveWriteContract({
      address: token1,
      abi: erc20Abi,
      functionName: "approve",
      args: [p2pContractAddress, maxUint256],
    });
  };

  // --- Handle Fill Order ---
  const handleFillOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsApproval || !token0 || !token1 || !amount1) return;

    try {
      const formattedAmount1 = parseUnits(amount1, token1Decimals);

      // For local testing with MockPyth, always pass empty array
      const priceUpdateArray: `0x${string}`[] = [];

      fillOrderWriteContract({
        address: p2pContractAddress,
        abi: p2pAbi,
        functionName: "fillOrderExactAmountIn",
        args: [priceUpdateArray, token0, token1, formattedAmount1],
      });
    } catch (err) {
      console.error("Formatting/submission error:", err);
    }
  };

  return (
    <form onSubmit={needsApproval ? handleApprove : handleFillOrder}>
      <h3>Fill Order (Buy {tokenInfoMap[token0]?.symbol ?? "Token"})</h3>
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
          1. Enter Token 0 (to receive) and Token 1 (to spend) addresses from
          the Market List above.
          <br />
          2. Enter the amount of Token 1 you want to spend.
          <br />
          3. Your wallet balance for Token 1 will be shown.
          <br />
          4. You may need to click "Approve" first before filling the order.
          <br />
          5. The contract will fill orders at current oracle prices with a 0.01%
          buyer fee and 0.005% seller bonus.
        </small>
      </div>
      <div>
        <label>
          Amount to Spend (amount1):
          <input
            type="text"
            value={amount1}
            onChange={(e) => setAmount1(e.target.value)}
            placeholder={`e.g., 1000 (${token1Decimals} decimals)`}
          />
        </label>
        {isConnected && token1 && token1 !== "0x" && (
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
                      balanceData.symbol
                    }`
                  : "N/A"}
          </span>
        )}
      </div>

      {/* Debug Section */}
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
        <p>token1: {token1}</p>
        <p>amount1: {amount1}</p>
        <p>allowance Status: {allowanceStatus}</p>
        <p>allowance isLoading: {isLoadingAllowance ? "true" : "false"}</p>
        <p>
          allowance Value: {allowance?.toString()} ({typeof allowance})
        </p>
        <p>allowance Error: {allowanceError?.message}</p>
        <p>token1Decimals: {token1Decimals}</p>
        <p>needsApproval State: {needsApproval ? "true" : "false"}</p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isApproving || isConfirming || !isConnected || !amount1}
      >
        {isApproving
          ? "Approving..."
          : needsApproval
            ? `Approve ${balanceData?.symbol ?? "Token"}`
            : isConfirming
              ? "Confirming Fill Order..."
              : "Fill Order"}
      </button>

      {/* Feedback Section */}
      {approveStatus === "pending" && (
        <p>Waiting for approval confirmation in wallet...</p>
      )}
      {isApproving && <p>Processing approval transaction...</p>}
      {isApproved && !needsApproval && (
        <p style={{ color: "green" }}>
          Approval successful! You can now fill the order.
        </p>
      )}
      {approveStatus === "error" && (
        <p style={{ color: "red" }}>
          Approval Error:{" "}
          {(approveError as BaseError)?.shortMessage || approveError?.message}
        </p>
      )}

      {fillOrderStatus === "pending" && (
        <p>Waiting for fill order confirmation in wallet...</p>
      )}
      {isConfirming && <p>Processing fill order transaction...</p>}
      {isConfirmed && (
        <p style={{ color: "green" }}>
          Order filled successfully! Transaction hash: {fillOrderHash}
        </p>
      )}
      {fillOrderStatus === "error" && (
        <p style={{ color: "red" }}>
          Fill Order Error:{" "}
          {(fillOrderError as BaseError)?.shortMessage ||
            fillOrderError?.message}
        </p>
      )}
    </form>
  );
}
