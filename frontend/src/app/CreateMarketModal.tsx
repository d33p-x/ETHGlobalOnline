"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { type Address, BaseError } from "viem";
import { getP2PAddress, getTokenAddresses } from "./config";
import { getTokenInfoMap } from "./tokenConfig";

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

type CreateMarketModalProps = {
  isOpen: boolean;
  onClose: () => void;
  existingMarkets: { token0: Address; token1: Address }[];
};

export function CreateMarketModal({ isOpen, onClose, existingMarkets }: CreateMarketModalProps) {
  const chainId = useChainId();
  const tokenAddresses = getTokenAddresses(chainId);
  const tokenInfoMap = getTokenInfoMap(chainId);
  const p2pAddress = getP2PAddress(chainId);

  const [token0, setToken0] = useState<Address>("" as Address);
  const [token1, setToken1] = useState<Address>("" as Address);

  const { writeContract, data: hash, status, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // Reset form when transaction is confirmed to prevent "already exists" warning
  useEffect(() => {
    if (isConfirmed) {
      setToken0("" as Address);
      setToken1("" as Address);
    }
  }, [isConfirmed]);

  // Get list of deployed tokens (non-zero addresses)
  const availableTokens = Object.entries(tokenAddresses)
    .filter(([_, address]) => address !== "0x0000000000000000000000000000000000000000")
    .map(([symbol, address]) => ({
      symbol,
      address,
      decimals: tokenInfoMap[address]?.decimals ?? 18,
    }));

  // Check if market already exists
  const marketExists = existingMarkets.some(
    (m) =>
      (m.token0.toLowerCase() === token0.toLowerCase() &&
        m.token1.toLowerCase() === token1.toLowerCase()) ||
      (m.token0.toLowerCase() === token1.toLowerCase() &&
        m.token1.toLowerCase() === token0.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token0 || !token1 || marketExists) return;

    writeContract({
      address: p2pAddress,
      abi: p2pAbi,
      functionName: "createMarket",
      args: [token0, token1],
    });
  };

  const handleClose = () => {
    reset();
    setToken0("" as Address);
    setToken1("" as Address);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "1rem",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-lg)",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "1.5rem" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.5rem" }}>Create New Market</h3>
            <button
              onClick={handleClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: "0.25rem 0.5rem",
              }}
            >
              ×
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                Base Asset
              </label>
              <select
                value={token0}
                onChange={(e) => setToken0(e.target.value as Address)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                }}
              >
                <option value="">Select token...</option>
                {availableTokens.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                Quote Asset
              </label>
              <select
                value={token1}
                onChange={(e) => setToken1(e.target.value as Address)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                }}
              >
                <option value="">Select token...</option>
                {availableTokens.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>

            {/* Warning if market exists */}
            {marketExists && token0 && token1 && (
              <div
                style={{
                  padding: "1rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "0.5rem",
                  marginBottom: "1rem",
                  fontSize: "0.875rem",
                  color: "#f87171",
                }}
              >
                This market already exists! Please choose different tokens.
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!token0 || !token1 || marketExists || status === "pending"}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: !token0 || !token1 || marketExists ? "var(--bg-tertiary)" : "var(--accent-primary)",
                  color: !token0 || !token1 || marketExists ? "var(--text-muted)" : "white",
                  fontSize: "1rem",
                  cursor: !token0 || !token1 || marketExists ? "not-allowed" : "pointer",
                  fontWeight: "600",
                }}
              >
                {status === "pending" ? "Confirming..." : "Create Market"}
              </button>
            </div>

            {/* Status Messages */}
            {status === "pending" && (
              <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                Waiting for wallet approval...
              </p>
            )}
            {isConfirming && (
              <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                Transaction sent, confirming...
              </p>
            )}
            {isConfirmed && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  color: "#10b981",
                }}
              >
                Market created successfully!
                <br />
                <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                  Transaction: {hash?.slice(0, 10)}...{hash?.slice(-8)}
                </span>
              </div>
            )}
            {status === "error" && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  color: "#f87171",
                }}
              >
                <strong>Error:</strong> {(error as BaseError)?.shortMessage || error?.message}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
