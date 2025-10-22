// src/app/market/[marketId]/page.tsx
"use client";

import { CreateOrderForm } from "@/app/CreateOrderForm";
import { FillOrderForm } from "@/app/FillOrderForm";
import { OrderList } from "@/app/OrderList";
import { CancelReduceOrderForm } from "@/app/CancelReduceOrderForm";
import { type Address } from "viem";

// This component receives the dynamic 'marketId' from the URL
// and the token addresses from the search parameters
export default function MarketPage({
  params,
  searchParams,
}: {
  params: { marketId: string };
  searchParams: { token0: string; token1: string };
}) {
  const { marketId } = params;
  // Fallback to empty addresses if not in URL, though MarketList should provide them
  const token0 = (searchParams.token0 ?? "0x") as Address;
  const token1 = (searchParams.token1 ?? "0x") as Address;

  return (
    <div>
      <h2>Market Details</h2>
      <p style={{ fontFamily: "monospace", fontSize: "12px" }}>
        <strong>Market ID:</strong> {marketId}
        <br />
        <strong>Token 0 (Sell):</strong> {token0}
        <br />
        <strong>Token 1 (Buy):</strong> {token1}
      </p>

      <hr />

      {/* The OrderList now just needs the marketId to fetch its data */}
      <OrderList marketId={marketId} />

      <hr />

      {/* The forms are now split into columns.
        We pass them the token addresses so the user doesn't have to.
      */}
      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ flex: 1 }}>
          <CreateOrderForm defaultToken0={token0} defaultToken1={token1} />
        </div>
        <div style={{ flex: 1 }}>
          <FillOrderForm defaultToken0={token0} defaultToken1={token1} />
        </div>
      </div>

      <hr />

      <CancelReduceOrderForm defaultToken0={token0} defaultToken1={token1} />
    </div>
  );
}
