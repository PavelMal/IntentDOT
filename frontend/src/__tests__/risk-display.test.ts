import {
  getRiskLabel,
  getRiskColors,
  formatBps,
  parseRiskCheckedEvent,
  RISK_LABELS,
  RISK_COLORS,
  type RawLog,
} from "@/lib/risk-display";
import type { OnChainRisk } from "@/lib/types";

// =====================
// getRiskLabel
// =====================

describe("getRiskLabel", () => {
  it("maps 0 to GREEN", () => {
    expect(getRiskLabel(0)).toBe("GREEN");
  });

  it("maps 1 to YELLOW", () => {
    expect(getRiskLabel(1)).toBe("YELLOW");
  });

  it("maps 2 to RED", () => {
    expect(getRiskLabel(2)).toBe("RED");
  });

  it("defaults to GREEN for out-of-range (3)", () => {
    expect(getRiskLabel(3)).toBe("GREEN");
  });

  it("defaults to GREEN for negative value", () => {
    expect(getRiskLabel(-1)).toBe("GREEN");
  });

  it("defaults to GREEN for 99", () => {
    expect(getRiskLabel(99)).toBe("GREEN");
  });
});

// =====================
// getRiskColors
// =====================

describe("getRiskColors", () => {
  it("returns green colors for GREEN", () => {
    const c = getRiskColors("GREEN");
    expect(c.text).toContain("green");
    expect(c.dot).toContain("green");
    expect(c.bg).toContain("green");
    expect(c.border).toContain("green");
  });

  it("returns yellow colors for YELLOW", () => {
    const c = getRiskColors("YELLOW");
    expect(c.text).toContain("yellow");
  });

  it("returns red colors for RED", () => {
    const c = getRiskColors("RED");
    expect(c.text).toContain("red");
  });

  it("all labels have complete color sets", () => {
    for (const label of RISK_LABELS) {
      const c = RISK_COLORS[label];
      expect(c).toHaveProperty("bg");
      expect(c).toHaveProperty("border");
      expect(c).toHaveProperty("text");
      expect(c).toHaveProperty("dot");
    }
  });
});

// =====================
// formatBps
// =====================

describe("formatBps", () => {
  it("converts 150 bps to 1.50%", () => {
    expect(formatBps(150)).toBe("1.50");
  });

  it("converts 0 bps to 0.00%", () => {
    expect(formatBps(0)).toBe("0.00");
  });

  it("converts 31 bps to 0.31%", () => {
    expect(formatBps(31)).toBe("0.31");
  });

  it("converts 10000 bps to 100.00%", () => {
    expect(formatBps(10000)).toBe("100.00");
  });

  it("converts 1 bp to 0.01%", () => {
    expect(formatBps(1)).toBe("0.01");
  });

  it("handles fractional bps", () => {
    expect(formatBps(33)).toBe("0.33");
  });
});

// =====================
// parseRiskCheckedEvent
// =====================

// Pre-encoded RiskChecked event logs (generated via viem encodeAbiParameters)
// Event: RiskChecked(address indexed user, uint8 riskLevel, uint256 score, uint256 priceImpact, uint256 volatility)
const TOPIC0 = "0xcef5a66bcd08278abcae3ba5107eb6fcd13e89565bbdac1480d06518a4b1fb45" as `0x${string}`;
const ALICE_TOPIC = "0x000000000000000000000000000000000000000000000000000000000000aA01" as `0x${string}`;

// riskLevel=0, score=15, priceImpact=31, volatility=50
const GREEN_DATA = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000000000000000000000000000000000000000001f0000000000000000000000000000000000000000000000000000000000000032" as `0x${string}`;

// riskLevel=1, score=55, priceImpact=200, volatility=150
const YELLOW_DATA = "0x0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000003700000000000000000000000000000000000000000000000000000000000000c80000000000000000000000000000000000000000000000000000000000000096" as `0x${string}`;

// riskLevel=2, score=85, priceImpact=5000, volatility=800
const RED_DATA = "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000005500000000000000000000000000000000000000000000000000000000000013880000000000000000000000000000000000000000000000000000000000000320" as `0x${string}`;

// riskLevel=0, score=10, priceImpact=20, volatility=30
const GREEN2_DATA = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001e" as `0x${string}`;

// riskLevel=1, score=50, priceImpact=200, volatility=100
const YELLOW3_DATA = "0x0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000000c80000000000000000000000000000000000000000000000000000000000000064" as `0x${string}`;

// riskLevel=1, score=99, priceImpact=9999, volatility=5000
const YELLOW4_DATA = "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000063000000000000000000000000000000000000000000000000000000000000270f0000000000000000000000000000000000000000000000000000000000001388" as `0x${string}`;

