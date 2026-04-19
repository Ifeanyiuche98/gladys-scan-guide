# GLADYS Scan

**Crypto Safety & Opportunity Scanner** — paste a token name, contract address, or link and get an instant, plain-English verdict on whether it's safe, risky, or worth a closer look.

Built for beginner-to-intermediate crypto users who want clarity, not hype.

🔗 **Live app:** https://gladys-scan-guide.lovable.app

---

## ✨ Features

- 🔍 **Universal input** — accepts token names, contract addresses (0x…), or CoinGecko / Dexscreener URLs
- 🛡️ **Risk score (0–100)** — visual circular indicator with rule-based scoring
- 💎 **Opportunity signals** — tags like *Early Gem*, *Overhyped*, *Stable Pick*
- 🧠 **Beginner Mode** — AI-generated plain-English explanations (Lovable AI / Gemini)
- ⚖️ **Final verdict** — color-coded **Safe / Caution / Avoid** banner
- 📊 **Live market data** — pulls liquidity, volume, and holder data from CoinGecko & Dexscreener
- 🔒 **Server-side rate limiting** — 6 free scans per day per IP, enforced in the backend
- 📱 **Mobile-first** — premium dark theme with gold accents

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — Postgres + Edge Functions (Deno)
- **AI:** Lovable AI Gateway (Google Gemini)
- **Data sources:** CoinGecko API, Dexscreener API

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and `npm` (or `bun`)

### Local development

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

The app will be available at `http://localhost:8080`.

> **Note:** Environment variables (`.env`) are managed automatically by Lovable Cloud and are not committed to the repo. If you self-host, you'll need to provide your own Supabase URL and publishable key.

---

## 📁 Project Structure

```
src/
├── components/
│   ├── gladys/          # Feature components (ScanInput, Results, RiskScore, …)
│   └── ui/              # shadcn/ui primitives
├── lib/
│   ├── scan-limit.ts    # Client-side scan tracking
│   └── scan-types.ts    # Shared TypeScript types
├── pages/               # Route pages
└── integrations/
    └── supabase/        # Auto-generated backend client & types

supabase/
├── functions/
│   └── scan-token/      # Edge function: aggregates data + AI explanation
└── migrations/          # Database schema
```

---

## 🔐 Security

- Daily scan quota is enforced **server-side** in the `scan-token` edge function (not just localStorage)
- Client identity is hashed (SHA-256 over IP + service key) before storage
- RLS is enabled on all tables; the `scan_usage` table is only writable by the edge function
- Error messages returned to the client are sanitized

---

## 🗺️ Roadmap

- [ ] User accounts → unlimited scans + saved history
- [ ] Wallet scanner (paste a wallet, see portfolio risk)
- [ ] Real-time scam alerts feed
- [ ] Shareable scan result cards

---

## 🤝 Contributing

This project is built with [Lovable](https://lovable.dev). Changes pushed to this repo sync back into the Lovable editor automatically, and edits made in Lovable push here.

Open the project in Lovable: https://lovable.dev/projects/c6f2e1ac-e8c8-46fa-b7b8-c60486dd6a5e

---

## 📄 License

MIT — feel free to fork and build on top of it.
