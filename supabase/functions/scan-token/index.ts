// GLADYS Scan — token scanner edge function
// Fetches market data from CoinGecko + Dexscreener, runs rule-based risk/opportunity engines,
// then asks Lovable AI to write plain-English explanations.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Verdict = "SAFE-ISH" | "CAUTION" | "AVOID";
type OpportunityTag = "Early Gem" | "Trending" | "Overhyped" | "Dead Zone";

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

function chainFromDex(p: any): string {
  const id = (p?.chainId ?? "").toString().toLowerCase();
  const map: Record<string, string> = {
    ethereum: "Ethereum",
    bsc: "BSC",
    polygon: "Polygon",
    arbitrum: "Arbitrum",
    base: "Base",
    solana: "Solana",
    avalanche: "Avalanche",
    optimism: "Optimism",
  };
  return map[id] ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : "Unknown");
}

async function gatherMarketData(input: string): Promise<MarketSnapshot> {
  const parsed = parseInput(input);

  // Try dexscreener first if we have an address-like value
  if (parsed.kind === "address" || parsed.kind === "url") {
    const dex = parsed.kind === "url"
      ? (await fetchDexscreenerByPair(parsed.value)) ?? (await fetchDexscreenerByAddress(parsed.value))
      : await fetchDexscreenerByAddress(parsed.value);
    if (dex) {
      const created = dex.pairCreatedAt ? new Date(dex.pairCreatedAt) : null;
      const ageDays = created ? Math.floor((Date.now() - created.getTime()) / 86_400_000) : undefined;
      return {
        name: dex.baseToken?.name ?? "Unknown Token",
        symbol: dex.baseToken?.symbol ?? "?",
        chain: chainFromDex(dex),
        address: dex.baseToken?.address ?? (parsed.kind === "address" ? parsed.value : undefined),
        priceUsd: dex.priceUsd ? parseFloat(dex.priceUsd) : undefined,
        marketCap: dex.fdv ?? dex.marketCap,
        volume24h: dex.volume?.h24,
        liquidityUsd: dex.liquidity?.usd,
        ageDays,
        priceChange24h: dex.priceChange?.h24,
      };
    }
  }

  // Fallback: coingecko search by name/symbol
  const search = await fetchCoinGeckoSearch(parsed.value);
  if (search?.id) {
    const coin = await fetchCoinGeckoCoin(search.id);
    if (coin) {
      const md = coin.market_data ?? {};
      const created = coin.genesis_date ? new Date(coin.genesis_date) : null;
      const ageDays = created ? Math.floor((Date.now() - created.getTime()) / 86_400_000) : undefined;
      const platforms = coin.platforms ?? {};
      const chain = Object.keys(platforms).filter((k) => platforms[k])[0] ?? "Multi-chain";
      return {
        name: coin.name ?? search.name,
        symbol: (coin.symbol ?? search.symbol ?? "").toUpperCase(),
        chain: chain.charAt(0).toUpperCase() + chain.slice(1),
        priceUsd: md.current_price?.usd,
        marketCap: md.market_cap?.usd,
        volume24h: md.total_volume?.usd,
        liquidityUsd: undefined,
        ageDays,
        priceChange24h: md.price_change_percentage_24h,
      };
    }
  }

  // Last resort minimal
  return {
    name: parsed.value,
    symbol: "?",
    chain: "Unknown",
  };
}

// ---------- Risk Engine ----------
function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function computeRisk(m: MarketSnapshot) {
  let score = 100;
  const breakdown = { liquidity: 80, whaleConcentration: 70, contractRisk: 75, volatility: 75 };

  // Liquidity
  if (m.liquidityUsd === undefined) {
    score -= 10;
    breakdown.liquidity = 50;
  } else if (m.liquidityUsd < 25_000) {
    score -= 30;
    breakdown.liquidity = 15;
  } else if (m.liquidityUsd < 100_000) {
    score -= 18;
    breakdown.liquidity = 40;
  } else if (m.liquidityUsd < 500_000) {
    score -= 8;
    breakdown.liquidity = 65;
  } else {
    breakdown.liquidity = 90;
  }

  // Volume
  if (!m.volume24h || m.volume24h < 1_000) {
    score -= 20;
    breakdown.contractRisk -= 10;
  } else if (m.volume24h < 50_000) {
    score -= 8;
  }

  // Age
  if (m.ageDays !== undefined && m.ageDays < 7) {
    score -= 15;
    breakdown.contractRisk = 35;
  } else if (m.ageDays !== undefined && m.ageDays < 30) {
    score -= 5;
    breakdown.contractRisk = 60;
  } else if (m.ageDays !== undefined && m.ageDays > 365) {
    breakdown.contractRisk = 88;
  }

  // Volatility / suspicious spikes
  const change = Math.abs(m.priceChange24h ?? 0);
  if (change > 100) {
    score -= 15;
    breakdown.volatility = 15;
  } else if (change > 40) {
    score -= 10;
    breakdown.volatility = 35;
  } else if (change > 15) {
    breakdown.volatility = 60;
  } else {
    breakdown.volatility = 85;
  }

  // Whale concentration proxy (low liquidity + low volume)
  if ((m.liquidityUsd ?? 0) < 100_000 && (m.volume24h ?? 0) < 20_000) {
    score -= 15;
    breakdown.whaleConcentration = 25;
  } else if ((m.liquidityUsd ?? 0) < 500_000) {
    breakdown.whaleConcentration = 55;
  } else {
    breakdown.whaleConcentration = 80;
  }

  for (const k of Object.keys(breakdown) as (keyof typeof breakdown)[]) {
    breakdown[k] = clamp(breakdown[k]);
  }

  return { score: clamp(score), breakdown };
}

