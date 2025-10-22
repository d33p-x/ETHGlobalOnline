// src/app/market/[marketId]/page.tsx
"use client";

import { CreateOrderForm } from "@/app/CreateOrderForm";
import { FillOrderForm } from "@/app/FillOrderForm";
import { OrderList } from "@/app/OrderList";
import { CancelReduceOrderForm } from "@/app/CancelReduceOrderForm";
import { type Address } from "viem";
import { tokenInfoMap } from "@/app/tokenConfig"; // <-- 1. Import

export default function MarketPage({
  params,
  searchParams,
}: {
  params: { marketId: string };
  searchParams: { token0: string; token1: string };
}) {
  const { marketId } = params;
  const token0 = (searchParams.token0 ?? "0x") as Address;
  const token1 = (searchParams.token1 ?? "0x") as Address;

  // 2. Look up symbols
  const symbol0 = tokenInfoMap[token0]?.symbol ?? "Token0";
  const symbol1 = tokenInfoMap[token1]?.symbol ?? "Token1";

  return (
    <div>
      {/* 3. Display symbols */}
      <h2>
        Market: {symbol0} / {symbol1}
      </h2>
      <p style={{ fontFamily: "monospace", fontSize: "12px" }}>
        <strong>Market ID:</strong> {marketId}
        <br />
        <strong>Token 0 (Sell):</strong> {token0} ({symbol0})
        <br />
        <strong>Token 1 (Buy):</strong> {token1} ({symbol1})
      </p>

      <hr />

      <OrderList marketId={marketId} />

      <hr />

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
