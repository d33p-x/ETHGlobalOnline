// frontend/src/app/OrderList.tsx
"use client";

import { type Address, formatUnits } from "viem";
import { useMarketOrders } from "@/hooks/useContractEvents";
import { useTokenRegistryContext } from "@/app/TokenRegistryContext";
import { useMemo } from "react";
import { TableSkeleton } from "@/app/components/Skeleton";

// Helper function to format numbers to max decimals
function formatToMaxDecimals(value: string, maxDecimals: number = 4): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  const fixed = num.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}

type OrderWithPrice = {
  orderId: bigint;
  maker: Address;
  token0: Address;
  token1: Address;
  remainingAmount0: bigint;
  minPrice: bigint;
  maxPrice: bigint;
  avgPrice: number;
  size: string;
  total: number;
};

export function OrderList({ marketId }: { marketId: string }) {
  const { orders, isLoading, error } = useMarketOrders({ marketId });
  const { tokenInfoMap } = useTokenRegistryContext();

  const orderArray = Array.from(orders.values());

  // Process and sort orders
  const { asks, bids, spread, maxTotal } = useMemo(() => {
    if (orderArray.length === 0) {
      return { asks: [], bids: [], spread: 0, maxTotal: 0 };
    }

    const processedOrders: OrderWithPrice[] = orderArray.map((order) => {
      const decimals0 = tokenInfoMap[order.token0]?.decimals ?? 18;
      const size = formatUnits(order.remainingAmount0, decimals0);

      // Calculate average price
      const minPriceNum = order.minPrice > 0n ? Number(formatUnits(order.minPrice, 18)) : 0;
      const maxPriceNum = order.maxPrice > 0n ? Number(formatUnits(order.maxPrice, 18)) : Infinity;
      const avgPrice = minPriceNum > 0 && maxPriceNum < Infinity
        ? (minPriceNum + maxPriceNum) / 2
        : minPriceNum > 0 ? minPriceNum : maxPriceNum;

      const total = parseFloat(size) * avgPrice;

      return {
        ...order,
        avgPrice,
        size,
        total,
      };
    });

    // Sort by price
    processedOrders.sort((a, b) => b.avgPrice - a.avgPrice);

    // Find midpoint - orders above median are asks (selling), below are bids (buying)
    const medianIndex = Math.floor(processedOrders.length / 2);
    const asks = processedOrders.slice(0, medianIndex).reverse(); // Reverse so lowest ask is at bottom
    const bids = processedOrders.slice(medianIndex);

    // Calculate spread
    const lowestAsk = asks.length > 0 ? asks[asks.length - 1].avgPrice : 0;
    const highestBid = bids.length > 0 ? bids[0].avgPrice : 0;
    const spread = lowestAsk > 0 && highestBid > 0 ? lowestAsk - highestBid : 0;

    // Find max total for depth visualization
    const maxTotal = Math.max(...processedOrders.map(o => o.total));

    return { asks, bids, spread, maxTotal };
  }, [orderArray, tokenInfoMap]);

  const renderOrderRow = (order: OrderWithPrice, isAsk: boolean) => {
    const depthPercentage = maxTotal > 0 ? (order.total / maxTotal) * 100 : 0;

    // All orders are sell orders, use red/orange theme
    const color = "#ef4444";
    const bgColor = "linear-gradient(90deg, rgba(239, 68, 68, 0) 0%, rgba(239, 68, 68, 0.15) 100%)";
    const hoverBgColor = "rgba(239, 68, 68, 0.2)";

    // Format price range
    const minPriceNum = order.minPrice > 0n ? Number(formatUnits(order.minPrice, 18)) : 0;
    const maxPriceNum = order.maxPrice > 0n ? Number(formatUnits(order.maxPrice, 18)) : Infinity;

    let priceDisplay: string;
    if (maxPriceNum === Infinity) {
      priceDisplay = minPriceNum > 0 ? `${formatToMaxDecimals(minPriceNum.toString(), 4)} - Market` : "Market";
    } else if (minPriceNum === 0) {
      priceDisplay = `Market - ${formatToMaxDecimals(maxPriceNum.toString(), 4)}`;
    } else {
      priceDisplay = `${formatToMaxDecimals(minPriceNum.toString(), 4)} - ${formatToMaxDecimals(maxPriceNum.toString(), 4)}`;
    }

    // Helper function to get Basescan URL
    const getBasescanUrl = (address: string): string => {
      return `https://sepolia.basescan.org/address/${address}`;
    };

    return (
      <div
        key={order.orderId.toString()}
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "0.6fr 1fr 1fr 1fr",
          padding: "0.375rem 0.5rem",
          fontSize: "0.75rem",
          color,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hoverBgColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Enhanced Depth bar with gradient */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: `${depthPercentage}%`,
            background: bgColor,
            zIndex: 0,
            transition: "width 0.3s ease",
          }}
        />
        <div style={{ position: "relative", zIndex: 1, textAlign: "left", fontSize: "0.7rem", color: "var(--text-muted)" }}>
          #{order.orderId.toString()}
        </div>
        <div style={{ position: "relative", zIndex: 1, textAlign: "left" }}>
          {priceDisplay}
        </div>
        <div style={{ position: "relative", zIndex: 1, textAlign: "right" }}>
          {formatToMaxDecimals(order.size, 4)}
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "right",
            fontSize: "0.7rem",
            color: "#3b82f6",
            cursor: "pointer",
            textDecoration: "underline"
          }}
          onClick={(e) => {
            e.stopPropagation();
            window.open(getBasescanUrl(order.maker), "_blank");
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#60a5fa";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#3b82f6";
          }}
        >
          {order.maker.substring(0, 6)}...
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        padding: "0.5rem",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg-card)",
      }}
    >
      {!marketId ? (
        <p style={{ fontSize: "0.875rem", padding: "1rem" }}>Market ID not found.</p>
      ) : isLoading ? (
        <TableSkeleton rows={8} columns={4} />
      ) : error ? (
        <div className="error-message">Error: {error}</div>
      ) : orderArray.length === 0 ? (
        <p style={{ fontSize: "0.875rem", padding: "1rem" }}>No active orders.</p>
      ) : (
        <>
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.6fr 1fr 1fr 1fr",
              padding: "0.5rem 0.5rem 0.375rem",
              fontSize: "0.6875rem",
              fontWeight: "600",
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border-color)",
              textTransform: "uppercase",
            }}
          >
            <div style={{ textAlign: "left" }}>ID</div>
            <div style={{ textAlign: "left" }}>Price</div>
            <div style={{ textAlign: "right" }}>Size</div>
            <div style={{ textAlign: "right" }}>Maker</div>
          </div>

          <div style={{ overflow: "auto", flex: 1 }}>
            {/* Asks (Sell Orders) - shown in reverse order (lowest ask at bottom) */}
            {asks.map((order) => renderOrderRow(order, true))}

            {/* Bids (Buy Orders) */}
            {bids.map((order) => renderOrderRow(order, false))}
          </div>
        </>
      )}
    </div>
  );
}
