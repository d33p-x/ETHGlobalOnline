# Base Sepolia Deployment Guide

This guide explains how to deploy your P2P DEX to Base Sepolia with all supported tokens.

## Overview

We use a **two-step deployment process**:

1. **Deploy mock tokens ONCE** (saved permanently on Base Sepolia)
2. **Deploy P2P contract multiple times** (uses existing tokens)

This allows you to redeploy the P2P contract during the hackathon without wasting gas on token deployments!

---

## Supported Tokens

### Real Base Sepolia Tokens (Pre-deployed)

These are **already deployed** on Base Sepolia - we just use their addresses:

- **WETH**: `0x4200000000000000000000000000000000000006`
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **LINK**: `0xE4aB69C077896252FAFBD49EFD26B5D171A32410`

### Mock Tokens (Deploy Once)

These will be deployed by you **ONE TIME**:

- **USDT** (Tether USD) - 6 decimals
- **cbDOGE** (Coinbase Wrapped DOGE) - 8 decimals
- **cbBTC** (Coinbase Wrapped BTC) - 8 decimals
- **SHIB** (Shiba Inu) - 18 decimals
- **AERO** (Aerodrome) - 18 decimals
- **PEPE** (Pepe) - 18 decimals

All mock tokens have a `faucet()` function that gives users **1000 tokens per call**!

---

## Step-by-Step Deployment

### Prerequisites

1. **Base Sepolia ETH** - Get from [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
2. **Private Key** - Your wallet's private key (keep it safe!)
3. **Foundry** - Make sure you have forge installed

### Step 1: Set Up Environment

```bash
cd contracts
cp .env.example .env
```

Edit `.env` and add your private key (without `0x` prefix):

```
PRIVATE_KEY=your_private_key_here_without_0x
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

### Step 2: Deploy Mock Tokens (ONE TIME ONLY)

⚠️ **IMPORTANT**: Only run this ONCE! Save the addresses.

```bash
./deploy-tokens.sh
```

You'll see output like:

```
Mock Token Addresses (COPY THESE):
-----------------------------------
USDT:    0x123...abc
cbDOGE:  0x456...def
cbBTC:   0x789...ghi
SHIB:    0xabc...123
AERO:    0xdef...456
PEPE:    0xghi...789
```

**Save these addresses!** You need them for the next step.

### Step 3: Update DeploySepolia.s.sol

Edit `script/DeploySepolia.s.sol` and replace the mock token addresses:

```solidity
// Mock tokens (UPDATE THESE after running deploy-tokens.sh)
address USDT = 0x123...abc;   // Replace with your USDT address
address cbDOGE = 0x456...def;  // Replace with your cbDOGE address
address cbBTC = 0x789...ghi;   // Replace with your cbBTC address
address SHIB = 0xabc...123;    // Replace with your SHIB address
address AERO = 0xdef...456;    // Replace with your AERO address
address PEPE = 0xghi...789;    // Replace with your PEPE address
```

### Step 4: Deploy P2P Contract (Run Multiple Times)

Now you can deploy (and redeploy) the P2P contract as many times as you want:

```bash
./deploy-sepolia.sh
```

You'll see:

```
P2P Contract:
-------------
P2P: 0xP2P...address
```

**Copy this P2P address** - you need it for the frontend!

### Step 5: Update Frontend Configuration

Edit `frontend/src/app/config.ts`:

```typescript
[baseSepolia.id]: {
  p2pAddress: "0xP2P...address", // Your P2P contract address
  tokens: {
    // Real tokens (already correct)
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    LINK: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    // Mock tokens (update with your addresses)
    USDT: "0x123...abc",
    cbDOGE: "0x456...def",
    cbBTC: "0x789...ghi",
    SHIB: "0xabc...123",
    AERO: "0xdef...456",
    PEPE: "0xghi...789",
  },
},
```

### Step 6: Run the Frontend

```bash
cd ../frontend
npm run dev
```

Open http://localhost:3000 and use the network selector to switch to Base Sepolia!

---

## Pyth Price Feeds

All tokens are configured with Pyth Network price feeds:

| Token  | Price Feed ID                                                        |
| ------ | -------------------------------------------------------------------- |
| USDT   | `0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b` |
| cbDOGE | `0x7eab5e260e42d81013207e623be60c66c9c55bfe0ace4797ad00d1c5a1335eae` |
| cbBTC  | `0x2817d7bfe5c64b8ea956e9a26f573ef64e72e4d7891f2d6af9bcc93f7aff9a97` |
| LINK   | `0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221` |
| WETH   | `0x9d4294bbcd1174d6f2003ec365831e64cc31d9f6f15a2b85399db8d5000960f6` |
| SHIB   | `0xf0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a` |
| AERO   | `0x9db37f4d5654aad3e37e2e14ffd8d53265fb3026d1d8f91146539eebaa2ef45f` |
| USDC   | `0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a` |
| PEPE   | `0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4` |

---

## Getting Test Tokens

### For Real Tokens (WETH, USDC, LINK)

You'll need to bridge/swap on Base Sepolia using standard faucets or bridges.

### For Mock Tokens

Any user can call `faucet()` on the token contracts to get **1000 tokens**!

```solidity
// Example: Get 1000 USDT
IERC20(usdtAddress).faucet();
```

Or via Etherscan:

1. Go to the token address on [BaseScan Sepolia](https://sepolia.basescan.org)
2. Go to "Write Contract"
3. Connect your wallet
4. Call `faucet()`
5. Receive 1000 tokens!

---

## Redeploying P2P Contract

During the hackathon, you might need to fix bugs or add features. Here's how:

1. **DON'T** run `deploy-tokens.sh` again (tokens are permanent!)
2. **Just** run `./deploy-sepolia.sh` to deploy a new P2P contract
3. Update the frontend config with the new P2P address
4. All your tokens still work with the new contract!

---

## Troubleshooting

### "Insufficient balance" error

- Make sure you have Base Sepolia ETH for gas
- Get more from the [faucet](https://www.alchemy.com/faucets/base-sepolia)

### "Invalid token address" error

- Check that you copied all addresses correctly
- Make sure there are no extra spaces or quotes

### Tokens not showing in frontend

- Verify addresses in `frontend/src/app/config.ts`
- Check that addresses match deployment output
- Restart the frontend dev server

### Can't get test tokens

- For mock tokens: Call `faucet()` on the contract
- For real tokens: Use Base Sepolia bridges/faucets

---

## Quick Reference

**Deploy tokens (once)**: `./deploy-tokens.sh`
**Deploy P2P (multiple times)**: `./deploy-sepolia.sh`
**Update frontend config**: `frontend/src/app/config.ts`
**Run frontend**: `cd frontend && npm run dev`

---

## View on BaseScan

All your contracts will be visible on Base Sepolia Explorer:
https://sepolia.basescan.org/address/YOUR_CONTRACT_ADDRESS

Good luck with your hackathon! 🚀
