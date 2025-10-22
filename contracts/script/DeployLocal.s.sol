// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Script.sol";
import "../src/p2p.sol";
import "../test/MockERC20.sol";
import {MockPyth} from "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract DeployLocal is Script {
    function run() external {
        // Anvil default private key (Account #0)
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        // Anvil accounts
        address deployer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // Account #0
        address user1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;    // Account #1
        address user2 = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;    // Account #2

        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying P2P DEX Local Setup ===");
        console.log("Deployer:", deployer);
        console.log("");

        // 1. Deploy Mock Pyth Oracle
        console.log("1. Deploying Mock Pyth Oracle...");
        // Deploy MockPyth with 365 days validity (31536000 seconds) and 0 wei update fee
        // This prevents StalePrice errors during local testing
        MockPyth mockPyth = new MockPyth(31536000, 0);
        console.log("   MockPyth deployed at:", address(mockPyth));
        console.log("   (Prices valid for 365 days - no refresh needed!)");
        console.log("");

        // 2. Deploy P2P Contract
        console.log("2. Deploying P2P Contract...");
        P2P p2p = new P2P(address(mockPyth));
        console.log("   P2P deployed at:", address(p2p));
        console.log("");

        // 3. Deploy Mock ERC20 Tokens
        console.log("3. Deploying Mock ERC20 Tokens...");

        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6); // 6 decimals like real USDC
        console.log("   USDC deployed at:", address(usdc));

        MockERC20 pepe = new MockERC20("Pepe", "PEPE", 18);
        console.log("   PEPE deployed at:", address(pepe));

        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        console.log("   WETH deployed at:", address(weth));
        console.log("");

        // 4. Set up Price Feeds (using the same IDs as in tests)
        console.log("4. Setting up Price Feeds...");

        bytes32 usdcPriceFeedId = 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a; // USDC/USD
        bytes32 pepePriceFeedId = 0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4; // PEPE/USD
        bytes32 wethPriceFeedId = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace; // ETH/USD

        p2p.setPriceFeed(address(usdc), usdcPriceFeedId);
        console.log("   USDC price feed set");

        p2p.setPriceFeed(address(pepe), pepePriceFeedId);
        console.log("   PEPE price feed set");

        p2p.setPriceFeed(address(weth), wethPriceFeedId);
        console.log("   WETH price feed set");
        console.log("");

        // 5. Set Mock Prices in Pyth Oracle
        console.log("5. Setting Mock Prices in Pyth Oracle...");

        // USDC = $1.00 (price: 100000000, expo: -8 = $1.00)
        bytes[] memory usdcUpdateData = new bytes[](1);
        usdcUpdateData[0] = mockPyth.createPriceFeedUpdateData(
            usdcPriceFeedId,
            100000000, // price
            1000000,   // conf
            -8,        // expo
            100000000, // emaPrice
            1000000,   // emaConf
            uint64(block.timestamp), // publishTime
            0          // prevPublishTime
        );
        mockPyth.updatePriceFeeds(usdcUpdateData);
        console.log("   USDC price set to $1.00");

        // PEPE = $0.000001 (price: 100, expo: -8 = $0.000001)
        bytes[] memory pepeUpdateData = new bytes[](1);
        pepeUpdateData[0] = mockPyth.createPriceFeedUpdateData(
            pepePriceFeedId,
            100,       // price
            1,         // conf
            -8,        // expo
            100,       // emaPrice
            1,         // emaConf
            uint64(block.timestamp), // publishTime
            0          // prevPublishTime
        );
        mockPyth.updatePriceFeeds(pepeUpdateData);
        console.log("   PEPE price set to $0.000001");

        // WETH = $3,000 (price: 300000000000, expo: -8 = $3000.00)
        bytes[] memory wethUpdateData = new bytes[](1);
        wethUpdateData[0] = mockPyth.createPriceFeedUpdateData(
            wethPriceFeedId,
            300000000000, // price
            3000000000,   // conf
            -8,           // expo
            300000000000, // emaPrice
            3000000000,   // emaConf
            uint64(block.timestamp), // publishTime
            0             // prevPublishTime
        );
        mockPyth.updatePriceFeeds(wethUpdateData);
        console.log("   WETH price set to $3,000.00");
        console.log("");

        // 6. Mint tokens to deployer, user1, and user2
        console.log("6. Distributing Tokens...");

        // Mint to deployer
        usdc.mint(deployer, 100000 * 10**6); // 100k USDC (6 decimals)
        pepe.mint(deployer, 1000000 * 10**18); // 1M PEPE
        weth.mint(deployer, 100 * 10**18); // 100 WETH
        console.log("   Minted to deployer (", deployer, ")");
        console.log("     - 100,000 USDC");
        console.log("     - 1,000,000 PEPE");
        console.log("     - 100 WETH");

        // Mint to user1
        usdc.mint(user1, 100000 * 10**6);
        pepe.mint(user1, 1000000 * 10**18);
        weth.mint(user1, 100 * 10**18);
        console.log("   Minted to user1 (", user1, ")");
        console.log("     - 100,000 USDC");
        console.log("     - 1,000,000 PEPE");
        console.log("     - 100 WETH");

        // Mint to user2
        usdc.mint(user2, 100000 * 10**6);
        pepe.mint(user2, 1000000 * 10**18);
        weth.mint(user2, 100 * 10**18);
        console.log("   Minted to user2 (", user2, ")");
        console.log("     - 100,000 USDC");
        console.log("     - 1,000,000 PEPE");
        console.log("     - 100 WETH");
        console.log("");

        vm.stopBroadcast();

        // Print summary
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Contract Addresses:");
        console.log("-------------------");
        console.log("MockPyth:  ", address(mockPyth));
        console.log("P2P:       ", address(p2p));
        console.log("USDC:      ", address(usdc));
        console.log("PEPE:      ", address(pepe));
        console.log("WETH:      ", address(weth));
        console.log("");
        console.log("Price Feed IDs:");
        console.log("-------------------");
        console.log("USDC: 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a");
        console.log("PEPE: 0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4");
        console.log("WETH: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace");
        console.log("");
        console.log("Test Accounts (with tokens):");
        console.log("-------------------");
        console.log("Deployer: ", deployer);
        console.log("User1:    ", user1);
        console.log("User2:    ", user2);
        console.log("");
        console.log("Next Steps:");
        console.log("1. Update frontend/src/config/contracts.ts with these addresses");
        console.log("2. Run: cd frontend && npm run dev");
        console.log("3. Connect MetaMask to Anvil (localhost:8545, Chain ID: 31337)");
        console.log("4. Import private keys to test with different accounts");
        console.log("");
        console.log("Private Keys (for MetaMask import):");
        console.log("Deployer: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
        console.log("User1:    0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
        console.log("User2:    0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
    }
}
