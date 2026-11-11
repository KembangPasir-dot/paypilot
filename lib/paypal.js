// PayPilot backend — lib/paypal.js
// PayPal Invoicing API (sandbox) + a fully offline MOCK mode.
// LIVE when PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are set and
// PAYPAL_MOCK is not "true". Otherwise MOCK — everything is simulated so
// the full flow works end-to-end with zero credentials.
// Mock responses are clearly labeled in comments below.

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

function isLiveMode() {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET &&
      process.env.PAYPAL_MOCK !== "true"
  );
}

// ---- token cache (live mode) ----
let cachedToken = null; // { token, expiresAtMs }

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs - 60_000) {
    return cachedToken.token;
  }
  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch(`${SANDBOX_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal token ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAtMs: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.token;
}

async function paypalFetch(path, { method = "GET", body } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${SANDBOX_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`PayPal ${method} ${path} ${res.status}: ${text.slice(0, 400)}`);
  }
  return { status: res.status, data };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { given_name: ".", surname: "." };
  if (parts.length === 1) return { given_name: parts[0], surname: "." };
  return { given_name: parts[0], surname: parts.slice(1).join(" ") };
}

function moneyValue(n) {
  // String with exactly 2 decimals, from a plain number (no floats in math).
  return Number(n).toFixed(2);
}

function uniqueInvoiceNumber() {
  // PP-<base36 timestamp + random> — unique per invoice.
  return `PP-${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

// ---- LIVE mode ----

async function createInvoiceLive(parsed) {
  const currency = parsed.currency || "IDR";
  const invoiceNumber = uniqueInvoiceNumber();
  const detail = {
    invoice_number: invoiceNumber,
    invoice_date: todayISO(),
    currency_code: currency,
    note: parsed.note || undefined,
  };
  if (parsed.dueDate) {
    detail.payment_term = {
      term_type: "DUE_ON_DATE_SPECIFIED",
      due_date: parsed.dueDate,
    };
  } else {
    detail.payment_term = { term_type: "NET_7" };
  }

  const body = {
    detail,
    primary_recipients: [
      {
        billing_info: {
          name: splitName(parsed.recipientName),
          email_address: parsed.recipientEmail,
        },
      },
    ],
    items: parsed.items.map((it) => ({
      name: it.name,
      quantity: String(it.quantity || 1),
      unit_amount: { currency_code: currency, value: moneyValue(it.unitPrice) },
    })),
  };

  const { data } = await paypalFetch("/v2/invoicing/invoices", {
    method: "POST",
    body,
  });
  return { id: data.id, number: invoiceNumber };
}

async function sendInvoiceLive(id) {
  await paypalFetch(`/v2/invoicing/invoices/${id}/send`, {
    method: "POST",
    body: { send_to_recipient: true },
  });
}

async function getInvoiceLive(id) {
  const { data } = await paypalFetch(`/v2/invoicing/invoices/${id}`);
  const payerLink = (data.links || []).find((l) => l.rel === "payer-view");
  const total = (data.amount && data.amount.value) || null;
  const currency = (data.amount && data.amount.currency_code) || null;
  return {
    id: data.id,
    number: data.detail?.invoice_number || null,
    recipientName: data.primary_recipients?.[0]?.billing_info?.name
      ? [
          data.primary_recipients[0].billing_info.name.given_name,
          data.primary_recipients[0].billing_info.name.surname,
        ]
          .filter((p) => p && p !== ".")
          .join(" ")
      : null,
    recipientEmail: data.primary_recipients?.[0]?.billing_info?.email_address || null,
    currency,
    total: total != null ? Number(total) : null,
    dueDate: data.detail?.payment_term?.due_date || null,
    status: data.status,
    paymentUrl:
      payerLink?.href || `https://www.sandbox.paypal.com/invoice/p/#${data.id}`,
    createdAt: data.detail?.invoice_date || null,
  };
}

// ---- MOCK mode (simulated, no network, no credentials) ----

function randomGroup(len) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function mockInvoiceId() {
  // MOCK: invoice id in the real PayPal shape INV2-XXXX-XXXX-XXXX-XXXX
  return `INV2-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

function mockCreateInvoice(parsed) {
  // MOCK: simulate create + send in one step; status SENT after send.
  const currency = parsed.currency || "IDR";
  const total = parsed.items.reduce(
    (sum, it) => sum + (it.quantity || 1) * it.unitPrice,
    0
  );
  const id = mockInvoiceId();
  return {
    id,
    number: uniqueInvoiceNumber(),
    recipientName: parsed.recipientName,
    recipientEmail: parsed.recipientEmail,
    currency,
    total,
    dueDate: parsed.dueDate || null,
    status: "SENT",
    paymentUrl: `https://www.sandbox.paypal.com/invoice/p/#${id}`,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  isLiveMode,
  createInvoiceLive,
  sendInvoiceLive,
  getInvoiceLive,
  mockCreateInvoice,
};
