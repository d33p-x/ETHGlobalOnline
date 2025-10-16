// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract P2P {
    enum OrderStatus {
        Open,
        Filled,
        Cancelled
    }

    struct Order {
        uint256 id;
        address maker;
        address tokenSell;
        address tokenBuy;
        uint256 amountSell;
        uint256 amountBuy; //for fixed price orders
        bool allowPartial; //allow partial fills
        OrderStatus status;
    }

    mapping(uint256 => Order) public orders; //mapping orders by orderID
    mapping(address => bytes32) public priceFeed; //mapping address to pricefeed Id;

    IPyth public pyth;
    address public owner;
    uint256 public orderIdCounter;

    constructor(address _pythAddress) {
        pyth = IPyth(_pythAddress);
        owner = msg.sender;
    }

    function createOrder(
        address _tokenSell,
        address _tokenBuy,
        uint256 _amountSell,
        uint256 _amountBuy,
        bool _allowPartial
    ) public payable {
        if (_amountBuy == 0) {
            require(
                priceFeed[_tokenSell] != bytes32(0),
                "no price feed for the token you are tring to sell"
            );
            require(
                priceFeed[_tokenBuy] != bytes32(0),
                "no price feed for the token you are trying to buy"
            );
        }
        if (_tokenSell == address(0)) {
            require(msg.value == _amountSell);
        }
        if (_tokenSell != address(0)) {
            IERC20(_tokenSell).transferFrom(
                msg.sender,
                address(this),
                _amountSell
            );
        }

        orders[orderIdCounter] = Order(
            orderIdCounter,
            msg.sender,
            _tokenSell,
            _tokenBuy,
            _amountSell,
            _amountBuy,
            _allowPartial,
            OrderStatus.Open
        );
        orderIdCounter++;
    }

    function cancelOrder(uint256 _orderId) public {
        Order order = orders[_oderId];
        require(
            order.maker == msg.sender,
            "you can only cancel your own orders"
        );
        require(
            order.status == OrderStatus.Open,
            "Only open orders can be closed"
        );

        if(order.tokenSell == address(0)) {
            (sent, data) = address(msg.sender).call{order[amountSell]}("");
            require(sent, "Failed to sent ether")
        }
        orders[_orderId].status = OrderStatus.Cancelled;
    }

    function setPriceFeed(
        address _tokenAddress,
        bytes32 _priceFeedId
    ) external {
        require(msg.sender == owner, "Only owner can set price feeds");
        priceFeed[_tokenAddress] = _priceFeedId;
    }
}
