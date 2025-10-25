// src/app/SupportedTokens.tsx
"use client";

import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { type Address } from "viem";
import { useTokenRegistryContext } from "./TokenRegistryContext";
import { type TokenInfo } from "./tokenConfig";

// ABI for the mint function in mock ERC20 tokens
const mockERC20Abi = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// Tokens that are official testnet versions (not our deployed mocks)
const OFFICIAL_TOKENS = ["WETH", "USDC", "LINK"];

/**
 * A small component to display a single token's info
 */
function TokenRow({
  address,
  tokenInfo,
}: {
  address: Address;
  tokenInfo: TokenInfo;
}) {
  const { address: userAddress } = useAccount();

  const isMockToken =
    tokenInfo.symbol && !OFFICIAL_TOKENS.includes(tokenInfo.symbol);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleMint = () => {
    if (!userAddress || !tokenInfo.decimals) return;

    const amount = BigInt(1000) * BigInt(10 ** tokenInfo.decimals);

    writeContract({
      address: address,
      abi: mockERC20Abi,
      functionName: "mint",
      args: [userAddress, amount],
    });
  };

  return (
    <li style={tokenRowStyles.tokenRow}>
      <div style={tokenRowStyles.tokenInfo}>
        <div style={tokenRowStyles.tokenSymbol}>
          <strong>{tokenInfo.symbol}</strong>
          <span style={tokenRowStyles.tokenDecimals}>
            ({tokenInfo.decimals} decimals)
          </span>
        </div>
        <span style={tokenRowStyles.tokenAddress}>{address}</span>
      </div>
      {isMockToken && (
        <button
          onClick={handleMint}
          disabled={isPending || isConfirming || !userAddress}
          style={{
            ...tokenRowStyles.mintButton,
            opacity: isPending || isConfirming || !userAddress ? 0.6 : 1,
            cursor:
              userAddress && !isPending && !isConfirming
                ? "pointer"
                : "not-allowed",
          }}
          onMouseEnter={(e) => {
            if (userAddress && !isPending && !isConfirming) {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(59, 130, 246, 0.4)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {isPending
            ? "Confirming..."
            : isConfirming
              ? "Minting..."
              : isSuccess
                ? "Minted!"
                : "Mint 1000"}
        </button>
      )}
    </li>
  );
}

const tokenRowStyles = {
  tokenRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "1rem 1.25rem",
    background: "rgba(26, 34, 65, 0.6)",
    border: "1px solid rgba(59, 130, 246, 0.15)",
    borderRadius: "0.5rem",
    transition: "all 0.2s ease",
  },
  tokenInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
    flex: 1,
  },
  tokenSymbol: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "1rem",
    color: "#f1f5f9",
  },
  tokenDecimals: {
    fontSize: "0.875rem",
    color: "#94a3b8",
    fontWeight: "normal" as const,
  },
  tokenAddress: {
    fontSize: "0.8125rem",
    color: "#64748b",
    fontFamily: "monospace",
  },
  mintButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
    color: "white",
    border: "none",
    borderRadius: "0.375rem",
    transition: "all 0.2s ease",
    minWidth: "100px",
  },
};

export function SupportedTokens() {
  const { tokenInfoMap, isLoading } = useTokenRegistryContext();

  const tokenArray = Object.entries(tokenInfoMap);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <svg
          style={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="8" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="17" y1="12" x2="22" y2="12" />
          <line x1="2" y1="12" x2="6" y2="12" />
        </svg>
        <h3 style={styles.title}>Supported Tokens</h3>
      </div>
      <p style={styles.subtitle}>Tokens with price feeds configured</p>
      {isLoading ? (
        <div style={styles.loadingState}>
          <svg
            className="loading"
            style={styles.loadingIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
          <p style={styles.loadingText}>Loading tokens...</p>
        </div>
      ) : tokenArray.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No price feeds configured yet</p>
        </div>
      ) : (
        <ul style={styles.tokenList}>
          {tokenArray.map(([address, info]) => (
            <TokenRow
              key={address}
              address={address as Address}
              tokenInfo={info}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: "rgba(30, 40, 73, 0.4)",
    padding: "2rem",
    borderRadius: "1rem",
    border: "1px solid rgba(59, 130, 246, 0.2)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
    backdropFilter: "blur(10px)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.75rem",
  },
  icon: {
    width: "28px",
    height: "28px",
    color: "#60a5fa",
  },
  title: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "#f1f5f9",
    letterSpacing: "-0.01em",
  },
  subtitle: {
    fontSize: "0.9375rem",
    color: "#94a3b8",
    marginBottom: "1.5rem",
  },
  loadingState: {
    textAlign: "center" as const,
    padding: "3rem 2rem",
    color: "#94a3b8",
  },
  loadingIcon: {
    width: "48px",
    height: "48px",
    color: "#60a5fa",
    margin: "0 auto",
    animation: "spin 2s linear infinite",
  },
  loadingText: {
    color: "#cbd5e1",
    fontSize: "1rem",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "3rem 2rem",
    color: "#94a3b8",
    background: "rgba(26, 34, 65, 0.4)",
    borderRadius: "0.75rem",
    border: "1px dashed rgba(59, 130, 246, 0.2)",
  },
  tokenList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  },
};
