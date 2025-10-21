"use client";

import { useState } from "react";
import { type Address } from "viem";

export function CreateOrderForm() {
  // State for each form input
  const [token0, setToken0] = useState<Address>("0x"); // Address of token to sell
  const [token1, setToken1] = useState<Address>("0x"); // Address of token to buy
  const [amount0, setAmount0] = useState(""); // Amount of token0 to sell (as a string)
  const [maxPrice, setMaxPrice] = useState(""); // Max price (as a string)
  const [minPrice, setMinPrice] = useState(""); // Min price (as a string)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the browser from reloading the page
    console.log("Form submitted with values:");
    console.log({ token0, token1, amount0, maxPrice, minPrice });
    // Next, we'll format these values and call the contract
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Create Order</h3>
      <div>
        <label>
          Token to Sell (token0):
          <input
            type="text"
            value={token0}
            onChange={(e) => setToken0(e.target.value as Address)}
          />
        </label>
      </div>
      <div>
        <label>
          Token to Buy (token1):
          <input
            type="text"
            value={token1}
            onChange={(e) => setToken1(e.target.value as Address)}
          />
        </label>
      </div>
      <div>
        <label>
          Amount to Sell (amount0):
          <input
            type="text"
            value={amount0}
            onChange={(e) => setAmount0(e.target.value)}
            placeholder="e.g., 1.5"
          />
        </label>
      </div>
      <div>
        <label>
          Max Price (in USD):
          <input
            type="text"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="e.g., 3000.50"
          />
        </label>
      </div>
      <div>
        <label>
          Min Price (in USD):
          <input
            type="text"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="e.g., 2950.00"
          />
        </label>
      </div>
      <button type="submit">Create Order</button>
    </form>
  );
}
