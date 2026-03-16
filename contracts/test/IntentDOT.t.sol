// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MockERC20.sol";
import "../src/MockDEX.sol";
import "../src/IntentExecutor.sol";

contract IntentDOTTest is Test {
    event IntentExecuted(address indexed user, string intentType, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event TokenWhitelisted(address indexed token, bool status);

    MockERC20 dot;
    MockERC20 usdt;
    MockDEX dex;
    IntentExecutor executor;

    address alice = makeAddr("alice");
    address lp = makeAddr("lp");

    function setUp() public {
        dot = new MockERC20("Polkadot", "DOT");
        usdt = new MockERC20("Tether USD", "USDT");
        dex = new MockDEX();
        executor = new IntentExecutor(address(dex));

        // Whitelist tokens
        executor.whitelistToken(address(dot), true);
        executor.whitelistToken(address(usdt), true);

        // Seed liquidity: 10,000 DOT + 67,500 USDT (1 DOT = 6.75 USDT)
        dot.mint(lp, 10_000 ether);
        usdt.mint(lp, 67_500 ether);

        vm.startPrank(lp);
        dot.approve(address(dex), type(uint256).max);
        usdt.approve(address(dex), type(uint256).max);
        dex.addLiquidity(address(dot), address(usdt), 10_000 ether, 67_500 ether);
        vm.stopPrank();

        // Give Alice some DOT
        dot.mint(alice, 1_000 ether);
    }

    function test_swap_DOT_USDT() public {
        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);
        uint256 amountOut = executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();

        assertGt(amountOut, 0, "Should receive USDT");
        assertEq(dot.balanceOf(alice), 990 ether, "Should spend 10 DOT");
        assertEq(usdt.balanceOf(alice), amountOut, "Should receive exact USDT");
    }

    function test_swap_insufficient_balance() public {
        address broke = makeAddr("broke");
        vm.startPrank(broke);
        dot.approve(address(executor), 10 ether);
        vm.expectRevert(abi.encodeWithSelector(
            bytes4(keccak256("ERC20InsufficientBalance(address,uint256,uint256)")),
            broke, 0, 10 ether
        ));
        executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();
    }

    function test_swap_slippage_exceeded() public {
        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);
        // Set minAmountOut absurdly high
        vm.expectRevert("DEX: slippage exceeded");
        executor.executeSwap(address(dot), address(usdt), 10 ether, 1_000_000 ether);
        vm.stopPrank();
    }

    function test_swap_zero_amount() public {
        vm.startPrank(alice);
        vm.expectRevert("IntentExecutor: zero amount");
        executor.executeSwap(address(dot), address(usdt), 0, 0);
        vm.stopPrank();
    }

    function test_swap_same_token() public {
        vm.startPrank(alice);
        vm.expectRevert("IntentExecutor: same token");
        executor.executeSwap(address(dot), address(dot), 10 ether, 0);
        vm.stopPrank();
    }

    function test_getAmountOut() public view {
        uint256 amountOut = dex.getAmountOut(address(dot), address(usdt), 10 ether);
        // With 10k DOT / 67.5k USDT pool, 10 DOT should give ~67.05 USDT (with 0.3% fee)
        assertGt(amountOut, 60 ether, "Should get reasonable USDT amount");
        assertLt(amountOut, 70 ether, "Should not exceed spot price");
    }

    function test_addLiquidity() public {
        dot.mint(alice, 100 ether);
        usdt.mint(alice, 675 ether);

        vm.startPrank(alice);
        dot.approve(address(dex), 100 ether);
        usdt.approve(address(dex), 675 ether);
        dex.addLiquidity(address(dot), address(usdt), 100 ether, 675 ether);
        vm.stopPrank();

        (, , uint256 r0, uint256 r1) = dex.getPool(address(dot), address(usdt));
        // token0/token1 are sorted by address, so check total reserves regardless of order
        uint256 totalReserves = r0 + r1;
        assertEq(totalReserves, 10_100 ether + 68_175 ether, "Total reserves should increase");
    }

    function test_previewSwap() public view {
        uint256 preview = executor.previewSwap(address(dot), address(usdt), 10 ether);
        uint256 direct = dex.getAmountOut(address(dot), address(usdt), 10 ether);
        assertEq(preview, direct, "Preview should match direct quote");
    }

    function test_executeIntent_emits_event() public {
        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);

        vm.expectEmit(true, false, false, false);
        emit IntentExecuted(alice, "swap", address(dot), address(usdt), 10 ether, 0);
        executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();
    }

    // === Whitelist Tests ===

    function test_swap_reverts_non_whitelisted_token() public {
        MockERC20 fake = new MockERC20("Fake", "FAKE");
        fake.mint(alice, 100 ether);

        vm.startPrank(alice);
        fake.approve(address(executor), 10 ether);
        vm.expectRevert("IntentExecutor: token not whitelisted");
        executor.executeSwap(address(fake), address(usdt), 10 ether, 0);
        vm.stopPrank();
    }

    function test_owner_can_whitelist() public {
        MockERC20 newToken = new MockERC20("New", "NEW");
        assertFalse(executor.whitelistedTokens(address(newToken)));

        executor.whitelistToken(address(newToken), true);
        assertTrue(executor.whitelistedTokens(address(newToken)));

        executor.whitelistToken(address(newToken), false);
        assertFalse(executor.whitelistedTokens(address(newToken)));
    }

    function test_non_owner_cannot_whitelist() public {
        MockERC20 newToken = new MockERC20("New", "NEW");

        vm.prank(alice);
        vm.expectRevert("IntentExecutor: not authorized");
        executor.whitelistToken(address(newToken), true);
    }

    function test_whitelist_emits_event() public {
        MockERC20 newToken = new MockERC20("New", "NEW");

        vm.expectEmit(true, false, false, true);
        emit TokenWhitelisted(address(newToken), true);
        executor.whitelistToken(address(newToken), true);
    }

    // === Transfer Tests ===

    function test_transfer_DOT() public {
        address bob = makeAddr("bob");
        dot.mint(alice, 100 ether);

        vm.startPrank(alice);
        dot.approve(address(executor), 50 ether);
        executor.executeTransfer(address(dot), bob, 50 ether);
        vm.stopPrank();

        assertEq(dot.balanceOf(bob), 50 ether);
    }

    function test_transfer_reverts_non_whitelisted() public {
        MockERC20 fake = new MockERC20("Fake", "FAKE");
        fake.mint(alice, 100 ether);
        address bob = makeAddr("bob");

        vm.startPrank(alice);
        fake.approve(address(executor), 50 ether);
        vm.expectRevert("IntentExecutor: token not whitelisted");
        executor.executeTransfer(address(fake), bob, 50 ether);
        vm.stopPrank();
    }

    function test_transfer_reverts_zero_address() public {
        vm.startPrank(alice);
        dot.approve(address(executor), 50 ether);
        vm.expectRevert("IntentExecutor: zero address");
        executor.executeTransfer(address(dot), address(0), 50 ether);
        vm.stopPrank();
    }

    function test_transfer_reverts_self_transfer() public {
        vm.startPrank(alice);
        dot.approve(address(executor), 50 ether);
        vm.expectRevert("IntentExecutor: self transfer");
        executor.executeTransfer(address(dot), alice, 50 ether);
        vm.stopPrank();
    }

    // === Pausable Tests ===

    function test_pause_blocks_swap() public {
        executor.pause();

        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("EnforcedPause()"))));
        executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();
    }

    function test_pause_blocks_transfer() public {
        executor.pause();
        address bob = makeAddr("bob");

        vm.startPrank(alice);
        dot.approve(address(executor), 50 ether);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("EnforcedPause()"))));
        executor.executeTransfer(address(dot), bob, 50 ether);
        vm.stopPrank();
    }

    function test_unpause_resumes_swap() public {
        executor.pause();
        executor.unpause();

        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);
        uint256 amountOut = executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();

        assertGt(amountOut, 0, "Swap should work after unpause");
    }

    function test_non_owner_cannot_pause() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(
            bytes4(keccak256("OwnableUnauthorizedAccount(address)")),
            alice
        ));
        executor.pause();
    }

    // === ERC20Permit / SwapWithPermit Tests ===

    uint256 constant ALICE_PK = 0xA11CE;
    address alicePermit = vm.addr(ALICE_PK);

    function _getPermitDigest(
        MockERC20 token,
        address owner_,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner_, spender, value, nonce, deadline));
        return keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
    }

    function test_swapWithPermit_happy_path() public {
        // Setup: give alicePermit some DOT
        dot.mint(alicePermit, 1_000 ether);

        uint256 deadline = block.timestamp + 1 hours;
        uint256 amountIn = 10 ether;

        // Sign permit off-chain
        bytes32 digest = _getPermitDigest(dot, alicePermit, address(executor), amountIn, 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, digest);

        // Execute swap with permit — no prior approve needed
        vm.prank(alicePermit);
        uint256 amountOut = executor.executeSwapWithPermit(
            address(dot), address(usdt), amountIn, 0, deadline, v, r, s
        );

        assertGt(amountOut, 0, "Should receive USDT");
        assertEq(dot.balanceOf(alicePermit), 990 ether, "Should spend 10 DOT");
        assertEq(usdt.balanceOf(alicePermit), amountOut, "Should receive exact USDT");
    }

    function test_swapWithPermit_expired_deadline() public {
        dot.mint(alicePermit, 1_000 ether);

        uint256 deadline = block.timestamp - 1; // expired
        uint256 amountIn = 10 ether;

        bytes32 digest = _getPermitDigest(dot, alicePermit, address(executor), amountIn, 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, digest);

        vm.prank(alicePermit);
        vm.expectRevert();
        executor.executeSwapWithPermit(
            address(dot), address(usdt), amountIn, 0, deadline, v, r, s
        );
    }

    function test_swapWithPermit_wrong_signer() public {
        dot.mint(alicePermit, 1_000 ether);

        uint256 deadline = block.timestamp + 1 hours;
        uint256 amountIn = 10 ether;

        // Sign with a DIFFERENT key
        uint256 WRONG_PK = 0xBAD;
        bytes32 digest = _getPermitDigest(dot, alicePermit, address(executor), amountIn, 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(WRONG_PK, digest);

        vm.prank(alicePermit);
        vm.expectRevert();
        executor.executeSwapWithPermit(
            address(dot), address(usdt), amountIn, 0, deadline, v, r, s
        );
    }

    function test_swapWithPermit_replay_reverts() public {
        dot.mint(alicePermit, 1_000 ether);

        uint256 deadline = block.timestamp + 1 hours;
        uint256 amountIn = 10 ether;

        bytes32 digest = _getPermitDigest(dot, alicePermit, address(executor), amountIn, 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, digest);

        // First call succeeds
        vm.prank(alicePermit);
        executor.executeSwapWithPermit(
            address(dot), address(usdt), amountIn, 0, deadline, v, r, s
        );

        // Replay with same signature — nonce consumed, should revert
        vm.prank(alicePermit);
        vm.expectRevert();
        executor.executeSwapWithPermit(
            address(dot), address(usdt), amountIn, 0, deadline, v, r, s
        );
    }

    // === ERC20Permit / TransferWithPermit Tests ===

    function test_transferWithPermit_happy_path() public {
        dot.mint(alicePermit, 1_000 ether);
        address bob = makeAddr("bob");

        uint256 deadline = block.timestamp + 1 hours;
        uint256 amount = 50 ether;

        bytes32 digest = _getPermitDigest(dot, alicePermit, address(executor), amount, 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, digest);

        vm.prank(alicePermit);
        executor.executeTransferWithPermit(
            address(dot), bob, amount, deadline, v, r, s
        );

        assertEq(dot.balanceOf(bob), 50 ether, "Bob should receive 50 DOT");
        assertEq(dot.balanceOf(alicePermit), 950 ether, "Alice should have 950 DOT");
    }

    function test_transferWithPermit_expired_deadline() public {
        dot.mint(alicePermit, 1_000 ether);
        address bob = makeAddr("bob");

        uint256 deadline = block.timestamp - 1;
        uint256 amount = 50 ether;

        bytes32 digest = _getPermitDigest(dot, alicePermit, address(executor), amount, 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, digest);

        vm.prank(alicePermit);
        vm.expectRevert();
        executor.executeTransferWithPermit(
            address(dot), bob, amount, deadline, v, r, s
        );
    }

    // === Factory Tests ===

    function test_factory_can_whitelist() public {
        address factoryAddr = makeAddr("factory");
        executor.setFactory(factoryAddr);

        MockERC20 newToken = new MockERC20("New", "NEW");

        vm.prank(factoryAddr);
        executor.whitelistToken(address(newToken), true);
        assertTrue(executor.whitelistedTokens(address(newToken)));
    }

    function test_non_owner_cannot_set_factory() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(
            bytes4(keccak256("OwnableUnauthorizedAccount(address)")),
            alice
        ));
        executor.setFactory(alice);
    }
}
