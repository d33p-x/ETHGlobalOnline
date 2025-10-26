#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Deploy Mock Tokens to Base Sepolia (ONE TIME ONLY) ===${NC}"
echo ""
echo -e "${YELLOW}WARNING: Only run this script ONCE!${NC}"
echo -e "${YELLOW}Token addresses will be saved and reused for future P2P deployments.${NC}"
echo ""
read -p "Are you sure you want to deploy new tokens? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Deployment cancelled."
    exit 1
fi

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
echo -e "${GREEN}Starting token deployment to Base Sepolia...${NC}"
echo ""

forge script script/DeployTokens.s.sol:DeployTokens \
    --rpc-url $BASE_SEPOLIA_RPC_URL \
    --broadcast \
    $VERIFY_FLAGS \
    -vvv

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=== Token Deployment Successful! ===${NC}"
    echo ""
    echo -e "${YELLOW}IMPORTANT:${NC}"
    echo "1. Copy the token addresses from above"
    echo "2. Update script/DeploySepolia.s.sol with these addresses"
    echo "3. Run ./deploy-sepolia.sh to deploy the P2P contract"
    echo ""
    echo -e "${GREEN}You don't need to run this script again!${NC}"
    echo "The tokens are now permanently deployed on Base Sepolia."
    echo ""
else
    echo ""
    echo -e "${RED}=== Token Deployment Failed ===${NC}"
    echo "Check the error messages above"
    exit 1
fi
