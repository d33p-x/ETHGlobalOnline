// Reusable Loading Skeleton Component
"use client";

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius = "0.25rem",
  className = "",
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, rgba(59, 130, 246, 0.1) 25%, rgba(59, 130, 246, 0.2) 50%, rgba(59, 130, 246, 0.1) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}

// Skeleton Row for OrderBook/Trades List
export function SkeletonRow({ columns = 4 }: { columns?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: "0.5rem",
        padding: "0.5rem",
      }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} height="0.875rem" />
      ))}
    </div>
  );
}

// Loading state for OrderList/TradesList
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div style={{ padding: "0.5rem" }}>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: "0.5rem",
          padding: "0.5rem",
          borderBottom: "1px solid var(--border-color)",
          marginBottom: "0.5rem",
        }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="0.75rem" width="60%" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </div>
  );
}
