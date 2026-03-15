"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { parseUnits, parseEther, formatUnits, formatEther } from "viem";
import type { ChatMessage, IntentParseResult, TransactionPreview, TransferPreview, TokenCreatePreview, BridgePreview, SwapReceipt, TransferReceipt, TokenCreateReceipt, BridgeReceipt, ParsedIntent } from "@/lib/types";
import { TransactionPreviewCard } from "./TransactionPreview";
import { SwapReceiptCard } from "./SwapReceipt";
import { TransferPreviewCard } from "./TransferPreview";
import { TransferReceiptCard } from "./TransferReceipt";
import { TokenCreatePreviewCard } from "./TokenCreatePreview";
import { TokenCreateReceiptCard } from "./TokenCreateReceipt";
import { BridgePreviewCard } from "./BridgePreview";
import { BridgeReceiptCard } from "./BridgeReceipt";
import { buildPreview, buildTransferPreview, buildTokenCreatePreview, fetchPoolReserves } from "@/lib/preview-builder";
import { useSwapExecution } from "@/hooks/useSwapExecution";
import { useTransferExecution } from "@/hooks/useTransferExecution";
import { useTokenCreation } from "@/hooks/useTokenCreation";
import { useBridgeExecution } from "@/hooks/useBridgeExecution";
import { minimumBridgeAmount, CHAIN_CONFIGS, evmToSS58, type DestinationChain } from "@/lib/xcm-encoder";
import { polkadotHubTestnet } from "@/lib/wagmi";
import { TOKEN_MAP, CONTRACTS } from "@/lib/contracts";
import { mockERC20Abi, tokenFactoryAbi } from "@/lib/abis";

const STORAGE_KEY = "intentdot-chat-history";
const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    'What would you like to do?\n\n• Swap 10 DOT to USDT\n• Send 50 USDT to 0x...\n• Create token PEPE with 1M supply\n• Bridge 20 PAS to relay chain\n• What\'s my balance?',
};

function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [WELCOME_MESSAGE];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ChatMessage[];
      return parsed.length > 0 ? parsed : [WELCOME_MESSAGE];
    }
  } catch { /* ignore */ }
  return [WELCOME_MESSAGE];
}

