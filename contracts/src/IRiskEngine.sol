// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IRiskEngine — Interface for PVM Rust Risk Engine
/// @dev Called by IntentExecutor before swaps to enforce on-chain risk limits.
///      Maintains per-pool price history for MA20 and volatility calculations.
interface IRiskEngine {
    /// @notice Evaluate swap risk using price impact, MA20 deviation, and volatility
    /// @param amountIn Amount of input token
    /// @param reserveIn Reserve of input token in the pool
    /// @param reserveOut Reserve of output token in the pool
    /// @param tokenIn Address of input token (used for per-pool tracking)
    /// @param tokenOut Address of output token (used for per-pool tracking)
    /// @return riskLevel 0=GREEN, 1=YELLOW, 2=RED
    /// @return score Composite risk score (0-100)
    /// @return priceImpact Price impact in basis points
    /// @return volatility Historical volatility in basis points
    function evaluate(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        address tokenIn,
        address tokenOut
    ) external returns (uint8 riskLevel, uint256 score, uint256 priceImpact, uint256 volatility);

    /// @notice Get current risk statistics for a specific pool
    /// @param tokenIn Address of input token
    /// @param tokenOut Address of output token
    /// @return ma20 20-period moving average price
    /// @return volatility Historical volatility in basis points
    /// @return tradeCount Number of recorded trades
    function getStats(address tokenIn, address tokenOut) external view returns (uint256 ma20, uint256 volatility, uint256 tradeCount);
}
