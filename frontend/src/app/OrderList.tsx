// frontend/src/app/OrderList.tsx
"use client";

import { type Address, formatUnits } from "viem";
import { useMarketOrders } from "@/hooks/useContractEvents";
import { useTokenRegistryContext } from "@/app/TokenRegistryContext";

// Helper function to format numbers to max 4 decimals
function formatToMaxDecimals(value: string, maxDecimals: number = 4): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  // Convert to fixed decimal, then remove trailing zeros
  const fixed = num.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}

export function OrderList({ marketId }: { marketId: string }) {
  const { orders, isLoading, error } = useMarketOrders({ marketId });
  const { tokenInfoMap } = useTokenRegistryContext();

  const orderArray = Array.from(orders.values());

  // Helper function to get Basescan URL
  const getBasescanUrl = (address: string): string => {
    return `https://sepolia.basescan.org/address/${address}`;
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        padding: "1rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-md)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <h3 style={{ marginBottom: "0.75rem", fontSize: "1.125rem" }}>
        Order Book
      </h3>

      {!marketId ? (
        <p style={{ fontSize: "0.875rem" }}>Market ID not found.</p>
      ) : isLoading ? (
        <div style={{ fontSize: "0.875rem" }}>Loading orders...</div>
      ) : error ? (
        <div className="error-message">Error: {error}</div>
      ) : orderArray.length === 0 ? (
        <p style={{ fontSize: "0.875rem" }}>No active orders.</p>
      ) : (
        <div style={{ overflow: "auto", flex: 1, maxHeight: "400px" }}>
          <table className="order-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Maker</th>
                <th>Amount</th>
                <th>Min</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              {orderArray.map((order) => {
                const decimals0 = tokenInfoMap[order.token0]?.decimals ?? 18;

                return (
                  <tr key={order.orderId.toString()}>
                    <td>{order.orderId.toString()}</td>
                    <td>
                      <a
                        href={getBasescanUrl(order.maker)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#00f5ff",
                          textDecoration: "none",
                          transition: "opacity 0.2s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        {order.maker.substring(0, 8)}...
                      </a>
                    </td>
                    <td>
                      {formatToMaxDecimals(
                        formatUnits(order.remainingAmount0, decimals0)
                      )}
                    </td>
                    <td>
                      {order.minPrice > 0n
                        ? formatToMaxDecimals(formatUnits(order.minPrice, 18))
                        : "N/A"}
                    </td>
                    <td>
                      {order.maxPrice > 0n
                        ? formatToMaxDecimals(formatUnits(order.maxPrice, 18))
                        : "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
