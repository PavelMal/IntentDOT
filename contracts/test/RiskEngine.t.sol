// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/MockERC20.sol";
import "../src/MockDEX.sol";
import "../src/IntentExecutor.sol";
import "../src/IRiskEngine.sol";

/// @dev Mock Risk Engine for Foundry tests (simulates PVM Rust contract behavior)
contract MockRiskEngine is IRiskEngine {
    uint8 public nextRiskLevel;
    uint256 public nextScore;
    uint256 public lastAmountIn;
    uint256 public lastReserveIn;
    uint256 public lastReserveOut;
    uint256 public callCount;

    function setNextResult(uint8 _riskLevel, uint256 _score) external {
        nextRiskLevel = _riskLevel;
        nextScore = _score;
    }

    function evaluate(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external override returns (uint8 riskLevel, uint256 score, uint256 priceImpact, uint256 volatility) {
        lastAmountIn = amountIn;
        lastReserveIn = reserveIn;
        lastReserveOut = reserveOut;
        callCount++;
        return (nextRiskLevel, nextScore, 100, 50);
    }

    function getStats() external pure override returns (uint256 ma20, uint256 volatility, uint256 tradeCount) {
        return (10000, 50, 1);
    }
}

contract RiskEngineIntegrationTest is Test {
    event RiskChecked(address indexed user, uint8 riskLevel, uint256 score, uint256 priceImpact, uint256 volatility);
    event RiskEngineUpdated(address indexed oldEngine, address indexed newEngine);

    MockERC20 dot;
    MockERC20 usdt;
    MockDEX dex;
    IntentExecutor executor;
    MockRiskEngine riskEngine;

    address alice = makeAddr("alice");
    address lp = makeAddr("lp");

    function setUp() public {
        dot = new MockERC20("Polkadot", "DOT");
        usdt = new MockERC20("Tether USD", "USDT");
        dex = new MockDEX();
        executor = new IntentExecutor(address(dex));
        riskEngine = new MockRiskEngine();

        executor.whitelistToken(address(dot), true);
        executor.whitelistToken(address(usdt), true);

        // Seed liquidity: 10,000 DOT + 67,500 USDT
        dot.mint(lp, 10_000 ether);
        usdt.mint(lp, 67_500 ether);
        vm.startPrank(lp);
        dot.approve(address(dex), type(uint256).max);
        usdt.approve(address(dex), type(uint256).max);
        dex.addLiquidity(address(dot), address(usdt), 10_000 ether, 67_500 ether);
        vm.stopPrank();

        dot.mint(alice, 1_000 ether);
    }

    // === setRiskEngine Tests ===

    function test_setRiskEngine() public {
        executor.setRiskEngine(address(riskEngine));
        assertEq(address(executor.riskEngine()), address(riskEngine));
    }

    function test_setRiskEngine_emits_event() public {
        vm.expectEmit(true, true, false, false);
        emit RiskEngineUpdated(address(0), address(riskEngine));
        executor.setRiskEngine(address(riskEngine));
    }

    function test_setRiskEngine_only_owner() public {
        vm.prank(alice);
        vm.expectRevert("IntentExecutor: not owner");
        executor.setRiskEngine(address(riskEngine));
    }

    function test_disableRiskEngine() public {
        executor.setRiskEngine(address(riskEngine));
        executor.setRiskEngine(address(0));
        assertEq(address(executor.riskEngine()), address(0));
    }

    // === Swap with Risk Engine ===

    function test_swap_green_passes() public {
        riskEngine.setNextResult(0, 20); // GREEN
        executor.setRiskEngine(address(riskEngine));

        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);
        uint256 amountOut = executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();

        assertGt(amountOut, 0, "GREEN swap should succeed");
        assertEq(riskEngine.callCount(), 1, "Risk engine should be called");
    }

    function test_swap_yellow_passes() public {
        riskEngine.setNextResult(1, 50); // YELLOW
        executor.setRiskEngine(address(riskEngine));

        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);
        uint256 amountOut = executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();

        assertGt(amountOut, 0, "YELLOW swap should succeed");
    }

    function test_swap_red_reverts() public {
        riskEngine.setNextResult(2, 80); // RED
        executor.setRiskEngine(address(riskEngine));

        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);
        vm.expectRevert("IntentExecutor: risk too high");
        executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();
    }

    function test_swap_emits_risk_checked() public {
        riskEngine.setNextResult(0, 20); // GREEN
        executor.setRiskEngine(address(riskEngine));

        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);

        vm.expectEmit(true, false, false, true);
        emit RiskChecked(alice, 0, 20, 100, 50);
        executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();
    }

    function test_swap_passes_correct_reserves() public {
        riskEngine.setNextResult(0, 10);
        executor.setRiskEngine(address(riskEngine));

        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);
        executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();

        assertEq(riskEngine.lastAmountIn(), 10 ether, "Should pass amountIn");
        // Reserves depend on token sort order, but both should be non-zero
        assertGt(riskEngine.lastReserveIn(), 0, "reserveIn should be non-zero");
        assertGt(riskEngine.lastReserveOut(), 0, "reserveOut should be non-zero");
    }

    function test_swap_without_risk_engine_works() public {
        // No risk engine set — swap should work normally
        vm.startPrank(alice);
        dot.approve(address(executor), 10 ether);
        uint256 amountOut = executor.executeSwap(address(dot), address(usdt), 10 ether, 0);
        vm.stopPrank();

        assertGt(amountOut, 0, "Swap without risk engine should work");
    }

    function test_transfer_ignores_risk_engine() public {
        riskEngine.setNextResult(2, 80); // RED — would block swap
        executor.setRiskEngine(address(riskEngine));

        address bob = makeAddr("bob");
        vm.startPrank(alice);
        dot.approve(address(executor), 50 ether);
        executor.executeTransfer(address(dot), bob, 50 ether);
        vm.stopPrank();

        assertEq(dot.balanceOf(bob), 50 ether, "Transfer should ignore risk engine");
        assertEq(riskEngine.callCount(), 0, "Risk engine should not be called for transfers");
    }
}
