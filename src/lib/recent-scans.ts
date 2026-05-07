import type { ScanResult, Verdict } from "./scan-types";

const KEY = "gladys_recent_scans_v1";
const MAX = 5;

export interface RecentScan {
  key: string; // address || `${symbol}:${chain}`
  name: string;
  symbol: string;
  chain: string;
  address?: string;
  riskScore: number;
  verdict: Verdict;
  scannedAt: string; // ISO
  result: ScanResult; // cached for instant reopen
}

function read(): RecentScan[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: RecentScan[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch { /* ignore */ }
}

export function getRecentScans(): RecentScan[] {
  return read();
}

export function addRecentScan(result: ScanResult): RecentScan[] {
  const key = (result.token.address || `${result.token.symbol}:${result.token.chain}`).toLowerCase();
  const entry: RecentScan = {
    key,
    name: result.token.name,
    symbol: result.token.symbol,
    chain: result.token.chain,
    address: result.token.address,
    riskScore: result.riskScore,
    verdict: result.verdict,
    scannedAt: result.scannedAt || new Date().toISOString(),
    result,
  };
  const existing = read().filter((r) => r.key !== key);
  const next = [entry, ...existing].slice(0, MAX);
  write(next);
  return next;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
