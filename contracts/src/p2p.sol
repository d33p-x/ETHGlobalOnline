// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {console} from "forge-std/console.sol";

contract P2P is ReentrancyGuard {
    event MarketCreated(bytes32 marketId, address token0, address token1);
    event OrderCreated(
        bytes32 indexed marketId,
        address indexed maker,
        address token0,
        address token1,
        uint256 amount0,
        uint256 maxPrice,
        uint256 minPrice,
        uint256 orderId
    );
    event OrderReducedOrCancelled(
        bytes32 indexed marketId,
        address maker,
        address token0,
        address token1,
        uint256 indexed orderId,
        uint256 amount0Closed
    );

    event OrderFilled(
        bytes32 indexed marketId,
        address token0,
        address token1,
        uint256 indexed orderId,
        uint256 amount0Filled,
        uint256 amount1Spent,
        address indexed taker
    );

    event PriceFeedSet(
        address indexed tokenAddress,
        bytes32 indexed priceFeedId,
        address owner
    );

    struct QueueNode {
        uint256 nextId; //0 if this is the last
        uint256 prevId; //0 if this is the first
    }

    struct Order {
        address maker;
        uint256 amount0;
        uint256 maxPrice;
        uint256 minPrice;
    }

    struct Market {
        address token0; //the token on offer
        address token1; //the token sellers want to receive
        uint8 decimals0;
        uint8 decimals1;
        mapping(uint256 => Order) orders; //order mapping
        mapping(uint256 => QueueNode) queue; //linked list
        uint256 headId; // first order
        uint256 tailId; // last order
        uint256 totalLiquidity;
        uint256 nextOrderId;
    }

    mapping(bytes32 => Market) public markets; //mapping markets (keccak of token0 & token1)
    mapping(address => bytes32) public priceFeeds; //mapping address to pricefeed Id;

    IPyth public pyth;
    address public owner;

    constructor(address _pythAddress) {
        pyth = IPyth(_pythAddress);
        owner = msg.sender;
    }

    function createMarket(address _token0, address _token1) public {
        require(
            _token0 != address(0) && _token1 != address(0),
            "Invalid token address"
        );
        require(_token0 != _token1, "Tokens must be different");
        require(priceFeeds[_token0] != bytes32(0));
        require(priceFeeds[_token1] != bytes32(0));
        bytes32 marketId = keccak256(abi.encodePacked(_token0, _token1));
        require(
            markets[marketId].token0 == address(0),
            "Market already exists"
        );
        Market storage newMarket = markets[marketId];
        newMarket.token0 = _token0;
        newMarket.token1 = _token1;
        newMarket.decimals0 = IERC20Metadata(_token0).decimals();
        newMarket.decimals1 = IERC20Metadata(_token1).decimals();
        newMarket.nextOrderId = 1;
        emit MarketCreated(marketId, _token0, _token1);
    }

    function createOrder(
        address _token0,
        address _token1,
        uint256 _amount0,
        uint256 _maxPrice,
        uint256 _minPrice
    ) public marketExists(_token0, _token1) {
        bytes32 marketId = keccak256(abi.encodePacked(_token0, _token1));

        // get market pointer
        Market storage market = markets[marketId];

        // get orderid
        uint256 orderId = market.nextOrderId;

        // create new order in mapping
        Order memory order = Order(
            address(msg.sender),
            _amount0,
            _maxPrice,
            _minPrice
        );
        market.orders[orderId] = order;
        // @todo max price and min price should be in token1 not USD
        // create new node in mapping
        QueueNode memory queueNode = QueueNode({
            nextId: 0, //0 because its the last order
            prevId: market.tailId
        });
        market.queue[orderId] = queueNode;

        //if there is an exsisting last order then update that orders tail to be the new order
        if (market.tailId != 0) {
            market.queue[market.tailId].nextId = orderId;
        }
        //if there are no orders yet, set the new orderId as head
        if (market.headId == 0) {
            market.headId = orderId;
        }

        market.tailId = orderId;
        market.totalLiquidity += _amount0;
        market.nextOrderId++;
        IERC20Metadata(market.token0).transferFrom(
            msg.sender,
            address(this),
            _amount0
        );
        emit OrderCreated(
            marketId,
            msg.sender,
            _token0,
            _token1,
            _amount0,
            _maxPrice,
            _minPrice,
            orderId
        );
    }

    function cancelOrReduceOrder(
        address _token0,
        address _token1,
        uint256 _amount0Close,
        uint256 _orderId
    ) public marketExists(_token0, _token1) {
        bytes32 marketId = keccak256(abi.encodePacked(_token0, _token1));
        Market storage market = markets[marketId];
        Order storage order = market.orders[_orderId];
        QueueNode storage queueNode = market.queue[_orderId];
        require(order.maker == address(msg.sender)); //check that msg sender is maker, also checks that order exists
        require(
            order.amount0 != 0,
            "order has been filled or cancelled already"
        );
        require(
            _amount0Close <= order.amount0,
            "close amount bigger than remaining order size"
        );

        order.amount0 -= _amount0Close;

        // remove the order from the linked list if remaining amount is 0
        if (order.amount0 == 0) {
            uint256 nextId = queueNode.nextId;
            uint256 prevId = queueNode.prevId;

            if (prevId != 0) {
                market.queue[prevId].nextId = queueNode.nextId;
            } else {
                market.headId = nextId;
            }

            if (nextId != 0) {
                market.queue[nextId].prevId = prevId;
            } else {
                market.tailId = prevId;
            }
            delete market.orders[_orderId];
            delete market.queue[_orderId];
        }
        market.totalLiquidity -= _amount0Close;
        IERC20Metadata(market.token0).transfer(msg.sender, _amount0Close);
        emit OrderReducedOrCancelled(
            marketId,
            msg.sender,
            _token0,
            _token1,
            _orderId,
            _amount0Close
        );
    }
    // @todo create fillOrderExactAmountOut
    function fillOrderExactAmountIn(
        bytes[] calldata priceUpdate,
        address _token0,
        address _token1,
        uint256 _amount1
    ) public payable marketExists(_token0, _token1) nonReentrant {
        bytes32 marketId = keccak256(abi.encodePacked(_token0, _token1));
        uint fee = pyth.getUpdateFee(priceUpdate);
        console.log("1");
        pyth.updatePriceFeeds{value: fee}(priceUpdate);
        bytes32 priceFeed0 = priceFeeds[_token0];
        bytes32 priceFeed1 = priceFeeds[_token1];
        // Use 365 days (31536000 seconds) for local testing to avoid StalePrice errors
        PythStructs.Price memory priceObject0 = pyth.getPriceNoOlderThan(
            priceFeed0,
            31536000
        );
        PythStructs.Price memory priceObject1 = pyth.getPriceNoOlderThan(
            priceFeed1,
            31536000
        );
        console.log("2");

        // convert int64 to uint256 (think about changing this later)
        require(priceObject0.price >= 0);
        require(priceObject1.price >= 0);
        //  absolute exponents for uint256
        uint256 absExpo0 = uint256(uint32(-priceObject0.expo));
        uint256 absExpo1 = uint256(uint32(-priceObject1.expo));
        console.log("3");

        // normalize price because of possible different exponents
        uint256 price0 = (uint256(uint64(priceObject0.price)) * 1e18) /
            (10 ** absExpo0);
        uint256 price1 = (uint256(uint64(priceObject1.price)) * 1e18) /
            (10 ** absExpo1);
        console.log("4");

        uint256 price0Buyer = (price0 * 100100) / 100000; //buyer pays 0.1% fee
        uint256 price0Seller = (price0 * 100050) / 100000; //seller receives 0.05% bonus

        Market storage market = markets[marketId];
        console.log("5");

        uint256 dec0Factor = 10 ** market.decimals0;
        uint256 dec1Factor = 10 ** market.decimals1;

        uint256 amount0Target = (_amount1 * price1 * dec0Factor) /
            (price0Buyer * dec1Factor); //give buyer less because of fee

        require(amount0Target > 0);
        // @todo this doesnt consider custom price orders
        require(amount0Target <= market.totalLiquidity);

        uint256 amount0FilledTotal = 0;
        uint256 amount1SpentOnSellers = 0;
        uint256 currentOrderId = market.headId;
        for (
            uint256 i = 0;
            i < 50 && amount0FilledTotal < amount0Target && currentOrderId != 0;
            i++
        ) {
            Order storage order = market.orders[currentOrderId];
            QueueNode storage queueNode = market.queue[currentOrderId];
            uint256 nextOrderId = queueNode.nextId;

            if (
                (order.maxPrice != 0 && price0 > order.maxPrice) ||
                (order.minPrice != 0 && price0 < order.minPrice)
            ) {
                currentOrderId = nextOrderId;
                continue;
            }

            uint256 amount0RemainingToFill = amount0Target - amount0FilledTotal;
            uint256 amount0ToFillLoop;

            if (order.amount0 >= amount0RemainingToFill) {
                amount0ToFillLoop = amount0RemainingToFill;
            } else {
                amount0ToFillLoop = order.amount0;
            }
            // seller gets 0.05% more
            uint256 amount1CostLoop = (amount0ToFillLoop *
                price0Seller *
                dec1Factor) / (price1 * dec0Factor);

            order.amount0 -= amount0ToFillLoop;
            amount0FilledTotal += amount0ToFillLoop;
            amount1SpentOnSellers += amount1CostLoop;

            address orderMaker = order.maker;

            if (order.amount0 == 0) {
                uint256 nextId = queueNode.nextId;
                uint256 prevId = queueNode.prevId;

                if (prevId != 0) {
                    market.queue[prevId].nextId = nextId;
                } else {
                    market.headId = nextId;
                }

                if (nextId != 0) {
                    market.queue[nextId].prevId = prevId;
                } else {
                    market.tailId = prevId;
                }

                delete market.orders[currentOrderId];
                delete market.queue[currentOrderId];
            }
            IERC20Metadata(_token1).transferFrom(
                msg.sender,
                orderMaker,
                amount1CostLoop
            );

            // Move to the next order in the queue
            emit OrderFilled(
                marketId,
                _token0,
                _token1,
                currentOrderId,
                amount0ToFillLoop,
                amount1CostLoop,
                msg.sender
            );
            currentOrderId = nextOrderId;
        }
        if (amount0FilledTotal == 0) {
            revert("No orders at current price levels available to fill");
        }
        market.totalLiquidity -= amount0FilledTotal;

        IERC20Metadata(_token0).transfer(msg.sender, amount0FilledTotal);
        uint256 protocolFee = _amount1 - amount1SpentOnSellers;
        if (protocolFee > 0) {
            IERC20Metadata(_token1).transferFrom(
                msg.sender,
                owner,
                protocolFee
            );
        }
    }

    modifier marketExists(address _token0, address _token1) {
        require(
            markets[keccak256(abi.encodePacked(_token0, _token1))].token0 !=
                address(0),
            "market doesnt exist"
        );
        _;
    }

    function setPriceFeed(
        address _tokenAddress,
        bytes32 _priceFeedId
    ) external {
        require(msg.sender == owner, "Only owner can set price feeds");
        priceFeeds[_tokenAddress] = _priceFeedId;
        emit PriceFeedSet(_tokenAddress, _priceFeedId, msg.sender);
    }
}