export function Chat() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { result: swapResult, executeSwap, reset: resetSwap } = useSwapExecution();
  const { result: transferResult, executeTransfer, reset: resetTransfer } = useTransferExecution();
  const { result: createResult, createToken, reset: resetCreate } = useTokenCreation();
  const { result: bridgeResult, executeBridge, reset: resetBridge } = useBridgeExecution();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSwapExecuting = swapResult.status === "signing" || swapResult.status === "approving" || swapResult.status === "executing" || swapResult.status === "approved";
  const isTransferExecuting = transferResult.status === "approving" || transferResult.status === "executing" || transferResult.status === "approved";
  const isCreateExecuting = createResult.status === "creating";
  const isBridgeExecuting = bridgeResult.status === "encoding" || bridgeResult.status === "weighing" || bridgeResult.status === "executing" || bridgeResult.status === "confirming";
  const isExecuting = isSwapExecuting || isTransferExecuting || isCreateExecuting || isBridgeExecuting;

  // Persist messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* storage full — ignore */ }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // Check on-chain balance for a token
  const checkBalance = useCallback(async (tokenSymbol: string, amount: number): Promise<{ have: string; need: number } | undefined> => {
    if (!publicClient || !address) return undefined;

    // Native PAS balance check
    if (tokenSymbol === "PAS") {
      try {
        const balance = await publicClient.getBalance({ address });
        const amountNeeded = parseEther(amount.toString());
        if (balance < amountNeeded) {
          return {
            have: parseFloat(formatEther(balance)).toFixed(4),
            need: amount,
          };
        }
      } catch { /* ignore */ }
      return undefined;
    }

    const tokenInfo = TOKEN_MAP[tokenSymbol];
    if (!tokenInfo) return undefined;
    try {
      const balance = await publicClient.readContract({
        address: tokenInfo.address,
        abi: mockERC20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      const amountNeeded = parseUnits(amount.toString(), tokenInfo.decimals);
      if (balance < amountNeeded) {
        return {
          have: parseFloat(formatUnits(balance, tokenInfo.decimals)).toFixed(2),
          need: amount,
        };
      }
    } catch {
      // Let execution handle it
    }
    return undefined;
  }, [publicClient, address]);

  const getExplorerUrl = useCallback((txHash: string) => {
    const explorer = polkadotHubTestnet.blockExplorers?.default;
    return explorer ? `${explorer.url}/tx/${txHash}` : `#${txHash}`;
  }, []);

  // === SWAP CONFIRM ===
  const handleSwapConfirm = useCallback(async (preview: TransactionPreview) => {
    const { intent } = preview;
    if (!intent.amount) return;

    addMessage({ role: "assistant", content: "Approving token spend..." });

    const amountOutWei = BigInt(Math.round(parseFloat(preview.amountOut) * 1e18));
    const minAmountOut = (amountOutWei * 99n) / 100n;

    const result = await executeSwap(intent.token_from, intent.token_to, intent.amount, minAmountOut);

    if (result.status === "success" && result.executeTxHash) {
      const receipt: SwapReceipt = {
        txHash: result.executeTxHash,
        tokenFrom: intent.token_from,
        tokenTo: intent.token_to,
        amountIn: intent.amount,
        amountOut: preview.amountOut,
        explorerUrl: getExplorerUrl(result.executeTxHash),
        onChainRisk: result.onChainRisk,
      };
      setMessages((prev) => prev.filter((m) => m.preview !== preview));
      addMessage({ role: "receipt", content: "", receipt });
      resetSwap();
    } else if (result.status === "error") {
      addMessage({ role: "assistant", content: `Swap failed: ${result.error}` });
      resetSwap();
    }
  }, [addMessage, executeSwap, resetSwap, getExplorerUrl]);

  // === TRANSFER CONFIRM ===
  const handleTransferConfirm = useCallback(async (preview: TransferPreview) => {
    const { intent } = preview;
    if (!intent.amount || !intent.recipient) return;

    addMessage({ role: "assistant", content: "Approving token spend..." });

    const result = await executeTransfer(intent.token_from, intent.recipient, intent.amount);

    if (result.status === "success" && result.executeTxHash) {
      const receipt: TransferReceipt = {
        txHash: result.executeTxHash,
        token: intent.token_from,
        amount: intent.amount,
        recipient: intent.recipient,
        explorerUrl: getExplorerUrl(result.executeTxHash),
      };
      setMessages((prev) => prev.filter((m) => m.transferPreview !== preview));
      addMessage({ role: "transfer-receipt", content: "", transferReceipt: receipt });
      resetTransfer();
    } else if (result.status === "error") {
      addMessage({ role: "assistant", content: `Transfer failed: ${result.error}` });
      resetTransfer();
    }
  }, [addMessage, executeTransfer, resetTransfer, getExplorerUrl]);

  // === CREATE TOKEN CONFIRM ===
  const handleCreateConfirm = useCallback(async (preview: TokenCreatePreview) => {
    const { intent } = preview;
    if (!intent.tokenName || !intent.tokenSymbol || !intent.initialSupply) return;

    addMessage({ role: "assistant", content: "Creating your token on-chain..." });

    const result = await createToken(intent.tokenName, intent.tokenSymbol, intent.initialSupply);

    if (result.status === "success" && result.executeTxHash && result.tokenAddress) {
      const receipt: TokenCreateReceipt = {
        txHash: result.executeTxHash,
        tokenName: intent.tokenName,
        tokenSymbol: intent.tokenSymbol,
        initialSupply: intent.initialSupply,
        tokenAddress: result.tokenAddress,
        explorerUrl: getExplorerUrl(result.executeTxHash),
      };
      setMessages((prev) => prev.filter((m) => m.createPreview !== preview));
      addMessage({ role: "create-receipt", content: "", createReceipt: receipt });
      resetCreate();
    } else if (result.status === "error") {
      addMessage({ role: "assistant", content: `Token creation failed: ${result.error}` });
      resetCreate();
    }
  }, [addMessage, createToken, resetCreate, getExplorerUrl]);

  // === BRIDGE CONFIRM ===
  const handleBridgeConfirm = useCallback(async (preview: BridgePreview) => {
    const { intent } = preview;
    if (!intent.amount) return;

    const dest = (intent.destination_chain || "relay") as DestinationChain;
    addMessage({ role: "assistant", content: "Encoding XCM message and bridging..." });

    const result = await executeBridge(intent.amount, dest);

    if (result.status === "success" && result.executeTxHash) {
      const receipt: BridgeReceipt = {
        txHash: result.executeTxHash,
        amountPAS: intent.amount,
        destinationChain: CHAIN_CONFIGS[dest].label,
        beneficiary: address || "",
        beneficiarySS58: address ? evmToSS58(address) : "",
        explorerUrl: getExplorerUrl(result.executeTxHash),
      };
      setMessages((prev) => prev.filter((m) => m.bridgePreview !== preview));
      addMessage({ role: "bridge-receipt", content: "", bridgeReceipt: receipt });
      resetBridge();
    } else if (result.status === "error") {
      addMessage({ role: "assistant", content: `Bridge failed: ${result.error}` });
      resetBridge();
    }
  }, [addMessage, executeBridge, resetBridge, getExplorerUrl, address]);

  // === SUBMIT ===
  const sendMessage = async (text: string) => {
    if (!text || isLoading) return;

    setInput("");
    // Remove stale previews from previous intents
    setMessages((prev) => prev.filter((m) =>
      m.role !== "preview" && m.role !== "transfer-preview" && m.role !== "create-preview" && m.role !== "bridge-preview"
    ));
    addMessage({ role: "user", content: text });
    setIsLoading(true);

    try {
      const res = await fetch("/api/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const result: IntentParseResult = await res.json();

      if (!result.success) {
        addMessage({ role: "assistant", content: result.clarification });
      } else {
        const { intent } = result;

        if (intent.action === "swap") {
          await handleSwapIntent(intent);
        } else if (intent.action === "transfer") {
          await handleTransferIntent(intent);
        } else if (intent.action === "create_token") {
          handleCreateTokenIntent(intent);
        } else if (intent.action === "bridge") {
          await handleBridgeIntent(intent);
        } else if (intent.action === "check_balance") {
          await handleCheckBalance(intent);
        }
      }
    } catch {
      addMessage({
        role: "assistant",
        content: "Failed to connect to AI service. Please check your configuration.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input.trim());
  };

  // --- Intent handlers ---

  const handleSwapIntent = async (intent: ParsedIntent) => {
    if (!intent.amount) {
      addMessage({
        role: "assistant",
        content: `I understood you want to swap ${intent.token_from} to ${intent.token_to}, but I need an amount. How much ${intent.token_from} would you like to swap?`,
      });
      return;
    }

    const livePool = await fetchPoolReserves(intent.token_from, intent.token_to);
    const preview = buildPreview(intent, livePool);

    if (!preview) {
      addMessage({
        role: "assistant",
        content: `No liquidity pool found for ${intent.token_from} / ${intent.token_to}. Try DOT/USDT or DOT/USDC.`,
      });
      return;
    }

    const insufficientBalance = await checkBalance(intent.token_from, intent.amount);
    if (insufficientBalance) preview.insufficientBalance = insufficientBalance;

    addMessage({
      role: "assistant",
      content: `Swap ${intent.amount} ${intent.token_from} \u2192 ~${preview.amountOut} ${intent.token_to}`,
    });
    addMessage({ role: "preview", content: "", preview });
  };

  const handleTransferIntent = async (intent: ParsedIntent) => {
    if (!intent.amount) {
      addMessage({
        role: "assistant",
        content: `How much ${intent.token_from} do you want to send?`,
      });
      return;
    }

    const transferPreview = buildTransferPreview(intent);
    if (!transferPreview) {
      addMessage({ role: "assistant", content: "Could not build transfer preview. Please try again." });
      return;
    }

    const insufficientBalance = await checkBalance(intent.token_from, intent.amount);
    if (insufficientBalance) transferPreview.insufficientBalance = insufficientBalance;

    addMessage({
      role: "assistant",
      content: `Send ${intent.amount} ${intent.token_from} \u2192 ${intent.recipient?.slice(0, 8)}...${intent.recipient?.slice(-4)}`,
    });
    addMessage({ role: "transfer-preview", content: "", transferPreview });
  };

  const handleCreateTokenIntent = (intent: ParsedIntent) => {
    const createPreview = buildTokenCreatePreview(intent);
    if (!createPreview) {
      addMessage({ role: "assistant", content: "Could not build token creation preview. Please provide name, symbol, and supply." });
      return;
    }

    addMessage({
      role: "assistant",
      content: `Create token "${intent.tokenName}" (${intent.tokenSymbol}) with ${intent.initialSupply?.toLocaleString()} supply`,
    });
    addMessage({ role: "create-preview", content: "", createPreview });
  };

  const handleBridgeIntent = async (intent: ParsedIntent) => {
    if (!intent.amount) {
      addMessage({
        role: "assistant",
        content: "How much PAS do you want to bridge? Example: 'Bridge 20 PAS to relay chain'",
      });
      return;
    }

    const dest = (intent.destination_chain || "relay") as DestinationChain;
    const cfg = CHAIN_CONFIGS[dest];
    const min = minimumBridgeAmount(dest);

    // Estimate fees: local ~10% capped at 2 PAS + remote 0.2 PAS
    const localFee = Math.min(intent.amount * 0.1, 2);
    const remoteFee = Number(cfg.remoteFeeBuffer) / 1e10;
    const totalFees = (localFee + remoteFee).toFixed(1);

    const bridgePreview: BridgePreview = {
      intent,
      destinationChain: cfg.label,
      estimatedFees: totalFees,
      minimumAmount: min,
    };

    // Check native PAS balance
    if (publicClient && address) {
      try {
        const balance = await publicClient.getBalance({ address });
        const balancePAS = parseFloat(formatUnits(balance, 18));
        if (balancePAS < intent.amount) {
          bridgePreview.insufficientBalance = {
            have: balancePAS.toFixed(2),
            need: intent.amount,
          };
        }
      } catch {
        // Let execution handle it
      }
    }

    addMessage({
      role: "assistant",
      content: `Bridge ${intent.amount} PAS \u2192 ${cfg.label}`,
    });
    addMessage({ role: "bridge-preview", content: "", bridgePreview });
  };

  const handleCheckBalance = async (intent: ParsedIntent) => {
    if (!publicClient || !address) {
      addMessage({ role: "assistant", content: "Please connect your wallet to check balances." });
      return;
    }

    const isKnownToken = intent.token_from && TOKEN_MAP[intent.token_from];
    const isSpecificQuery = !!intent.token_from;
    const showAll = !isSpecificQuery;
    const lines: string[] = [];

    // 1. Native PAS balance
    if (showAll || intent.token_from === "PAS") {
      try {
        const nativeBalance = await publicClient.getBalance({ address });
        const formatted = parseFloat(formatUnits(nativeBalance, 18));
        lines.push(`PAS — ${formatted > 0 ? formatted.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0"}`);
      } catch {
        lines.push("PAS — unable to read");
      }
    }

    // 2. Known tokens (DOT, USDT, USDC)
    if (showAll || isKnownToken) {
      const tokensToCheck = showAll
        ? Object.entries(TOKEN_MAP).map(([key, info]) => ({ ...info, symbol: key }))
        : [{ ...TOKEN_MAP[intent.token_from], symbol: intent.token_from }];

      for (const token of tokensToCheck) {
        try {
          const balance = await publicClient.readContract({
            address: token.address,
            abi: mockERC20Abi,
            functionName: "balanceOf",
            args: [address],
          });
          const formatted = parseFloat(formatUnits(balance, token.decimals));
          lines.push(`${token.symbol} — ${formatted > 0 ? formatted.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0"}`);
        } catch {
          lines.push(`${token.symbol} — unable to read`);
        }
      }
    }

    // 3. User-created tokens from TokenFactory
    const factory = CONTRACTS.tokenFactory;
    const hasFactory = factory !== "0x0000000000000000000000000000000000000000";

    if (hasFactory && (showAll || !isKnownToken)) {
      try {
        const createdTokens = await publicClient.readContract({
          address: factory,
          abi: tokenFactoryAbi,
          functionName: "getTokensByCreator",
          args: [address],
        }) as `0x${string}`[];

        for (const tokenAddr of createdTokens) {
          try {
            const [symbol, balance] = await Promise.all([
              publicClient.readContract({ address: tokenAddr, abi: mockERC20Abi, functionName: "symbol" }),
              publicClient.readContract({ address: tokenAddr, abi: mockERC20Abi, functionName: "balanceOf", args: [address] }),
            ]);
            const sym = symbol as string;
            const formatted = parseFloat(formatUnits(balance as bigint, 18));
            // For specific queries, only show the matching token
            if (isSpecificQuery && sym.toUpperCase() !== intent.token_from.toUpperCase()) continue;
            lines.push(`${sym} — ${formatted > 0 ? formatted.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0"}`);
          } catch {
            if (showAll) lines.push(`${tokenAddr.slice(0, 8)}... — unable to read`);
          }
        }
      } catch {
        // Factory query failed — skip custom tokens
      }
    }

    if (lines.length === 0) {
      addMessage({ role: "assistant", content: `No token found matching "${intent.token_from}". Try "check my balance" to see all tokens.` });
    } else {
      addMessage({
        role: "assistant",
        content: isSpecificQuery ? `Your ${intent.token_from} balance:\n${lines.join("\n")}` : `Your balances:\n${lines.join("\n")}`,
      });
    }
  };

  // --- Execution status text ---
  const getExecutionStatusText = () => {
    if (isSwapExecuting) {
      return swapResult.status === "signing"
        ? "Sign permit in wallet (gasless approval)..."
        : swapResult.status === "approving"
          ? "Waiting for token approval..."
          : swapResult.status === "approved"
            ? "Token approved. Sending swap..."
            : "Executing swap on-chain...";
    }
    if (isTransferExecuting) {
      return transferResult.status === "approving"
        ? "Waiting for token approval..."
        : transferResult.status === "approved"
          ? "Token approved. Sending transfer..."
          : "Executing transfer on-chain...";
    }
    if (isCreateExecuting) {
      return "Deploying token contract on-chain...";
    }
    if (isBridgeExecuting) {
      return bridgeResult.status === "encoding"
        ? "Encoding XCM message..."
        : bridgeResult.status === "weighing"
          ? "Weighing XCM message..."
          : bridgeResult.status === "confirming"
            ? "Waiting for confirmation..."
            : "Executing XCM bridge on-chain...";
    }
    return "";
  };

  return (
    <div className="flex w-full max-w-2xl flex-1 flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-2 py-4">
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.preview ? (
              <TransactionPreviewCard
                preview={msg.preview}
                isExecuting={isExecuting}
                onConfirm={() => handleSwapConfirm(msg.preview!)}
                onCancel={() => {
                  setMessages((prev) => prev.filter((m) => m.preview !== msg.preview));
                  addMessage({ role: "assistant", content: "Transaction cancelled." });
                }}
                onRefresh={async () => {
                  const intent = msg.preview!.intent;
                  const livePool = await fetchPoolReserves(intent.token_from, intent.token_to);
                  const refreshed = buildPreview(intent, livePool);
                  if (refreshed) {
                    setMessages((prev) => prev.map((m, idx) =>
                      idx === i ? { ...m, preview: refreshed } : m
                    ));
                    addMessage({ role: "assistant", content: "Quote refreshed with latest pool data." });
                  }
                }}
              />
            ) : msg.transferPreview ? (
              <TransferPreviewCard
                preview={msg.transferPreview}
                isExecuting={isExecuting}
                onConfirm={() => handleTransferConfirm(msg.transferPreview!)}
                onCancel={() => {
                  setMessages((prev) => prev.filter((m) => m.transferPreview !== msg.transferPreview));
                  addMessage({ role: "assistant", content: "Transfer cancelled." });
                }}
              />
            ) : msg.createPreview ? (
              <TokenCreatePreviewCard
                preview={msg.createPreview}
                isExecuting={isExecuting}
                onConfirm={() => handleCreateConfirm(msg.createPreview!)}
                onCancel={() => {
                  setMessages((prev) => prev.filter((m) => m.createPreview !== msg.createPreview));
                  addMessage({ role: "assistant", content: "Token creation cancelled." });
                }}
              />
            ) : msg.bridgePreview ? (
              <BridgePreviewCard
                preview={msg.bridgePreview}
                isExecuting={isExecuting}
                onConfirm={() => handleBridgeConfirm(msg.bridgePreview!)}
                onCancel={() => {
                  setMessages((prev) => prev.filter((m) => m.bridgePreview !== msg.bridgePreview));
                  addMessage({ role: "assistant", content: "Bridge cancelled." });
                }}
              />
            ) : msg.receipt ? (
              <SwapReceiptCard receipt={msg.receipt} />
            ) : msg.transferReceipt ? (
              <TransferReceiptCard receipt={msg.transferReceipt} />
            ) : msg.createReceipt ? (
              <TokenCreateReceiptCard receipt={msg.createReceipt} />
            ) : msg.bridgeReceipt ? (
              <BridgeReceiptCard receipt={msg.bridgeReceipt} />
            ) : (
              <div
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-polkadot-pink/90 text-white rounded-br-md"
                      : "glass text-white/80 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl rounded-bl-md px-5 py-3 text-sm text-white/50 dot-pulse">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        {isExecuting && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-polkadot-pink/20 bg-polkadot-pink/5 px-4 py-3 text-sm text-polkadot-pink/80">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-polkadot-pink animate-pulse mr-2 align-middle" />
              {getExecutionStatusText()}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {address && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {[
            { label: "Swap DOT → USDT", text: "Swap 10 DOT to USDT" },
            { label: "Swap DOT → USDC", text: "Swap 10 DOT to USDC" },
            { label: "Bridge to Relay", text: "Bridge 20 PAS to relay chain" },
            { label: "My Balance", text: "What's my balance?" },
            { label: "Create Token", text: "Create token MEME with 1000000 supply" },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => sendMessage(action.text)}
              disabled={isLoading || isExecuting}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/50 hover:text-white/80 hover:border-polkadot-pink/30 hover:bg-polkadot-pink/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-white/[0.06] p-4">
        <div className="flex gap-2">
          {messages.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={isLoading || isExecuting}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-white/30 hover:text-white/60 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Clear chat"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
              {showClearConfirm && (
                <div className="absolute bottom-full left-0 mb-2 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#1a1425] backdrop-blur-xl px-4 py-3 shadow-xl whitespace-nowrap animate-fade-in-up">
                  <span className="text-xs text-white/60">Clear chat history?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([WELCOME_MESSAGE]);
                      resetSwap();
                      resetTransfer();
                      resetCreate();
                      resetBridge();
                      setShowClearConfirm(false);
                    }}
                    className="rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-all"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="rounded-lg bg-white/5 border border-white/[0.08] px-3 py-1 text-xs font-medium text-white/40 hover:text-white/60 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try: "Swap 10 DOT to USDT" or "Bridge 20 PAS to relay chain"'
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-polkadot-pink/30 focus:bg-white/[0.05] transition-all"
            maxLength={500}
            disabled={isLoading || isExecuting}
          />
          <button
            type="submit"
            disabled={isLoading || isExecuting || !input.trim()}
            className="rounded-xl bg-polkadot-pink px-5 py-3 text-sm font-semibold text-white hover:bg-polkadot-pink/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-polkadot-pink/20 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
