#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== P2P DEX Base Sepolia Deployment ===${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file with your PRIVATE_KEY and BASE_SEPOLIA_RPC_URL"
    echo "You can copy .env.example: cp .env.example .env"
    exit 1
fi

# Load environment variables
source .env

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY not set in .env file${NC}"
    exit 1
fi

# Check if ETHERSCAN_API_KEY is set
if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo -e "${YELLOW}Warning: ETHERSCAN_API_KEY not set - contracts will not be verified${NC}"
    echo -e "${YELLOW}Add ETHERSCAN_API_KEY to .env for automatic verification${NC}"
    VERIFY_FLAGS=""
else
    echo -e "${GREEN}Etherscan API key found - contracts will be verified${NC}"
    VERIFY_FLAGS="--verify --verifier etherscan --etherscan-api-key $ETHERSCAN_API_KEY"
fi

# Use public RPC if not provided
if [ -z "$BASE_SEPOLIA_RPC_URL" ]; then
    echo -e "${YELLOW}Warning: BASE_SEPOLIA_RPC_URL not set, using public endpoint${NC}"
    export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
fi

echo "RPC URL: $BASE_SEPOLIA_RPC_URL"
echo ""

# Run the deployment
echo -e "${GREEN}Starting deployment to Base Sepolia...${NC}"
echo ""

forge script script/DeploySepolia.s.sol:DeploySepolia \
    --rpc-url $BASE_SEPOLIA_RPC_URL \
    --broadcast \
    $VERIFY_FLAGS \
    -vvv

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=== Deployment Successful! ===${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Copy the contract addresses from above"
    echo "2. Update frontend/src/app/config.ts with the Base Sepolia addresses"
    echo "3. Run: cd ../frontend && npm run dev"
    echo "4. Connect MetaMask to Base Sepolia and use the network selector"
    echo ""
else
    echo ""
    echo -e "${RED}=== Deployment Failed ===${NC}"
    echo "Check the error messages above"
    exit 1
fi
