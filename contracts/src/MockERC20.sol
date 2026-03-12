// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockERC20 — OpenZeppelin-based ERC20 for testnet
/// @dev Mintable by owner. ERC20Permit enables gasless approvals (EIP-2612).
contract MockERC20 is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
        ERC20Permit(_name)
        Ownable(msg.sender)
    {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @dev Required override — ERC20Permit inherits Nonces which defines nonces()
    function nonces(address owner) public view override(ERC20Permit) returns (uint256) {
        return super.nonces(owner);
    }
}
