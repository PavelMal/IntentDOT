// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockERC20.sol";
import "../src/MockDEX.sol";
import "../src/IntentExecutor.sol";
import "../src/TokenFactory.sol";

/// @notice Full redeploy: all contracts with OpenZeppelin 5.x + seed pools.
///         Reuses existing Rust/PVM RiskEngine.
contract DeployV3Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Existing PVM Rust Risk Engine (keep as-is)
        address riskEngine = 0x20c0dF8e93A0c400b7b36f699101972712ad7f9F;

        vm.startBroadcast(deployerPrivateKey);

        // --- 1. Deploy tokens (ERC20 + ERC20Burnable + ERC20Permit + Ownable) ---
        MockERC20 dot = new MockERC20("Polkadot", "DOT");
        MockERC20 usdt = new MockERC20("Tether USD", "USDT");
        MockERC20 usdc = new MockERC20("USD Coin", "USDC");

        // --- 2. Deploy DEX (SafeERC20) ---
        MockDEX dex = new MockDEX();

        // --- 3. Deploy IntentExecutor (Ownable + ReentrancyGuard + Pausable + SafeERC20 + Permit) ---
        IntentExecutor executor = new IntentExecutor(address(dex));

        // --- 4. Whitelist tokens ---
        executor.whitelistToken(address(dot), true);
        executor.whitelistToken(address(usdt), true);
        executor.whitelistToken(address(usdc), true);

        // --- 5. Connect PVM Rust Risk Engine ---
        executor.setRiskEngine(riskEngine);

        // --- 6. Deploy TokenFactory (AccessControl + CREATOR_ROLE) ---
        TokenFactory factory = new TokenFactory(address(executor));
        executor.setFactory(address(factory));

        // --- 7. Mint tokens for pools + deployer ---
        dot.mint(deployer, 100_000 ether);
        usdt.mint(deployer, 675_000 ether);
        usdc.mint(deployer, 675_000 ether);

        // --- 8. Seed liquidity pools ---
        dot.approve(address(dex), type(uint256).max);
        usdt.approve(address(dex), type(uint256).max);
        usdc.approve(address(dex), type(uint256).max);

        // DOT/USDT: 50,000 DOT + 337,500 USDT (1 DOT = 6.75 USDT)
        dex.addLiquidity(address(dot), address(usdt), 50_000 ether, 337_500 ether);

        // DOT/USDC: 50,000 DOT + 337,500 USDC
        dex.addLiquidity(address(dot), address(usdc), 50_000 ether, 337_500 ether);

        vm.stopBroadcast();

        console.log("=== V3 Full Deploy (OpenZeppelin 5.x) ===");
        console.log("DOT Token:          ", address(dot));
        console.log("USDT Token:         ", address(usdt));
        console.log("USDC Token:         ", address(usdc));
        console.log("MockDEX:            ", address(dex));
        console.log("IntentExecutor:     ", address(executor));
        console.log("TokenFactory:       ", address(factory));
        console.log("RiskEngine (PVM):   ", riskEngine);
        console.log("");
        console.log("Pools seeded: DOT/USDT + DOT/USDC (50K/337.5K each)");
    }
}
