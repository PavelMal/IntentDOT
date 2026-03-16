"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { parseUnits, type Hash, type Address, decodeEventLog } from "viem";
import { config, polkadotHubTestnet } from "@/lib/wagmi";
import { CONTRACTS } from "@/lib/contracts";
import { tokenFactoryAbi } from "@/lib/abis";

export type CreateTokenStatus =
  | "idle"
  | "creating"
  | "success"
  | "error";

export interface CreateTokenResult {
  status: CreateTokenStatus;
  executeTxHash?: Hash;
  tokenAddress?: string;
  error?: string;
}

export function useTokenCreation() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [result, setResult] = useState<CreateTokenResult>({ status: "idle" });

  const reset = useCallback(() => {
    setResult({ status: "idle" });
  }, []);

  const createToken = useCallback(
    async (
      tokenName: string,
      tokenSymbol: string,
      initialSupply: number,
    ): Promise<CreateTokenResult> => {
      if (!address || !publicClient) {
        const r: CreateTokenResult = { status: "error", error: "Wallet not connected" };
        setResult(r);
        return r;
      }

      const factory = CONTRACTS.tokenFactory;
      if (factory === "0x0000000000000000000000000000000000000000") {
        const r: CreateTokenResult = { status: "error", error: "TokenFactory contract not configured. Set NEXT_PUBLIC_TOKEN_FACTORY." };
        setResult(r);
        return r;
      }

      try {
        const walletClient = await getWalletClient(config);

        setResult({ status: "creating" });

        const supplyWei = parseUnits(initialSupply.toString(), 18);

        const executeTxHash = await walletClient.writeContract({
          chain: polkadotHubTestnet,
          address: factory,
          abi: tokenFactoryAbi,
          functionName: "createToken",
          args: [tokenName, tokenSymbol, supplyWei],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: executeTxHash });

        if (receipt.status !== "success") {
          const r: CreateTokenResult = {
            status: "error",
            executeTxHash,
            error: "Token creation reverted on-chain.",
          };
          setResult(r);
          return r;
        }

        // Parse TokenCreated event to get the new token address
        let tokenAddress = "";
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: tokenFactoryAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "TokenCreated") {
              tokenAddress = (decoded.args as { tokenAddress: Address }).tokenAddress;
              break;
            }
          } catch {
            // Not our event, skip
          }
        }

        const r: CreateTokenResult = {
          status: "success",
          executeTxHash,
          tokenAddress: tokenAddress || "unknown",
        };
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

        const r: CreateTokenResult = { status: "error", error: friendlyMsg };
        setResult(r);
        return r;
      }
    },
    [address, publicClient]
  );

  return { result, createToken, reset };
}
