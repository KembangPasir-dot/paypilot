# PayPilot — Devpost Submission Package

Ready to paste into Devpost (https://paypalaihackathon.devpost.com/). The user submits this himself — do NOT submit on his behalf.

## Project title

PayPilot

## Tagline

Tagih siapa pun lewat chat — AI turns plain language into PayPal invoices.

## Description (for the Devpost "Tell us about your project" field)

**Inspiration.** Small freelancers and sellers lose time (and money) to invoicing: open a dashboard, fill a form, copy a link, chase the payment. We asked: what if sending an invoice was as easy as sending a chat message?

**What it does.** PayPilot is an AI chat agent that turns a plain-language request — in Indonesian or English — into a real PayPal invoice with a shareable payment link. Type "Tagih Budi budi@example.com Rp500.000 untuk desain logo, jatuh tempo minggu depan" and PayPilot: (1) uses Google Gemini to parse the message into structured invoice data (recipient, items, amount, currency, due date — relative dates like "minggu depan" resolved correctly); (2) creates and sends the invoice through the PayPal Invoicing API v2 (sandbox); (3) returns the PayPal payment link and tracks the invoice status (SENT → PAID) in a live list. A one-click "Simulasikan Pembayaran" (mock mode) demonstrates the full payment lifecycle.

**How we built it.** Node.js + Express backend, vanilla HTML/CSS/JS frontend (no build step). Gemini is called via the REST API (`gemini-3.6-flash`, JSON mode, temperature 0.2) with a prompt that encodes Indonesian amount rules ("500 ribu" = 500000 IDR, "1,5 juta" = 1500000) and relative-date resolution. PayPal is integrated via OAuth2 client-credentials + Invoicing API v2 (create draft → send → get status + payer-view link). The app ships a clearly-labeled mock mode so the whole flow works end-to-end with zero credentials, and switches to the real sandbox automatically when credentials are configured.

**Challenges we ran into.** The PayPal sandbox app's credentials validated fine for OAuth, but invoice calls returned 403 NOT_AUTHORIZED — the app's token carried payments scopes but no invoicing scope, so the Invoicing permission had to be enabled on the app in the Developer Dashboard. We made the app surface that exact error in the chat instead of crashing, and kept mock mode as a fully working fallback. We also learned the Gemini free tier rate-limits bursts, so the demo paces its AI calls.

**What's next.** Live PayPal sandbox end-to-end once the Invoicing permission is enabled on the app; payment reminders; multi-item and recurring invoices; WhatsApp/Telegram front-ends for the same agent.

## Built with

Node.js, Express, PayPal Invoicing API v2, Google Gemini API, JavaScript, HTML, CSS

## AI tools used

- Google Gemini `gemini-3.6-flash` (REST API) — parses every chat message into structured invoice JSON.
- AI coding agent assistance during development (structure, boilerplate, documentation).

## Links

- **Public repo:** https://github.com/KembangPasir-dot/paypilot
  (Repo is prepared locally and committed; push it first — see PUSH-INSTRUCTIONS.md — then replace KembangPasir-dot with your GitHub username.)
- **Demo video:** `demo-video.mp4` in the repo root (under 3 minutes). Upload it to YouTube (unlisted) or attach it on Devpost and paste the URL here.
- **Live demo / run instructions:** clone the repo, `npm install`, copy `.env.example` to `.env` and add a `GEMINI_API_KEY` (Google AI Studio, free tier works), then `npm start` → http://localhost:3000. No PayPal credentials needed: the app runs in mock mode and the full chat → invoice → payment-link flow works end-to-end. With PayPal sandbox credentials (`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`, `PAYPAL_MOCK=false`) it uses the real sandbox Invoicing API — the sandbox app needs the Invoicing permission enabled in the Developer Dashboard.

## Submission checklist (Devpost requirements)

- [x] Working project using PayPal + AI (both are core to the flow)
- [x] Text description (above)
- [x] Functional demo (run instructions above; demo video)
- [x] AI tools used listed (above)
- [x] Public open-source repo (push first — see PUSH-INSTRUCTIONS.md)
- [x] Demo video under 3 minutes (`demo-video.mp4`)
