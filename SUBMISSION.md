# PayPilot — Devpost Submission Package

Ready to paste into Devpost (https://paypalaihackathon.devpost.com/). The user submits this himself — do NOT submit on his behalf.

## Project title

PayPilot

## Tagline

Tagih siapa pun lewat chat — AI turns plain language into PayPal invoices.

## Description (for the Devpost "Tell us about your project" field)

**Inspiration.** Small freelancers and sellers lose time (and money) to invoicing: open a dashboard, fill a form, copy a link, chase the payment. We asked: what if sending an invoice was as easy as sending a chat message?

**What it does.** PayPilot is an AI chat agent that turns a plain-language request — in Indonesian or English — into a real PayPal invoice with a shareable payment link. Type "Invoice Sarah sarah@example.com $120 for consulting, due Friday" and PayPilot: (1) uses Google Gemini to parse the message into structured invoice data (recipient, items, amount, currency, due date — relative dates like "due Friday" resolved correctly); (2) creates and sends the invoice through the PayPal Invoicing API v2 (sandbox); (3) returns the PayPal payment link and shows the live SENT status in the chat and the invoice list (the list refreshes status from PayPal, so a payment flips it to PAID). The demo video shows this live sandbox flow end to end. Mock mode (no credentials) still runs the whole flow offline, including a one-click simulated payment.

**How we built it.** Node.js + Express backend, vanilla HTML/CSS/JS frontend (no build step). Gemini is called via the REST API (`gemini-3.6-flash`, JSON mode, temperature 0.2) with a prompt that encodes Indonesian amount rules ("500 ribu" = 500000 IDR, "1,5 juta" = 1500000) and relative-date resolution. PayPal is integrated via OAuth2 client-credentials + Invoicing API v2 (create draft → send → get status + payer-view link). The app ships a clearly-labeled mock mode so the whole flow works end-to-end with zero credentials, and switches to the real sandbox automatically when credentials are configured.

**Challenges we ran into.** The PayPal sandbox app's credentials validated fine for OAuth, but invoice calls returned 403 NOT_AUTHORIZED — the app's token carried payments scopes but no invoicing scope, so the Invoicing permission had to be enabled on the app in the Developer Dashboard and took ~30 minutes to propagate. Two more live-mode gotchas followed: the create-invoice 201 response carries the invoice id only in its self-link href, not in the body, so our first version read data.id, got undefined, and broke the send step; and PayPal Invoicing rejects IDR ("Currency Code is not valid"), so the live demo uses USD. We made the app surface PayPal errors in the chat instead of crashing, and kept mock mode as a fully working fallback. We also learned the Gemini free tier rate-limits bursts, so the demo paces its AI calls.

**What's next.** Live PayPal sandbox end-to-end is now demonstrated in the demo video; next: payment reminders; multi-item and recurring invoices; IDR/multi-currency support; WhatsApp/Telegram front-ends for the same agent.

## Built with

Node.js, Express, PayPal Invoicing API v2, Google Gemini API, JavaScript, HTML, CSS

## AI tools used

- Google Gemini `gemini-3.6-flash` (REST API) — parses every chat message into structured invoice JSON.
- AI coding agent assistance during development (structure, boilerplate, documentation).

## Links

- **Public repo:** https://github.com/KembangPasir-dot/paypilot
- **Demo video:** https://www.youtube.com/watch?v=VjSsZMDlApo (Unlisted, 24 seconds; also in the repo as `demo-video.mp4`)
- **Live demo / run instructions:** clone the repo, `npm install`, copy `.env.example` to `.env` and add a `GEMINI_API_KEY` (Google AI Studio, free tier works), then `npm start` → http://localhost:3000. No PayPal credentials needed: the app runs in mock mode and the full chat → invoice → payment-link flow works end-to-end. With PayPal sandbox credentials (`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`, `PAYPAL_MOCK=false`) it uses the real sandbox Invoicing API — the sandbox app needs the Invoicing permission enabled in the Developer Dashboard. The demo video shows the live sandbox flow (USD invoice — PayPal Invoicing does not accept IDR).

## Submission checklist (Devpost requirements)

- [x] Working project using PayPal + AI (both are core to the flow)
- [x] Text description (above)
- [x] Functional demo (run instructions above; demo video)
- [x] AI tools used listed (above)
- [x] Public open-source repo (push first — see PUSH-INSTRUCTIONS.md)
- [x] Demo video under 3 minutes (`demo-video.mp4`)
