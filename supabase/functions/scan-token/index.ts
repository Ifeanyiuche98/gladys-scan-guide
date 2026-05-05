// GLADYS Scan — token scanner edge function
// Fetches market data from CoinGecko + Dexscreener, runs rule-based risk/opportunity engines,
// then asks Lovable AI to write plain-English explanations.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-gladys-client-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Verdict = "SAFE-ISH" | "CAUTION" | "AVOID";
type OpportunityTag = "Early Gem" | "Trending" | "Overhyped" | "Low Activity Zone";
type AssetClass = "MAJOR" | "MID" | "LOW" | "UNKNOWN";
type Confidence = "High" | "Medium" | "Low";
type Outlook = "Bullish" | "Neutral" | "Weak";

interface MarketSnapshot {
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
  categories?: string[];
}

// Heuristic: detect meme/speculative/hype-driven tokens from CoinGecko categories.
function isMemeOrSpeculative(m: MarketSnapshot): boolean {
  const cats = (m.categories ?? []).map((c) => c.toLowerCase());
  if (cats.length === 0) return false;
  const flags = ["meme", "memes", "dog", "cat", "frog", "community", "hype", "fan token"];
  return cats.some((c) => flags.some((f) => c.includes(f)));
}

// ---------- Input normalization ----------
function parseInput(raw: string): { kind: "address" | "url" | "name"; value: string; chainHint?: string } {
  const v = raw.trim();
  // EVM contract
  if (/^0x[a-fA-F0-9]{40}$/.test(v)) return { kind: "address", value: v };
  // URL
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      // dexscreener: /<chain>/<pair>
      if (u.hostname.includes("dexscreener.com")) {
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) return { kind: "url", value: parts[1], chainHint: parts[0] };
      }
      // coingecko: /coins/<id>
      if (u.hostname.includes("coingecko.com")) {
        const m = u.pathname.match(/\/coins\/([^\/]+)/);
        if (m) return { kind: "name", value: m[1] };
      }
      return { kind: "name", value: v };
    } catch {
      return { kind: "name", value: v };
    }
  }
  // Solana base58 (32-44 chars, no 0/O/I/l) — heuristic
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return { kind: "address", value: v };
  return { kind: "name", value: v };
}

