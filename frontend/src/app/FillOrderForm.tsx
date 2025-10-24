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
import { tokenInfoMap } from "@/app/tokenConfig";
import { P2P_CONTRACT_ADDRESS } from "./config";

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

export function FillOrderForm({
  defaultToken0,
  defaultToken1,
}: {
  defaultToken0: Address;
  defaultToken1: Address;
}) {
  const { address: userAddress, isConnected, chain } = useAccount();

  const [amount1, setAmount1] = useState("");
  const [needsApproval, setNeedsApproval] = useState(false);

  const token0 = defaultToken0;
  const token1 = defaultToken1;
  const token0Symbol = tokenInfoMap[token0]?.symbol ?? "Token";
  const token1Symbol = tokenInfoMap[token1]?.symbol ?? "Token";
  const token1Decimals = tokenInfoMap[token1]?.decimals ?? 18;

  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useBalance({
    address: userAddress,
    token: token1,
    chainId: foundry.id,
    query: {
      enabled: isConnected && !!token1 && token1 !== "0x",
    },
  });

  const {
    data: allowance,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance,
  } = useReadContract({
    address: token1,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      userAddress && P2P_CONTRACT_ADDRESS
        ? [userAddress, P2P_CONTRACT_ADDRESS]
        : undefined,
    chainId: foundry.id,
    query: {
      enabled:
        isConnected &&
        !!userAddress &&
        !!token1 &&
        token1 !== "0x" &&
        !!P2P_CONTRACT_ADDRESS &&
        !!amount1 &&
        chain?.id === foundry.id,
    },
  });

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

  const { isLoading: isApproving, isSuccess: isApproved } =
    useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: fillOrderHash });

  useEffect(() => {
    if (allowance === undefined || !amount1 || !token1Decimals) {
      if (needsApproval) {
        setNeedsApproval(false);
      }
      return;
    }

    try {
      const requiredAmount = parseUnits(amount1, token1Decimals);
      const shouldNeedApproval = allowance < requiredAmount;
      if (needsApproval !== shouldNeedApproval) {
        setNeedsApproval(shouldNeedApproval);
      }
    } catch (error) {
      if (needsApproval) {
        setNeedsApproval(false);
      }
    }
  }, [allowance, amount1, token1Decimals, needsApproval]);

  useEffect(() => {
    if (isApproved) {
      refetchAllowance();
    }
  }, [isApproved, refetchAllowance]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token1 || !amount1) return;

    approveWriteContract({
      address: token1,
      abi: erc20Abi,
      functionName: "approve",
      args: [P2P_CONTRACT_ADDRESS, maxUint256],
    });
  };

  const handleFillOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsApproval || !token0 || !token1 || !amount1) return;

    try {
      const formattedAmount1 = parseUnits(amount1, token1Decimals);
      const priceUpdateArray: `0x${string}`[] = [];

      fillOrderWriteContract({
        address: P2P_CONTRACT_ADDRESS,
        abi: p2pAbi,
        functionName: "fillOrderExactAmountIn",
        args: [priceUpdateArray, token0, token1, formattedAmount1],
      });
    } catch (err) {
      console.error("Formatting/submission error:", err);
    }
  };

  const setPercentage = (percent: number) => {
    if (!balanceData) return;
    const balance = formatUnits(balanceData.value, balanceData.decimals);
    const percentAmount = (parseFloat(balance) * percent) / 100;
    setAmount1(percentAmount.toFixed(token1Decimals > 6 ? 6 : token1Decimals));
  };

  const balance = balanceData
    ? formatUnits(balanceData.value, balanceData.decimals)
    : "0";

  return (
    <div style={styles.container}>
      {/* Balance Section */}
      <div style={styles.balanceSection}>
        <div style={styles.balanceLabel}>Available Balance</div>
        <div style={styles.balanceAmount}>
          {isLoadingBalance ? (
            <span className="loading">Loading...</span>
          ) : balanceError ? (
            <span style={{ color: "var(--error)" }}>Error</span>
          ) : (
            <>
              {balance} <span style={styles.tokenSymbol}>{token1Symbol}</span>
            </>
          )}
        </div>
      </div>

      {/* Amount Input */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>
          Amount to Spend
          <span style={styles.tooltip} title={`Spend ${token1Symbol} to buy ${token0Symbol}`}>
            ⓘ
          </span>
        </label>
        <div style={styles.inputWrapper}>
          <input
            type="text"
            value={amount1}
            onChange={(e) => setAmount1(e.target.value)}
            placeholder="0.0"
            style={styles.input}
          />
          <button
            type="button"
            onClick={() => setPercentage(100)}
            style={styles.maxButton}
          >
            MAX
          </button>
        </div>

        {/* Percentage Buttons */}
        <div style={styles.percentButtons}>
          {[25, 50, 75, 100].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => setPercentage(percent)}
              style={styles.percentButton}
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>

      {/* Info Message */}
      <div style={styles.infoBox}>
        <span style={styles.infoIcon}>ℹ️</span>
        <div style={styles.infoText}>
          You'll buy {token0Symbol} at the exact oracle price (zero slippage)
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        onClick={needsApproval ? handleApprove : handleFillOrder}
        disabled={isApproving || isConfirming || !isConnected || !amount1}
        style={{
          ...styles.submitButton,
          ...(needsApproval ? styles.approveButton : styles.buyButton),
        }}
      >
        {isApproving ? (
          <span>⏳ Approving...</span>
        ) : needsApproval ? (
          <span>✓ Approve {token1Symbol}</span>
        ) : isConfirming ? (
          <span>⏳ Filling Order...</span>
        ) : (
          <span>📈 Buy {token0Symbol}</span>
        )}
      </button>

      {/* Feedback Messages */}
      {approveStatus === "pending" && (
        <div style={styles.infoMessage}>
          <span>💡</span> Check your wallet to confirm approval
        </div>
      )}
      {isApproved && !needsApproval && (
        <div style={styles.successMessage}>
          <span>✓</span> Approval successful! You can now buy {token0Symbol}.
        </div>
      )}
      {approveStatus === "error" && (
        <div style={styles.errorMessage}>
          <span>⚠</span>{" "}
          {(approveError as BaseError)?.shortMessage || approveError?.message}
        </div>
      )}

      {fillOrderStatus === "pending" && (
        <div style={styles.infoMessage}>
          <span>💡</span> Check your wallet to confirm the transaction
        </div>
      )}
      {isConfirmed && (
        <div style={styles.successMessage}>
          <span>✓</span> Order filled! Check your balance.
        </div>
      )}
      {fillOrderStatus === "error" && (
        <div style={styles.errorMessage}>
          <span>⚠</span>{" "}
          {(fillOrderError as BaseError)?.shortMessage ||
            fillOrderError?.message}
        </div>
      )}

      {!isConnected && (
        <div style={styles.warningMessage}>
          <span>⚠</span> Connect your wallet to buy
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.25rem",
  },

  balanceSection: {
    padding: "1rem",
    background: "rgba(0, 245, 255, 0.05)",
    borderRadius: "0.5rem",
    border: "1px solid rgba(0, 245, 255, 0.15)",
  },

  balanceLabel: {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    marginBottom: "0.25rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },

  balanceAmount: {
    fontSize: "1.5rem",
    fontWeight: "600",
    color: "var(--text-primary)",
  },

  tokenSymbol: {
    fontSize: "1rem",
    color: "var(--text-secondary)",
    marginLeft: "0.5rem",
  },

  inputGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },

  label: {
    fontSize: "0.875rem",
    fontWeight: "500",
    color: "var(--text-secondary)",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },

  tooltip: {
    cursor: "help",
    opacity: 0.5,
    fontSize: "0.875rem",
  },

  inputWrapper: {
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
  },

  input: {
    width: "100%",
    padding: "1rem",
    paddingRight: "5rem",
    fontSize: "1.25rem",
    fontWeight: "500",
    background: "var(--bg-tertiary)",
    border: "2px solid var(--border-color)",
    borderRadius: "0.5rem",
    color: "var(--text-primary)",
    transition: "all 0.3s ease",
  },

  maxButton: {
    position: "absolute" as const,
    right: "0.5rem",
    padding: "0.5rem 1rem",
    background: "rgba(0, 245, 255, 0.2)",
    border: "1px solid #00f5ff",
    borderRadius: "0.375rem",
    color: "#00f5ff",
    fontSize: "0.75rem",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  percentButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "0.5rem",
  },

  percentButton: {
    padding: "0.5rem",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border-color)",
    borderRadius: "0.375rem",
    color: "var(--text-secondary)",
    fontSize: "0.75rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  infoBox: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.875rem",
    background: "rgba(0, 245, 255, 0.05)",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    borderRadius: "0.5rem",
  },

  infoIcon: {
    fontSize: "1.25rem",
  },

  infoText: {
    fontSize: "0.75rem",
    color: "#00f5ff",
    lineHeight: "1.4",
  },

  submitButton: {
    width: "100%",
    padding: "1rem",
    fontSize: "1rem",
    fontWeight: "600",
    border: "none",
    borderRadius: "0.5rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    marginTop: "0.5rem",
  },

  approveButton: {
    background: "rgba(59, 130, 246, 0.2)",
    color: "#60a5fa",
    border: "2px solid #3b82f6",
  },

  buyButton: {
    background: "rgba(0, 245, 255, 0.2)",
    color: "#00f5ff",
    border: "2px solid #00f5ff",
    boxShadow: "0 0 20px rgba(0, 245, 255, 0.2)",
  },

  successMessage: {
    padding: "0.75rem",
    background: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    borderRadius: "0.375rem",
    color: "#10b981",
    fontSize: "0.875rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },

  errorMessage: {
    padding: "0.75rem",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "0.375rem",
    color: "#ef4444",
    fontSize: "0.875rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },

  infoMessage: {
    padding: "0.75rem",
    background: "rgba(59, 130, 246, 0.1)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: "0.375rem",
    color: "#60a5fa",
    fontSize: "0.875rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },

  warningMessage: {
    padding: "0.75rem",
    background: "rgba(245, 158, 11, 0.1)",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    borderRadius: "0.375rem",
    color: "#f59e0b",
    fontSize: "0.875rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
};
