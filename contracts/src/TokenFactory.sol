// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MockERC20.sol";
import "./IntentExecutor.sol";

/// @title TokenFactory — Deploys new ERC20 tokens and auto-whitelists them
/// @dev Created tokens are minted to the caller. Auto-whitelists via IntentExecutor.
contract TokenFactory {
    IntentExecutor public immutable executor;

    mapping(address => address[]) public createdTokens;

    event TokenCreated(
        address indexed creator,
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 initialSupply
    );

    constructor(address _executor) {
        executor = IntentExecutor(_executor);
    }

    /// @notice Create a new ERC20 token, mint initialSupply to caller, and auto-whitelist.
    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 initialSupply
    ) external returns (address tokenAddress) {
        require(initialSupply > 0, "TokenFactory: zero supply");
        require(bytes(name).length > 0, "TokenFactory: empty name");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 10, "TokenFactory: invalid symbol");

        // Deploy new MockERC20
        MockERC20 token = new MockERC20(name, symbol);
        tokenAddress = address(token);

        // Mint initial supply to caller
        token.mint(msg.sender, initialSupply);

        // Auto-whitelist in IntentExecutor
        executor.whitelistToken(tokenAddress, true);

        // Track
        createdTokens[msg.sender].push(tokenAddress);

        emit TokenCreated(msg.sender, tokenAddress, name, symbol, initialSupply);
    }

    /// @notice Get all tokens created by a specific address.
    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return createdTokens[creator];
    }
}
