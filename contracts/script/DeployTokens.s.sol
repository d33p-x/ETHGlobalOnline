// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Script.sol";
import "../test/MockERC20.sol";

/**
 * @title DeployTokens
 * @notice Deploy mock ERC20 tokens ONCE on Base Sepolia
 * @dev Run this script first, then save the addresses for DeploySepolia.s.sol
 */
contract DeployTokens is Script {
    function run() external {
        // Load private key from environment variable
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying Mock Tokens to Base Sepolia ===");
        console.log("Deployer:", deployer);
        console.log("");

        // Deploy mock tokens (these will be deployed once)
        console.log("Deploying Mock Tokens...");
        console.log("");
        console.log("Note: Run this script with --verify --verifier etherscan --etherscan-api-key $ETHERSCAN_API_KEY to verify on deployment");
        console.log("");

        MockERC20 usdt = new MockERC20("Tether USD", "USDT", 6);
        console.log("USDT deployed at:   ", address(usdt));

        MockERC20 cbDOGE = new MockERC20("Coinbase Wrapped DOGE", "cbDOGE", 8);
        console.log("cbDOGE deployed at: ", address(cbDOGE));

        MockERC20 cbBTC = new MockERC20("Coinbase Wrapped BTC", "cbBTC", 8);
        console.log("cbBTC deployed at:  ", address(cbBTC));

        MockERC20 shib = new MockERC20("Shiba Inu", "SHIB", 18);
        console.log("SHIB deployed at:   ", address(shib));

        MockERC20 aero = new MockERC20("Aerodrome", "AERO", 18);
        console.log("AERO deployed at:   ", address(aero));

        MockERC20 cbXRP = new MockERC20("Coinbase Wrapped XRP", "cbXRP", 6);
        console.log("cbXRP deployed at:  ", address(cbXRP));

        // For local testing, also deploy PEPE
        MockERC20 pepe = new MockERC20("Pepe", "PEPE", 18);
        console.log("PEPE deployed at:   ", address(pepe));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Token Deployment Complete ===");
        console.log("");
        console.log("Mock Token Addresses (COPY THESE):");
        console.log("-----------------------------------");
        console.log("USDT:   ", address(usdt));
        console.log("cbDOGE: ", address(cbDOGE));
        console.log("cbBTC:  ", address(cbBTC));
        console.log("SHIB:   ", address(shib));
        console.log("AERO:   ", address(aero));
        console.log("cbXRP:  ", address(cbXRP));
        console.log("PEPE:   ", address(pepe));
        console.log("");
        console.log("Real Token Addresses (Base Sepolia):");
        console.log("-------------------------------------");
        console.log("WETH:   0x4200000000000000000000000000000000000006");
        console.log("USDC:   0x036CbD53842c5426634e7929541eC2318f3dCF7e");
        console.log("LINK:   0xE4aB69C077896252FAFBD49EFD26B5D171A32410");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Copy the mock token addresses above");
        console.log("2. Update DeploySepolia.s.sol with these addresses");
        console.log("3. Run ./deploy-sepolia.sh to deploy P2P contract");
        console.log("");
        console.log(
            "Users can call faucet() on any mock token to get 1000 tokens!"
        );
        console.log("");
        console.log("Verification:");
        console.log("To deploy with automatic verification, run:");
        console.log("forge script script/DeployTokens.s.sol:DeployTokens --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify --verifier etherscan --etherscan-api-key $ETHERSCAN_API_KEY");
        console.log("");
        console.log("View on BaseScan:");
        console.log("https://sepolia.basescan.org/address/", address(usdt));
    }
}
