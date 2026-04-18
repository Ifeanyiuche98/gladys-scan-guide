const KEY = "gladys_scan_usage_v1";
const LIMIT = 3;

interface Usage {
  date: string; // YYYY-MM-DD
  count: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function read(): Usage {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { date: today(), count: 0 };
    const parsed = JSON.parse(raw) as Usage;
    if (parsed.date !== today()) return { date: today(), count: 0 };
    return parsed;
  } catch {
    return { date: today(), count: 0 };
  }
}

export function getRemainingScans(): number {
  return Math.max(0, LIMIT - read().count);
}

export function canScan(): boolean {
  return getRemainingScans() > 0;
}

export function recordScan(): void {
  const u = read();
  const next: Usage = { date: today(), count: u.count + 1 };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export const SCAN_LIMIT = LIMIT;
