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
    uint256 public orderIdCounter;

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
    ) public {
        bytes32 marketId = keccak256(abi.encodePacked(_tokenSell, _tokenBuy));
        require(
            markets[marketId].tokenSell == address(0),
            "no market for this exists"
        );
    }

    function setPriceFeed(
        address _tokenAddress,
        bytes32 _priceFeedId
    ) external {
        require(msg.sender == owner, "Only owner can set price feeds");
        priceFeed[_tokenAddress] = _priceFeedId;
    }
}
