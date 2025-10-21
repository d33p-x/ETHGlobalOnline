#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}P2P DEX Local Deployment${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if Anvil is running
if ! nc -z localhost 8545 2>/dev/null; then
    echo -e "${RED}Error: Anvil is not running${NC}"
    echo -e "${YELLOW}Please start Anvil in another terminal:${NC}"
    echo "  anvil"
    exit 1
fi

echo -e "${GREEN}✓ Anvil detected${NC}"
echo ""

# Run deployment script
echo -e "${YELLOW}Deploying contracts...${NC}"
forge script script/DeployLocal.s.sol:DeployLocal --rpc-url http://127.0.0.1:8545 --broadcast -vvv

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Deployment successful!${NC}"
    echo ""
    echo -e "${YELLOW}To update the frontend:${NC}"
    echo "1. Copy the contract addresses from above"
    echo "2. Edit frontend/src/config/contracts.ts"
    echo "3. Update CONTRACT_ADDRESSES[31337] and TOKEN_ADDRESSES[31337]"
    echo ""
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi
