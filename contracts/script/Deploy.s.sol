// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockERC20.sol";
import "../src/MockDEX.sol";
import "../src/IntentExecutor.sol";
import "../src/TokenFactory.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy tokens
        MockERC20 dot = new MockERC20("Polkadot", "DOT");
        MockERC20 usdt = new MockERC20("Tether USD", "USDT");
        MockERC20 usdc = new MockERC20("USD Coin", "USDC");

        // Deploy DEX
        MockDEX dex = new MockDEX();

        // Deploy IntentExecutor
        IntentExecutor executor = new IntentExecutor(address(dex));

        // Whitelist tokens
        executor.whitelistToken(address(dot), true);
        executor.whitelistToken(address(usdt), true);
        executor.whitelistToken(address(usdc), true);

        // Deploy TokenFactory and grant it whitelist rights
        TokenFactory factory = new TokenFactory(address(executor));
        executor.setFactory(address(factory));

        vm.stopBroadcast();

        console.log("=== Deployed Addresses ===");
        console.log("DOT Token:       ", address(dot));
        console.log("USDT Token:      ", address(usdt));
        console.log("USDC Token:      ", address(usdc));
        console.log("MockDEX:         ", address(dex));
        console.log("IntentExecutor:  ", address(executor));
        console.log("TokenFactory:    ", address(factory));
    }
}
