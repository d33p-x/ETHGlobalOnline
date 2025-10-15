// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract PEERTOPEER {
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

    mapping(uint256 => Order) public orders;
    address public owner;
    uint256 public orderIdCounter;

    constructor() {
        owner = msg.sender;
    }

    function createOrder(
        address _tokenSell,
        address _tokenBuy,
        uint256 _amountSell,
        uint256 _amountBuy,
        bool _allowPartial
    ) public payable {
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
    }

    function cancelOrder(uint256 _orderId) public {
        require(
            orders[_orderId].maker == msg.sender,
            "you can only cancel your own orders"
        );
        require(
            orders[_orderId].status == OrderStatus.Open,
            "Only open orders can be closed"
        );
        orders[_orderId].status = OrderStatus.Cancelled;
    }
}
