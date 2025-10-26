// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Script.sol";
import "../src/p2p.sol";

/**
 * @title DeploySepolia
 * @notice Deploy P2P contract and configure price feeds for existing tokens
 * @dev Run deploy-tokens.sh FIRST to deploy mock tokens, then update addresses below
 */
contract DeploySepolia is Script {
    function run() external {
        // Load private key from environment variable
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Base Sepolia Pyth Oracle address
        address pythOracle = 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729;

        // =====================================================
        // TOKEN ADDRESSES - UPDATE AFTER RUNNING deploy-tokens.sh
        // =====================================================

        // Real Base Sepolia tokens (DO NOT CHANGE)
        address WETH = 0x4200000000000000000000000000000000000006;
        address USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
        address LINK = 0xE4aB69C077896252FAFBD49EFD26B5D171A32410;

        // Mock tokens (UPDATE THESE after running deploy-tokens.sh)
        address USDT = 0x5Fe161a97511aa3C185cBfFDCf281Fd510411343; //
        address cbDOGE = 0x58c445B391c553A216DEfEd1631997eddF604B49; //
        address cbBTC = 0xA4d20763EB35092bdd5B2545079AACF048fA96B7; //
        address SHIB = 0x7f24751c3aECdCC72981CBF9bbdefAD11094AB2D; //
        address AERO = 0x67Abb24DAC2b03550F6594909917a5BBDFDbEDb2; //
        address cbXRP = 0xbB792AfFD9152d17E0772e2B7CcE48A17103E59d; //
        address PEPE = 0x69F2ecec8707359204dea8249b64a5a3d3e1aE05; //

        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying P2P DEX to Base Sepolia ===");
        console.log("Deployer:", deployer);
        console.log("Pyth Oracle:", pythOracle);
        console.log("");

        // 1. Deploy P2P Contract
        console.log("1. Deploying P2P Contract...");
        P2P p2p = new P2P(pythOracle);
        console.log("   P2P deployed at:", address(p2p));
        console.log("");
        console.log("   Note: Run this script with --verify --verifier etherscan --etherscan-api-key $ETHERSCAN_API_KEY to verify on deployment");
        console.log("");

        // 2. Set up Price Feeds for ALL tokens
        console.log("2. Setting up Price Feeds...");
        console.log("");

        // Pyth price feed IDs
        bytes32 usdtPriceFeedId = 0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b;
        bytes32 cbDOGEPriceFeedId = 0x7eab5e260e42d81013207e623be60c66c9c55bfe0ace4797ad00d1c5a1335eae;
        bytes32 cbBTCPriceFeedId = 0x2817d7bfe5c64b8ea956e9a26f573ef64e72e4d7891f2d6af9bcc93f7aff9a97;
        bytes32 linkPriceFeedId = 0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221;
        bytes32 wethPriceFeedId = 0x9d4294bbcd1174d6f2003ec365831e64cc31d9f6f15a2b85399db8d5000960f6;
        bytes32 shibPriceFeedId = 0xf0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a;
        bytes32 aeroPriceFeedId = 0x9db37f4d5654aad3e37e2e14ffd8d53265fb3026d1d8f91146539eebaa2ef45f;
        bytes32 cbXRPPriceFeedId = 0x95fd9e16d4cfc5d1370f32bb0bf2346860ad9c92fec83acf4ca263baf16c961d;
        bytes32 usdcPriceFeedId = 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;
        bytes32 pepePriceFeedId = 0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4;

        // Set price feeds for real tokens
        p2p.setPriceFeed(WETH, wethPriceFeedId);
        console.log("   WETH price feed set");

        p2p.setPriceFeed(USDC, usdcPriceFeedId);
        console.log("   USDC price feed set");

        p2p.setPriceFeed(LINK, linkPriceFeedId);
        console.log("   LINK price feed set");

        // Set price feeds for mock tokens (only if deployed)
        if (USDT != address(0)) {
            p2p.setPriceFeed(USDT, usdtPriceFeedId);
            console.log("   USDT price feed set");
        }

        if (cbDOGE != address(0)) {
            p2p.setPriceFeed(cbDOGE, cbDOGEPriceFeedId);
            console.log("   cbDOGE price feed set");
        }

        if (cbBTC != address(0)) {
            p2p.setPriceFeed(cbBTC, cbBTCPriceFeedId);
            console.log("   cbBTC price feed set");
        }

        if (SHIB != address(0)) {
            p2p.setPriceFeed(SHIB, shibPriceFeedId);
            console.log("   SHIB price feed set");
        }

        if (AERO != address(0)) {
            p2p.setPriceFeed(AERO, aeroPriceFeedId);
            console.log("   AERO price feed set");
        }

        if (cbXRP != address(0)) {
            p2p.setPriceFeed(cbXRP, cbXRPPriceFeedId);
            console.log("   cbXRP price feed set");
        }

        if (PEPE != address(0)) {
            p2p.setPriceFeed(PEPE, pepePriceFeedId);
            console.log("   PEPE price feed set");
        }

        console.log("");

        vm.stopBroadcast();

        // Print summary
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Network: Base Sepolia (Chain ID: 84532)");
        console.log("");
        console.log("P2P Contract:");
        console.log("-------------");
        console.log("P2P: ", address(p2p));
        console.log("");
        console.log("Real Token Addresses (Base Sepolia):");
        console.log("-------------------------------------");
        console.log("WETH: ", WETH);
        console.log("USDC: ", USDC);
        console.log("LINK: ", LINK);
        console.log("");
        console.log("Mock Token Addresses:");
        console.log("---------------------");
        console.log("USDT:   ", USDT);
        console.log("cbDOGE: ", cbDOGE);
        console.log("cbBTC:  ", cbBTC);
        console.log("SHIB:   ", SHIB);
        console.log("AERO:   ", AERO);
        console.log("cbXRP:  ", cbXRP);
        console.log("PEPE:   ", PEPE);
        console.log("");
        console.log("Next Steps:");
        console.log(
            "1. Update frontend/src/app/config.ts with P2P address for baseSepolia"
        );
        console.log("2. Update frontend token list with all token addresses");
        console.log("3. Run: cd frontend && npm run dev");
        console.log("4. Connect MetaMask to Base Sepolia");
        console.log(
            "5. Users can call faucet() on mock tokens to get 1000 tokens!"
        );
        console.log("");
        console.log("Verification:");
        console.log("To deploy with automatic verification, run:");
        console.log("forge script script/DeploySepolia.s.sol:DeploySepolia --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify --verifier etherscan --etherscan-api-key $ETHERSCAN_API_KEY");
        console.log("");
        console.log("View on BaseScan:");
        console.log("https://sepolia.basescan.org/address/", address(p2p));
    }
}
