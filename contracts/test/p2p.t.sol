// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {P2P} from "../src/p2p.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(
            allowance[from][msg.sender] >= amount,
            "Insufficient allowance"
        );
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }
}

contract PEERTOPEERTEST is Test {
    P2P p2p;
    MockERC20 usdc;
    MockERC20 pepe;
    MockERC20 weth;

    address user1 = address(0x1);
    address user2 = address(0x2);
    address user3 = address(0x3);

    function setUp() public {
        // Deploy P2P contract
        p2p = new P2P(0x4305FB66699C3B2702D4d05CF36551390A4c69C6);

        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC");
        pepe = new MockERC20("Pepe", "PEPE");
        weth = new MockERC20("Wrapped ETH", "WETH");

        // Set price feeds
        p2p.setPriceFeed(
            address(usdc),
            0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a
        );
        p2p.setPriceFeed(
            address(pepe),
            0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4
        );
        p2p.setPriceFeed(
            address(weth),
            0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
        );

        // Mint tokens to users
        usdc.mint(user1, 10000e18);
        usdc.mint(user2, 10000e18);
        usdc.mint(user3, 10000e18);

        pepe.mint(user1, 10000e18);
        pepe.mint(user2, 10000e18);
        pepe.mint(user3, 10000e18);

        weth.mint(user1, 100e18);
        weth.mint(user2, 100e18);
        weth.mint(user3, 100e18);
    }

    // ===== Market Creation Tests =====

    function test_createMarket() public {
        p2p.createMarket(address(usdc), address(pepe));

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (
            address tokenSell,
            address tokenBuy,
            uint256 headId,
            uint256 tailId,
            uint256 totalLiquidity,
            uint256 nextOrderId
        ) = p2p.markets(marketId);

        assertEq(tokenSell, address(usdc));
        assertEq(tokenBuy, address(pepe));
    }

    function test_createMarket_EmitsEvent() public {
        bytes32 expectedMarketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );

        vm.expectEmit(true, true, true, true);
        emit P2P.MarketCreated(expectedMarketId, address(usdc), address(pepe));

        p2p.createMarket(address(usdc), address(pepe));
    }

    function test_createMarket_RevertsIfTokensAreSame() public {
        vm.expectRevert("Tokens must be different");
        p2p.createMarket(address(usdc), address(usdc));
    }

    function test_createMarket_RevertsIfMarketExists() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.expectRevert("Market already exists");
        p2p.createMarket(address(usdc), address(pepe));
    }

    function test_createMarket_RevertsIfNoPriceFeed() public {
        MockERC20 unknownToken = new MockERC20("Unknown", "UNK");

        vm.expectRevert();
        p2p.createMarket(address(unknownToken), address(usdc));
    }

    // ===== Order Creation Tests =====

    function test_createOrder() public {
        // Create market first
        p2p.createMarket(address(usdc), address(pepe));

        // User1 creates order
        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);
        vm.stopPrank();

        // Verify order was created
        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (
            ,
            ,
            uint256 headId,
            uint256 tailId,
            uint256 totalLiquidity,
            uint256 nextOrderId
        ) = p2p.markets(marketId);

        assertEq(headId, 1);
        assertEq(tailId, 1);
        assertEq(totalLiquidity, 1000e18);
        assertEq(nextOrderId, 2);
        assertEq(usdc.balanceOf(address(p2p)), 1000e18);
    }

    function test_createOrder_MultipleOrders() public {
        p2p.createMarket(address(usdc), address(pepe));

        // User1 creates first order
        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);
        vm.stopPrank();

        // User2 creates second order
        vm.startPrank(user2);
        usdc.approve(address(p2p), 2000e18);
        p2p.createOrder(address(usdc), address(pepe), 2000e18, 0, 0);
        vm.stopPrank();

        // User3 creates third order
        vm.startPrank(user3);
        usdc.approve(address(p2p), 500e18);
        p2p.createOrder(address(usdc), address(pepe), 500e18, 0, 0);
        vm.stopPrank();

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (
            ,
            ,
            uint256 headId,
            uint256 tailId,
            uint256 totalLiquidity,
            uint256 nextOrderId
        ) = p2p.markets(marketId);

        assertEq(headId, 1);
        assertEq(tailId, 3);
        assertEq(totalLiquidity, 3500e18);
        assertEq(nextOrderId, 4);
        assertEq(usdc.balanceOf(address(p2p)), 3500e18);
    }

    function test_createOrder_RevertsIfMarketDoesntExist() public {
        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);

        vm.expectRevert("market doesnt exist");
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);
        vm.stopPrank();
    }

    // ===== Cancel/Reduce Order Tests =====

    function test_cancelOrder_Full() public {
        // Setup: Create market and order
        p2p.createMarket(address(usdc), address(pepe));
        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);

        uint256 balanceBefore = usdc.balanceOf(user1);

        // Cancel entire order
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 1000e18, 1);
        vm.stopPrank();

        // Verify order was cancelled
        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (
            ,
            ,
            uint256 headId,
            uint256 tailId,
            uint256 totalLiquidity,
            uint256 nextOrderId
        ) = p2p.markets(marketId);

        assertEq(headId, 0);
        assertEq(tailId, 0);
        assertEq(totalLiquidity, 0);
        assertEq(usdc.balanceOf(user1), balanceBefore + 1000e18);
    }

    function test_reduceOrder_Partial() public {
        // Setup: Create market and order
        p2p.createMarket(address(usdc), address(pepe));
        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);

        uint256 balanceBefore = usdc.balanceOf(user1);

        // Reduce order by 400
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 400e18, 1);
        vm.stopPrank();

        // Verify order was reduced
        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (
            ,
            ,
            uint256 headId,
            uint256 tailId,
            uint256 totalLiquidity,
            uint256 nextOrderId
        ) = p2p.markets(marketId);

        assertEq(headId, 1); // Order still exists
        assertEq(tailId, 1);
        assertEq(totalLiquidity, 600e18);
        assertEq(usdc.balanceOf(user1), balanceBefore + 400e18);
    }

    function test_cancelOrder_MiddleOfQueue() public {
        p2p.createMarket(address(usdc), address(pepe));

        // Create three orders
        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(p2p), 2000e18);
        p2p.createOrder(address(usdc), address(pepe), 2000e18, 0, 0);
        vm.stopPrank();

        vm.startPrank(user3);
        usdc.approve(address(p2p), 500e18);
        p2p.createOrder(address(usdc), address(pepe), 500e18, 0, 0);
        vm.stopPrank();

        // Cancel middle order (user2's order - orderId 2)
        vm.prank(user2);
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 2000e18, 2);

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (
            ,
            ,
            uint256 headId,
            uint256 tailId,
            uint256 totalLiquidity,
            uint256 nextOrderId
        ) = p2p.markets(marketId);

        assertEq(headId, 1); // Still order 1
        assertEq(tailId, 3); // Still order 3
        assertEq(totalLiquidity, 1500e18); // 1000 + 500
    }

    function test_cancelOrder_HeadOfQueue() public {
        p2p.createMarket(address(usdc), address(pepe));

        // Create two orders
        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(p2p), 2000e18);
        p2p.createOrder(address(usdc), address(pepe), 2000e18, 0, 0);
        vm.stopPrank();

        // Cancel head order
        vm.prank(user1);
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 1000e18, 1);

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (
            ,
            ,
            uint256 headId,
            uint256 tailId,
            uint256 totalLiquidity,
            uint256 nextOrderId
        ) = p2p.markets(marketId);

        assertEq(headId, 2); // Now order 2 is head
        assertEq(tailId, 2);
        assertEq(totalLiquidity, 2000e18);
    }

    function test_cancelOrder_TailOfQueue() public {
        p2p.createMarket(address(usdc), address(pepe));

        // Create two orders
        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(p2p), 2000e18);
        p2p.createOrder(address(usdc), address(pepe), 2000e18, 0, 0);
        vm.stopPrank();

        // Cancel tail order
        vm.prank(user2);
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 2000e18, 2);

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (
            ,
            ,
            uint256 headId,
            uint256 tailId,
            uint256 totalLiquidity,
            uint256 nextOrderId
        ) = p2p.markets(marketId);

        assertEq(headId, 1);
        assertEq(tailId, 1); // Now order 1 is tail
        assertEq(totalLiquidity, 1000e18);
    }

    function test_cancelOrder_RevertsIfNotMaker() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);
        vm.stopPrank();

        // User2 tries to cancel user1's order
        vm.prank(user2);
        vm.expectRevert();
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 1000e18, 1);
    }

    function test_cancelOrder_RevertsIfAmountTooLarge() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);

        vm.expectRevert("close amount bigger than remaining order size");
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 1001e18, 1);
        vm.stopPrank();
    }

    function test_cancelOrder_RevertsIfAlreadyCancelled() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);

        // Cancel once
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 1000e18, 1);

        // Try to cancel again - will revert because order.maker is now address(0)
        vm.expectRevert();
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 1000e18, 1);
        vm.stopPrank();
    }

    // ===== Price Feed Tests =====

    function test_setPriceFeed() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW");
        bytes32 newFeed = bytes32(uint256(123456));

        p2p.setPriceFeed(address(newToken), newFeed);

        assertEq(p2p.priceFeeds(address(newToken)), newFeed);
    }

    function test_setPriceFeed_RevertsIfNotOwner() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW");
        bytes32 newFeed = bytes32(uint256(123456));

        vm.prank(user1);
        vm.expectRevert("Only owner can set price feeds");
        p2p.setPriceFeed(address(newToken), newFeed);
    }

    // ===== Integration Tests =====

    function test_fullFlow_CreateMultipleOrdersAndCancelSome() public {
        p2p.createMarket(address(weth), address(usdc));

        // User1 creates order
        vm.startPrank(user1);
        weth.approve(address(p2p), 10e18);
        p2p.createOrder(address(weth), address(usdc), 10e18, 0, 0);
        vm.stopPrank();

        // User2 creates order
        vm.startPrank(user2);
        weth.approve(address(p2p), 5e18);
        p2p.createOrder(address(weth), address(usdc), 5e18, 0, 0);
        vm.stopPrank();

        // User3 creates order
        vm.startPrank(user3);
        weth.approve(address(p2p), 3e18);
        p2p.createOrder(address(weth), address(usdc), 3e18, 0, 0);
        vm.stopPrank();

        bytes32 marketId = keccak256(
            abi.encodePacked(address(weth), address(usdc))
        );
        (
            ,
            ,
            uint256 headId1,
            uint256 tailId,
            uint256 totalLiquidity,
            uint256 nextOrderId
        ) = p2p.markets(marketId);

        assertEq(totalLiquidity, 18e18);
        assertEq(tailId, 3);

        // User2 reduces their order
        vm.prank(user2);
        p2p.cancelOrReduceOrder(address(weth), address(usdc), 2e18, 2);

        (, , headId1, tailId, totalLiquidity, nextOrderId) = p2p.markets(
            marketId
        );
        assertEq(totalLiquidity, 16e18);

        // User1 cancels their order completely
        vm.prank(user1);
        p2p.cancelOrReduceOrder(address(weth), address(usdc), 10e18, 1);

        (
            ,
            ,
            uint256 headId,
            uint256 tailId2,
            uint256 totalLiquidity2,
            uint256 nextOrderId2
        ) = p2p.markets(marketId);
        assertEq(totalLiquidity2, 6e18);
        assertEq(headId, 2); // Order 2 is now head
    }

    // ===== Fill Order Tests =====
    // Note: These tests would require mocking Pyth oracle responses
    // For now, we'll create comprehensive tests for order creation with price limits

    // ===== Price Limit Tests =====

    function test_createOrder_WithMaxPrice() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        // Create order with max price of 2000e18
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 2000e18, 0);
        vm.stopPrank();

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (, , uint256 headId, uint256 tailId, uint256 totalLiquidity, ) = p2p
            .markets(marketId);

        assertEq(headId, 1);
        assertEq(tailId, 1);
        assertEq(totalLiquidity, 1000e18);
    }

    function test_createOrder_WithMinPrice() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        // Create order with min price of 500e18
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 500e18);
        vm.stopPrank();

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (, , uint256 headId, uint256 tailId, uint256 totalLiquidity, ) = p2p
            .markets(marketId);

        assertEq(headId, 1);
        assertEq(tailId, 1);
        assertEq(totalLiquidity, 1000e18);
    }

    function test_createOrder_WithBothPriceLimits() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        // Create order with price range: min 500e18, max 2000e18
        p2p.createOrder(
            address(usdc),
            address(pepe),
            1000e18,
            2000e18,
            500e18
        );
        vm.stopPrank();

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (, , uint256 headId, uint256 tailId, uint256 totalLiquidity, ) = p2p
            .markets(marketId);

        assertEq(headId, 1);
        assertEq(tailId, 1);
        assertEq(totalLiquidity, 1000e18);
    }

    function test_createOrder_MultipleOrdersWithDifferentPriceLimits() public {
        p2p.createMarket(address(weth), address(usdc));

        // User1 creates order with no price limits
        vm.startPrank(user1);
        weth.approve(address(p2p), 10e18);
        p2p.createOrder(address(weth), address(usdc), 10e18, 0, 0);
        vm.stopPrank();

        // User2 creates order with max price
        vm.startPrank(user2);
        weth.approve(address(p2p), 5e18);
        p2p.createOrder(address(weth), address(usdc), 5e18, 3000e18, 0);
        vm.stopPrank();

        // User3 creates order with both limits
        vm.startPrank(user3);
        weth.approve(address(p2p), 3e18);
        p2p.createOrder(address(weth), address(usdc), 3e18, 4000e18, 2000e18);
        vm.stopPrank();

        bytes32 marketId = keccak256(
            abi.encodePacked(address(weth), address(usdc))
        );
        (
            ,
            ,
            uint256 headId,
            uint256 tailId,
            uint256 totalLiquidity,
            uint256 nextOrderId
        ) = p2p.markets(marketId);

        assertEq(headId, 1);
        assertEq(tailId, 3);
        assertEq(totalLiquidity, 18e18);
        assertEq(nextOrderId, 4);
    }

    // ===== Edge Case Tests =====

    function test_createOrder_VerySmallAmount() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1);
        p2p.createOrder(address(usdc), address(pepe), 1, 0, 0);
        vm.stopPrank();

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (, , , , uint256 totalLiquidity, ) = p2p.markets(marketId);

        assertEq(totalLiquidity, 1);
        assertEq(usdc.balanceOf(address(p2p)), 1);
    }

    function test_createOrder_VeryLargeAmount() public {
        p2p.createMarket(address(usdc), address(pepe));

        uint256 largeAmount = 1000000000e18; // 1 billion tokens
        usdc.mint(user1, largeAmount);

        vm.startPrank(user1);
        usdc.approve(address(p2p), largeAmount);
        p2p.createOrder(address(usdc), address(pepe), largeAmount, 0, 0);
        vm.stopPrank();

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (, , , , uint256 totalLiquidity, ) = p2p.markets(marketId);

        assertEq(totalLiquidity, largeAmount);
        assertEq(usdc.balanceOf(address(p2p)), largeAmount);
    }

    function test_reduceOrder_ToExactlyZero() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);

        // Reduce to exactly zero
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 1000e18, 1);
        vm.stopPrank();

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (, , uint256 headId, uint256 tailId, uint256 totalLiquidity, ) = p2p
            .markets(marketId);

        assertEq(headId, 0);
        assertEq(tailId, 0);
        assertEq(totalLiquidity, 0);
    }

    function test_reduceOrder_MultiplePartialReductions() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);

        uint256 initialBalance = usdc.balanceOf(user1);

        // First reduction
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 200e18, 1);
        assertEq(usdc.balanceOf(user1), initialBalance + 200e18);

        // Second reduction
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 300e18, 1);
        assertEq(usdc.balanceOf(user1), initialBalance + 500e18);

        // Third reduction
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 100e18, 1);
        assertEq(usdc.balanceOf(user1), initialBalance + 600e18);

        vm.stopPrank();

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (, , , , uint256 totalLiquidity, ) = p2p.markets(marketId);

        assertEq(totalLiquidity, 400e18);
    }

    function test_cancelAllOrdersInQueue() public {
        p2p.createMarket(address(usdc), address(pepe));

        // Create three orders
        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(p2p), 2000e18);
        p2p.createOrder(address(usdc), address(pepe), 2000e18, 0, 0);
        vm.stopPrank();

        vm.startPrank(user3);
        usdc.approve(address(p2p), 500e18);
        p2p.createOrder(address(usdc), address(pepe), 500e18, 0, 0);
        vm.stopPrank();

        // Cancel all orders
        vm.prank(user1);
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 1000e18, 1);

        vm.prank(user2);
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 2000e18, 2);

        vm.prank(user3);
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 500e18, 3);

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );
        (, , uint256 headId, uint256 tailId, uint256 totalLiquidity, ) = p2p
            .markets(marketId);

        assertEq(headId, 0);
        assertEq(tailId, 0);
        assertEq(totalLiquidity, 0);
    }

    function test_createMarket_WithDifferentTokenPairs() public {
        // Create USDC/PEPE market
        p2p.createMarket(address(usdc), address(pepe));
        bytes32 marketId1 = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );

        // Create WETH/USDC market
        p2p.createMarket(address(weth), address(usdc));
        bytes32 marketId2 = keccak256(
            abi.encodePacked(address(weth), address(usdc))
        );

        // Create WETH/PEPE market
        p2p.createMarket(address(weth), address(pepe));
        bytes32 marketId3 = keccak256(
            abi.encodePacked(address(weth), address(pepe))
        );

        // Verify all markets exist and are different
        (address token0_1, address token1_1, , , , ) = p2p.markets(marketId1);
        (address token0_2, address token1_2, , , , ) = p2p.markets(marketId2);
        (address token0_3, address token1_3, , , , ) = p2p.markets(marketId3);

        assertEq(token0_1, address(usdc));
        assertEq(token1_1, address(pepe));
        assertEq(token0_2, address(weth));
        assertEq(token1_2, address(usdc));
        assertEq(token0_3, address(weth));
        assertEq(token1_3, address(pepe));

        // Verify market IDs are different
        assertTrue(marketId1 != marketId2);
        assertTrue(marketId2 != marketId3);
        assertTrue(marketId1 != marketId3);
    }

    function test_orderIds_IncrementCorrectly() public {
        p2p.createMarket(address(usdc), address(pepe));

        bytes32 marketId = keccak256(
            abi.encodePacked(address(usdc), address(pepe))
        );

        // Initial nextOrderId should be 1
        (, , , , , uint256 nextOrderId) = p2p.markets(marketId);
        assertEq(nextOrderId, 1);

        // Create first order
        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);
        vm.stopPrank();

        (, , , , , nextOrderId) = p2p.markets(marketId);
        assertEq(nextOrderId, 2);

        // Create second order
        vm.startPrank(user2);
        usdc.approve(address(p2p), 2000e18);
        p2p.createOrder(address(usdc), address(pepe), 2000e18, 0, 0);
        vm.stopPrank();

        (, , , , , nextOrderId) = p2p.markets(marketId);
        assertEq(nextOrderId, 3);

        // Cancel first order - nextOrderId should still be 3
        vm.prank(user1);
        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 1000e18, 1);

        (, , , , , nextOrderId) = p2p.markets(marketId);
        assertEq(nextOrderId, 3); // Doesn't decrement

        // Create third order - should use id 3
        vm.startPrank(user3);
        usdc.approve(address(p2p), 500e18);
        p2p.createOrder(address(usdc), address(pepe), 500e18, 0, 0);
        vm.stopPrank();

        (, , , , , nextOrderId) = p2p.markets(marketId);
        assertEq(nextOrderId, 4);
    }

    function test_createOrder_TransfersTokensCorrectly() public {
        p2p.createMarket(address(usdc), address(pepe));

        uint256 user1BalanceBefore = usdc.balanceOf(user1);
        uint256 contractBalanceBefore = usdc.balanceOf(address(p2p));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);
        vm.stopPrank();

        uint256 user1BalanceAfter = usdc.balanceOf(user1);
        uint256 contractBalanceAfter = usdc.balanceOf(address(p2p));

        assertEq(user1BalanceBefore - user1BalanceAfter, 1000e18);
        assertEq(contractBalanceAfter - contractBalanceBefore, 1000e18);
    }

    function test_cancelOrder_RefundsTokensCorrectly() public {
        p2p.createMarket(address(usdc), address(pepe));

        vm.startPrank(user1);
        usdc.approve(address(p2p), 1000e18);
        p2p.createOrder(address(usdc), address(pepe), 1000e18, 0, 0);

        uint256 user1BalanceBefore = usdc.balanceOf(user1);
        uint256 contractBalanceBefore = usdc.balanceOf(address(p2p));

        p2p.cancelOrReduceOrder(address(usdc), address(pepe), 400e18, 1);
        vm.stopPrank();

        uint256 user1BalanceAfter = usdc.balanceOf(user1);
        uint256 contractBalanceAfter = usdc.balanceOf(address(p2p));

        assertEq(user1BalanceAfter - user1BalanceBefore, 400e18);
        assertEq(contractBalanceBefore - contractBalanceAfter, 400e18);
    }
}
