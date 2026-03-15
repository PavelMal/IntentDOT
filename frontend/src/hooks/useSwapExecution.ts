"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { parseUnits, formatUnits, parseSignature, type Hash } from "viem";
import { config, polkadotHubTestnet } from "@/lib/wagmi";
import { CONTRACTS, TOKEN_MAP } from "@/lib/contracts";
import { mockERC20Abi, intentExecutorAbi } from "@/lib/abis";
import { parseRiskCheckedEvent, type RawLog } from "@/lib/risk-display";
import type { OnChainRisk } from "@/lib/types";

export type SwapStatus =
  | "idle"
  | "signing"
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
  onChainRisk?: OnChainRisk;
  usedPermit?: boolean;
}

/**
 * Hook that handles the full swap flow.
 * Tries EIP-2612 permit (one tx) first, falls back to approve → swap (two tx).
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
        const walletClient = await getWalletClient(config);

        // Check balance
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

        // --- Try EIP-2612 Permit flow (one tx) ---
        let permitFailed = false;
        try {
          setResult({ status: "signing" });

          // Read token name and nonce for EIP-712 domain
          const [tokenName, nonce] = await Promise.all([
            publicClient.readContract({
              address: tokenIn.address,
              abi: mockERC20Abi,
              functionName: "name",
            }),
            publicClient.readContract({
              address: tokenIn.address,
              abi: mockERC20Abi,
              functionName: "nonces",
              args: [address],
            }),
          ]);

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

          // EIP-712 typed data for Permit (matches OZ ERC20Permit v5)
          const signature = await walletClient.signTypedData({
            domain: {
              name: tokenName,
              version: "1",
              chainId: polkadotHubTestnet.id,
              verifyingContract: tokenIn.address,
            },
            types: {
              Permit: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
                { name: "value", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
              ],
            },
            primaryType: "Permit",
            message: {
              owner: address,
              spender: executor,
              value: amountIn,
              nonce,
              deadline,
            },
          });

          const { v, r: sigR, s: sigS } = parseSignature(signature);

          // Execute swap with permit (one tx, no separate approve)
          setResult({ status: "executing", usedPermit: true });

          const executeTxHash = await walletClient.writeContract({
            chain: polkadotHubTestnet,
            address: executor,
            abi: intentExecutorAbi,
            functionName: "executeSwapWithPermit",
            args: [tokenIn.address, tokenOut.address, amountIn, minAmountOut, deadline, Number(v), sigR, sigS],
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash: executeTxHash });

          if (receipt.status !== "success") {
            const r: SwapResult = {
              status: "error",
              executeTxHash,
              error: "Transaction reverted. Possible risk block or slippage exceeded.",
            };
            setResult(r);
            return r;
          }

          const onChainRisk = parseRiskCheckedEvent(receipt.logs as unknown as RawLog[]);

          const r: SwapResult = {
            status: "success",
            executeTxHash,
            onChainRisk,
            usedPermit: true,
          };
          setResult(r);
          return r;
        } catch (permitErr: unknown) {
          const msg = permitErr instanceof Error ? permitErr.message : "";
          // If user rejected the signature, don't fall back
          if (msg.includes("User rejected") || msg.includes("user rejected")) {
            const r: SwapResult = { status: "error", error: "Transaction rejected by user" };
            setResult(r);
            return r;
          }
          // Otherwise fall back to approve → swap
          console.warn("Permit flow failed, falling back to approve→swap:", msg);
          permitFailed = true;
        }

        // --- Fallback: approve → executeSwap (two tx) ---
        if (permitFailed) {
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
            const isRiskRevert = receipt.logs.length === 0;
            const r: SwapResult = {
              status: "error",
              approveTxHash,
              executeTxHash,
              error: isRiskRevert
                ? "Transaction blocked by on-chain Risk Engine (risk too high)."
                : "Transaction reverted on-chain. Possible slippage exceeded or insufficient liquidity.",
            };
            setResult(r);
            return r;
          }

          const onChainRisk = parseRiskCheckedEvent(receipt.logs as unknown as RawLog[]);

          const r: SwapResult = {
            status: "success",
            approveTxHash,
            executeTxHash,
            onChainRisk,
            usedPermit: false,
          };
          setResult(r);
          return r;
        }

        // Should not reach here
        const r: SwapResult = { status: "error", error: "Unknown error" };
        setResult(r);
        return r;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
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
