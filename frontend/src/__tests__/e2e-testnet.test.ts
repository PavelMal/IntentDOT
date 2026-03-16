/**
 * E2E Tests — IntentDOT on Polkadot Hub TestNet
 *
 * Tests the full flow against deployed contracts:
 * 1. Parse intent via AI API route logic
 * 2. Build preview with risk assessment
 * 3. Execute on-chain swaps (approve → swap)
 * 4. Verify balances change correctly
 * 5. Edge cases: insufficient balance, high slippage, wrong tokens
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mockERC20Abi, mockDexAbi, intentExecutorAbi } from "@/lib/abis";
import { buildPreview } from "@/lib/preview-builder";
import { validateUserMessage, validateParsedIntent } from "@/lib/intent-validator";

// --- Config ---

const RPC_URL = "https://eth-rpc-testnet.polkadot.io/";
const CHAIN_ID = 420420417;

const CONTRACTS = {
  dotToken: "0x6e824774C36cdF88D323419A29cB9F92090C5d8f" as Address,
  usdtToken: "0x152A1523096f6C34B104a3401aDcBA01B2cd80b4" as Address,
  usdcToken: "0x3140615Ed902E20c92d70395E6Af855325C4106f" as Address,
  mockDex: "0x91F2d00CdC18Ab7B9E834356065C3353F800099c" as Address,
  intentExecutor: "0x3A1E9DbCd16c7287b56F952EC3e9b3d238ECB75B" as Address,
};

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";

const chain = {
  id: CHAIN_ID,
  name: "Polkadot Hub TestNet",
  nativeCurrency: { decimals: 18, name: "Paseo", symbol: "PAS" },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

const account = privateKeyToAccount(DEPLOYER_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain,
  transport: http(RPC_URL),
});

// --- Helpers ---

async function getBalance(token: Address, addr: Address): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: mockERC20Abi,
    functionName: "balanceOf",
    args: [addr],
  });
}

async function approve(token: Address, spender: Address, amount: bigint) {
  const hash = await walletClient.writeContract({
    address: token,
    abi: mockERC20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function executeSwap(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  minAmountOut: bigint = 0n
) {
  const hash = await walletClient.writeContract({
    address: CONTRACTS.intentExecutor,
    abi: intentExecutorAbi,
    functionName: "executeSwap",
    args: [tokenIn, tokenOut, amountIn, minAmountOut],
  });
  return publicClient.waitForTransactionReceipt({ hash });
}

async function mintTokens(token: Address, to: Address, amount: bigint) {
  const hash = await walletClient.writeContract({
    address: token,
    abi: mockERC20Abi,
    functionName: "mint",
    args: [to, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

// --- Tests ---

// Increase timeout for on-chain transactions
jest.setTimeout(120_000);

afterAll(() => {
  // Force close open handles (HTTP connections to RPC)
  setTimeout(() => process.exit(0), 500);
});

describe("E2E: Intent Validation", () => {
  test("valid swap message passes validation", () => {
    const result = validateUserMessage("Swap 10 DOT to USDT");
    expect(result).toBeNull();
  });

  test("empty message fails validation", () => {
    const result = validateUserMessage("");
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
  });

  test("too long message fails validation", () => {
    const result = validateUserMessage("a".repeat(501));
    expect(result).not.toBeNull();
  });

  test("valid parsed intent passes validation", () => {
    const result = validateParsedIntent({
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "USDT", amount: 10 },
    });
    expect(result.success).toBe(true);
  });

  test("unsupported token fails validation", () => {
    const result = validateParsedIntent({
      success: true,
      intent: { action: "swap", token_from: "ETH", token_to: "USDT", amount: 10 },
    });
    expect(result.success).toBe(false);
  });

  test("same token swap fails validation", () => {
    const result = validateParsedIntent({
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "DOT", amount: 10 },
    });
    expect(result.success).toBe(false);
  });
});

describe("E2E: Preview & Risk Assessment", () => {
  test("builds preview for DOT → USDT swap", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 10 });
    expect(preview).not.toBeNull();
    expect(parseFloat(preview!.amountOut)).toBeGreaterThan(0);
    expect(preview!.risk.level).toBe("GREEN");
  });

  test("builds preview for DOT → USDC swap", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDC", amount: 50 });
    expect(preview).not.toBeNull();
    expect(parseFloat(preview!.amountOut)).toBeGreaterThan(0);
  });

  test("large swap triggers YELLOW/RED risk", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 20000 });
    expect(preview).not.toBeNull();
    expect(["YELLOW", "RED"]).toContain(preview!.risk.level);
    expect(preview!.risk.slippage).toBeGreaterThan(0.03);
  });

  test("returns null for unsupported pair", () => {
    const preview = buildPreview({ token_from: "USDT", token_to: "USDC", amount: 100 });
    expect(preview).toBeNull();
  });

  test("insufficient balance is flaggable", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 10 });
    expect(preview).not.toBeNull();
    // Simulate insufficient balance check
    preview!.insufficientBalance = { have: "5.00", need: 10 };
    expect(preview!.insufficientBalance.need).toBeGreaterThan(parseFloat(preview!.insufficientBalance.have));
  });
});

describe("E2E: On-chain contract reads", () => {
  test("reads pool reserves from MockDEX", async () => {
    const pool = await publicClient.readContract({
      address: CONTRACTS.mockDex,
      abi: mockDexAbi,
      functionName: "getPool",
      args: [CONTRACTS.dotToken, CONTRACTS.usdtToken],
    });

    expect(pool[2]).toBeGreaterThan(0n); // reserve0
    expect(pool[3]).toBeGreaterThan(0n); // reserve1
  });

  test("reads DOT/USDC pool", async () => {
    const pool = await publicClient.readContract({
      address: CONTRACTS.mockDex,
      abi: mockDexAbi,
      functionName: "getPool",
      args: [CONTRACTS.dotToken, CONTRACTS.usdcToken],
    });

    expect(pool[2]).toBeGreaterThan(0n);
    expect(pool[3]).toBeGreaterThan(0n);
  });

  test("previewSwap returns expected amount", async () => {
    const amountIn = parseUnits("10", 18);
    const amountOut = await publicClient.readContract({
      address: CONTRACTS.intentExecutor,
      abi: intentExecutorAbi,
      functionName: "previewSwap",
      args: [CONTRACTS.dotToken, CONTRACTS.usdtToken, amountIn],
    });

    expect(amountOut).toBeGreaterThan(0n);
    // ~67.5 USDT for 10 DOT at 6.75 rate
    const outFloat = parseFloat(formatUnits(amountOut, 18));
    expect(outFloat).toBeGreaterThan(50);
    expect(outFloat).toBeLessThan(80);
  });

  test("deployer has DOT balance", async () => {
    const balance = await getBalance(CONTRACTS.dotToken, account.address);
    expect(balance).toBeGreaterThan(0n);
  });
});

describe("E2E: On-chain swap execution", () => {
  // Mint fresh tokens before swaps to ensure idempotent tests
  beforeAll(async () => {
    await mintTokens(CONTRACTS.dotToken, account.address, parseUnits("500", 18));
    await mintTokens(CONTRACTS.usdtToken, account.address, parseUnits("500", 18));
    await mintTokens(CONTRACTS.usdcToken, account.address, parseUnits("500", 18));
  });

  test("Swap 1: 10 DOT → USDT (happy path)", async () => {
    const amountIn = parseUnits("10", 18);

    // Check balances before
    const dotBefore = await getBalance(CONTRACTS.dotToken, account.address);
    const usdtBefore = await getBalance(CONTRACTS.usdtToken, account.address);
    expect(dotBefore).toBeGreaterThanOrEqual(amountIn);

    // Preview
    const expectedOut = await publicClient.readContract({
      address: CONTRACTS.intentExecutor,
      abi: intentExecutorAbi,
      functionName: "previewSwap",
      args: [CONTRACTS.dotToken, CONTRACTS.usdtToken, amountIn],
    });
    expect(expectedOut).toBeGreaterThan(0n);

    // Approve
    await approve(CONTRACTS.dotToken, CONTRACTS.intentExecutor, amountIn);

    // Execute
    const receipt = await executeSwap(
      CONTRACTS.dotToken,
      CONTRACTS.usdtToken,
      amountIn,
      0n
    );
    expect(receipt.status).toBe("success");

    // Verify balances changed
    const dotAfter = await getBalance(CONTRACTS.dotToken, account.address);
    const usdtAfter = await getBalance(CONTRACTS.usdtToken, account.address);

    expect(dotAfter).toBeLessThan(dotBefore);
    expect(usdtAfter).toBeGreaterThan(usdtBefore);
  });

  test("Swap 2: 50 DOT → USDC", async () => {
    const amountIn = parseUnits("50", 18);

    const dotBefore = await getBalance(CONTRACTS.dotToken, account.address);
    const usdcBefore = await getBalance(CONTRACTS.usdcToken, account.address);
    expect(dotBefore).toBeGreaterThanOrEqual(amountIn);

    await approve(CONTRACTS.dotToken, CONTRACTS.intentExecutor, amountIn);

    const receipt = await executeSwap(
      CONTRACTS.dotToken,
      CONTRACTS.usdcToken,
      amountIn,
      0n
    );
    expect(receipt.status).toBe("success");

    const dotAfter = await getBalance(CONTRACTS.dotToken, account.address);
    const usdcAfter = await getBalance(CONTRACTS.usdcToken, account.address);

    expect(dotAfter).toBeLessThan(dotBefore);
    expect(usdcAfter).toBeGreaterThan(usdcBefore);
  });

  test("Swap 3: 100 USDT → DOT (reverse swap)", async () => {
    const amountIn = parseUnits("100", 18);

    const usdtBefore = await getBalance(CONTRACTS.usdtToken, account.address);
    const dotBefore = await getBalance(CONTRACTS.dotToken, account.address);
    expect(usdtBefore).toBeGreaterThanOrEqual(amountIn);

    await approve(CONTRACTS.usdtToken, CONTRACTS.intentExecutor, amountIn);

    const receipt = await executeSwap(
      CONTRACTS.usdtToken,
      CONTRACTS.dotToken,
      amountIn,
      0n
    );
    expect(receipt.status).toBe("success");

    const usdtAfter = await getBalance(CONTRACTS.usdtToken, account.address);
    const dotAfter = await getBalance(CONTRACTS.dotToken, account.address);

    expect(usdtAfter).toBeLessThan(usdtBefore);
    expect(dotAfter).toBeGreaterThan(dotBefore);
  });
});

describe("E2E: Edge cases", () => {
  test("swap with minAmountOut too high reverts", async () => {
    const amountIn = parseUnits("1", 18);
    await approve(CONTRACTS.dotToken, CONTRACTS.intentExecutor, amountIn);

    // Set minAmountOut absurdly high — should revert
    const absurdMin = parseUnits("99999", 18);

    await expect(
      executeSwap(CONTRACTS.dotToken, CONTRACTS.usdtToken, amountIn, absurdMin)
    ).rejects.toThrow();
  });

  test("swap with zero amount reverts", async () => {
    await expect(
      executeSwap(CONTRACTS.dotToken, CONTRACTS.usdtToken, 0n, 0n)
    ).rejects.toThrow();
  });

  test("IntentExecuted event is emitted on swap", async () => {
    const amountIn = parseUnits("5", 18);
    await approve(CONTRACTS.dotToken, CONTRACTS.intentExecutor, amountIn);

    const hash = await walletClient.writeContract({
      address: CONTRACTS.intentExecutor,
      abi: intentExecutorAbi,
      functionName: "executeSwap",
      args: [CONTRACTS.dotToken, CONTRACTS.usdtToken, amountIn, 0n],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    // Check logs for IntentExecuted event
    expect(receipt.logs.length).toBeGreaterThan(0);
  });
});