function verdictFromScore(score: number): Verdict {
  if (score >= 70) return "SAFE-ISH";
  if (score >= 40) return "CAUTION";
  return "AVOID";
}

// ---------- Opportunity Engine ----------
function computeOpportunity(m: MarketSnapshot, riskScore: number): { tag: OpportunityTag; reason: string } {
  const vol = m.volume24h ?? 0;
  const liq = m.liquidityUsd ?? 0;
  const age = m.ageDays ?? 999;
  const change = m.priceChange24h ?? 0;

  if (vol < 5_000 && liq < 50_000) {
    return { tag: "Dead Zone", reason: "Almost no trading activity or liquidity right now." };
  }
  if (Math.abs(change) > 50 && riskScore < 50) {
    return { tag: "Overhyped", reason: "Big price swings on shaky fundamentals — classic pump signs." };
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
  return { tag: "Dead Zone", reason: "Low activity — not much happening here." };
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
  // Use a dedicated, non-sensitive salt. Never reuse the service role key for hashing.
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? "gladys-default-salt-v1";
  const data = new TextEncoder().encode(`${identifier}:${salt}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Derive a client identifier from trusted infrastructure headers only.
 * Supabase Edge Functions sit behind Cloudflare, which sets `cf-connecting-ip`
 * with the real client IP and strips client-supplied versions of it. We prefer
 * that, then fall back to the leftmost entry of `x-forwarded-for` (set by the
 * Supabase/Cloudflare edge, not the client). Any client-supplied `x-real-ip`
 * is ignored because it can be trivially spoofed.
 *
 * As an extra layer we mix in the user-agent so two devices behind the same
 * NAT don't share a counter and a single attacker can't trivially evade the
 * limit by rotating just one signal.
 */
function getClientFingerprint(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  const xff = req.headers.get("x-forwarded-for");
  // Trust only the leftmost XFF entry as set by the platform edge.
  const xffIp = xff ? xff.split(",")[0].trim() : "";
  const ip = (cfIp || xffIp || "unknown").toLowerCase();
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 120);
  return `${ip}|${ua}`;
}

async function checkAndIncrementQuota(req: Request): Promise<{ allowed: boolean; remaining: number; reason?: "daily" | "burst" }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase env for rate limiting");
    return { allowed: true, remaining: DAILY_LIMIT };
  }

  const fingerprint = getClientFingerprint(req);
  const clientHash = await hashClient(fingerprint);
  const today = new Date().toISOString().slice(0, 10);

  // Burst guard: reject rapid repeat calls from the same fingerprint.
  const now = Date.now();
  const last = burstMap.get(clientHash) ?? 0;
  if (now - last < BURST_WINDOW_MS) {
    return { allowed: false, remaining: -1, reason: "burst" };
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
    return { allowed: false, remaining: 0, reason: "daily" };
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
    // Avoid logging response body — may contain infra detail.
    console.error("scan_usage upsert failed with status:", upR.status);
  }

  return { allowed: true, remaining: Math.max(0, DAILY_LIMIT - (current + 1)) };
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { input } = await req.json();
    if (!input || typeof input !== "string" || input.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const market = await gatherMarketData(input);
    const { score: riskScore, breakdown } = computeRisk(market);
    const verdict = verdictFromScore(riskScore);
    const opportunity = computeOpportunity(market, riskScore);
    const ai = await generateExplanation(market, riskScore, verdict, opportunity);

    const result = {
      token: market,
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
      remainingScans: quota.remaining,
      scannedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Log full detail server-side. Return 200 with a structured error so the
    // Supabase client SDK (which throws on non-2xx and discards the body) can
    // surface a friendly message instead of a generic crash.
    console.error("scan-token error:", e);
    return new Response(
      JSON.stringify({
        error: "We couldn't scan that token right now. Try again in a moment.",
        fallback: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
