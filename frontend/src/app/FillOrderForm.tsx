// src/app/FillOrderForm.tsx
"use client";
import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  usePublicClient,
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
import { checkMarketLiquidity } from "@/hooks/useContractEvents";

export function FillOrderForm({
  defaultToken0,
  defaultToken1,
  marketId,
}: {
  defaultToken0: Address;
  defaultToken1: Address;
  marketId: string;
}) {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const p2pAddress = getP2PAddress(chainId);
  const { tokenInfoMap } = useTokenRegistryContext();

  const [amount1, setAmount1] = useState("");
  const [hasLiquidity, setHasLiquidity] = useState(true);
  const [isCheckingLiquidity, setIsCheckingLiquidity] = useState(true);

  const token0 = defaultToken0;
  const token1 = defaultToken1;
  const tokenInfo0 = tokenInfoMap[token0];
  const tokenInfo1 = tokenInfoMap[token1];
  const token0Symbol = tokenInfo0?.symbol ?? "Token";
  const token1Symbol = tokenInfo1?.symbol ?? "Token";
  const token1Decimals = tokenInfo1?.decimals ?? 18;

  const isWethMarket = tokenInfo1?.symbol === "WETH";

  const client = usePublicClient({ chainId: chainId });

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
    tokenAddress: token1,
    spenderAddress: p2pAddress,
    amount: amount1,
    tokenDecimals: token1Decimals,
  });

  // Use shared Pyth price hook
  const {
    pythUpdateData,
    isLoading: isPythLoading,
    error: pythError,
    fetchFreshPythData,
  } = usePythPrice({
    priceFeedIds: [tokenInfo0?.priceFeedId, tokenInfo1?.priceFeedId].filter(Boolean) as string[],
    enabled: !!tokenInfo0?.priceFeedId && !!tokenInfo1?.priceFeedId,
  });

  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useBalance({
    address: userAddress,
    token: token1,
    chainId: chainId,
    query: {
      enabled: isConnected && !!token1 && token1 !== "0x",
    },
  });

  const {
    data: fillOrderHash,
    error: fillOrderError,
    status: fillOrderStatus,
    writeContract: fillOrderWriteContract,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash: fillOrderHash,
    query: {
      retry: 10,
    }
  });

  // Check for available liquidity
  useEffect(() => {
    if (!client || !marketId) {
      setHasLiquidity(false);
      setIsCheckingLiquidity(false);
      return;
    }

    const checkLiquidity = async () => {
      setIsCheckingLiquidity(true);
      const liquidity = await checkMarketLiquidity(client, p2pAddress, marketId, chainId);
      setHasLiquidity(liquidity);
      setIsCheckingLiquidity(false);
    };

    checkLiquidity();
  }, [client, marketId, p2pAddress, chainId]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    approve();
  };

  const handleFillOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (needsApproval || !token0 || !token1 || !amount1 || !tokenInfo0?.priceFeedId || !tokenInfo1?.priceFeedId) {
      return;
    }

    try {
      // Fetch fresh Pyth data right before transaction
      const freshData = await fetchFreshPythData();
      if (!freshData) {
        throw new Error("Failed to fetch Pyth price data");
      }

      const formattedAmount1 = parseUnits(amount1, token1Decimals);

      fillOrderWriteContract({
        address: p2pAddress,
        abi: p2pAbi,
        functionName: "fillOrderExactAmountIn",
        args: [freshData.priceUpdateArray, token0, token1, formattedAmount1],
        value: freshData.fee,
      });
    } catch (err) {
      console.error("An error occurred in handleFillOrder:", err);
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
              {parseFloat(balance).toFixed(5)}{" "}
              <span style={styles.tokenSymbol}>{token1Symbol}</span>
            </>
          )}
        </div>
      </div>

      {/* Amount Input */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>
          Amount to Spend
          <span
            style={styles.tooltip}
            title={`Spend ${token1Symbol} to buy ${token0Symbol}`}
          >
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
          You'll buy {token0Symbol} at the exact oracle price (zero slippage). Partial fills are supported - you'll only pay for what's actually filled.
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        onClick={needsApproval ? handleApprove : handleFillOrder}
        disabled={
          isApproving ||
          isConfirming ||
          !isConnected ||
          !amount1 ||
          !hasLiquidity ||
          isCheckingLiquidity ||
          isPythLoading ||
          !pythUpdateData
        }
        style={{
          ...styles.submitButton,
          ...(needsApproval ? styles.approveButton : styles.buyButton),
        }}
      >
        {isCheckingLiquidity ? (
          <span>⏳ Checking liquidity...</span>
        ) : !hasLiquidity ? (
          <span>🚫 No Liquidity Available</span>
        ) : isPythLoading && !pythUpdateData ? (
          <span>⏳ Loading price data...</span>
        ) : isApproving ? (
          <span>⏳ Approving...</span>
        ) : needsApproval ? (
          <span>✓ Approve {token1Symbol}</span>
        ) : isConfirming ? (
          <span>⏳ Filling Order...</span>
        ) : (
          <span>Buy {token0Symbol}</span>
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
      {fillOrderHash && !isConfirmed && !isConfirming && (
        <div style={styles.infoMessage}>
          <span>⏳</span> Transaction submitted! Waiting for confirmation...
          <a
            href={`https://sepolia.basescan.org/tx/${fillOrderHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#00f5ff", marginLeft: "0.5rem" }}
          >
            View on Basescan
          </a>
        </div>
      )}
      {isConfirmed && (
        <div style={styles.successMessage}>
          <span>✓</span> Order filled! Check your balance.
        </div>
      )}
      {fillOrderStatus === "error" && !fillOrderHash && (
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

      {isConnected && !hasLiquidity && !isCheckingLiquidity && (
        <div style={styles.warningMessage}>
          <span>💧</span> No sell orders available. Be the first to create a
          sell order!
        </div>
      )}

      {pythError && (
        <div style={styles.errorMessage}>
          <span>⚠</span> Price data error: {pythError}
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
    fontSize: "1rem",
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
