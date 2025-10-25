// Consolidated contract ABIs for the P2P Exchange

export const p2pAbi = [
  // Events
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: false },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OrderCreated",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
      { name: "amount0", type: "uint256", indexed: false },
      { name: "maxPrice", type: "uint256", indexed: false },
      { name: "minPrice", type: "uint256", indexed: false },
      { name: "orderId", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OrderFilled",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
      { name: "orderId", type: "uint256", indexed: true },
      { name: "amount0Filled", type: "uint256", indexed: false },
      { name: "amount1Spent", type: "uint256", indexed: false },
      { name: "taker", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OrderReducedOrCancelled",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: false },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
      { name: "orderId", type: "uint256", indexed: true },
      { name: "amount0Closed", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  // Functions
  {
    type: "function",
    name: "createOrder",
    inputs: [
      { name: "_token0", type: "address" },
      { name: "_token1", type: "address" },
      { name: "_amount0", type: "uint256" },
      { name: "_maxPrice", type: "uint256" },
      { name: "_minPrice", type: "uint256" },
      { name: "priceUpdate", type: "bytes[]" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "fillOrderExactAmountIn",
    inputs: [
      { name: "priceUpdate", type: "bytes[]" },
      { name: "_token0", type: "address" },
      { name: "_token1", type: "address" },
      { name: "_amount1", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "markets",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "decimals0", type: "uint8" },
      { name: "decimals1", type: "uint8" },
      { name: "headId", type: "uint256" },
      { name: "tailId", type: "uint256" },
      { name: "totalLiquidity", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pyth",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

export const pythAbi = [
  {
    type: "function",
    name: "getUpdateFee",
    inputs: [{ name: "updateData", type: "bytes[]" }],
    outputs: [{ name: "feeAmount", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const erc20DecimalsAbi = [
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;
