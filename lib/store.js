// PayPilot backend — lib/store.js
// In-memory invoice store (no DB). Newest first on list.

const invoices = []; // newest first (unshift on insert)

function add(invoice) {
  invoices.unshift(invoice);
  return invoice;
}

function list() {
  return [...invoices];
}

function get(id) {
  return invoices.find((inv) => inv.id === id) || null;
}

function update(id, patch) {
  const inv = get(id);
  if (!inv) return null;
  Object.assign(inv, patch);
  return inv;
}

module.exports = { add, list, get, update };
