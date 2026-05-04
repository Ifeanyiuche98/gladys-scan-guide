export type Verdict = "SAFE-ISH" | "CAUTION" | "AVOID";
export type OpportunityTag = "Early Gem" | "Trending" | "Overhyped" | "Low Activity Zone";
export type AssetClass = "MAJOR" | "MID" | "LOW" | "UNKNOWN";
export type Confidence = "High" | "Medium" | "Low";
export type Outlook = "Bullish" | "Neutral" | "Weak";

export interface RiskBreakdown {
  liquidity: number;        // 0-100 (higher = safer)
  whaleConcentration: number;
  contractRisk: number;
  volatility: number;
}

export interface ScanResult {
  token: {
    name: string;
    symbol: string;
    chain: string;
    address?: string;
    priceUsd?: number;
    marketCap?: number;
    volume24h?: number;
    liquidityUsd?: number;
    ageDays?: number;
    priceChange24h?: number;
  };
  classification: AssetClass;
  confidence: Confidence;
  outlook: Outlook;
  riskScore: number;          // 0-100, higher = safer
  riskBreakdown: RiskBreakdown;
  opportunity: {
    tag: OpportunityTag;
    reason: string;
  };
  verdict: Verdict;
  verdictReason: string;
  explainer: {
    summary: string;
    whatItDoes: string;
    whyPeopleBuy: string;
    whatCouldGoWrong: string;
  };
  resolutionConfidence?: "High" | "Medium";
  networkWarning?: string;
  scannedAt: string;
  remainingScans?: number;
  limitResetTime?: string;
}

export interface TokenSuggestion {
  id: string;
  name: string;
  symbol: string;
}
  scannedAt: string;
  remainingScans?: number;
  limitResetTime?: string; // ISO timestamp when daily quota resets
}
