// src/app/CreateOrderForm.tsx
"use client";
import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  useChainId,
} from "wagmi";
import {
  type Address,
  BaseError,
  parseUnits,
  formatUnits,
} from "viem";
import { useTokenRegistryContext } from "@/app/TokenRegistryContext";
import { getP2PAddress } from "./config";
import { p2pAbi } from "@/lib/contracts/abis";
import { useTokenApproval } from "@/hooks/useTokenApproval";
import { usePythPrice } from "@/hooks/usePythPrice";

export function CreateOrderForm({
  defaultToken0,
  defaultToken1,
}: {
  defaultToken0: Address;
  defaultToken1: Address;
}) {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);
  const { tokenInfoMap } = useTokenRegistryContext();

  const [amount0, setAmount0] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");

  const token0 = defaultToken0;
  const token1 = defaultToken1;
  const tokenInfo0 = tokenInfoMap[token0];
  const tokenInfo1 = tokenInfoMap[token1];
  const token0Symbol = tokenInfo0?.symbol ?? "Token";
  const token1Symbol = tokenInfo1?.symbol ?? "Token";
  const token0Decimals = tokenInfo0?.decimals ?? 18;

  const isWethMarket = tokenInfo0?.symbol === "WETH";

  // Use shared approval hook
  const {
    needsApproval,
    approve,
    approveHash,
    approveError,
    approveStatus,
    isApproving,
    isApproved,
  } = useTokenApproval({
    tokenAddress: token0,
    spenderAddress: p2pAddress,
    amount: amount0,
    tokenDecimals: token0Decimals,
  });

  // Use shared Pyth price hook
  const {
    pythUpdateData,
    isLoading: isPythLoading,
    error: pythError,
    fetchFreshPythData,
  } = usePythPrice({
    priceFeedIds: tokenInfo0?.priceFeedId ? [tokenInfo0.priceFeedId] : [],
    enabled: !!tokenInfo0?.priceFeedId,
  });

  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useBalance({
    address: userAddress,
    token: token0,
    chainId: chainId,
    query: {
      enabled: isConnected && !!token0 && token0 !== "0x",
    },
  });

  const {
    data: createOrderHash,
    error: createOrderError,
    status: createOrderStatus,
    writeContract: createOrderWriteContract,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: createOrderHash });

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    approve();
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsApproval || !token0 || !token1 || !amount0 || !tokenInfo0?.priceFeedId) {
      return;
    }

    try {
      // Fetch fresh Pyth data right before transaction
      const freshData = await fetchFreshPythData();
      if (!freshData) {
        throw new Error("Failed to fetch Pyth price data");
      }

      const formattedAmount0 = parseUnits(amount0, token0Decimals);
      const formattedMaxPrice = maxPrice ? parseUnits(maxPrice, 18) : 0n;
      const formattedMinPrice = minPrice ? parseUnits(minPrice, 18) : 0n;

      createOrderWriteContract({
        address: p2pAddress,
        abi: p2pAbi,
        functionName: "createOrder",
        args: [
          token0,
          token1,
          formattedAmount0,
          formattedMaxPrice,
          formattedMinPrice,
          freshData.priceUpdateArray,
        ],
        value: freshData.fee,
      });
    } catch (err) {
      console.error("An error occurred in handleCreateOrder:", err);
    }
  };

  const setPercentage = (percent: number) => {
    if (!balanceData) return;
    const balance = formatUnits(balanceData.value, balanceData.decimals);
    const percentAmount = (parseFloat(balance) * percent) / 100;
    setAmount0(percentAmount.toFixed(token0Decimals > 6 ? 6 : token0Decimals));
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
              {parseFloat(balance).toFixed(5)}{" "}
              <span style={styles.tokenSymbol}>{token0Symbol}</span>
            </>
          )}
        </div>
      </div>

      {/* Maker Fee Info */}
      <div style={styles.feeInfoBox}>
        <span style={styles.feeIcon}>💰</span>
        <div style={styles.feeText}>
          <strong>Maker Rebate: +0.05%</strong> - Earn a fee rebate for providing liquidity
        </div>
      </div>

      {/* Minimum Order Info */}
      <div style={styles.warningBox}>
        <span style={styles.infoIcon}>ℹ️</span>
        <div style={styles.infoText}>
          Minimum order value: $10 USD
        </div>
      </div>

      {/* Amount Input */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>
          Amount to Sell
          <span
            style={styles.tooltip}
            title="Amount of tokens you want to sell"
          >
            ⓘ
          </span>
        </label>
        <div style={styles.inputWrapper}>
          <input
            type="text"
            value={amount0}
            onChange={(e) => setAmount0(e.target.value)}
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

      {/* Exchange Rate Range */}

      <div style={styles.priceRange}>
        <div style={styles.priceInputs}>
          <div style={styles.priceInputGroup}>
            <label style={styles.smallLabel}>
              Min Exchange Rate (Optional)
              <span
                style={{ ...styles.tooltip, marginLeft: "0.25rem" }}
                title={`Minimum ${token1Symbol} per ${token0Symbol} you'll accept`}
              >
                ⓘ
              </span>
            </label>

            <input
              type="text"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="No limit"
              style={styles.smallInput}
            />
          </div>

          <div style={styles.priceSeparator}>→</div>

          <div style={styles.priceInputGroup}>
            <label style={styles.smallLabel}>
              Max Exchange Rate (Optional)
              <span
                style={{ ...styles.tooltip, marginLeft: "0.25rem" }}
                title={`Maximum ${token1Symbol} per ${token0Symbol} you'll accept`}
              >
                ⓘ
              </span>
            </label>

            <input
              type="text"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="No limit"
              style={styles.smallInput}
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        onClick={needsApproval ? handleApprove : handleCreateOrder}
        disabled={isApproving || isConfirming || !isConnected || !amount0}
        style={{
          ...styles.submitButton,
          ...(needsApproval ? styles.approveButton : styles.sellButton),
        }}
      >
        {isApproving ? (
          <span>⏳ Approving...</span>
        ) : needsApproval ? (
          <span>✓ Approve {token0Symbol}</span>
        ) : isConfirming ? (
          <span>⏳ Creating Order...</span>
        ) : (
          <span>Create Sell Order</span>
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
          <span>✓</span> Approval successful! You can now create the order.
        </div>
      )}
      {approveStatus === "error" && (
        <div style={styles.errorMessage}>
          <span>⚠</span>{" "}
          {(approveError as BaseError)?.shortMessage || approveError?.message}
        </div>
      )}

      {createOrderStatus === "pending" && (
        <div style={styles.infoMessage}>
          <span>💡</span> Check your wallet to confirm the transaction
        </div>
      )}
      {isConfirmed && (
        <div style={styles.successMessage}>
          <span>✓</span> Order created! Check the order book below.
        </div>
      )}
      {createOrderStatus === "error" && (
        <div style={styles.errorMessage}>
          <span>⚠</span>{" "}
          {(() => {
            const error = createOrderError as BaseError;
            const errorMsg = error?.shortMessage || error?.message || "";
            const errorString = JSON.stringify(error);

            if (errorMsg.includes("OrderValueTooLow") ||
                errorString.includes("OrderValueTooLow") ||
                errorString.includes("0x64a6d4a3")) {
              return "Order value too low. Minimum order value is $10 USD.";
            }
            return errorMsg;
          })()}
        </div>
      )}

      {!isConnected && (
        <div style={styles.warningMessage}>
          <span>⚠</span> Connect your wallet to create orders
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },

  balanceSection: {
    padding: "1rem",
    background: "rgba(59, 130, 246, 0.05)",
    borderRadius: "0.5rem",
    border: "1px solid rgba(59, 130, 246, 0.15)",
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
    gap: "0.25rem",
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
    top: "50%",
    transform: "translateY(-50%)",
    padding: "0.5rem 1rem",
    background: "rgba(255, 0, 128, 0.2)",
    border: "1px solid #ff0080",
    borderRadius: "0.375rem",
    color: "#ff0080",
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

  priceRange: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },

  priceLabel: {
    fontSize: "0.875rem",
    fontWeight: "500",
    color: "var(--text-secondary)",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },

  priceInputs: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: "0.75rem",
    alignItems: "end",
  },

  priceInputGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },

  smallLabel: {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },

  smallInput: {
    padding: "0.75rem",
    fontSize: "0.875rem",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border-color)",
    borderRadius: "0.375rem",
    color: "var(--text-primary)",
    transition: "all 0.3s ease",
  },

  priceSeparator: {
    fontSize: "1.25rem",
    color: "var(--text-muted)",
    paddingBottom: "0.75rem",
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
    marginTop: "0.25rem",
  },

  approveButton: {
    background: "rgba(59, 130, 246, 0.2)",
    color: "#60a5fa",
    border: "2px solid #3b82f6",
  },

  sellButton: {
    background: "rgba(255, 0, 128, 0.2)",
    color: "#ff0080",
    border: "2px solid #ff0080",
    boxShadow: "0 0 20px rgba(255, 0, 128, 0.2)",
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

  infoBox: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.875rem",
    background: "rgba(139, 92, 246, 0.05)",
    border: "1px solid rgba(139, 92, 246, 0.2)",
    borderRadius: "0.5rem",
  },

  feeInfoBox: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.875rem",
    background: "rgba(16, 185, 129, 0.05)",
    border: "1px solid rgba(16, 185, 129, 0.2)",
    borderRadius: "0.5rem",
  },

  feeIcon: {
    fontSize: "1.25rem",
  },

  feeText: {
    fontSize: "0.8125rem",
    color: "#10b981",
    lineHeight: "1.4",
  },

  warningBox: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.875rem",
    background: "rgba(245, 158, 11, 0.05)",
    border: "1px solid rgba(245, 158, 11, 0.2)",
    borderRadius: "0.5rem",
  },

  infoIcon: {
    fontSize: "1.25rem",
  },

  infoText: {
    fontSize: "0.875rem",
    color: "#a855f7",
    lineHeight: "1.4",
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
