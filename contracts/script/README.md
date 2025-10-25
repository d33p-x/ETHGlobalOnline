# Bulk Order Creation Script

This script creates 50 WETH/USDT sell orders on the P2P exchange contract.

## Configuration

- **Contract Address**: `0x41d897084fD42d0509f752954FEcf48C62307b3f`
- **WETH**: `0x4200000000000000000000000000000000000006`
- **USDT**: `0x5Fe161a97511aa3C185cBfFDCf281Fd510411343`
- **Orders**: 50 (configurable via `NUM_ORDERS` in the script)
- **Amount per order**: 0.01 WETH
- **Min Price**: 0 (no limit)
- **Max Price**: 0 (no limit)

## Prerequisites

1. **Node.js** and **npm** installed
2. **Foundry** installed
3. **ethers** package (will be auto-installed if missing)
4. `.env` file with `PRIVATE_KEY` and `BASE_SEPOLIA_RPC_URL`

## How to Run

### Option 1: Using the bash script (easiest)

```bash
cd contracts
./script/run-bulk-orders.sh
```

### Option 2: Using forge directly

```bash
cd contracts

# Install ethers if needed
npm install --no-save ethers

# Run the script
forge script script/CreateBulkOrders.s.sol:CreateBulkOrders \
    --rpc-url $BASE_SEPOLIA_RPC_URL \
    --broadcast \
    --ffi \
    -vvv
```

## Files

- `CreateBulkOrders.s.sol` - Main Foundry script
- `fetchPythData.js` - Helper Node.js script to fetch Pyth price updates
- `run-bulk-orders.sh` - Convenience bash script
- `README.md` - This file

## How it Works

**Important**: To avoid Pyth price staleness issues, the script runs 50 separate executions (1 order each) instead of 1 execution with 50 orders.

1. The bash wrapper script (`run-bulk-orders.sh`) loops 50 times
2. Each iteration:
   - Runs the Foundry script once (creates 1 order)
   - The Foundry script calls `fetchPythData.js` to get fresh WETH price
   - The Node.js script fetches from Pyth Hermes API and ABI-encodes the data
   - Sends a transaction to create an order with 0.01 WETH
   - Waits 2 seconds before the next iteration (ensures fresh Pyth prices)
3. Progress is logged for each order
4. Final summary shows successful/failed orders

**Why this approach?**
- Pyth prices must be < 60 seconds old
- During Foundry simulation, all transactions use the same price data
- By running 50 separate executions, each transaction gets fresh price data
- This eliminates "price too stale" errors

## Notes

- The script uses Foundry's `ffi` feature to call the Node.js helper
- Each order costs 0.01 WETH + Pyth update fee (small amount of ETH)
- Total cost: ~0.5 WETH + gas fees for 50 transactions
- The contract must already have approval to spend WETH
- Orders have no price limits (min=0, max=0)
- With 2-second delays, the script takes ~100 seconds (~1.7 minutes) to complete
- To create more/fewer orders, change `NUM_ORDERS` variable in `run-bulk-orders.sh`

## Troubleshooting

**Error: "FFI disabled"**
- Make sure you use the `--ffi` flag when running forge

**Error: "Cannot find module 'ethers'"**
- Run `npm install --no-save ethers` in the contracts directory

**Error: "Order failed: insufficient balance"**
- Make sure you have at least 1 WETH in your wallet

**Error: "Order failed: ERC20: insufficient allowance"**
- The contract needs approval to spend WETH. Run the approval transaction first.
