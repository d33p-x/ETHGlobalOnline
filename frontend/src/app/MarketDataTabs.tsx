// frontend/src/app/MarketDataTabs.tsx
"use client";

import { useState } from "react";
import { OrderList } from "./OrderList";
import { TradesList } from "./TradesList";

interface MarketDataTabsProps {
  marketId: string;
}

export function MarketDataTabs({ marketId }: MarketDataTabsProps) {
  const [activeTab, setActiveTab] = useState<"orderbook" | "trades">("orderbook");

  return (
    <div style={styles.container}>
      {/* Tab Header */}
      <div style={styles.tabHeader}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "orderbook" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("orderbook")}
        >
          Order Book
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "trades" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("trades")}
        >
          Recent Trades
        </button>
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {activeTab === "orderbook" ? (
          <OrderList marketId={marketId} />
        ) : (
          <TradesList marketId={marketId} />
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
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
  } as React.CSSProperties,

  tabHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    background: "var(--bg-tertiary)",
    borderBottom: "1px solid var(--border-color)",
  } as React.CSSProperties,

  tab: {
    padding: "0.75rem",
    background: "transparent",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-muted)",
    fontSize: "0.8125rem",
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
    color: "var(--accent-secondary)",
    background: "var(--bg-card)",
    borderBottom: "2px solid var(--accent-secondary)",
    boxShadow: "0 0 15px rgba(59, 130, 246, 0.2)",
  } as React.CSSProperties,

  tabContent: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
  } as React.CSSProperties,
};
