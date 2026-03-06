// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/MockERC20.sol";
import "../src/MockDEX.sol";
import "../src/IntentExecutor.sol";
import "../src/TokenFactory.sol";

contract TokenFactoryTest is Test {
    event TokenCreated(address indexed creator, address indexed tokenAddress, string name, string symbol, uint256 initialSupply);

    MockDEX dex;
    IntentExecutor executor;
    TokenFactory factory;

    address alice = makeAddr("alice");

    function setUp() public {
        dex = new MockDEX();
        executor = new IntentExecutor(address(dex));
        factory = new TokenFactory(address(executor));
        executor.setFactory(address(factory));
    }

    function test_createToken() public {
        vm.prank(alice);
        address tokenAddr = factory.createToken("PEPE Token", "PEPE", 1_000_000 ether);

        // Token deployed
        assertTrue(tokenAddr != address(0));

        // Supply minted to creator
        MockERC20 token = MockERC20(tokenAddr);
        assertEq(token.balanceOf(alice), 1_000_000 ether);
        assertEq(token.name(), "PEPE Token");
        assertEq(token.symbol(), "PEPE");
    }

    function test_createToken_auto_whitelists() public {
        vm.prank(alice);
        address tokenAddr = factory.createToken("PEPE", "PEPE", 1_000 ether);

        assertTrue(executor.whitelistedTokens(tokenAddr));
    }

    function test_createToken_tracks_creator() public {
        vm.startPrank(alice);
        address token1 = factory.createToken("Token1", "T1", 100 ether);
        address token2 = factory.createToken("Token2", "T2", 200 ether);
        vm.stopPrank();

        address[] memory tokens = factory.getTokensByCreator(alice);
        assertEq(tokens.length, 2);
        assertEq(tokens[0], token1);
        assertEq(tokens[1], token2);
    }

    function test_createToken_emits_event() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit TokenCreated(alice, address(0), "PEPE", "PEPE", 1_000 ether);
        factory.createToken("PEPE", "PEPE", 1_000 ether);
    }

    function test_createToken_reverts_zero_supply() public {
        vm.prank(alice);
        vm.expectRevert("TokenFactory: zero supply");
        factory.createToken("PEPE", "PEPE", 0);
    }

    function test_createToken_reverts_empty_name() public {
        vm.prank(alice);
        vm.expectRevert("TokenFactory: empty name");
        factory.createToken("", "PEPE", 1_000 ether);
    }

    function test_createToken_reverts_invalid_symbol() public {
        vm.prank(alice);
        vm.expectRevert("TokenFactory: invalid symbol");
        factory.createToken("PEPE", "", 1_000 ether);
    }
}
