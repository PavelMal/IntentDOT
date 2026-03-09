// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IRiskEngine — Interface for PVM Rust Risk Engine
/// @dev Called by IntentExecutor before swaps to enforce on-chain risk limits.
///      The implementation is a Rust contract compiled to PolkaVM bytecode.
interface IRiskEngine {
    /// @notice Evaluate swap risk using price impact, MA20 deviation, and volatility
    /// @param amountIn Amount of input token
    /// @param reserveIn Reserve of input token in the pool
    /// @param reserveOut Reserve of output token in the pool
    /// @return riskLevel 0=GREEN, 1=YELLOW, 2=RED
    /// @return score Composite risk score (0-100)
    /// @return priceImpact Price impact in basis points
    /// @return volatility Historical volatility in basis points
    function evaluate(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external returns (uint8 riskLevel, uint256 score, uint256 priceImpact, uint256 volatility);

    /// @notice Get current risk statistics
    /// @return ma20 20-period moving average price
    /// @return volatility Historical volatility in basis points
    /// @return tradeCount Number of recorded trades
    function getStats() external view returns (uint256 ma20, uint256 volatility, uint256 tradeCount);
}