// ---------- Data fetchers ----------
// Fetch with a hard timeout so one slow upstream API can't hang the whole edge function.
async function fetchWithTimeout(url: string, ms = 6000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    console.warn("fetch failed/timeout:", url, (e as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchDexscreenerByAddress(address: string) {
  try {
    const r = await fetchWithTimeout(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    if (!r || !r.ok) return null;
    const d = await r.json();
    const pairs = (d?.pairs ?? []) as any[];
    if (!pairs.length) return null;
    pairs.sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
    return pairs[0];
  } catch (e) {
    console.error("dexscreener err:", e);
    return null;
  }
}

async function fetchDexscreenerByPair(pairAddress: string) {
  try {
    const r = await fetchWithTimeout(`https://api.dexscreener.com/latest/dex/pairs/search?q=${pairAddress}`);
    if (!r || !r.ok) return null;
    const d = await r.json();
    return d?.pairs?.[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchCoinGeckoSearch(query: string) {
  try {
    const r = await fetchWithTimeout(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`);
    if (!r || !r.ok) return null;
    const d = await r.json();
    return d?.coins?.[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchCoinGeckoCoin(id: string) {
  try {
    const r = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`,
    );
    if (!r || !r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// CoinGecko platform → display chain name. Each platform is queried
// INDEPENDENTLY so we never merge same-symbol tokens across networks.
const CG_PLATFORMS: Record<string, string> = {
  ethereum: "Ethereum",
  "binance-smart-chain": "BNB Smart Chain",
  "polygon-pos": "Polygon",
  "arbitrum-one": "Arbitrum",
  base: "Base",
  "optimistic-ethereum": "Optimism",
  avalanche: "Avalanche",
  fantom: "Fantom",
};

async function fetchCoinGeckoByContract(platform: string, address: string) {
  try {
    const r = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address.toLowerCase()}`,
    );
    if (!r || !r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function chainFromDex(p: any): string {
  const id = (p?.chainId ?? "").toString().toLowerCase();
  const map: Record<string, string> = {
    ethereum: "Ethereum",
    bsc: "BNB Smart Chain",
    polygon: "Polygon",
    arbitrum: "Arbitrum",
    base: "Base",
    solana: "Solana",
    avalanche: "Avalanche",
    optimism: "Optimism",
  };
  return map[id] ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : "Unknown");
}

// Sentinel error type for unresolved contracts.
class ContractResolutionError extends Error {
  constructor(public userMessage: string) {
    super(userMessage);
  }
}

// Sentinel error type for unresolved name/symbol inputs. Frontend treats this
// the same as contract resolution failure: a clean clarification message,
// never a guessed token.
class TokenResolutionError extends Error {
  constructor(public userMessage: string) {
    super(userMessage);
  }
}

// Suggestion mode: zero exact matches, but close candidates exist. We refuse
// to auto-pick — return options for the user to choose from.
interface TokenSuggestion {
  id: string;
  name: string;
  symbol: string;
}
class TokenSuggestionError extends Error {
  constructor(public userMessage: string, public suggestions: TokenSuggestion[]) {
    super(userMessage);
  }
}

// Light, safe normalization. We lowercase, trim, collapse whitespace, strip
// noisy special chars (keep letters/numbers/spaces only), and split a few
// obviously-glued words like "trustwallettoken" → "trust wallet token" using
// a tiny dictionary. We never invent characters or apply fuzzy edits.
const KNOWN_WORD_SPLITS: Array<[RegExp, string]> = [
  [/trustwallettoken/gi, "trust wallet token"],
  [/binancecoin/gi, "binance coin"],
  [/shibainu/gi, "shiba inu"],
  [/bitcoincash/gi, "bitcoin cash"],
  [/usdcoin/gi, "usd coin"],
  [/wrappedbitcoin/gi, "wrapped bitcoin"],
  [/wrappedether/gi, "wrapped ether"],
];
function normalizeQuery(raw: string): { norm: string; changed: boolean } {
  const original = raw.trim().toLowerCase();
  let s = original
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // strip special chars
    .replace(/\s+/g, " ")
    .trim();
  for (const [re, repl] of KNOWN_WORD_SPLITS) s = s.replace(re, repl);
  return { norm: s, changed: s !== original };
}

function devLog(msg: string) {
  if (Deno.env.get("DENO_DEPLOYMENT_ID") === undefined) {
    console.debug(`[resolve] ${msg}`);
  }
}

/**
 * Strict name/symbol resolution. NO fuzzy fallback, NO "closest match".
 *
 * Rules:
 *   - Search CoinGecko, then require an EXACT match (case-insensitive) on
 *     either the coin's name or symbol against the normalized query.
 *   - If exactly one exact match → proceed.
 *   - If multiple exact matches (e.g. several coins share a symbol) → ask the
 *     user to be more specific.
 *   - If zero exact matches → "Token not found".
 *   - We never auto-pick the top search hit by similarity alone.
 */
async function resolveByNameStrict(
  rawInput: string,
): Promise<{ snapshot: MarketSnapshot; resolutionConfidence: "High" | "Medium" }> {
  const { norm, changed } = normalizeQuery(rawInput);
  if (!norm) throw new TokenResolutionError("Token not found. Please check the spelling.");

  const r = await fetchWithTimeout(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(norm)}`,
  );
  const data = r && r.ok ? await r.json() : null;
  const coins = (data?.coins ?? []) as Array<{ id: string; name: string; symbol: string; market_cap_rank?: number }>;

  devLog(`name input="${rawInput}" norm="${norm}" hits=${coins.length}`);

  if (coins.length === 0) {
    throw new TokenResolutionError("Token not found. Please check the spelling.");
  }

  const normNoSpace = norm.replace(/\s+/g, "");
  const exact = coins.filter((c) => {
    const name = (c.name ?? "").toLowerCase();
    const symbol = (c.symbol ?? "").toLowerCase();
    return name === norm || symbol === norm || name.replace(/\s+/g, "") === normNoSpace;
  });

  devLog(`exact matches=${exact.length}`);

  if (exact.length === 0) {
    // SUGGESTION MODE — close candidates exist but no exact match. Never
    // auto-pick. Return top 2-3 by market cap rank for the user to choose.
    const ranked = [...coins]
      .sort((a, b) => (a.market_cap_rank ?? 9_999_999) - (b.market_cap_rank ?? 9_999_999))
      .slice(0, 3)
      .map((c) => ({ id: c.id, name: c.name, symbol: (c.symbol ?? "").toUpperCase() }));
    throw new TokenSuggestionError(
      "We couldn't find an exact match. Did you mean one of these?",
      ranked,
    );
  }

  let chosen: { id: string; name: string; symbol: string };
  if (exact.length === 1) {
    chosen = exact[0];
  } else {
    // Multiple exact matches. Only auto-resolve if ONE is overwhelmingly more
    // established (top-100 by market cap rank) and the others are not. This
    // covers cases like "USDT" (one canonical Tether vs. many copycats).
    const ranked = exact
      .filter((c) => typeof c.market_cap_rank === "number")
      .sort((a, b) => (a.market_cap_rank as number) - (b.market_cap_rank as number));
    const top = ranked[0];
    const second = ranked[1];
    const topIsDominant =
      top &&
      (top.market_cap_rank as number) <= 100 &&
      (!second || (second.market_cap_rank as number) > (top.market_cap_rank as number) + 50);
    if (!topIsDominant) {
      // Equally plausible exact matches → suggestion mode (let user pick).
      const sugg = exact
        .slice(0, 3)
        .map((c) => ({ id: c.id, name: c.name, symbol: (c.symbol ?? "").toUpperCase() }));
      throw new TokenSuggestionError("Multiple tokens match. Please pick the one you meant:", sugg);
    }
    chosen = top;
  }

  const coin = await fetchCoinGeckoCoin(chosen.id);
  if (!coin) throw new TokenResolutionError("Token not found. Please check the spelling.");

  const md = coin.market_data ?? {};
  const created = coin.genesis_date ? new Date(coin.genesis_date) : null;
  const ageDays = created ? Math.floor((Date.now() - created.getTime()) / 86_400_000) : undefined;
  const platforms = coin.platforms ?? {};
  const chainKey = Object.keys(platforms).filter((k) => platforms[k])[0];
  const chain = chainKey
    ? (CG_PLATFORMS[chainKey] ?? chainKey.charAt(0).toUpperCase() + chainKey.slice(1))
    : "Multi-chain";

  return {
    snapshot: {
      name: coin.name ?? chosen.name,
      symbol: (coin.symbol ?? chosen.symbol ?? "").toUpperCase(),
      chain,
      priceUsd: md.current_price?.usd,
      marketCap: md.market_cap?.usd,
      volume24h: md.total_volume?.usd,
      liquidityUsd: undefined,
      ageDays,
      priceChange24h: md.price_change_percentage_24h,
      categories: Array.isArray(coin.categories) ? coin.categories : undefined,
    },
    // High = matched exactly as typed; Medium = matched only after normalization.
    resolutionConfidence: changed ? "Medium" : "High",
  };
}

// Direct lookup by CoinGecko ID — used when the user picks a suggestion.
async function resolveByCoinGeckoId(id: string): Promise<MarketSnapshot> {
  const coin = await fetchCoinGeckoCoin(id);
  if (!coin) throw new TokenResolutionError("Selected token could not be loaded.");
  const md = coin.market_data ?? {};
  const created = coin.genesis_date ? new Date(coin.genesis_date) : null;
  const ageDays = created ? Math.floor((Date.now() - created.getTime()) / 86_400_000) : undefined;
  const platforms = coin.platforms ?? {};
  const chainKey = Object.keys(platforms).filter((k) => platforms[k])[0];
  const chain = chainKey
    ? (CG_PLATFORMS[chainKey] ?? chainKey.charAt(0).toUpperCase() + chainKey.slice(1))
    : "Multi-chain";
  return {
    name: coin.name,
    symbol: (coin.symbol ?? "").toUpperCase(),
    chain,
    priceUsd: md.current_price?.usd,
    marketCap: md.market_cap?.usd,
    volume24h: md.total_volume?.usd,
    liquidityUsd: undefined,
    ageDays,
    priceChange24h: md.price_change_percentage_24h,
  };
}

/**
 * Strict chain-aware contract resolution.
 *
 * 1. Query Dexscreener — returns ALL pairs across chains for the address.
 * 2. Group by chain. NEVER merge across chains.
 * 3. If results on multiple distinct chains → ambiguous (rare for EVM since
 *    addresses are usually unique to one deployment, but a token can be
 *    bridged with the same address on EVM forks).
 * 4. Cross-check with CoinGecko's contract endpoint per-chain to verify
 *    name/symbol consistency.
 */
async function resolveContractStrict(address: string): Promise<MarketSnapshot> {
  // 1. Dexscreener — multi-chain lookup by token address
  const dexR = await fetchWithTimeout(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
  const dexData = dexR && dexR.ok ? await dexR.json() : null;
  const allPairs = (dexData?.pairs ?? []) as any[];

  // Group pairs by chain, picking the deepest-liquidity pair per chain.
  const byChain = new Map<string, any>();
  for (const p of allPairs) {
    const chain = chainFromDex(p);
    const existing = byChain.get(chain);
    if (!existing || (p?.liquidity?.usd ?? 0) > (existing?.liquidity?.usd ?? 0)) {
      byChain.set(chain, p);
    }
  }

  const distinctChains = [...byChain.keys()];

  if (distinctChains.length === 0) {
    // 2. Fallback: try CoinGecko per platform individually (no merging).
    const cgPlatforms = Object.keys(CG_PLATFORMS);
    const cgHits: Array<{ chain: string; coin: any }> = [];
    for (const platform of cgPlatforms) {
      const coin = await fetchCoinGeckoByContract(platform, address);
      if (coin?.id) cgHits.push({ chain: CG_PLATFORMS[platform], coin });
    }
    if (cgHits.length === 0) {
      throw new ContractResolutionError("Contract not recognized on supported networks.");
    }
    if (cgHits.length > 1) {
      const chains = new Set(cgHits.map((h) => h.chain));
      if (chains.size > 1) {
        throw new ContractResolutionError(
          "Unable to confidently resolve this contract address. Please verify the network.",
        );
      }
    }
    const { chain, coin } = cgHits[0];
    const md = coin.market_data ?? {};
    const created = coin.genesis_date ? new Date(coin.genesis_date) : null;
    return {
      name: coin.name ?? "Unknown Token",
      symbol: (coin.symbol ?? "?").toUpperCase(),
      chain,
      address,
      priceUsd: md.current_price?.usd,
      marketCap: md.market_cap?.usd,
      volume24h: md.total_volume?.usd,
      liquidityUsd: undefined,
      ageDays: created ? Math.floor((Date.now() - created.getTime()) / 86_400_000) : undefined,
      priceChange24h: md.price_change_percentage_24h,
    };
  }

  // 3. Multiple chains from Dexscreener → ambiguous unless one clearly dominates.
  let chosenPair: any;
  let chosenChain: string;
  if (distinctChains.length === 1) {
    chosenChain = distinctChains[0];
    chosenPair = byChain.get(chosenChain);
  } else {
    // Pick the chain with the most liquidity, but only if it's clearly dominant
    // (≥ 5x the next one). Otherwise refuse to guess.
    const ranked = [...byChain.entries()].sort(
      (a, b) => (b[1]?.liquidity?.usd ?? 0) - (a[1]?.liquidity?.usd ?? 0),
    );
    const top = ranked[0][1]?.liquidity?.usd ?? 0;
    const next = ranked[1][1]?.liquidity?.usd ?? 0;
    if (top > 0 && (next === 0 || top >= next * 5)) {
      chosenChain = ranked[0][0];
      chosenPair = ranked[0][1];
    } else {
      throw new ContractResolutionError(
        "Unable to confidently resolve this contract address. Please verify the network.",
      );
    }
  }

  const created = chosenPair.pairCreatedAt ? new Date(chosenPair.pairCreatedAt) : null;
  const ageDays = created ? Math.floor((Date.now() - created.getTime()) / 86_400_000) : undefined;
  return {
    name: chosenPair.baseToken?.name ?? "Unknown Token",
    symbol: chosenPair.baseToken?.symbol ?? "?",
    chain: chosenChain,
    address: chosenPair.baseToken?.address ?? address,
    priceUsd: chosenPair.priceUsd ? parseFloat(chosenPair.priceUsd) : undefined,
    marketCap: chosenPair.fdv ?? chosenPair.marketCap,
    volume24h: chosenPair.volume?.h24,
    liquidityUsd: chosenPair.liquidity?.usd,
    ageDays,
    priceChange24h: chosenPair.priceChange?.h24,
  };
}

async function gatherMarketData(
  input: string,
  opts?: { coingeckoId?: string },
): Promise<{ snapshot: MarketSnapshot; resolutionConfidence: "High" | "Medium" }> {
  // User picked a suggestion → resolve directly by CoinGecko ID.
  if (opts?.coingeckoId) {
    const snapshot = await resolveByCoinGeckoId(opts.coingeckoId);
    return { snapshot, resolutionConfidence: "High" };
  }

  const parsed = parseInput(input);

  if (parsed.kind === "address") {
    devLog(`address input chain-resolution`);
    return { snapshot: await resolveContractStrict(parsed.value), resolutionConfidence: "High" };
  }

  if (parsed.kind === "url") {
    const pair = await fetchDexscreenerByPair(parsed.value);
    if (pair) {
      const created = pair.pairCreatedAt ? new Date(pair.pairCreatedAt) : null;
      const ageDays = created ? Math.floor((Date.now() - created.getTime()) / 86_400_000) : undefined;
      return {
        snapshot: {
          name: pair.baseToken?.name ?? "Unknown Token",
          symbol: pair.baseToken?.symbol ?? "?",
          chain: chainFromDex(pair),
          address: pair.baseToken?.address,
          priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : undefined,
          marketCap: pair.fdv ?? pair.marketCap,
          volume24h: pair.volume?.h24,
          liquidityUsd: pair.liquidity?.usd,
          ageDays,
          priceChange24h: pair.priceChange?.h24,
        },
        resolutionConfidence: "High",
      };
    }
    throw new TokenResolutionError("We couldn't read this link. Please verify the URL or try the contract/name.");
  }

  return await resolveByNameStrict(parsed.value);
}

// ---------- Asset Classification (MANDATORY FIRST STEP) ----------
function classifyAsset(m: MarketSnapshot): AssetClass {
  const mc = m.marketCap ?? 0;
  const vol = m.volume24h ?? 0;
  const hasCoreData = m.marketCap !== undefined || m.volume24h !== undefined;

  if (!hasCoreData) return "UNKNOWN";
  if (mc >= 1_000_000_000 && vol >= 10_000_000) return "MAJOR";
  if (mc >= 50_000_000 && vol >= 500_000) return "MID";
  return "LOW";
}

// ---------- Data hierarchy enrichment ----------
// For MAJOR/MID candidates, prefer CoinGecko global market data over a single
// DEX pool snapshot. This prevents "no liquidity" false alarms on assets like
// SOL/ETH/BTC that trade across many CEX/DEX venues.
async function enrichWithCoinGecko(m: MarketSnapshot): Promise<MarketSnapshot> {
  const query = m.symbol && m.symbol !== "?" ? m.symbol : m.name;
  if (!query) return m;
  const search = await fetchCoinGeckoSearch(query);
  if (!search?.id) return m;
  const coin = await fetchCoinGeckoCoin(search.id);
  if (!coin) return m;
  const md = coin.market_data ?? {};
  const created = coin.genesis_date ? new Date(coin.genesis_date) : null;
  const ageDays = created ? Math.floor((Date.now() - created.getTime()) / 86_400_000) : m.ageDays;
  // CoinGecko is authoritative for global market cap & volume on listed assets.
  return {
    ...m,
    name: m.name && m.name !== "Unknown Token" ? m.name : (coin.name ?? m.name),
    symbol: m.symbol && m.symbol !== "?" ? m.symbol : (coin.symbol ?? m.symbol).toUpperCase(),
    priceUsd: md.current_price?.usd ?? m.priceUsd,
    marketCap: md.market_cap?.usd ?? m.marketCap,
    volume24h: md.total_volume?.usd ?? m.volume24h,
    // For globally-listed assets, leave liquidityUsd as `undefined` from CG —
    // the classification layer treats this correctly (deep global liquidity).
    ageDays: ageDays ?? m.ageDays,
    priceChange24h: md.price_change_percentage_24h ?? m.priceChange24h,
  };
}

// ---------- Risk Engine (context-aware) ----------
function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function computeRisk(m: MarketSnapshot, cls: AssetClass) {
  // MAJOR assets: anchor scores high, ignore single-pool DEX gaps.
  if (cls === "MAJOR") {
    const change = Math.abs(m.priceChange24h ?? 0);
    const volatility = change > 25 ? 65 : change > 10 ? 80 : 92;
    return {
      score: 88,
      breakdown: { liquidity: 95, whaleConcentration: 85, contractRisk: 95, volatility },
    };
  }

  if (cls === "MID") {
    let score = 78;
    const breakdown = { liquidity: 75, whaleConcentration: 70, contractRisk: 80, volatility: 75 };
    if (m.liquidityUsd !== undefined) {
      if (m.liquidityUsd < 100_000) { score -= 12; breakdown.liquidity = 45; }
      else if (m.liquidityUsd < 500_000) { score -= 4; breakdown.liquidity = 65; }
      else { breakdown.liquidity = 88; }
    }
    const change = Math.abs(m.priceChange24h ?? 0);
    if (change > 50) { score -= 10; breakdown.volatility = 35; }
    else if (change > 20) { score -= 4; breakdown.volatility = 60; }
    else { breakdown.volatility = 82; }
    if (m.ageDays !== undefined && m.ageDays < 30) { score -= 6; breakdown.contractRisk = 60; }
    for (const k of Object.keys(breakdown) as (keyof typeof breakdown)[]) breakdown[k] = clamp(breakdown[k]);
    return { score: clamp(score), breakdown };
  }

  // LOW / UNKNOWN: full risk detection
  let score = 100;
  const breakdown = { liquidity: 80, whaleConcentration: 70, contractRisk: 75, volatility: 75 };

  if (m.liquidityUsd === undefined) {
    score -= cls === "UNKNOWN" ? 25 : 10;
    breakdown.liquidity = cls === "UNKNOWN" ? 30 : 50;
  } else if (m.liquidityUsd < 25_000) { score -= 30; breakdown.liquidity = 15; }
  else if (m.liquidityUsd < 100_000) { score -= 18; breakdown.liquidity = 40; }
  else if (m.liquidityUsd < 500_000) { score -= 8; breakdown.liquidity = 65; }
  else { breakdown.liquidity = 90; }

  if (!m.volume24h || m.volume24h < 1_000) { score -= 20; breakdown.contractRisk -= 10; }
  else if (m.volume24h < 50_000) { score -= 8; }

  if (m.ageDays !== undefined && m.ageDays < 7) { score -= 15; breakdown.contractRisk = 35; }
  else if (m.ageDays !== undefined && m.ageDays < 30) { score -= 5; breakdown.contractRisk = 60; }
  else if (m.ageDays !== undefined && m.ageDays > 365) { breakdown.contractRisk = 88; }

  const change = Math.abs(m.priceChange24h ?? 0);
  if (change > 100) { score -= 15; breakdown.volatility = 15; }
  else if (change > 40) { score -= 10; breakdown.volatility = 35; }
  else if (change > 15) { breakdown.volatility = 60; }
  else { breakdown.volatility = 85; }

  if ((m.liquidityUsd ?? 0) < 100_000 && (m.volume24h ?? 0) < 20_000) {
    score -= 15; breakdown.whaleConcentration = 25;
  } else if ((m.liquidityUsd ?? 0) < 500_000) { breakdown.whaleConcentration = 55; }
  else { breakdown.whaleConcentration = 80; }

  if (cls === "UNKNOWN") score -= 10;

  for (const k of Object.keys(breakdown) as (keyof typeof breakdown)[]) breakdown[k] = clamp(breakdown[k]);
  return { score: clamp(score), breakdown };
}

function verdictFromScore(score: number): Verdict {
  if (score >= 70) return "SAFE-ISH";
  if (score >= 40) return "CAUTION";
  return "AVOID";
}

// ---------- Confidence ----------
function computeConfidence(m: MarketSnapshot, cls: AssetClass): Confidence {
  if (cls === "MAJOR") return "High";
  if (cls === "UNKNOWN") return "Low";
  const fields = [m.marketCap, m.volume24h, m.priceUsd, m.ageDays].filter((v) => v !== undefined).length;
  if (cls === "MID" && fields >= 3) return "High";
  if (fields >= 3) return "Medium";
  if (fields >= 2) return "Medium";
  return "Low";
}

// ---------- Outlook (lightweight forward signal) ----------
function computeOutlook(m: MarketSnapshot, cls: AssetClass, riskScore: number): Outlook {
  if (cls === "UNKNOWN") return "Weak";
  const change = m.priceChange24h ?? 0;
  const vol = m.volume24h ?? 0;

  if (cls === "MAJOR") {
    if (change > 3 && riskScore >= 70) return "Bullish";
    if (change < -5) return "Weak";
    return "Neutral";
  }
  if (riskScore < 40) return "Weak";
  if (change > 8 && vol > 100_000 && riskScore >= 60) return "Bullish";
  if (change < -15) return "Weak";
  return "Neutral";
}

// ---------- Opportunity Engine (context-aware) ----------
function computeOpportunity(m: MarketSnapshot, cls: AssetClass, riskScore: number): { tag: OpportunityTag; reason: string } {
  if (cls === "MAJOR") {
    const change = m.priceChange24h ?? 0;
    if (change > 3) return { tag: "Trending", reason: "Widely adopted asset with steady upward momentum." };
    if (change < -5) return { tag: "Trending", reason: "Major asset under short-term pressure — still highly liquid." };
    return { tag: "Trending", reason: "Established asset with consistent global trading activity." };
  }

  const vol = m.volume24h ?? 0;
  const liq = m.liquidityUsd ?? 0;
  const age = m.ageDays ?? 999;
  const change = m.priceChange24h ?? 0;

  if (cls === "UNKNOWN" || (vol < 5_000 && liq < 50_000)) {
    return { tag: "Low Activity Zone", reason: "Limited trading activity or liquidity at the moment." };
  }
  if (Math.abs(change) > 50 && riskScore < 50) {
    return { tag: "Overhyped", reason: "Big price swings on shaky fundamentals — classic pump pattern." };
  }
  if (age < 30 && vol > 50_000 && liq > 100_000) {
    return { tag: "Early Gem", reason: "Young token with real volume and liquidity — worth watching carefully." };
  }
  if (vol > 100_000 && change > 5 && riskScore >= 55) {
    return { tag: "Trending", reason: "Healthy volume and steady upward momentum." };
  }
  if (vol > 50_000) {
    return { tag: "Trending", reason: "Active trading with reasonable fundamentals." };
  }
  return { tag: "Low Activity Zone", reason: "Limited activity — not much happening here." };
}

// ---------- AI Explanation ----------
async function generateExplanation(m: MarketSnapshot, riskScore: number, verdict: Verdict, opportunity: { tag: OpportunityTag; reason: string }) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return {
      summary: `${m.name} (${m.symbol}) on ${m.chain}.`,
      whatItDoes: "We couldn't generate a description right now.",
      whyPeopleBuy: "Check the project's official site for details.",
      whatCouldGoWrong: "Always check liquidity, holders, and the team before buying.",
      verdictReason: `Score ${riskScore}/100 — ${verdict}.`,
    };
  }

  const facts = {
    name: m.name,
    symbol: m.symbol,
    chain: m.chain,
    priceUsd: m.priceUsd,
    marketCap: m.marketCap,
    volume24h: m.volume24h,
    liquidityUsd: m.liquidityUsd,
    ageDays: m.ageDays,
    priceChange24h: m.priceChange24h,
    riskScore,
    verdict,
    opportunityTag: opportunity.tag,
  };

  const sys =
    "You are GLADYS, a friendly crypto safety guide for absolute beginners. " +
    "Never give financial advice. Use plain English, no jargon, short sentences. " +
    "Be honest about risk without being preachy. Tone: protective, calm, smart friend.";

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content:
              `Token facts (JSON): ${JSON.stringify(facts)}\n\n` +
              "Use the function to return clear plain-English explanations for a beginner.",
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "explain_token",
              description: "Return beginner-friendly explanations.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "One short sentence (max 18 words) explaining what this token is." },
                  whatItDoes: { type: "string", description: "2-3 short sentences. What is this token's purpose in plain words?" },
                  whyPeopleBuy: { type: "string", description: "2-3 short sentences. Why are people interested in it right now?" },
                  whatCouldGoWrong: { type: "string", description: "2-3 short sentences. Honest risks for a beginner." },
                  verdictReason: { type: "string", description: "One short sentence (max 20 words) justifying the verdict." },
                },
                required: ["summary", "whatItDoes", "whyPeopleBuy", "whatCouldGoWrong", "verdictReason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "explain_token" } },
      }),
    });
    clearTimeout(timer);

    if (!r.ok) {
      const txt = await r.text();
      console.error("AI gateway error", r.status, txt);
      throw new Error(`AI gateway ${r.status}`);
    }

    const data = await r.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (args) {
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      return parsed;
    }
    throw new Error("No tool call in AI response");
  } catch (e) {
    console.error("AI explanation failed:", e);
    return {
      summary: `${m.name} (${m.symbol}) trading on ${m.chain}.`,
      whatItDoes: "This token trades on decentralized exchanges. Check the project's website for its actual purpose.",
      whyPeopleBuy: "People buy tokens hoping the price goes up, or because they believe in the project's mission.",
      whatCouldGoWrong: "Low liquidity, sudden dumps, or scams are common in crypto. Never invest more than you can lose.",
      verdictReason: `Score ${riskScore}/100 — handle with ${verdict === "SAFE-ISH" ? "normal care" : verdict === "CAUTION" ? "extra caution" : "great caution"}.`,
    };
  }
}

// ---------- Rate limiting ----------
const DAILY_LIMIT = 6;
const BURST_WINDOW_MS = 3_000; // min gap between scans from same client
const burstMap = new Map<string, number>();

async function hashClient(identifier: string): Promise<string> {
  // Dedicated non-sensitive salt. NEVER use the service role key for hashing.
  // Prefer SCAN_HASH_SALT; fall back to legacy RATE_LIMIT_SALT for compatibility.
  const salt =
    Deno.env.get("SCAN_HASH_SALT") ??
    Deno.env.get("RATE_LIMIT_SALT") ??
    "gladys-default-salt-v1";
  const data = new TextEncoder().encode(`${identifier}:${salt}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Derive a stable client identifier for fair, per-device rate limiting.
 *
 * Priority:
 *   1. `x-gladys-client-id` — UUID generated client-side and persisted in
 *      localStorage. This is the PRIMARY identifier so users on shared/NAT
 *      networks (offices, schools, mobile carriers) get independent quotas.
 *   2. IP fallback (cf-connecting-ip → right-most XFF entry) only when the
 *      client ID header is missing.
 *
 * The application origin is mixed in so the same device can't be limited
 * across unrelated deployments. User-agent is intentionally NOT used for
 * enforcement (only logged separately if needed).
 */
function getClientFingerprint(req: Request): { fingerprint: string; source: "client_id" | "ip" } {
  const origin = (req.headers.get("origin") ?? req.headers.get("referer") ?? "unknown").toLowerCase();
  const clientId = req.headers.get("x-gladys-client-id")?.trim();
  if (clientId && /^[a-f0-9-]{16,64}$/i.test(clientId)) {
    return { fingerprint: `${clientId}|${origin}`, source: "client_id" };
  }
  const cfIp = req.headers.get("cf-connecting-ip");
  const xff = req.headers.get("x-forwarded-for");
  const xffIp = xff ? xff.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? "" : "";
  const ip = (cfIp || xffIp || "unknown").toLowerCase();
  return { fingerprint: `${ip}|${origin}`, source: "ip" };
}

function nextResetTime(): string {
  // UTC midnight (next day) — matches usage_date rollover.
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

async function checkAndIncrementQuota(
  req: Request,
): Promise<{ allowed: boolean; remaining: number; resetTime: string; reason?: "daily" | "burst" }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resetTime = nextResetTime();
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase env for rate limiting");
    return { allowed: true, remaining: DAILY_LIMIT, resetTime };
  }

  const { fingerprint, source } = getClientFingerprint(req);
  const clientHash = await hashClient(fingerprint);
  const today = new Date().toISOString().slice(0, 10);

  if (Deno.env.get("DENO_DEPLOYMENT_ID") === undefined) {
    // Local/dev only — never log in production.
    console.debug(`[rate-limit] source=${source} hash=${clientHash.slice(0, 8)}…`);
  }

  // Burst guard: reject rapid repeat calls from the same fingerprint.
  const now = Date.now();
  const last = burstMap.get(clientHash) ?? 0;
  if (now - last < BURST_WINDOW_MS) {
    if (Deno.env.get("DENO_DEPLOYMENT_ID") === undefined) {
      console.debug(`[rate-limit] burst triggered for ${clientHash.slice(0, 8)}…`);
    }
    return { allowed: false, remaining: -1, resetTime, reason: "burst" };
  }
  burstMap.set(clientHash, now);
  if (burstMap.size > 5000) {
    for (const [k, t] of burstMap) {
      if (now - t > 60_000) burstMap.delete(k);
    }
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation,resolution=merge-duplicates",
  };

  const getR = await fetch(
    `${supabaseUrl}/rest/v1/scan_usage?client_hash=eq.${clientHash}&usage_date=eq.${today}&select=count`,
    { headers },
  );
  const rows = getR.ok ? await getR.json() : [];
  const current: number = rows?.[0]?.count ?? 0;

  if (current >= DAILY_LIMIT) {
    if (Deno.env.get("DENO_DEPLOYMENT_ID") === undefined) {
      console.debug(`[rate-limit] daily limit reached for ${clientHash.slice(0, 8)}…`);
    }
    return { allowed: false, remaining: 0, resetTime, reason: "daily" };
  }

  const upR = await fetch(`${supabaseUrl}/rest/v1/scan_usage?on_conflict=client_hash,usage_date`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      client_hash: clientHash,
      usage_date: today,
      count: current + 1,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!upR.ok) {
    console.error("scan_usage upsert failed with status:", upR.status);
  }

  return { allowed: true, remaining: Math.max(0, DAILY_LIMIT - (current + 1)), resetTime };
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const input: unknown = body?.input;
    const coingeckoId: unknown = body?.coingeckoId;
    if (!input || typeof input !== "string" || input.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const pickedId = typeof coingeckoId === "string" && /^[a-z0-9-]{1,80}$/.test(coingeckoId)
      ? coingeckoId
      : undefined;

    // Server-side rate limit (cannot be bypassed by clearing localStorage)
    const quota = await checkAndIncrementQuota(req);
    if (!quota.allowed) {
      const isBurst = quota.reason === "burst";
      return new Response(
        JSON.stringify({
          error: isBurst
            ? "Slow down a moment — too many scans in a row."
            : "Daily scan limit reached. Please come back tomorrow or upgrade.",
          rateLimited: true,
          burst: isBurst,
          remainingScans: isBurst ? undefined : 0,
          limitResetTime: quota.resetTime,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            ...(isBurst ? { "Retry-After": "3" } : {}),
          },
        },
      );
    }

    const gathered = await gatherMarketData(input, { coingeckoId: pickedId });
    let market = gathered.snapshot;
    const resolutionConfidence = gathered.resolutionConfidence;

    // Step 1: provisional classification using whatever we already have.
    let classification = classifyAsset(market);

    // Step 2: data hierarchy. If DEX gave us a token that *could* be a major
    // asset (had a recognizable symbol) but we lack global market cap/volume,
    // enrich from CoinGecko so global liquidity isn't misread as "no liquidity".
    const symbolLooksReal = market.symbol && market.symbol !== "?";
    const looksPotentiallyMajor = symbolLooksReal && (
      (market.marketCap ?? 0) < 1_000_000_000 || market.marketCap === undefined
    );
    if ((classification === "LOW" || classification === "UNKNOWN" || classification === "MID") && looksPotentiallyMajor) {
      const enriched = await enrichWithCoinGecko(market);
      const newCls = classifyAsset(enriched);
      if (newCls === "MAJOR" || newCls === "MID" || (enriched.marketCap && !market.marketCap)) {
        market = enriched;
        classification = newCls;
      }
    }

    const { score: baseScore, breakdown } = computeRisk(market, classification);
    // Volume-based safety cap: prevent low-activity tokens from appearing artificially safe.
    // Applied AFTER base score, BEFORE verdict classification.
    const vol24h = market.volume24h ?? 0;
    let riskScore = baseScore;
    if (vol24h > 0 && vol24h < 10_000) {
      riskScore = Math.min(riskScore, 50);
    } else if (vol24h > 0 && vol24h < 50_000) {
      riskScore = Math.min(riskScore, 60);
    }
    const verdict = verdictFromScore(riskScore);
    const opportunity = computeOpportunity(market, classification, riskScore);
    let confidence = computeConfidence(market, classification);
    const outlook = computeOutlook(market, classification, riskScore);

    // Network safety: if we couldn't confidently identify the chain, force
    // confidence to Low and surface a visible warning. Never present a
    // full-confidence verdict when the network is unknown.
    const chainLower = (market.chain ?? "").toLowerCase();
    const networkUncertain =
      !market.chain || chainLower === "unknown" || chainLower === "multi-chain";
    let networkWarning: string | undefined;
    if (networkUncertain) {
      confidence = "Low";
      networkWarning =
        "We couldn't confidently identify the blockchain network for this token. Please verify before proceeding.";
    }

    // Resolution confidence (Medium = matched only after normalization) caps
    // overall confidence so it can never claim "High" when the user input was
    // ambiguous-but-recoverable.
    if (resolutionConfidence === "Medium" && confidence === "High") {
      confidence = "Medium";
    }

    const ai = await generateExplanation(market, riskScore, verdict, opportunity);

    const result = {
      token: market,
      classification,
      confidence,
      outlook,
      riskScore,
      riskBreakdown: breakdown,
      opportunity,
      verdict,
      verdictReason: ai.verdictReason,
      explainer: {
        summary: ai.summary,
        whatItDoes: ai.whatItDoes,
        whyPeopleBuy: ai.whyPeopleBuy,
        whatCouldGoWrong: ai.whatCouldGoWrong,
      },
      resolutionConfidence,
      networkWarning,
      remainingScans: quota.remaining,
      limitResetTime: quota.resetTime,
      scannedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof TokenSuggestionError) {
      return new Response(
        JSON.stringify({
          error: e.userMessage,
          tokenUnresolved: true,
          suggestions: e.suggestions,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (e instanceof ContractResolutionError) {
      return new Response(
        JSON.stringify({ error: e.userMessage, contractUnresolved: true }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (e instanceof TokenResolutionError) {
      return new Response(
        JSON.stringify({ error: e.userMessage, tokenUnresolved: true }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // Log full detail server-side. Return a real 500 so monitoring and
    // clients can distinguish failures from successes.
    console.error("scan-token error:", e);
    return new Response(
      JSON.stringify({
        error: "Something went wrong while analyzing this token. Please try again.",
        fallback: true,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
