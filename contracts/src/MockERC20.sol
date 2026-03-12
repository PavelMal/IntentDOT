// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockERC20 — OpenZeppelin-based ERC20 for testnet
/// @dev Mintable by owner. Built on OZ ERC20 + ERC20Burnable + Ownable.
contract MockERC20 is ERC20, ERC20Burnable, Ownable {
    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
        Ownable(msg.sender)
    {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
