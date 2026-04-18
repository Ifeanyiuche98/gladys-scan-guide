
## GLADYS Scan — Crypto Safety & Opportunity Scanner

A mobile-first web app where users paste a token name, contract address, or URL and get an instant safety + opportunity verdict in plain English.

### Design
- **Theme:** Dark (near-black background) with gold accents, subtle gradients, soft glows on key actions
- **Typography:** Modern sans-serif, large confident headings, friendly body copy
- **Feel:** Premium, calm, "trusted guide" — not a trading terminal
- **Mobile-first** with comfortable tap targets and a single-column flow

### Screens & Flow

**1. Landing**
- Logo "GLADYS Scan" + tagline "Scan Before You Ape."
- Large input: token name / contract address / CoinGecko or Dexscreener link
- Gold "Scan Token" button
- Small footer note: "3 free scans / day"

**2. Loading state**
- Animated loader with cycling text: "Analyzing contract…" → "Checking liquidity…" → "Scanning risk signals…"

**3. Results Dashboard** (single scrollable page)
- **Token Summary Card** — name, symbol, chain badge, 1-line plain-English description
- **Risk Score** — big circular score /100 with color (green/yellow/red) + breakdown bars: Liquidity, Whale Concentration, Contract Risk, Volatility
- **Opportunity Signal** — tag chip: Early Gem / Trending / Overhyped / Dead Zone + short reason
- **Explain Like I'm New** — 3 short paragraphs: what it does, why people buy it, what could go wrong
- **Final Verdict** — large banner: ✅ SAFE-ISH / ⚠️ CAUTION / 🚨 AVOID + one-line reasoning
- **CTA** — "Scan Another Token"

### Logic & Backend (Lovable Cloud)

**Input handling**
- Normalize input: detect contract address (0x…/Solana base58), CoinGecko/Dexscreener URLs, or plain token name
- Route to the right lookup path

**Data fetching** (via edge function to keep things clean and rate-limit-safe)
- **CoinGecko** public API → token info, market cap, volume, price, age
- **Dexscreener** public API → liquidity, pairs, volume spikes, holder/whale hints where available

**Risk engine (rule-based v1)**
- Start at 100, subtract per rule (low liquidity −30, whale concentration −25, no volume −20, <7 days old −15, suspicious spikes −10), clamp 0–100
- Map score → color and verdict tier

**Opportunity engine**
- Rules over volume trend + age + volatility → one of the four tags

**AI explanation layer (Lovable AI, Gemini)**
- Edge function takes the structured data + scores and returns: plain-English summary, beginner explanation (3 short paras), and one-line verdict reasoning
- Friendly, non-technical tone enforced via system prompt

**Free-tier limit**
- 3 scans / day tracked per browser (localStorage for v1, no login required)
- After limit: friendly modal with "Upgrade for unlimited scans" placeholder button (non-functional, future-ready)

### Future-ready structure (scaffolded, not built)
- Modular folders for `wallet-scan`, `scam-alerts`, `history` so they can be added later without refactor
- Results object shaped so it can be persisted to a `scans` table when accounts are added

### Out of scope for v1
- User accounts, payments, saved history, wallet scanning (structure only)
- Real contract bytecode analysis (rules use market signals as proxy)
