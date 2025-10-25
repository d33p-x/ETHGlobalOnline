// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Script.sol";
import "../src/p2p.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CreateBulkOrders is Script {
    // Contract addresses
    address constant P2P_CONTRACT = 0x41d897084fD42d0509f752954FEcf48C62307b3f;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDT = 0x5Fe161a97511aa3C185cBfFDCf281Fd510411343;

    // Order parameters
    uint256 constant ORDERS_TO_CREATE = 1; // Create 1 order per script run (avoids stale price issues)
    uint256 constant AMOUNT_PER_ORDER = 0.01 ether; // 0.01 WETH
    uint256 constant MIN_PRICE = 0; // No min price
    uint256 constant MAX_PRICE = 0; // No max price

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        P2P p2p = P2P(P2P_CONTRACT);

        // Get Pyth contract address
        IPyth pyth = p2p.pyth();

        // Fetch price feed for WETH (we only need WETH price feed since USDT would be needed for fills)
        // WETH price feed ID on Base Sepolia
        bytes32 wethPriceFeedId = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

        // Create price feed IDs array
        bytes32[] memory priceFeedIds = new bytes32[](1);
        priceFeedIds[0] = wethPriceFeedId;

        console.log("Creating 1 order: 0.01 WETH");

        // Fetch latest price update from Pyth Hermes API
        bytes[] memory priceUpdate = getPriceUpdate(priceFeedIds);

        // Get update fee
        uint256 fee = pyth.getUpdateFee(priceUpdate);

        // Create order
        p2p.createOrder{value: fee}(
            WETH,
            USDT,
            AMOUNT_PER_ORDER,
            MAX_PRICE,
            MIN_PRICE,
            priceUpdate
        );

        vm.stopBroadcast();

        console.log("Order created successfully!");
    }

    // Helper function to get price update from Pyth Hermes API
    function getPriceUpdate(
        bytes32[] memory /* priceFeedIds */
    ) internal returns (bytes[] memory) {
        // Use Node.js helper script to fetch and parse Pyth data
        string[] memory inputs = new string[](2);
        inputs[0] = "node";
        inputs[1] = "script/fetchPythData.js";

        bytes memory result = vm.ffi(inputs);

        // Decode the result from the helper script
        // The helper returns ABI-encoded bytes[] array
        bytes[] memory updateData = abi.decode(result, (bytes[]));

        return updateData;
    }
}
