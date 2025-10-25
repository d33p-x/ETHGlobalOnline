// frontend/src/app/WrapUnwrap.tsx
"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  useChainId,
} from "wagmi";
import { type Address, BaseError, parseEther, formatEther } from "viem";

const wethAbi = [
  {
    type: "function",
    name: "deposit",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export function WrapUnwrapButton({ wethAddress }: { wethAddress: Address }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} style={styles.openButton}>
        Wrap/Unwrap ETH
      </button>
      {isOpen && (
        <WrapUnwrapModal
          wethAddress={wethAddress}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

function WrapUnwrapModal({
  wethAddress,
  onClose,
}: {
  wethAddress: Address;
  onClose: () => void;
}) {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const [amount, setAmount] = useState("");

  const { data: ethBalance } = useBalance({
    address: userAddress,
    chainId: chainId,
  });

  const { data: wethBalance } = useBalance({
    address: userAddress,
    token: wethAddress,
    chainId: chainId,
  });

  const {
    data: wrapHash,
    error: wrapError,
    writeContract: wrap,
  } = useWriteContract();
  const {
    data: unwrapHash,
    error: unwrapError,
    writeContract: unwrap,
  } = useWriteContract();

  const { isLoading: isWrapping } = useWaitForTransactionReceipt({
    hash: wrapHash,
  });
  const { isLoading: isUnwrapping } = useWaitForTransactionReceipt({
    hash: unwrapHash,
  });

  const handleWrap = () => {
    if (!amount) return;
    wrap({
      address: wethAddress,
      abi: wethAbi,
      functionName: "deposit",
      value: parseEther(amount),
    });
  };

  const handleUnwrap = () => {
    if (!amount) return;
    unwrap({
      address: wethAddress,
      abi: wethAbi,
      functionName: "withdraw",
      args: [parseEther(amount)],
    });
  };

  const setMaxEth = () => {
    if (ethBalance) {
      setAmount(parseFloat(formatEther(ethBalance.value)).toFixed(6));
    }
  };

  const setMaxWeth = () => {
    if (wethBalance) {
      setAmount(parseFloat(formatEther(wethBalance.value)).toFixed(6));
    }
  };

  // Use portal to render modal at document body level to avoid positioning issues
  const modalContent = (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Wrap / Unwrap ETH</h3>
          <button onClick={onClose} style={styles.closeButton}>
            ×
          </button>
        </div>

        <div style={styles.balanceDisplay}>
          <div style={styles.balanceItem}>
            <div style={styles.balanceLabel}>ETH Balance</div>
            <div style={styles.balanceValue}>
              {ethBalance
                ? parseFloat(formatEther(ethBalance.value)).toFixed(6)
                : "0.000000"}
            </div>
            <button onClick={setMaxEth} style={styles.maxBadge}>
              Use Max
            </button>
          </div>
          <div style={styles.balanceDivider}></div>
          <div style={styles.balanceItem}>
            <div style={styles.balanceLabel}>WETH Balance</div>
            <div style={styles.balanceValue}>
              {wethBalance
                ? parseFloat(formatEther(wethBalance.value)).toFixed(6)
                : "0.000000"}
            </div>
            <button onClick={setMaxWeth} style={styles.maxBadge}>
              Use Max
            </button>
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Amount</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            style={styles.input}
          />
        </div>

        <div style={styles.buttonGroup}>
          <button
            onClick={handleWrap}
            disabled={isWrapping || !isConnected || !amount}
            style={{
              ...styles.button,
              ...styles.wrapButton,
              ...(isWrapping || !isConnected || !amount
                ? styles.buttonDisabled
                : {}),
            }}
          >
            {isWrapping ? "Wrapping..." : "Wrap ETH → WETH"}
          </button>
          <button
            onClick={handleUnwrap}
            disabled={isUnwrapping || !isConnected || !amount}
            style={{
              ...styles.button,
              ...styles.unwrapButton,
              ...(isUnwrapping || !isConnected || !amount
                ? styles.buttonDisabled
                : {}),
            }}
          >
            {isUnwrapping ? "Unwrapping..." : "Unwrap WETH → ETH"}
          </button>
        </div>

        {(wrapError || unwrapError || !isConnected) && (
          <div style={styles.messageText}>
            {wrapError &&
              ((wrapError as BaseError)?.shortMessage || wrapError.message)}
            {unwrapError &&
              ((unwrapError as BaseError)?.shortMessage || unwrapError.message)}
            {!isConnected &&
              !wrapError &&
              !unwrapError &&
              "Connect wallet to wrap/unwrap"}
          </div>
        )}
      </div>
    </div>
  );

  // Render modal at document body level using portal
  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}

const styles = {
  openButton: {
    padding: "0.625rem 1rem",
    fontSize: "0.875rem",
    fontWeight: "600",
    background: "rgba(139, 92, 246, 0.2)",
    color: "#a855f7",
    border: "2px solid #8b5cf6",
    borderRadius: "0.5rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    width: "auto",
  },
  modalOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    backdropFilter: "blur(4px)",
  },
  modalContent: {
    background: "var(--bg-card)",
    borderRadius: "1rem",
    border: "2px solid rgba(139, 92, 246, 0.3)",
    padding: "1.5rem",
    maxWidth: "480px",
    width: "90%",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.25rem",
  },
  modalTitle: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  closeButton: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    fontSize: "2rem",
    cursor: "pointer",
    padding: "0",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0.25rem",
    transition: "all 0.2s ease",
  },
  balanceDisplay: {
    display: "flex",
    alignItems: "center",
    gap: "1.5rem",
    padding: "1rem",
    background: "rgba(139, 92, 246, 0.05)",
    borderRadius: "0.5rem",
    border: "1px solid rgba(139, 92, 246, 0.15)",
    marginBottom: "1rem",
  },
  balanceItem: {
    flex: 1,
    textAlign: "center" as const,
  },
  balanceLabel: {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    marginBottom: "0.25rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  balanceValue: {
    fontSize: "1.125rem",
    fontWeight: "600",
    color: "var(--text-primary)",
    marginBottom: "0.5rem",
  },
  balanceDivider: {
    width: "1px",
    height: "50px",
    background: "rgba(139, 92, 246, 0.2)",
  },
  maxBadge: {
    padding: "0.25rem 0.5rem",
    fontSize: "0.625rem",
    background: "rgba(139, 92, 246, 0.2)",
    color: "#a855f7",
    border: "1px solid #8b5cf6",
    borderRadius: "0.25rem",
    cursor: "pointer",
    fontWeight: "600",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    marginBottom: "1rem",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: "500",
    color: "var(--text-secondary)",
  },
  input: {
    width: "100%",
    padding: "1rem",
    fontSize: "1.25rem",
    fontWeight: "500",
    background: "var(--bg-tertiary)",
    border: "2px solid var(--border-color)",
    borderRadius: "0.5rem",
    color: "var(--text-primary)",
    transition: "all 0.3s ease",
  },
  buttonGroup: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  button: {
    padding: "1rem",
    fontSize: "0.875rem",
    fontWeight: "600",
    border: "none",
    borderRadius: "0.5rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  wrapButton: {
    background: "rgba(59, 130, 246, 0.2)",
    color: "#60a5fa",
    border: "2px solid #3b82f6",
  },
  unwrapButton: {
    background: "rgba(139, 92, 246, 0.2)",
    color: "#a855f7",
    border: "2px solid #8b5cf6",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  messageText: {
    fontSize: "0.75rem",
    color: "#ef4444",
    padding: "0.5rem",
    textAlign: "center" as const,
  },
};
