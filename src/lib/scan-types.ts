export type Verdict = "SAFE-ISH" | "CAUTION" | "AVOID";
export type OpportunityTag = "Early Gem" | "Trending" | "Overhyped" | "Dead Zone";

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
  riskScore: number;          // 0-100, higher = safer
  riskBreakdown: RiskBreakdown;
  opportunity: {
    tag: OpportunityTag;
    reason: string;
  };
  verdict: Verdict;
  verdictReason: string;
  explainer: {
    summary: string;          // 1-line plain English
    whatItDoes: string;
    whyPeopleBuy: string;
    whatCouldGoWrong: string;
  };
  scannedAt: string;
}
