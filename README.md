# PayPilot

**AI chat agent that turns plain-language requests into PayPal invoices.**

Built for the **PayPal AI Hackathon** (Devpost, Oct–Nov 2026). Prizes: $69,750 total, $12,000 first place.

## What it does

You chat in Indonesian or English — e.g.:

> Tagih Budi budi@example.com Rp500.000 untuk desain logo, jatuh tempo minggu depan

PayPilot then:

1. **Gemini (AI)** parses the message into structured invoice data — recipient, items, amount, currency, due date (relative dates resolved: "minggu depan" → 2026-11-19).
2. **PayPal Invoicing API v2 (sandbox)** creates a draft invoice and sends it to the recipient.
3. Returns a **shareable PayPal payment link** and shows the invoice with live status (SENT → PAID).
4. A sidebar lists all invoices; in mock mode you can simulate the payer paying.

The project meaningfully uses **both PayPal and AI** — that combination is the core of the app, not an add-on.

## Demo script (60–90 seconds)

1. Open http://localhost:3000 — the chat shows three example prompts.
2. Send: `Tagih Budi budi@example.com Rp500.000 untuk desain logo, jatuh tempo minggu depan`
3. PayPilot replies with the invoice card: Budi, Rp500.000, due 2026-11-19, status SENT, plus **Buka Link Bayar** (opens the PayPal sandbox payment page) and **Salin Link**.
4. Click **Simulasikan Pembayaran** (mock mode) — status flips to PAID in the chat card and the sidebar.
5. Try a second one: `Invoice Sarah sarah@example.com $120 for consulting, due Friday`.

## Run it

Prerequisites: **Node.js 24+** (only `express` + `dotenv` dependencies).

```bash
npm install
cp .env.example .env   # then fill in the keys (see below)
npm start              # → http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default 3000) | Port the server listens on |
| `GEMINI_API_KEY` | Yes | Google AI Studio key — powers the chat parser (model `gemini-3.6-flash`) |
| `PAYPAL_CLIENT_ID` | No | PayPal sandbox REST app client ID (live mode) |
| `PAYPAL_CLIENT_SECRET` | No | PayPal sandbox REST app client secret (live mode) |
| `PAYPAL_MODE` | No (default `sandbox`) | `sandbox` only for now |
| `PAYPAL_MOCK` | No | `true` = mock PayPal (default when no credentials are set) |

**Mock vs live.** With no PayPal credentials (or `PAYPAL_MOCK=true`), the app runs in **mock mode**: the full flow works end-to-end with simulated PayPal responses (mock invoice IDs in real `INV2-…` shape, payment links in sandbox URL shape). The UI badges this clearly as **MOCK SANDBOX**. With credentials set and `PAYPAL_MOCK=false`, the app uses the real sandbox Invoicing API and badges **LIVE SANDBOX**.

> Note: the sandbox app behind your credentials must have the **Invoicing** API permission enabled in the PayPal Developer Dashboard (My Apps & Credentials → your app → enable Invoicing). Without it, PayPal returns `403 NOT_AUTHORIZED` on invoice calls and the app reports that error in the chat instead of crashing.

Never commit real keys: `.env` is gitignored. See `.env.example` for placeholders only.

## API

- `GET /api/health` → `{ ok, mode: "mock"|"live", gemini, paypal }`
- `POST /api/chat` `{ message }` → `{ reply, invoice | null, parsed | null, paypalMode }`
- `GET /api/invoices` → `{ invoices: [...] }` (newest first)
- `GET /api/invoices/:id` → single invoice (live mode refreshes status from PayPal)
- `POST /api/invoices/:id/mock-pay` → mock mode only; marks an invoice PAID

## Project structure

```
paypilot/
├── server.js            # Express app, routes, chat orchestration
├── lib/
│   ├── gemini.js        # Gemini REST parsing (gemini-3.6-flash)
│   ├── paypal.js        # PayPal Invoicing v2 client (live + mock)
│   └── store.js         # In-memory invoice store
├── public/
│   ├── index.html       # Chat UI
│   ├── styles.css
│   └── app.js           # Chat logic, invoice cards, sidebar
├── .env.example         # Placeholders only — never real keys
├── SUBMISSION.md        # Devpost submission package (title, description, links)
└── demo-video.mp4       # Demo video (< 3 min)
```

## Built with

Node.js, Express, PayPal Invoicing API v2 (sandbox), Google Gemini API (`gemini-3.6-flash`), vanilla HTML/CSS/JS (no frontend framework, no build step).

## AI tools used

- **Google Gemini `gemini-3.6-flash`** (via REST API) — parses every chat message into structured invoice JSON (recipient, items, amounts, currency, due dates).
- Development assistance from an AI coding agent (structure, boilerplate, docs).

## License

MIT
