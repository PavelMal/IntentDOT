// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/IntentExecutor.sol";
import "../src/TokenFactory.sol";

/// @notice Deploys new IntentExecutor + TokenFactory with PVM Risk Engine integration.
contract DeployV2Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Existing contracts (keep as-is)
        address dex = 0x5b2810428f3DA3400f111f516560EE63d44c336A;
        address dot = 0x0Fb72340AA780c00823E0a80429327af63E8d2Fc;
        address usdt = 0x12e41FDB22Bc661719B4D7445952e1b51C429dDB;
        address usdc = 0x540De5E6237395b63cFd9C383C47F5F32FAb3123;
        address riskEngine = 0x47DEe4a8d8bad545cBC824eb5504f2FC16aeeF4B;

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new IntentExecutor (points to existing DEX)
        IntentExecutor executor = new IntentExecutor(dex);

        // Whitelist existing tokens
        executor.whitelistToken(dot, true);
        executor.whitelistToken(usdt, true);
        executor.whitelistToken(usdc, true);

        // Connect PVM Rust Risk Engine
        executor.setRiskEngine(riskEngine);

        // Deploy TokenFactory (linked to new executor)
        TokenFactory factory = new TokenFactory(address(executor));

        // Grant factory whitelist rights
        executor.setFactory(address(factory));

        vm.stopBroadcast();

        console.log("=== V3 Deployed ===");
        console.log("IntentExecutor (new):", address(executor));
        console.log("TokenFactory (new):  ", address(factory));
        console.log("RiskEngine (PVM):    ", riskEngine);
        console.log("");
        console.log("=== Existing (unchanged) ===");
        console.log("MockDEX:             ", dex);
        console.log("DOT Token:           ", dot);
        console.log("USDT Token:          ", usdt);
        console.log("USDC Token:          ", usdc);
    }
}
