import { ApiPromise, WsProvider } from "@polkadot/api";
import { encodeAddress } from "@polkadot/util-crypto";
import type { Address } from "viem";

// --- Constants ---

const ASSET_HUB_WS_ENDPOINTS = [
  "wss://sys.ibp.network/asset-hub-paseo",
  "wss://pas-rpc.stakeworld.io/assethub",
  "wss://rpc.ibp.network/paseo",
];

/** XCM precompile on Polkadot Hub */
export const XCM_PRECOMPILE =
  "0x00000000000000000000000000000000000a0000" as Address;

/** IXcm Solidity ABI for the precompile */
export const xcmPrecompileAbi = [
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "message", type: "bytes" },
      {
        name: "weight",
        type: "tuple",
        components: [
          { name: "refTime", type: "uint64" },
          { name: "proofSize", type: "uint64" },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: "weighMessage",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "message", type: "bytes" }],
    outputs: [
      {
        name: "weight",
        type: "tuple",
        components: [
          { name: "refTime", type: "uint64" },
          { name: "proofSize", type: "uint64" },
        ],
      },
    ],
  },
  {
    name: "send",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "destination", type: "bytes" },
      { name: "message", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

// --- Destination chains ---

export type DestinationChain = "relay";

interface ChainConfig {
  label: string;
  /** XCM location of the destination relative to Hub */
  destination: { parents: number; interior: string | Record<string, unknown> };
  /** Existential deposit in planck (10-decimal) */
  existentialDeposit: bigint;
  /** Suggested fee buffer in planck for remote BuyExecution */
  remoteFeeBuffer: bigint;
}

export const CHAIN_CONFIGS: Record<DestinationChain, ChainConfig> = {
  relay: {
    label: "Paseo Relay Chain",
    destination: { parents: 1, interior: "Here" },
    existentialDeposit: 10_000_000_000n, // 1 PAS
    remoteFeeBuffer: 2_000_000_000n, // 0.2 PAS
  },
};

// --- API singleton ---

let apiPromise: Promise<ApiPromise> | null = null;

/**
 * Get or create a cached ApiPromise connected to Asset Hub.
 * Used for SCALE type encoding only — no extrinsics submitted.
 */
export function getAssetHubApi(): Promise<ApiPromise> {
  if (!apiPromise) {
    apiPromise = ApiPromise.create({
      provider: new WsProvider(ASSET_HUB_WS_ENDPOINTS),
      noInitWarn: true,
    }).catch((err) => {
      apiPromise = null;
      throw err;
    });
  }
  return apiPromise;
}

// --- Helpers ---

/**
 * Convert an EVM H160 address to the EE-padded AccountId32
 * used by pallet_revive on Polkadot Hub.
 *
 * `0x16Fc...00BA` → `0x16fc...00baeeeeeeeeeeeeeeeeeeeeeeee`
 */
export function evmToAccountId32(address: Address): `0x${string}` {
  const clean = address.toLowerCase().replace("0x", "");
  if (clean.length !== 40) throw new Error(`Invalid H160 address: ${address}`);
  return `0x${clean}${"ee".repeat(12)}` as `0x${string}`;
}

/**
 * Convert an EVM address to the SS58 address on the relay chain.
 * Useful for showing the user where to check their balance after bridging.
 *
 * `0x16Fc...00BA` → `1X8wYgu5SU9w52gG9pt8VjZfR9chdKKoeuZvk5jniFCtJNX`
 */
export function evmToSS58(address: Address, ss58Prefix = 0): string {
  const accountId32 = evmToAccountId32(address);
  return encodeAddress(accountId32, ss58Prefix);
}

/**
 * Minimum amount (in PAS, human-readable) needed to cover
 * existential deposit + fees on the destination chain.
 */
export function minimumBridgeAmount(dest: DestinationChain): number {
  const cfg = CHAIN_CONFIGS[dest];
  const minPlanck = cfg.existentialDeposit + cfg.remoteFeeBuffer;
  // Convert from 10-decimal planck to human PAS
  return Number(minPlanck) / 1e10;
}

// --- Encoder ---

export interface EncodedXcm {
  /** Hex-encoded VersionedXcm V5 message */
  message: `0x${string}`;
  /** Human-readable description */
  description: string;
}

/**
 * Encode an XCM teleport message: Hub → destination chain.
 *
 * @param amountPAS  Amount in human-readable PAS (e.g. 20)
 * @param beneficiary EVM address of the recipient (will be EE-padded)
 * @param dest Destination chain identifier
 */
export async function encodeTeleport(
  amountPAS: number,
  beneficiary: Address,
  dest: DestinationChain = "relay",
): Promise<EncodedXcm> {
  const cfg = CHAIN_CONFIGS[dest];
  const amountPlanck = BigInt(Math.floor(amountPAS * 1e10));

  // Validate minimum
  const minPlanck = cfg.existentialDeposit + cfg.remoteFeeBuffer;
  if (amountPlanck < minPlanck) {
    throw new Error(
      `Amount ${amountPAS} PAS is below minimum ${Number(minPlanck) / 1e10} PAS for ${cfg.label}`,
    );
  }

  // Local fees: ~10% of amount, capped at 2 PAS
  const localFees = amountPlanck / 10n > 20_000_000_000n
    ? 20_000_000_000n
    : amountPlanck / 10n;

  const beneficiaryId32 = evmToAccountId32(beneficiary);

  const api = await getAssetHubApi();

  const xcm = api.createType("XcmVersionedXcm", {
    V5: [
      {
        WithdrawAsset: [
          {
            id: { parents: 1, interior: "Here" },
            fun: { Fungible: amountPlanck },
          },
        ],
      },
      {
        PayFees: {
          asset: {
            id: { parents: 1, interior: "Here" },
            fun: { Fungible: localFees },
          },
        },
      },
      {
        InitiateTeleport: {
          assets: { Wild: { AllCounted: 1 } },
          dest: cfg.destination,
          xcm: [
            {
              BuyExecution: {
                fees: {
                  id: { parents: 0, interior: "Here" },
                  fun: { Fungible: cfg.remoteFeeBuffer },
                },
                weightLimit: "Unlimited",
              },
            },
            {
              DepositAsset: {
                assets: { Wild: { AllCounted: 1 } },
                beneficiary: {
                  parents: 0,
                  interior: {
                    X1: [
                      { AccountId32: { network: null, id: beneficiaryId32 } },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    ],
  });

  return {
    message: xcm.toHex() as `0x${string}`,
    description: `Teleport ${amountPAS} PAS to ${cfg.label}`,
  };
}

/**
 * Encode a local XCM transfer on Hub (same chain, PAS only).
 *
 * @param amountPAS Amount in human-readable PAS
 * @param beneficiary EVM address of the recipient
 */
export async function encodeLocalTransfer(
  amountPAS: number,
  beneficiary: Address,
): Promise<EncodedXcm> {
  const amountPlanck = BigInt(Math.floor(amountPAS * 1e10));
  const localFees = amountPlanck / 10n > 10_000_000_000n
    ? 10_000_000_000n
    : amountPlanck / 10n;
  const beneficiaryId32 = evmToAccountId32(beneficiary);

  const api = await getAssetHubApi();

  const xcm = api.createType("XcmVersionedXcm", {
    V5: [
      {
        WithdrawAsset: [
          {
            id: { parents: 1, interior: "Here" },
            fun: { Fungible: amountPlanck },
          },
        ],
      },
      {
        PayFees: {
          asset: {
            id: { parents: 1, interior: "Here" },
            fun: { Fungible: localFees },
          },
        },
      },
      {
        DepositAsset: {
          assets: { Wild: { AllCounted: 1 } },
          beneficiary: {
            parents: 0,
            interior: {
              X1: [
                { AccountId32: { network: null, id: beneficiaryId32 } },
              ],
            },
          },
        },
      },
    ],
  });

  return {
    message: xcm.toHex() as `0x${string}`,
    description: `Transfer ${amountPAS} PAS to ${beneficiary} on Hub`,
  };
}
