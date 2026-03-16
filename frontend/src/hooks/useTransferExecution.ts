"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { parseEther, parseUnits, formatEther, formatUnits, isAddress, parseSignature, type Hash, type Address } from "viem";
import { config, polkadotHubTestnet } from "@/lib/wagmi";
import { CONTRACTS, TOKEN_MAP } from "@/lib/contracts";
import { mockERC20Abi, intentExecutorAbi } from "@/lib/abis";

export type TransferStatus =
  | "idle"
  | "signing"
  | "approving"
  | "approved"
  | "executing"
  | "success"
  | "error";

export interface TransferResult {
  status: TransferStatus;
  approveTxHash?: Hash;
  executeTxHash?: Hash;
  error?: string;
  usedPermit?: boolean;
}

/**
 * Hook that handles the full transfer flow.
 * Tries EIP-2612 permit (one tx) first, falls back to approve → transfer (two tx).
 */
export function useTransferExecution() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [result, setResult] = useState<TransferResult>({ status: "idle" });

  const reset = useCallback(() => {
    setResult({ status: "idle" });
  }, []);

  const executeTransfer = useCallback(
    async (
      tokenSymbol: string,
      recipient: string,
      amount: number,
    ): Promise<TransferResult> => {
      if (!address || !publicClient) {
        const r: TransferResult = { status: "error", error: "Wallet not connected" };
        setResult(r);
        return r;
      }

      if (!isAddress(recipient)) {
        const r: TransferResult = { status: "error", error: "Invalid recipient address." };
        setResult(r);
        return r;
      }

      try {
        const walletClient = await getWalletClient(config);

        // Native PAS transfer (no contract needed, no permit)
        if (tokenSymbol === "PAS") {
          const amountWei = parseEther(amount.toString());

          const balance = await publicClient.getBalance({ address });
          if (balance < amountWei) {
            const r: TransferResult = {
              status: "error",
              error: `Insufficient PAS balance. You have ${parseFloat(formatEther(balance)).toFixed(4)} but need ${amount}.`,
            };
            setResult(r);
            return r;
          }

          setResult({ status: "executing" });

          const executeTxHash = await walletClient.sendTransaction({
            chain: polkadotHubTestnet,
            to: recipient as Address,
            value: amountWei,
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash: executeTxHash });

          if (receipt.status !== "success") {
            const r: TransferResult = { status: "error", executeTxHash, error: "Transaction reverted on-chain." };
            setResult(r);
            return r;
          }

          const r: TransferResult = { status: "success", executeTxHash };
          setResult(r);
          return r;
        }

        // ERC-20 transfer via IntentExecutor
        const token = TOKEN_MAP[tokenSymbol];
        if (!token) {
          const r: TransferResult = { status: "error", error: `Unknown token: ${tokenSymbol}` };
          setResult(r);
          return r;
        }

        const executor = CONTRACTS.intentExecutor;
        if (executor === "0x0000000000000000000000000000000000000000") {
          const r: TransferResult = { status: "error", error: "IntentExecutor contract not configured." };
          setResult(r);
          return r;
        }

        const amountWei = parseUnits(amount.toString(), token.decimals);

        // Check balance
        const balance = await publicClient.readContract({
          address: token.address,
          abi: mockERC20Abi,
          functionName: "balanceOf",
          args: [address],
        });

        if (balance < amountWei) {
          const r: TransferResult = {
            status: "error",
            error: `Insufficient ${tokenSymbol} balance. You have ${parseFloat(formatUnits(balance, token.decimals)).toFixed(2)} but need ${amount}.`,
          };
          setResult(r);
          return r;
        }

        // --- Try EIP-2612 Permit flow (one tx) ---
        let permitFailed = false;
        try {
          setResult({ status: "signing" });

          const [tokenName, nonce] = await Promise.all([
            publicClient.readContract({
              address: token.address,
              abi: mockERC20Abi,
              functionName: "name",
            }),
            publicClient.readContract({
              address: token.address,
              abi: mockERC20Abi,
              functionName: "nonces",
              args: [address],
            }),
          ]);

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

          const signature = await walletClient.signTypedData({
            domain: {
              name: tokenName,
              version: "1",
              chainId: polkadotHubTestnet.id,
              verifyingContract: token.address,
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
              value: amountWei,
              nonce,
              deadline,
            },
          });

          const { v, r: sigR, s: sigS } = parseSignature(signature);

          setResult({ status: "executing", usedPermit: true });

          const executeTxHash = await walletClient.writeContract({
            chain: polkadotHubTestnet,
            address: executor,
            abi: intentExecutorAbi,
            functionName: "executeTransferWithPermit",
            args: [token.address, recipient as Address, amountWei, deadline, Number(v), sigR, sigS],
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash: executeTxHash });

          if (receipt.status !== "success") {
            const r: TransferResult = {
              status: "error",
              executeTxHash,
              error: "Transaction reverted on-chain.",
            };
            setResult(r);
            return r;
          }

          const r: TransferResult = { status: "success", executeTxHash, usedPermit: true };
          setResult(r);
          return r;
        } catch (permitErr: unknown) {
          const msg = permitErr instanceof Error ? permitErr.message : "";
          if (msg.includes("User rejected") || msg.includes("user rejected")) {
            const r: TransferResult = { status: "error", error: "Transaction rejected by user" };
            setResult(r);
            return r;
          }
          console.warn("Permit flow failed, falling back to approve→transfer:", msg);
          permitFailed = true;
        }

        // --- Fallback: approve → executeTransfer (two tx) ---
        if (permitFailed) {
          setResult({ status: "approving" });

          const currentAllowance = await publicClient.readContract({
            address: token.address,
            abi: mockERC20Abi,
            functionName: "allowance",
            args: [address, executor],
          });

          let approveTxHash: Hash | undefined;

          if (currentAllowance < amountWei) {
            approveTxHash = await walletClient.writeContract({
              chain: polkadotHubTestnet,
              address: token.address,
              abi: mockERC20Abi,
              functionName: "approve",
              args: [executor, amountWei],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
          }

          setResult({ status: "executing", approveTxHash });

          const executeTxHash = await walletClient.writeContract({
            chain: polkadotHubTestnet,
            address: executor,
            abi: intentExecutorAbi,
            functionName: "executeTransfer",
            args: [token.address, recipient as Address, amountWei],
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash: executeTxHash });

          if (receipt.status !== "success") {
            const r: TransferResult = {
              status: "error",
              approveTxHash,
              executeTxHash,
              error: "Transaction reverted on-chain.",
            };
            setResult(r);
            return r;
          }

          const r: TransferResult = { status: "success", approveTxHash, executeTxHash, usedPermit: false };
          setResult(r);
          return r;
        }

        const r: TransferResult = { status: "error", error: "Unknown error" };
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

        const r: TransferResult = { status: "error", error: friendlyMsg };
        setResult(r);
        return r;
      }
    },
    [address, publicClient]
  );

  return { result, executeTransfer, reset };
}
