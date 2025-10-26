# p33rX

**Zero-Slippage Decentralized Exchange with Real-Time Oracle Pricing**

---

## Overview

**p33rX** is a next-generation decentralized peer-to-peer trading platform that implements an on-chain order book DEX with **guaranteed zero slippage**. Unlike traditional AMM-based exchanges where large trades suffer from significant price impact, p33rX executes all trades at exact oracle prices provided by Pyth Network.

### The Problem

Traditional AMM DEXs use bonding curves (x\*y=k) which create slippage - the larger your trade, the worse your price. A $100K trade might experience 2-5% slippage, making DeFi impractical for large orders.

### The Solution

p33rX uses:

- **On-chain FIFO order book** for transparent, fair matching
- **Pyth Network oracles** for real-time price feeds
- **Zero slippage execution** - buying 1 ETH or 100 ETH gets the same unit price
- **Maker-friendly fees** - liquidity providers earn 0.15% instead of paying fees

---

## Key Features

### 🎯 Zero Slippage Trading

All trades execute at exact oracle prices. No price impact, no matter the order size.

### 💰 Maker Rebates

Market makers receive a **0.15% bonus** on filled orders, incentivizing deep liquidity.

### 📊 FIFO Order Matching

Orders are filled first-in-first-out from a linked list queue. Fair and transparent.

### ⚡ Real-Time Oracle Pricing

Pyth Network provides sub-second price updates with 15-second staleness checks.

### 🔒 Non-Custodial

Tokens are locked in the smart contract when creating orders, but you retain full control. Cancel anytime to retrieve your tokens.

### 🌐 Multi-Token Support

Trade WETH, USDC, USDT, LINK, cbBTC, cbDOGE, SHIB, AERO, cbXRP, and PEPE.

---

## How It Works

### For Sellers (Makers)

1. Create a sell order specifying the amount to sell
2. Optional: Set min/max price bounds
3. Your tokens are locked in the smart contract
4. Orders enter a FIFO queue
5. **Earn 0.15% bonus** when your order is filled

### For Buyers (Takers)

1. Specify how much you want to spend
2. The contract fills orders from oldest to newest
3. **Pay 0.20% fee** on the oracle price
4. Receive tokens instantly at exact oracle price
5. Unused funds returned if insufficient liquidity

### Fee Structure

- **Taker Fee**: 0.20% (buyers pay oracle price × 1.002)
- **Maker Rebate**: +0.15% (sellers receive oracle price × 1.0015)
- **Protocol Fee**: 0.05% (the spread)

**Example Trade**: Buy 1 WETH @ 2,000 USDC oracle price

- Buyer pays: 2,004 USDC
- Seller receives: 2,003 USDC
- Protocol keeps: 1 USDC

---

## Architecture

### Smart Contracts (`/contracts`)

- **Framework**: Foundry (Forge, Cast, Anvil)
- **Language**: Solidity 0.8.30
- **Key Dependencies**:
  - OpenZeppelin Contracts (ERC20, ReentrancyGuard)
  - Pyth Network SDK v4.2.0
- **Main Contract**: `P2P.sol` - FIFO order book with oracle integration

### Frontend (`/frontend`)

- **Framework**: Next.js 14.2.4 (React 18)
- **Web3**: Wagmi + Viem for Ethereum interactions
- **State Management**: TanStack React Query
- **Charts**: Lightweight Charts library
- **Styling**: Custom CSS-in-JS with glassmorphism design

---

## Deployment

### Base Sepolia Testnet

- **Contract Address**: `0x4F7e5b32E1C1eA49c597E840804CE898F53cC149`
- **Deployment Block**: `32854371`
- **Explorer**: [View on BaseScan](https://sepolia.basescan.org/address/0x4F7e5b32E1C1eA49c597E840804CE898F53cC149)

## Tech Stack

**Smart Contracts**

- Foundry
- Solidity 0.8.30
- OpenZeppelin Contracts
- Pyth Network SDK

**Frontend**

- Next.js 14 (App Router)
- TypeScript
- Wagmi / Viem
- TanStack Query
- Lightweight Charts

**Infrastructure**

- Base Sepolia (L2)
- Pyth Network (Oracles)
- Hermes API (Price feeds)

---

## Getting Started

### Prerequisites

- Node.js 18+
- Foundry
- MetaMask or compatible Web3 wallet

### Smart Contracts

```bash
cd contracts

# Install dependencies
forge install

# Run tests
forge test

# Deploy to Base Sepolia (requires private key in .env)
./deploy-sepolia.sh
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

### Environment Variables

**Contracts** (`/contracts/.env`):

```
PRIVATE_KEY=your_private_key_here
BASE_SEPOLIA_RPC_URL=your_rpc_url
BASESCAN_API_KEY=your_basescan_api_key
```

**Frontend** (`/frontend/.env.local`):

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

---

## Project Structure

```
p33rX/
├── contracts/              # Foundry smart contracts
│   ├── src/
│   │   └── p2p.sol        # Main order book contract
│   ├── script/            # Deployment scripts
│   ├── test/              # Contract tests
│   └── foundry.toml       # Foundry config
│
├── frontend/              # Next.js application
│   ├── src/
│   │   ├── app/          # Next.js pages (App Router)
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Contract ABIs & utilities
│   └── package.json
│
└── README.md             # This file
```

---

## Key Smart Contract Functions

### `createMarket(address token0, address token1)`

Creates a new trading pair market.

### `createOrder(bytes32 marketId, uint256 amount0, uint256 minPrice, uint256 maxPrice)`

Creates a sell order. Requires token approval and oracle update fee.

### `fillOrderExactAmountIn(bytes32 marketId, uint256 amount1In)`

Fills orders FIFO. Takers specify how much they want to spend.

### `cancelOrReduceOrder(bytes32 marketId, uint256 orderId, uint256 reduceAmount)`

Cancel or partially reduce an order. Returns tokens to maker.

---

## Documentation

For detailed documentation on protocol mechanics, fee structure, and technical implementation, visit the `/docs` page in the application or see `/frontend/src/app/docs/page.tsx`.

---

## Links

- **Live Demo**: [Vercel](https://p33r-x.vercel.app/)
- **Contract Explorer**: [BaseScan](https://sepolia.basescan.org/address/0x4F7e5b32E1C1eA49c597E840804CE898F53cC149)
- **Pyth Network**: [pyth.network](https://pyth.network)

---

## Contributing

This project was built for ETHGlobal Online. Contributions, issues, and feature requests are welcome!

---
