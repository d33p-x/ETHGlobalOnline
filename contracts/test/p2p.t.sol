// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {P2P} from "../src/p2p.sol";

contract PEERTOPEERTEST is Test {
    P2P p2p;
    function setUp() public {
        p2p = new P2P(0x4305FB66699C3B2702D4d05CF36551390A4c69C6);

        // set USDC feed
        p2p.setPriceFeed(
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a
        );
        // set PEPE feed
        p2p.setPriceFeed(
            0x6982508145454Ce325dDbE47a25d4ec3d2311933,
            0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4
        );
        // set ETH feed (0x address for native)
        p2p.setPriceFeed(
            0x0000000000000000000000000000000000000000,
            0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
        );
    }
}
