// PayPilot backend — server.js
// ============================ RUN ============================
//   npm install
//   cp .env.example .env        # fill in GEMINI_API_KEY + PayPal creds
//   npm start                   # → http://localhost:3000
// Mock mode (no credentials): full chat → invoice flow works end-to-end.
// Live PayPal sandbox: set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and
// PAYPAL_MOCK=false (or unset PAYPAL_MOCK).
// ===============================================================

require("dotenv").config();
const path = require("path");
const express = require("express");
const { parseInvoiceRequest, isGeminiConfigured } = require("./lib/gemini");
const paypal = require("./lib/paypal");
const store = require("./lib/store");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serves public/ at /

const paypalMode = () => (paypal.isLiveMode() ? "live" : "mock");

// ---------- helpers ----------

function formatMoney(currency, total) {
  if (currency === "IDR") return `Rp${Number(total).toLocaleString("id-ID")}`;
  return `$${Number(total).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------- API ----------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode: paypalMode(),
    gemini: isGeminiConfigured(),
    paypal: paypalMode(),
  });
});

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    return res.json({
      reply: "Tulis permintaan invoice-nya, contoh: Tagih Budi budi@example.com Rp500.000 untuk desain logo, jatuh tempo minggu depan.",
      invoice: null,
      parsed: null,
      paypalMode: paypalMode(),
    });
  }

  // 1) AI not configured → graceful reply, HTTP 200, no crash.
  if (!isGeminiConfigured()) {
    return res.json({
      reply: "AI belum dikonfigurasi. Minta admin mengatur GEMINI_API_KEY di server, lalu coba lagi.",
      invoice: null,
      parsed: null,
      paypalMode: paypalMode(),
    });
  }

  // 2) Parse with Gemini.
  let parsed;
  try {
    parsed = await parseInvoiceRequest(message);
  } catch (err) {
    console.error("[gemini] parse failed:", err.message);
    return res.json({
      reply:
        "Maaf, AI gagal memahami permintaan itu (layanan AI sedang bermasalah). Coba lagi sebentar lagi, atau tulis dengan format: Tagih [nama] [email] Rp[jumlah] untuk [layanan], jatuh tempo [tanggal].",
      invoice: null,
      parsed: null,
      paypalMode: paypalMode(),
    });
  }
  if (!parsed) {
    return res.json({
      reply: "AI belum dikonfigurasi. Minta admin mengatur GEMINI_API_KEY di server, lalu coba lagi.",
      invoice: null,
      parsed: null,
      paypalMode: paypalMode(),
    });
  }

  // 3) Not an invoice request → clarifying question, no invoice.
  if (!parsed.isInvoiceRequest) {
    return res.json({
      reply:
        "Halo! Saya PayPilot — saya bisa membuat dan mengirim invoice PayPal dari pesan biasa. Coba tulis misalnya: Tagih Budi budi@example.com Rp500.000 untuk desain logo, jatuh tempo minggu depan.",
      invoice: null,
      parsed: null,
      paypalMode: paypalMode(),
    });
  }

  // 4) Missing recipient email → ask for it, do NOT create an invoice.
  if (!parsed.recipientEmail) {
    const name = parsed.recipientName || "penerima";
    return res.json({
      reply: `Saya sudah paham: tagih ${name} untuk ${parsed.items?.[0]?.name || "layanan"} sebesar ${formatMoney(parsed.currency, parsed.items?.reduce((s, i) => s + (i.quantity || 1) * i.unitPrice, 0) || 0)}${parsed.dueDate ? `, jatuh tempo ${parsed.dueDate}` : ""}. Boleh minta alamat email ${name} supaya invoice bisa dikirim?`,
      invoice: null,
      parsed,
      paypalMode: paypalMode(),
    });
  }

  // Missing items/amount → ask for the amount.
  if (!parsed.items || parsed.items.length === 0 || !parsed.items[0].unitPrice) {
    return res.json({
      reply: `Tagih ${parsed.recipientName} (${parsed.recipientEmail}) untuk apa dan berapa jumlahnya? Contoh: Rp500.000 untuk desain logo.`,
      invoice: null,
      parsed,
      paypalMode: paypalMode(),
    });
  }

  // 5) Create + send the invoice.
  try {
    let invoice;
    if (paypal.isLiveMode()) {
      const { id, number } = await paypal.createInvoiceLive(parsed);
      await paypal.sendInvoiceLive(id);
      const live = await paypal.getInvoiceLive(id);
      invoice = {
        id,
        number,
        recipientName: parsed.recipientName,
        recipientEmail: parsed.recipientEmail,
        currency: parsed.currency || "IDR",
        total: parsed.items.reduce((s, i) => s + (i.quantity || 1) * i.unitPrice, 0),
        dueDate: parsed.dueDate || null,
        status: live.status || "SENT",
        paymentUrl: live.paymentUrl,
        createdAt: new Date().toISOString(),
      };
    } else {
      // MOCK: simulated create + send, status SENT.
      invoice = paypal.mockCreateInvoice(parsed);
    }
    store.add(invoice);

    const reply = `Invoice ${invoice.number} berhasil dibuat dan dikirim ke ${invoice.recipientName} (${invoice.recipientEmail}).\nTotal: ${formatMoney(invoice.currency, invoice.total)}${invoice.dueDate ? `\nJatuh tempo: ${invoice.dueDate}` : ""}\nStatus: ${invoice.status}\nLink pembayaran: ${invoice.paymentUrl}`;
    return res.json({ reply, invoice, parsed, paypalMode: paypalMode() });
  } catch (err) {
    console.error("[paypal] create/send failed:", err.message);
    // Surface the PayPal error (name/status/message) so the user knows WHY
    // — e.g. a 403 NOT_AUTHORIZED means the sandbox app lacks the Invoicing
    // permission in the Developer Dashboard. Never a 500, never a crash.
    const detail = String(err.message || "unknown error").slice(0, 300);
    return res.json({
      reply:
        `Maaf, invoice gagal dibuat di PayPal. PayPal menolak permintaan ini: ${detail}\n` +
        "Coba lagi sebentar lagi, atau periksa izin Invoicing pada aplikasi PayPal (Developer Dashboard).",
      invoice: null,
      parsed,
      paypalMode: paypalMode(),
    });
  }
});

app.get("/api/invoices", (req, res) => {
  res.json({ invoices: store.list() });
});

app.get("/api/invoices/:id", async (req, res) => {
  const inv = store.get(req.params.id);
  if (!inv) return res.status(404).json({ error: "Invoice not found" });

  // Live mode: refresh status from PayPal first.
  if (paypal.isLiveMode()) {
    try {
      const live = await paypal.getInvoiceLive(inv.id);
      store.update(inv.id, { status: live.status, paymentUrl: live.paymentUrl });
    } catch (err) {
      console.error("[paypal] status refresh failed:", err.message);
      // Fall through with the stored copy.
    }
  }
  res.json(store.get(req.params.id));
});

app.post("/api/invoices/:id/mock-pay", (req, res) => {
  // MOCK MODE ONLY.
  if (paypal.isLiveMode()) {
    return res.status(404).json({ error: "mock-pay is only available in mock mode" });
  }
  const inv = store.get(req.params.id);
  if (!inv) return res.status(404).json({ error: "Invoice not found" });
  store.update(inv.id, { status: "PAID" });
  res.json(store.get(req.params.id));
});

// ---------- root ----------

app.get("/", (req, res) => {
  // express.static already serves public/index.html when present;
  // this fallback covers the case where public/ is empty/missing.
  res.json({
    ok: true,
    name: "PayPilot",
    message: "PayPilot backend is running. Use POST /api/chat to create invoices.",
    mode: paypalMode(),
  });
});

app.listen(PORT, () => {
  console.log(`PayPilot backend listening on http://localhost:${PORT} (mode: ${paypalMode()}, gemini: ${isGeminiConfigured() ? "configured" : "not configured"})`);
});