// riskLevel=1, score=45, priceImpact=180, volatility=75
const YELLOW2_DATA = "0x0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002d00000000000000000000000000000000000000000000000000000000000000b4000000000000000000000000000000000000000000000000000000000000004b" as `0x${string}`;

function makeRiskLog(data: `0x${string}`): RawLog {
  return { data, topics: [TOPIC0, ALICE_TOPIC] };
}

// Dummy log (ERC20 Transfer event, not RiskChecked)
const DUMMY_LOG: RawLog = {
  data: "0x0000000000000000000000000000000000000000000000000000000000000001",
  topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as `0x${string}`],
};

describe("parseRiskCheckedEvent", () => {
  it("parses GREEN risk from logs", () => {
    const result = parseRiskCheckedEvent([makeRiskLog(GREEN_DATA)]);

    expect(result).toBeDefined();
    expect(result!.riskLevel).toBe(0);
    expect(result!.score).toBe(15);
    expect(result!.priceImpact).toBe(31);
    expect(result!.volatility).toBe(50);
  });

  it("parses YELLOW risk", () => {
    const result = parseRiskCheckedEvent([makeRiskLog(YELLOW_DATA)]);

    expect(result).toBeDefined();
    expect(result!.riskLevel).toBe(1);
    expect(result!.score).toBe(55);
  });

  it("parses RED risk", () => {
    const result = parseRiskCheckedEvent([makeRiskLog(RED_DATA)]);

    expect(result).toBeDefined();
    expect(result!.riskLevel).toBe(2);
    expect(result!.score).toBe(85);
    expect(result!.priceImpact).toBe(5000);
    expect(result!.volatility).toBe(800);
  });

  it("returns undefined when no RiskChecked event in logs", () => {
    const result = parseRiskCheckedEvent([DUMMY_LOG, DUMMY_LOG]);
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty logs array", () => {
    const result = parseRiskCheckedEvent([]);
    expect(result).toBeUndefined();
  });

  it("finds RiskChecked among other events", () => {
    const result = parseRiskCheckedEvent([DUMMY_LOG, makeRiskLog(GREEN2_DATA), DUMMY_LOG]);

    expect(result).toBeDefined();
    expect(result!.score).toBe(10);
  });

  it("returns first RiskChecked if multiple present", () => {
    const result = parseRiskCheckedEvent([makeRiskLog(GREEN2_DATA), makeRiskLog(YELLOW3_DATA)]);

    expect(result).toBeDefined();
    expect(result!.riskLevel).toBe(0);
    expect(result!.score).toBe(10);
  });

  it("handles large values correctly", () => {
    const result = parseRiskCheckedEvent([makeRiskLog(YELLOW4_DATA)]);

    expect(result).toBeDefined();
    expect(result!.score).toBe(99);
    expect(result!.priceImpact).toBe(9999);
    expect(result!.volatility).toBe(5000);
  });
});

// =====================
// OnChainRisk type integration
// =====================

describe("OnChainRisk display integration", () => {
  it("GREEN risk label + colors pipeline", () => {
    const risk: OnChainRisk = { riskLevel: 0, score: 15, priceImpact: 31, volatility: 50 };
    const label = getRiskLabel(risk.riskLevel);
    const colors = getRiskColors(label);

    expect(label).toBe("GREEN");
    expect(colors.text).toContain("green");
    expect(formatBps(risk.priceImpact)).toBe("0.31");
    expect(formatBps(risk.volatility)).toBe("0.50");
  });

  it("YELLOW risk label + colors pipeline", () => {
    const risk: OnChainRisk = { riskLevel: 1, score: 55, priceImpact: 200, volatility: 150 };
    const label = getRiskLabel(risk.riskLevel);
    const colors = getRiskColors(label);

    expect(label).toBe("YELLOW");
    expect(colors.text).toContain("yellow");
    expect(formatBps(risk.priceImpact)).toBe("2.00");
  });

  it("RED risk label + colors pipeline", () => {
    const risk: OnChainRisk = { riskLevel: 2, score: 85, priceImpact: 5000, volatility: 800 };
    const label = getRiskLabel(risk.riskLevel);
    const colors = getRiskColors(label);

    expect(label).toBe("RED");
    expect(colors.text).toContain("red");
    expect(formatBps(risk.priceImpact)).toBe("50.00");
  });

  it("full pipeline: parse → label → colors → display", () => {
    const risk = parseRiskCheckedEvent([makeRiskLog(YELLOW2_DATA)]);

    expect(risk).toBeDefined();
    const label = getRiskLabel(risk!.riskLevel);
    expect(label).toBe("YELLOW");
    expect(formatBps(risk!.priceImpact)).toBe("1.80");
    expect(formatBps(risk!.volatility)).toBe("0.75");
  });
});
