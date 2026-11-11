/* PayPilot frontend — vanilla JS, no external dependencies.
   Talks to the backend API (same origin):
   GET  /api/health
   POST /api/chat            { message } -> { reply, invoice, parsed, paypalMode }
   GET  /api/invoices       -> { invoices: [...] } newest first
   GET  /api/invoices/:id   -> single invoice
   POST /api/invoices/:id/mock-pay  (mock mode only)
*/
(function () {
  "use strict";

  var chatEl = document.getElementById("chat");
  var formEl = document.getElementById("chat-form");
  var inputEl = document.getElementById("chat-input");
  var sendBtn = document.getElementById("send-btn");
  var badgeEl = document.getElementById("mode-badge");
  var chipsEl = document.getElementById("chips");
  var listEl = document.getElementById("invoice-list");
  var emptyEl = document.getElementById("invoice-empty");
  var countEl = document.getElementById("invoice-count");
  var refreshBtn = document.getElementById("refresh-btn");

  var health = null; // { ok, mode, gemini, paypal }
  var pending = false;
  var typingEl = null;

  /* ---------- helpers ---------- */

  function scrollChat() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function formatMoney(total, currency) {
    var cur = (currency || "USD").toUpperCase();
    var n = Number(total);
    if (!isFinite(n)) return escapeHtml(String(total == null ? "" : total));
    try {
      if (cur === "IDR") {
        return new Intl.NumberFormat("id-ID", {
          style: "currency", currency: "IDR", maximumFractionDigits: 0
        }).format(n);
      }
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency: cur
      }).format(n);
    } catch (e) {
      return cur + " " + n.toLocaleString("en-US");
    }
  }

  function formatDate(d) {
    if (!d) return "—";
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  }

  function statusClass(status) {
    var s = String(status || "").toUpperCase();
    if (s === "PAID") return "pill-paid";
    if (s === "SENT") return "pill-sent";
    if (s === "DRAFT") return "pill-draft";
    return "pill-draft";
  }

  function pillHtml(status) {
    var s = String(status || "DRAFT").toUpperCase();
    return '<span class="pill ' + statusClass(s) + '">' + escapeHtml(s) + "</span>";
  }

  function setPending(on) {
    pending = on;
    inputEl.disabled = on;
    sendBtn.disabled = on;
    Array.prototype.forEach.call(chipsEl.querySelectorAll(".chip"), function (c) {
      c.disabled = on;
    });
  }

  function addMessage(text, kind) {
    var div = document.createElement("div");
    div.className = "message " + (kind || "assistant");
    div.textContent = text;
    chatEl.appendChild(div);
    scrollChat();
    return div;
  }

  function showTyping() {
    typingEl = document.createElement("div");
    typingEl.className = "message assistant typing";
    typingEl.innerHTML = '<span class="typing-dots">PayPilot sedang menulis invoice</span>';
    chatEl.appendChild(typingEl);
    scrollChat();
  }

  function hideTyping() {
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  /* ---------- invoice card (in chat) ---------- */

  function invoiceCardHtml(inv) {
    var paid = String(inv.status || "").toUpperCase() === "PAID";
    var canMockPay = health && health.paypal === "mock" &&
      String(inv.status || "").toUpperCase() === "SENT";
    var html =
      '<div class="invoice-card' + (paid ? " paid" : "") + '" id="card-' + escapeHtml(inv.id) + '">' +
      "<h3>Invoice " + escapeHtml(inv.recipientName || "—") + "</h3>" +
      '<p class="inv-number">' + escapeHtml(inv.number || inv.id || "") + " &nbsp;·&nbsp; " + pillHtml(inv.status) + "</p>" +
      '<div class="inv-total">' + formatMoney(inv.total, inv.currency) + "</div>" +
      "<dl>" +
      "<dt>Penerima</dt><dd>" + escapeHtml(inv.recipientName || "—") + "</dd>" +
      "<dt>Email</dt><dd>" + escapeHtml(inv.recipientEmail || "—") + "</dd>" +
      "<dt>Jatuh tempo</dt><dd>" + escapeHtml(formatDate(inv.dueDate)) + "</dd>" +
      "<dt>Mata uang</dt><dd>" + escapeHtml(inv.currency || "—") + "</dd>" +
      "</dl>" +
      '<div class="card-actions">';
    if (inv.paymentUrl) {
      html += '<a class="btn btn-primary" href="' + escapeHtml(inv.paymentUrl) +
        '" target="_blank" rel="noopener noreferrer">Buka Link Bayar</a>' +
        '<button type="button" class="btn btn-secondary copy-link" data-url="' +
        escapeHtml(inv.paymentUrl) + '">Salin Link</button>';
    }
    if (canMockPay) {
      html += '<button type="button" class="btn btn-green mock-pay" data-id="' +
        escapeHtml(inv.id) + '">Simulasikan Pembayaran</button>';
    }
    html += "</div></div>";
    return html;
  }

  function renderInvoiceCard(inv) {
    var wrap = document.createElement("div");
    wrap.innerHTML = invoiceCardHtml(inv);
    chatEl.appendChild(wrap.firstChild);
    scrollChat();
  }

  /* ---------- invoice list (sidebar) ---------- */

  function rowHtml(inv) {
    return '<div class="row-top"><span class="row-name">' + escapeHtml(inv.recipientName || "—") +
      '</span>' + pillHtml(inv.status) + "</div>" +
      '<div class="row-meta"><span>' + escapeHtml(inv.number || "") + "</span>" +
      '<span class="row-total">' + formatMoney(inv.total, inv.currency) + "</span></div>" +
      '<div class="row-detail">' +
      "Email: " + escapeHtml(inv.recipientEmail || "—") + "<br>" +
      "Jatuh tempo: " + escapeHtml(formatDate(inv.dueDate)) + "<br>" +
      "Dibuat: " + escapeHtml(formatDate(inv.createdAt)) +
      '<div class="row-actions">' +
      (inv.paymentUrl
        ? '<a class="btn btn-primary" href="' + escapeHtml(inv.paymentUrl) +
          '" target="_blank" rel="noopener noreferrer">Buka Link Bayar</a>'
        : "") +
      "</div></div>";
  }

  function renderInvoiceList(invoices) {
    listEl.innerHTML = "";
    var items = Array.isArray(invoices) ? invoices : [];
    emptyEl.style.display = items.length ? "none" : "";
    countEl.textContent = items.length
      ? items.length + " invoice" + (items.length > 1 ? "s" : "")
      : "";
    items.forEach(function (inv) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "invoice-row";
      btn.dataset.id = inv.id;
      btn.innerHTML = rowHtml(inv);
      btn.addEventListener("click", function (ev) {
        // Let link clicks inside the detail area work normally.
        if (ev.target.closest("a")) return;
        var expanded = btn.classList.toggle("expanded");
        if (expanded) {
          var card = document.getElementById("card-" + CSS.escape(String(inv.id)));
          if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  async function loadInvoices() {
    try {
      var res = await fetch("/api/invoices");
      if (!res.ok) throw new Error("HTTP " + res.status);
      var data = await res.json();
      renderInvoiceList(data.invoices || []);
    } catch (e) {
      countEl.textContent = "Gagal memuat daftar invoice.";
    }
  }

  /* ---------- health / mode badge ---------- */

  async function loadHealth() {
    try {
      var res = await fetch("/api/health");
      if (!res.ok) throw new Error("HTTP " + res.status);
      health = await res.json();
      var paypalMode = String(health.paypal || health.mode || "mock").toLowerCase();
      if (paypalMode === "live") {
        badgeEl.textContent = "LIVE SANDBOX";
        badgeEl.className = "mode-badge mode-live";
      } else {
        badgeEl.textContent = "MOCK SANDBOX";
        badgeEl.className = "mode-badge mode-mock";
      }
      badgeEl.title = "Backend: " + (health.mode || "?") +
        " · Gemini: " + (health.gemini ? "aktif" : "nonaktif") +
        " · PayPal: " + paypalMode;
    } catch (e) {
      health = null;
      badgeEl.textContent = "Offline";
      badgeEl.className = "mode-badge mode-unknown";
      badgeEl.title = "Backend tidak dapat dijangkau";
    }
  }

  /* ---------- mock pay ---------- */

  async function mockPay(id, btn) {
    if (!id) return;
    btn.disabled = true;
    btn.textContent = "Memproses…";
    try {
      var res = await fetch("/api/invoices/" + encodeURIComponent(id) + "/mock-pay", {
        method: "POST"
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var updated = await res.json();
      var inv = updated.invoice || updated;
      addMessage("Pembayaran simulasi berhasil — invoice " + (inv.number || id) +
        " kini berstatus PAID.", "assistant");
      // Replace the card in chat if present.
      var oldCard = document.getElementById("card-" + CSS.escape(String(id)));
      if (oldCard) {
        var wrap = document.createElement("div");
        wrap.innerHTML = invoiceCardHtml(inv);
        oldCard.replaceWith(wrap.firstChild);
      }
      await loadInvoices();
    } catch (e) {
      addMessage("Gagal mensimulasikan pembayaran: " + e.message +
        ". Pastikan backend berjalan dalam mode mock.", "error");
      btn.disabled = false;
      btn.textContent = "Simulasikan Pembayaran";
    }
  }

  /* ---------- chat send ---------- */

  async function sendMessage(text) {
    var message = String(text || "").trim();
    if (!message || pending) return;
    addMessage(message, "user");
    inputEl.value = "";
    setPending(true);
    showTyping();
    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message })
      });
      hideTyping();
      if (!res.ok) throw new Error("Server menjawab HTTP " + res.status);
      var data = await res.json();
      if (data.reply) addMessage(data.reply, "assistant");
      if (data.invoice) renderInvoiceCard(data.invoice);
      if (!data.reply && !data.invoice) {
        addMessage("PayPilot tidak mengembalikan jawaban. Coba lagi.", "error");
      }
      await loadInvoices();
    } catch (e) {
      hideTyping();
      addMessage("Terjadi kesalahan: " + e.message +
        ". Periksa koneksi ke backend lalu coba lagi.", "error");
    } finally {
      setPending(false);
      inputEl.focus();
    }
  }

  /* ---------- events ---------- */

  formEl.addEventListener("submit", function (ev) {
    ev.preventDefault();
    sendMessage(inputEl.value);
  });

  chipsEl.addEventListener("click", function (ev) {
    var chip = ev.target.closest(".chip");
    if (!chip || pending) return;
    sendMessage(chip.dataset.prompt);
  });

  refreshBtn.addEventListener("click", loadInvoices);

  // Delegated clicks: copy link + mock-pay inside invoice cards.
  chatEl.addEventListener("click", function (ev) {
    var copyBtn = ev.target.closest(".copy-link");
    if (copyBtn) {
      var url = copyBtn.dataset.url;
      var done = function () { copyBtn.textContent = "Tersalin"; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
      } else {
        fallbackCopy(url); done();
      }
      setTimeout(function () { copyBtn.textContent = "Salin Link"; }, 2000);
      return;
    }
    var payBtn = ev.target.closest(".mock-pay");
    if (payBtn) mockPay(payBtn.dataset.id, payBtn);
  });

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* clipboard unavailable */ }
    ta.remove();
  }

  /* ---------- init ---------- */

  addMessage(
    "Halo, saya PayPilot. Tulis saja siapa yang mau ditagih, berapa jumlahnya, dan untuk apa — " +
    "saya buatkan invoice PayPal-nya. Contohnya ada di bawah.",
    "assistant"
  );
  loadHealth();
  loadInvoices();
})();
