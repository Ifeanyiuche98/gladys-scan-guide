const KEY = "gladys_scan_usage_v1";
const LIMIT = 6;

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

function write(count: number) {
  localStorage.setItem(KEY, JSON.stringify({ date: today(), count }));
}

export function getRemainingScans(): number {
  return Math.max(0, LIMIT - read().count);
}

export function canScan(): boolean {
  return getRemainingScans() > 0;
}

export function recordScan(): void {
  const u = read();
  write(u.count + 1);
}

/** Sync client counter from authoritative server `remainingScans`. */
export function syncRemaining(remaining: number): void {
  const used = Math.max(0, LIMIT - Math.max(0, Math.min(LIMIT, remaining)));
  write(used);
}

export function markLimitReached(): void {
  write(LIMIT);
}

export const SCAN_LIMIT = LIMIT;
