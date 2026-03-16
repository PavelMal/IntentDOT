// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockERC20.sol";
import "../src/MockDEX.sol";

contract SeedPoolsScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        address dotAddr = vm.envAddress("DOT_TOKEN");
        address usdtAddr = vm.envAddress("USDT_TOKEN");
        address usdcAddr = vm.envAddress("USDC_TOKEN");
        address dexAddr = vm.envAddress("MOCK_DEX");

        MockERC20 dot = MockERC20(dotAddr);
        MockERC20 usdt = MockERC20(usdtAddr);
        MockERC20 usdc = MockERC20(usdcAddr);
        MockDEX dex = MockDEX(dexAddr);

        vm.startBroadcast(deployerPrivateKey);

        // Mint tokens for seeding
        address deployer = vm.addr(deployerPrivateKey);
        dot.mint(deployer, 100_000 ether);
        usdt.mint(deployer, 675_000 ether);
        usdc.mint(deployer, 675_000 ether);

        // Approve DEX
        dot.approve(address(dex), type(uint256).max);
        usdt.approve(address(dex), type(uint256).max);
        usdc.approve(address(dex), type(uint256).max);

        // Seed DOT/USDT pool: 50,000 DOT + 337,500 USDT (1 DOT = 6.75 USDT)
        dex.addLiquidity(dotAddr, usdtAddr, 50_000 ether, 337_500 ether);

        // Seed DOT/USDC pool: 50,000 DOT + 337,500 USDC
        dex.addLiquidity(dotAddr, usdcAddr, 50_000 ether, 337_500 ether);

        vm.stopBroadcast();

        console.log("=== Pools Seeded ===");
        console.log("DOT/USDT: 50,000 DOT / 337,500 USDT");
        console.log("DOT/USDC: 50,000 DOT / 337,500 USDC");
    }
}
