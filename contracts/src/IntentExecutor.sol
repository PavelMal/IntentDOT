// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "./MockDEX.sol";
import "./IRiskEngine.sol";

/// @title IntentExecutor — On-chain entry point for AI-parsed DeFi intents
/// @dev Routes structured intents to MockDEX. Uses OZ ReentrancyGuard, Ownable, Pausable, SafeERC20.
///      Optionally calls a PVM Rust Risk Engine before swaps — RED risk = revert.
contract IntentExecutor is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    MockDEX public immutable dex;
    address public factory;

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

    modifier onlyWhitelisted(address token) {
        require(whitelistedTokens[token], "IntentExecutor: token not whitelisted");
        _;
    }

    constructor(address _dex)
        Ownable(msg.sender)
    {
        dex = MockDEX(_dex);
    }

    /// @notice Whitelist or de-whitelist a token. Only owner or factory.
    function whitelistToken(address token, bool status) external {
        require(msg.sender == owner() || msg.sender == factory, "IntentExecutor: not authorized");
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

    /// @notice Pause all swap and transfer operations (emergency stop)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause operations
    function unpause() external onlyOwner {
        _unpause();
    }

    function _getReserves(address tokenIn, address tokenOut) internal view returns (uint256 reserveIn, uint256 reserveOut) {
        (, , uint256 r0, uint256 r1) = dex.getPool(tokenIn, tokenOut);
        (address t0, ) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
        return tokenIn == t0 ? (r0, r1) : (r1, r0);
    }

    function _checkRisk(address tokenIn, address tokenOut, uint256 amountIn) internal {
        (uint256 reserveIn, uint256 reserveOut) = _getReserves(tokenIn, tokenOut);

        (uint8 riskLevel, uint256 score, uint256 priceImpact, uint256 volatility) =
            riskEngine.evaluate(amountIn, reserveIn, reserveOut, tokenIn, tokenOut);

        emit RiskChecked(msg.sender, riskLevel, score, priceImpact, volatility);
        require(riskLevel < RISK_RED, "IntentExecutor: risk too high");
    }

    function _doSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        require(amountIn > 0, "IntentExecutor: zero amount");
        require(tokenIn != tokenOut, "IntentExecutor: same token");

        // On-chain risk check via PVM Rust Risk Engine
        if (address(riskEngine) != address(0)) {
            _checkRisk(tokenIn, tokenOut, amountIn);
        }

        // Transfer tokenIn from user to this contract
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Approve DEX to spend tokenIn
        IERC20(tokenIn).forceApprove(address(dex), amountIn);

        // Execute swap via DEX
        amountOut = dex.swap(tokenIn, tokenOut, amountIn, minAmountOut);

        // Transfer tokenOut to user
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        emit IntentExecuted(msg.sender, "swap", tokenIn, tokenOut, amountIn, amountOut);
    }

    /// @notice Standard swap — requires prior ERC20 approval
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant whenNotPaused onlyWhitelisted(tokenIn) onlyWhitelisted(tokenOut) returns (uint256 amountOut) {
        return _doSwap(tokenIn, tokenOut, amountIn, minAmountOut);
    }

    /// @notice Gasless-approval swap via EIP-2612 permit — one signature, one tx
    /// @dev User signs an off-chain permit (no gas), then this function calls permit() + swap in one tx
    function executeSwapWithPermit(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused onlyWhitelisted(tokenIn) onlyWhitelisted(tokenOut) returns (uint256 amountOut) {
        IERC20Permit(tokenIn).permit(msg.sender, address(this), amountIn, deadline, v, r, s);
        return _doSwap(tokenIn, tokenOut, amountIn, minAmountOut);
    }

    /// @notice Transfer tokens to a recipient. Whitelist enforced.
    function executeTransfer(
        address token,
        address recipient,
        uint256 amount
    ) external nonReentrant whenNotPaused onlyWhitelisted(token) returns (bool) {
        require(amount > 0, "IntentExecutor: zero amount");
        require(recipient != address(0), "IntentExecutor: zero address");
        require(recipient != msg.sender, "IntentExecutor: self transfer");

        IERC20(token).safeTransferFrom(msg.sender, recipient, amount);

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
