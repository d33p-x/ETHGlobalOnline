// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract P2P {
    event MarketCreated(bytes32 markteId, address tokenSell, address tokenBuy);

    struct QueueNode {
        uint256 nextId; //0 if this is the last
        uint256 prevId; //0 if this is the first
    }

    struct Order {
        address maker;
        uint256 amountSell;
    }

    struct Market {
        address tokenSell;
        address tokenBuy;
        mapping(uint256 => Order) orders; //order mapping
        mapping(uint256 => QueueNode) queue; //linked list
        uint256 headId; // first order
        uint256 tailId; // last order
        uint256 totalLiquidity;
        uint256 nextOrderId;
    }

    mapping(bytes32 => Market) public markets; //mapping markets (keccak of tokenSell & tokenBuy)
    mapping(address => bytes32) public priceFeed; //mapping address to pricefeed Id;

    IPyth public pyth;
    address public owner;

    constructor(address _pythAddress) {
        pyth = IPyth(_pythAddress);
        owner = msg.sender;
    }

    function createMarket(address _tokenSell, address _tokenBuy) public {
        require(
            _tokenSell != address(0) && _tokenBuy != address(0),
            "Invalid token address"
        );
        require(_tokenSell != _tokenBuy, "Tokens must be different");
        require(priceFeed[_tokenSell] != bytes32(0));
        require(priceFeed[_tokenBuy] != bytes32(0));
        bytes32 marketId = keccak256(abi.encodePacked(_tokenSell, _tokenBuy));
        require(
            markets[marketId].tokenSell == address(0),
            "Market already exists"
        );
        Market storage newMarket = markets[marketId];
        newMarket.tokenSell = _tokenSell;
        newMarket.tokenBuy = _tokenBuy;
        newMarket.nextOrderId = 1;
        emit MarketCreated(marketId, _tokenSell, _tokenBuy);
    }

    function createOrder(
        address _tokenSell,
        address _tokenBuy,
        uint256 _amountSell
    ) public marketExists(_tokenSell, _tokenBuy) {
        bytes32 marketId = keccak256(abi.encodePacked(_tokenSell, _tokenBuy));

        // get market pointer
        Market storage market = markets[marketId];

        // get orderid
        uint256 orderId = market.nextOrderId;

        // create new order in mapping
        Order memory order = Order(address(msg.sender), _amountSell);
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
        market.totalLiquidity += _amountSell;
        market.nextOrderId++;
        IERC20(market.tokenSell).transferFrom(
            msg.sender,
            address(this),
            _amountSell
        );
    }

    function cancelOrReduceOrder(
        address _tokenSell,
        address _tokenBuy,
        uint256 _amountClose,
        uint256 _orderId
    ) public marketExists(_tokenSell, _tokenBuy) {
        bytes32 marketId = keccak256(abi.encodePacked(_tokenSell, _tokenBuy));
        Market storage market = markets[marketId];
        Order storage order = market.orders[_orderId];
        QueueNode storage queueNode = market.queue[_orderId];
        require(order.maker == address(msg.sender)); //check that msg sender is maker, also checks that order exists
        require(
            order.amountSell != 0,
            "order has been filled or cancelled already"
        );
        require(
            _amountClose <= order.amountSell,
            "close amount bigger than remaining order size"
        );

        order.amountSell -= _amountClose;

        // remove the order from the linked list if remaining amount is 0
        if (order.amountSell == 0) {
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
        market.totalLiquidity -= _amountClose;
        IERC20(market.tokenSell).transfer(msg.sender, _amountClose);
    }

    modifier marketExists(address _tokenSell, address _tokenBuy) {
        require(
            markets[keccak256(abi.encodePacked(_tokenSell, _tokenBuy))]
                .tokenSell != address(0),
            "market doesnt exist"
        );
        _;
    }

    function setPriceFeed(
        address _tokenAddress,
        bytes32 _priceFeedId
    ) external {
        require(msg.sender == owner, "Only owner can set price feeds");
        priceFeed[_tokenAddress] = _priceFeedId;
    }
}
