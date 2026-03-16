"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { parseEther, formatEther, type Hash, type Address } from "viem";
import { config, polkadotHubTestnet } from "@/lib/wagmi";
import {
  encodeTeleport,
  XCM_PRECOMPILE,
  xcmPrecompileAbi,
  minimumBridgeAmount,
  type DestinationChain,
} from "@/lib/xcm-encoder";

export type BridgeStatus =
  | "idle"
  | "encoding"
  | "weighing"
  | "executing"
  | "confirming"
  | "success"
  | "error";

export interface BridgeResult {
  status: BridgeStatus;
  executeTxHash?: Hash;
  error?: string;
}

export function useBridgeExecution() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [result, setResult] = useState<BridgeResult>({ status: "idle" });

  const reset = useCallback(() => {
    setResult({ status: "idle" });
  }, []);

  const executeBridge = useCallback(
    async (
      amountPAS: number,
      dest: DestinationChain = "relay",
    ): Promise<BridgeResult> => {
      if (!address || !publicClient) {
        const r: BridgeResult = { status: "error", error: "Wallet not connected" };
        setResult(r);
        return r;
      }

      // Check minimum
      const min = minimumBridgeAmount(dest);
      if (amountPAS < min) {
        const r: BridgeResult = {
          status: "error",
          error: `Minimum bridge amount is ${min} PAS.`,
        };
        setResult(r);
        return r;
      }

      // Check native PAS balance
      const balance = await publicClient.getBalance({ address });
      const amountWei = parseEther(amountPAS.toString());
      if (balance < amountWei) {
        const r: BridgeResult = {
          status: "error",
          error: `Insufficient PAS balance. You have ${parseFloat(formatEther(balance)).toFixed(2)} but need ${amountPAS}.`,
        };
        setResult(r);
        return r;
      }

      try {
        // 1. Encode XCM message
        setResult({ status: "encoding" });
        const encoded = await encodeTeleport(amountPAS, address, dest);

        // 2. Weigh message via precompile
        setResult({ status: "weighing" });
        const weight = await publicClient.readContract({
          address: XCM_PRECOMPILE,
          abi: xcmPrecompileAbi,
          functionName: "weighMessage",
          args: [encoded.message],
        });

        // Add 10% safety margin to weight
        const safeWeight = {
          refTime: (weight.refTime * 110n) / 100n,
          proofSize: (weight.proofSize * 110n) / 100n,
        };

        // 3. Execute via precompile (sends native PAS value)
        setResult({ status: "executing" });
        const walletClient = await getWalletClient(config);

        const executeTxHash = await walletClient.writeContract({
          chain: polkadotHubTestnet,
          address: XCM_PRECOMPILE,
          abi: xcmPrecompileAbi,
          functionName: "execute",
          args: [encoded.message, safeWeight],
          value: amountWei,
        });

        // 4. Wait for confirmation
        setResult({ status: "confirming", executeTxHash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: executeTxHash });

        if (receipt.status !== "success") {
          const r: BridgeResult = {
            status: "error",
            executeTxHash,
            error: "XCM execute transaction reverted on-chain.",
          };
          setResult(r);
          return r;
        }

        const r: BridgeResult = { status: "success", executeTxHash };
        setResult(r);
        return r;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const friendlyMsg = message.includes("User rejected")
          ? "Transaction rejected by user."
          : message.includes("insufficient funds")
            ? "Insufficient funds for gas. Top up your PAS balance."
            : message.includes("Timed out")
              ? "Transaction is taking longer than expected. It may still go through — check your history in a moment."
              : message.includes("reverted")
                ? "Transaction failed on-chain. Please try again."
                : message.includes("nonce")
                  ? "Transaction conflict. Please wait a moment and try again."
                  : "Something went wrong. Please try again.";

        const r: BridgeResult = { status: "error", error: friendlyMsg };
        setResult(r);
        return r;
      }
    },
    [address, publicClient],
  );

  return { result, executeBridge, reset };
}
