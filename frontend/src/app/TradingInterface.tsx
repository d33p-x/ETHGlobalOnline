"use client";

import { useState } from "react";
import { type Address } from "viem";
import { CreateOrderForm } from "./CreateOrderForm";
import { FillOrderForm } from "./FillOrderForm";

interface TradingInterfaceProps {
  defaultToken0: Address;
  defaultToken1: Address;
  marketId: string;
}

export function TradingInterface({
  defaultToken0,
  defaultToken1,
  marketId,
}: TradingInterfaceProps) {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");

  return (
    <div style={styles.container}>
      {/* Tab Header */}
      <div style={styles.tabHeader}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "buy" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("buy")}
        >
          Buy
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "sell" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("sell")}
        >
          Sell
        </button>
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {activeTab === "buy" ? (
          <FillOrderForm
            defaultToken0={defaultToken0}
            defaultToken1={defaultToken1}
            marketId={marketId}
          />
        ) : (
          <CreateOrderForm
            defaultToken0={defaultToken0}
            defaultToken1={defaultToken1}
          />
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: "var(--bg-card)",
    borderRadius: "1rem",
    border: "1px solid var(--border-color)",
    overflow: "hidden",
    boxShadow: "var(--shadow-lg)",
  } as React.CSSProperties,

  tabHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    background: "var(--bg-tertiary)",
    borderBottom: "1px solid var(--border-color)",
  } as React.CSSProperties,

  tab: {
    padding: "1rem",
    background: "transparent",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-muted)",
    fontSize: "0.875rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    position: "relative" as const,
  } as React.CSSProperties,

  tabActive: {
    color: "#00f5ff",
    background: "var(--bg-card)",
    borderBottom: "2px solid #00f5ff",
    boxShadow: "0 0 20px rgba(0, 245, 255, 0.3)",
  } as React.CSSProperties,

  tabContent: {
    padding: "1.5rem",
  } as React.CSSProperties,
};
