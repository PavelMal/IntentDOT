"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { parseUnits, formatUnits, type Hash } from "viem";
import { config, polkadotHubTestnet } from "@/lib/wagmi";
import { CONTRACTS, TOKEN_MAP } from "@/lib/contracts";
import { mockERC20Abi, intentExecutorAbi } from "@/lib/abis";

export type SwapStatus =
  | "idle"
  | "approving"
  | "approved"
  | "executing"
  | "success"
  | "error";

export interface SwapResult {
  status: SwapStatus;
  approveTxHash?: Hash;
  executeTxHash?: Hash;
  amountOut?: string;
  error?: string;
}

/**
 * Hook that handles the full approve → execute swap flow.
 * Returns a function to trigger the swap and the current status.
 */
export function useSwapExecution() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [result, setResult] = useState<SwapResult>({ status: "idle" });

  const reset = useCallback(() => {
    setResult({ status: "idle" });
  }, []);

  const executeSwap = useCallback(
    async (
      tokenFromSymbol: string,
      tokenToSymbol: string,
      amount: number,
      minAmountOut: bigint = 0n
    ): Promise<SwapResult> => {
      if (!address || !publicClient) {
        const r: SwapResult = { status: "error", error: "Wallet not connected" };
        setResult(r);
        return r;
      }

      const tokenIn = TOKEN_MAP[tokenFromSymbol];
      const tokenOut = TOKEN_MAP[tokenToSymbol];
      if (!tokenIn || !tokenOut) {
        const r: SwapResult = { status: "error", error: `Unknown token: ${tokenFromSymbol} or ${tokenToSymbol}` };
        setResult(r);
        return r;
      }

      const executor = CONTRACTS.intentExecutor;
      if (executor === "0x0000000000000000000000000000000000000000") {
        const r: SwapResult = { status: "error", error: "IntentExecutor contract not configured. Set NEXT_PUBLIC_INTENT_EXECUTOR." };
        setResult(r);
        return r;
      }

      const amountIn = parseUnits(amount.toString(), tokenIn.decimals);

      try {
        // Get wallet client on demand (async, waits until ready)
        const walletClient = await getWalletClient(config);

        // Step 1: Check balance
        const balance = await publicClient.readContract({
          address: tokenIn.address,
          abi: mockERC20Abi,
          functionName: "balanceOf",
          args: [address],
        });

        if (balance < amountIn) {
          const r: SwapResult = {
            status: "error",
            error: `Insufficient ${tokenFromSymbol} balance. You have ${parseFloat(formatUnits(balance, tokenIn.decimals)).toFixed(2)} but need ${amount}.`,
          };
          setResult(r);
          return r;
        }

        // Step 2: Check allowance, approve if needed
        setResult({ status: "approving" });

        const currentAllowance = await publicClient.readContract({
          address: tokenIn.address,
          abi: mockERC20Abi,
          functionName: "allowance",
          args: [address, executor],
        });

        let approveTxHash: Hash | undefined;

        if (currentAllowance < amountIn) {
          approveTxHash = await walletClient.writeContract({
            chain: polkadotHubTestnet,
            address: tokenIn.address,
            abi: mockERC20Abi,
            functionName: "approve",
            args: [executor, amountIn],
          });

          await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
        }

        setResult({ status: "approved", approveTxHash });

        // Step 3: Execute swap
        setResult({ status: "executing", approveTxHash });

        const executeTxHash = await walletClient.writeContract({
          chain: polkadotHubTestnet,
          address: executor,
          abi: intentExecutorAbi,
          functionName: "executeSwap",
          args: [tokenIn.address, tokenOut.address, amountIn, minAmountOut],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: executeTxHash });

        if (receipt.status !== "success") {
          const r: SwapResult = {
            status: "error",
            approveTxHash,
            executeTxHash,
            error: "Transaction reverted on-chain. Possible slippage exceeded or insufficient liquidity.",
          };
          setResult(r);
          return r;
        }

        const r: SwapResult = {
          status: "success",
          approveTxHash,
          executeTxHash,
        };
        setResult(r);
        return r;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        // Simplify common wallet errors
        const friendlyMsg = message.includes("User rejected")
          ? "Transaction rejected by user"
          : message.includes("insufficient funds")
            ? "Insufficient funds for gas"
            : message.length > 200
              ? message.slice(0, 200) + "..."
              : message;

        const r: SwapResult = { status: "error", error: friendlyMsg };
        setResult(r);
        return r;
      }
    },
    [address, publicClient]
  );

  return { result, executeSwap, reset };
}
