// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract P2P {
    event MarketCreated(bytes32 markteId, address token0, address token1);

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
        IERC20(market.token0).transferFrom(msg.sender, address(this), _amount0);
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
        IERC20(market.token0).transfer(msg.sender, _amount0Close);
    }

    function fillOrder(
        bytes[] calldata priceUpdate,
        address _token0,
        address _token1,
        uint256 _amount1
    ) public marketExists(_token0, _token1) {
        bytes32 marketId = keccak256(abi.encodePacked(_token0, _token1));
        uint fee = pyth.getUpdateFee(priceUpdate);
        pyth.updatePriceFeeds{value: fee}(priceUpdate);
        bytes32 priceFeed0 = priceFeeds[_token0];
        bytes32 priceFeed1 = priceFeeds[_token1];
        PythStructs.Price memory priceObject0 = pyth.getPriceNoOlderThan(
            priceFeed0,
            60
        );
        PythStructs.Price memory priceObject1 = pyth.getPriceNoOlderThan(
            priceFeed1,
            60
        );
        // convert int64 to uint256 (think about changing this later)
        require(priceObject0.price >= 0);
        require(priceObject1.price >= 0);
        uint256 absExpo0 = uint256(uint32(-priceObject0.expo));
        uint256 absExpo1 = uint256(uint32(-priceObject1.expo));

        uint256 price0 = uint256(uint64(priceObject0.price) * 1e18);
        uint256 price1 = uint256(uint64(priceObject1.price) * 1e18);

        uint256 rate = price0 / price1;
        uint256 amount0 = _amount1 * rate; //amount0 value of input _amount1
        require(
            amount0 <= markets[marketId].totalLiquidity,
            "theres not enought liqudity to fill your trade"
        );
        Market storage market = markets[marketId];

        uint256 orderId = 0;
        uint256 amount1remaining = _amount1;
        uint256 amount1order;
        uint256 amount0filledLoop;
        uint256 amount0filledTotal;
        address orderMaker;
        Order storage order;
        while (amount1remaining > 0) {
            // if first loop then pick headId as order
            if (orderId == 0) {
                order = market.orders[market.headId];
                orderId = market.headId;
            } else {
                order = market.orders[market.queue[orderId].nextId];
            }
            // skip order if outside price range
            if (price0 > order.maxPrice || price0 < order.minPrice) {
                continue;
            }
            // how much of amount1 is available in this order
            amount1order = (order.amount0 * rate);
            if (amount1order >= amount1remaining) {
                amount0filledLoop = amount1remaining / rate;
                amount0filledTotal += amount0filledLoop;
                order.amount0 -= amount0filledLoop;
            } else {
                amount0filledLoop = amount1order / rate;
                amount0filledTotal += amount0filledLoop;
                order.amount0 = 0;
            }
            orderMaker = order.maker;
            // if no amount0 remaining in order then reorganize linked list and delete order
            if (order.amount0 == 0) {
                market.queue[market.queue[orderId].prevId].nextId = market
                    .queue[orderId]
                    .nextId;
                market.queue[market.queue[orderId].nextId].prevId = market
                    .queue[orderId]
                    .prevId;
                delete market.orders[orderId];
                delete market.queue[orderId];
            }

            IERC20(_token1).transferFrom(
                msg.sender,
                orderMaker,
                (amount0filledLoop / rate)
            );
        }
        IERC20(_token0).transfer(msg.sender, amount0filledTotal);
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
    }
}
