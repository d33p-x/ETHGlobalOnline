// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title MockPyth
 * @notice Mock implementation of Pyth oracle for local testing
 * @dev Returns configurable fake prices for testing the P2P contract
 */
contract MockPyth is IPyth {
    mapping(bytes32 => PythStructs.Price) private prices;
    mapping(bytes32 => PythStructs.PriceFeed) private priceFeeds;

    uint256 public updateFee = 0; // No fee for testing

    // Set a price for a specific price feed
    function setPrice(bytes32 id, int64 price, uint64 conf, int32 expo, uint publishTime) external {
        prices[id] = PythStructs.Price({
            price: price,
            conf: conf,
            expo: expo,
            publishTime: publishTime
        });

        priceFeeds[id] = PythStructs.PriceFeed({
            id: id,
            price: prices[id],
            emaPrice: prices[id]
        });
    }

    // Simplified version - just set price with common defaults
    function setTestPrice(bytes32 id, int64 price) external {
        // Calculate confidence as 1% of absolute price value
        uint64 conf;
        if (price >= 0) {
            conf = uint64(int64(price / 100));
        } else {
            conf = uint64(int64(-price / 100));
        }

        prices[id] = PythStructs.Price({
            price: price,
            conf: conf,
            expo: -8, // 8 decimals
            publishTime: block.timestamp
        });

        priceFeeds[id] = PythStructs.PriceFeed({
            id: id,
            price: prices[id],
            emaPrice: prices[id]
        });
    }

    function getUpdateFee(bytes[] calldata) external view override returns (uint feeAmount) {
        return updateFee;
    }

    function getPrice(bytes32 id) external view returns (PythStructs.Price memory price) {
        require(prices[id].publishTime > 0, "Price not set");
        return prices[id];
    }

    function getPriceUnsafe(bytes32 id) external view returns (PythStructs.Price memory price) {
        return prices[id];
    }

    function getPriceNoOlderThan(bytes32 id, uint age) external view returns (PythStructs.Price memory price) {
        require(prices[id].publishTime > 0, "Price not set");
        require(block.timestamp - prices[id].publishTime <= age, "Price too old");
        return prices[id];
    }

    function getEmaPriceUnsafe(bytes32 id) external view returns (PythStructs.Price memory price) {
        return prices[id];
    }

    function getEmaPriceNoOlderThan(bytes32 id, uint age) external view returns (PythStructs.Price memory price) {
        require(prices[id].publishTime > 0, "Price not set");
        require(block.timestamp - prices[id].publishTime <= age, "Price too old");
        return prices[id];
    }

    function updatePriceFeeds(bytes[] calldata) external payable override {
        // Mock - do nothing, prices are set manually
    }

    function updatePriceFeedsIfNecessary(
        bytes[] calldata,
        bytes32[] calldata,
        uint64[] calldata
    ) external payable override {
        // Mock - do nothing
    }

    function parsePriceFeedUpdates(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64
    ) external payable override returns (PythStructs.PriceFeed[] memory feeds) {
        // Return empty array for mock
        feeds = new PythStructs.PriceFeed[](0);
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64
    ) external payable override returns (PythStructs.PriceFeed[] memory feeds) {
        // Return empty array for mock
        feeds = new PythStructs.PriceFeed[](0);
    }

    function getValidTimePeriod() external pure returns (uint) {
        return 60; // 60 seconds validity for testing
    }

    // Additional required functions from newer IPyth versions
    function getTwapUpdateFee(bytes[] calldata) external view returns (uint feeAmount) {
        return updateFee;
    }

    function parsePriceFeedUpdatesWithConfig(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64,
        bool,
        bool,
        bool
    ) external payable returns (PythStructs.PriceFeed[] memory feeds, uint64[] memory slots) {
        feeds = new PythStructs.PriceFeed[](0);
        slots = new uint64[](0);
    }

    function parseTwapPriceFeedUpdates(
        bytes[] calldata,
        bytes32[] calldata
    ) external payable returns (PythStructs.TwapPriceFeed[] memory twapFeeds) {
        twapFeeds = new PythStructs.TwapPriceFeed[](0);
    }

    function setUpdateFee(uint256 fee) external {
        updateFee = fee;
    }
}
