// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MockDEX.sol";
import "./MockERC20.sol";
import "./IRiskEngine.sol";

/// @title IntentExecutor — On-chain entry point for AI-parsed DeFi intents
/// @dev Routes structured intents to MockDEX. Reentrancy-protected. Token whitelist enforced.
///      Optionally calls a PVM Rust Risk Engine before swaps — RED risk = revert.
contract IntentExecutor {
    MockDEX public immutable dex;
    address public owner;
    address public factory;
    bool private locked;

    /// @notice PVM Rust Risk Engine address (0 = disabled)
    IRiskEngine public riskEngine;

    /// @notice Risk level that causes revert (default: 2 = RED)
    uint8 public constant RISK_RED = 2;

    mapping(address => bool) public whitelistedTokens;

    event IntentExecuted(
        address indexed user,
        string intentType,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event TokenWhitelisted(address indexed token, bool status);

    event RiskChecked(
        address indexed user,
        uint8 riskLevel,
        uint256 score,
        uint256 priceImpact,
        uint256 volatility
    );

    event RiskEngineUpdated(address indexed oldEngine, address indexed newEngine);

    modifier noReentrant() {
        require(!locked, "IntentExecutor: reentrant call");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "IntentExecutor: not owner");
        _;
    }

    modifier onlyWhitelisted(address token) {
        require(whitelistedTokens[token], "IntentExecutor: token not whitelisted");
        _;
    }

    constructor(address _dex) {
        dex = MockDEX(_dex);
        owner = msg.sender;
    }

    /// @notice Whitelist or de-whitelist a token. Only owner or factory.
    function whitelistToken(address token, bool status) external {
        require(msg.sender == owner || msg.sender == factory, "IntentExecutor: not authorized");
        whitelistedTokens[token] = status;
        emit TokenWhitelisted(token, status);
    }

    /// @notice Set the factory address (for auto-whitelisting new tokens)
    function setFactory(address _factory) external onlyOwner {
        factory = _factory;
    }

    /// @notice Set or disable the PVM Risk Engine. Pass address(0) to disable.
    function setRiskEngine(address _riskEngine) external onlyOwner {
        address old = address(riskEngine);
        riskEngine = IRiskEngine(_riskEngine);
        emit RiskEngineUpdated(old, _riskEngine);
    }

    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external noReentrant onlyWhitelisted(tokenIn) onlyWhitelisted(tokenOut) returns (uint256 amountOut) {
        require(amountIn > 0, "IntentExecutor: zero amount");
        require(tokenIn != tokenOut, "IntentExecutor: same token");

        // On-chain risk check via PVM Rust Risk Engine
        if (address(riskEngine) != address(0)) {
            // Get pool reserves for risk evaluation
            (, , uint256 r0, uint256 r1) = dex.getPool(tokenIn, tokenOut);
            (address t0, ) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
            (uint256 reserveIn, uint256 reserveOut) = tokenIn == t0 ? (r0, r1) : (r1, r0);

            (uint8 riskLevel, uint256 score, uint256 priceImpact, uint256 volatility) =
                riskEngine.evaluate(amountIn, reserveIn, reserveOut);

            emit RiskChecked(msg.sender, riskLevel, score, priceImpact, volatility);
            require(riskLevel < RISK_RED, "IntentExecutor: risk too high");
        }

        // Transfer tokenIn from user to this contract
        MockERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Approve DEX to spend tokenIn
        MockERC20(tokenIn).approve(address(dex), amountIn);

        // Execute swap via DEX
        amountOut = dex.swap(tokenIn, tokenOut, amountIn, minAmountOut);

        // Transfer tokenOut to user
        MockERC20(tokenOut).transfer(msg.sender, amountOut);

        emit IntentExecuted(msg.sender, "swap", tokenIn, tokenOut, amountIn, amountOut);
    }

    /// @notice Transfer tokens to a recipient. Whitelist enforced.
    function executeTransfer(
        address token,
        address recipient,
        uint256 amount
    ) external noReentrant onlyWhitelisted(token) returns (bool) {
        require(amount > 0, "IntentExecutor: zero amount");
        require(recipient != address(0), "IntentExecutor: zero address");
        require(recipient != msg.sender, "IntentExecutor: self transfer");

        MockERC20(token).transferFrom(msg.sender, recipient, amount);

        emit IntentExecuted(msg.sender, "transfer", token, recipient, amount, amount);
        return true;
    }

    /// @notice Preview swap output without executing
    function previewSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        return dex.getAmountOut(tokenIn, tokenOut, amountIn);
    }
}
