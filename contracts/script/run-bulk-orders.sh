#!/bin/bash

# Script to create 50 WETH/USDT orders on the P2P contract
# Runs the order creation script 50 times (1 order per run) to avoid stale price issues

# Number of orders to create
NUM_ORDERS=50

# Load environment variables from .env file
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo "Error: .env file not found!"
    echo "Please create a .env file with PRIVATE_KEY and BASE_SEPOLIA_RPC_URL"
    exit 1
fi

# Check if RPC URL is set
if [ -z "$BASE_SEPOLIA_RPC_URL" ]; then
    echo "Error: BASE_SEPOLIA_RPC_URL not found in .env file!"
    exit 1
fi

echo "===================================="
echo "Creating $NUM_ORDERS WETH/USDT Orders"
echo "===================================="
echo ""
echo "Contract: 0x41d897084fD42d0509f752954FEcf48C62307b3f"
echo "WETH:     0x4200000000000000000000000000000000000006"
echo "USDT:     0x5Fe161a97511aa3C185cBfFDCf281Fd510411343"
echo "Amount:   0.01 WETH per order"
echo "Min/Max:  No price limits (0/0)"
echo ""
echo "Strategy: Running script $NUM_ORDERS times (1 order per run)"
echo "           This ensures fresh Pyth prices for each order"
echo ""
echo "===================================="
echo ""

# Make sure ethers is installed for the Node.js helper
if ! node -e "require('ethers')" 2>/dev/null; then
    echo "Installing ethers package..."
    npm install --no-save ethers
    echo ""
fi

# Counter for successful orders
SUCCESS_COUNT=0
FAIL_COUNT=0

# Run the script NUM_ORDERS times
for i in $(seq 1 $NUM_ORDERS); do
    echo "[$i/$NUM_ORDERS] Creating order..."

    # Run the Foundry script with FFI enabled
    if forge script script/CreateBulkOrders.s.sol:CreateBulkOrders \
        --rpc-url "$BASE_SEPOLIA_RPC_URL" \
        --broadcast \
        --ffi \
        -vv 2>&1 | grep -q "Order created successfully"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "[$i/$NUM_ORDERS] ✓ Success"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "[$i/$NUM_ORDERS] ✗ Failed"
    fi

    echo ""

    # Small delay to ensure fresh prices and avoid rate limiting
    if [ $i -lt $NUM_ORDERS ]; then
        sleep 2
    fi
done

echo ""
echo "===================================="
echo "All orders processed!"
echo "===================================="
echo "Successful: $SUCCESS_COUNT"
echo "Failed:     $FAIL_COUNT"
echo "===================================="
