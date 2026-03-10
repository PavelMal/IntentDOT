export type IntentAction = "swap" | "transfer" | "create_token" | "check_balance" | "bridge";

export interface ParsedIntent {
  action: IntentAction;
  token_from: string;
  token_to: string;
  amount: number | null;
  recipient?: string;
  destination_chain?: string;
  tokenName?: string;
  tokenSymbol?: string;
  initialSupply?: number;
}

export interface IntentParseSuccess {
  success: true;
  intent: ParsedIntent;
}

export interface IntentParseNeedsClarification {
  success: false;
  clarification: string;
}

export type IntentParseResult = IntentParseSuccess | IntentParseNeedsClarification;

export type RiskLevel = "GREEN" | "YELLOW" | "RED";

export interface RiskAssessment {
  level: RiskLevel;
  slippage: number;
  priceImpact: number;
  reasons: string[];
}

export interface TransactionPreview {
  intent: ParsedIntent;
  amountOut: string;
  risk: RiskAssessment;
  tokenInAddress: string;
  tokenOutAddress: string;
  insufficientBalance?: { have: string; need: number };
}

export interface TransferPreview {
  intent: ParsedIntent;
  tokenAddress: string;
  insufficientBalance?: { have: string; need: number };
}

export interface TokenCreatePreview {
  intent: ParsedIntent;
}

export interface BridgePreview {
  intent: ParsedIntent;
  destinationChain: string;
  estimatedFees: string;
  minimumAmount: number;
  insufficientBalance?: { have: string; need: number };
}

export interface BridgeReceipt {
  txHash: string;
  amountPAS: number;
  destinationChain: string;
  beneficiary: string;
  explorerUrl: string;
}

export interface OnChainRisk {
  riskLevel: number; // 0=GREEN, 1=YELLOW, 2=RED
  score: number;
  priceImpact: number; // basis points
  volatility: number; // basis points
}

export interface SwapReceipt {
  txHash: string;
  tokenFrom: string;
  tokenTo: string;
  amountIn: number;
  amountOut: string;
  explorerUrl: string;
  onChainRisk?: OnChainRisk;
}

export interface TransferReceipt {
  txHash: string;
  token: string;
  amount: number;
  recipient: string;
  explorerUrl: string;
}

export interface TokenCreateReceipt {
  txHash: string;
  tokenName: string;
  tokenSymbol: string;
  initialSupply: number;
  tokenAddress: string;
  explorerUrl: string;
}

export type MessageRole = "user" | "assistant" | "preview" | "receipt" | "transfer-preview" | "transfer-receipt" | "create-preview" | "create-receipt" | "bridge-preview" | "bridge-receipt";

export interface ChatMessage {
  role: MessageRole;
  content: string;
  preview?: TransactionPreview;
  receipt?: SwapReceipt;
  transferPreview?: TransferPreview;
  transferReceipt?: TransferReceipt;
  createPreview?: TokenCreatePreview;
  createReceipt?: TokenCreateReceipt;
  bridgePreview?: BridgePreview;
  bridgeReceipt?: BridgeReceipt;
}
