// lib/kv.js
// Thin wrapper around Vercel's Upstash Redis REST API.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvCommand(command) {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  return data.result;
}

// ---- Invoices ----

// Store invoice data with a 48-hour expiry (auto-cleans itself, nothing to maintain)
export async function saveInvoice(code, invoiceData) {
  const value = JSON.stringify(invoiceData);
  await kvCommand(["SET", `invoice:${code}`, value, "EX", 60 * 60 * 48]);
}

export async function getInvoice(code) {
  const value = await kvCommand(["GET", `invoice:${code}`]);
  if (!value) return null;
  return JSON.parse(value);
}

export async function updateInvoiceStatus(code, status) {
  const invoice = await getInvoice(code);
  if (!invoice) return;
  invoice.status = status;
  await saveInvoice(code, invoice);
}

// Lists recent invoices. Uses KEYS (fine at this volume - only invoices within
// the 48h TTL window ever exist, so the key count stays small).
export async function listInvoices(limit = 20) {
  const keys = await kvCommand(["KEYS", "invoice:*"]);
  if (!keys || keys.length === 0) return [];

  const invoices = [];
  for (const key of keys) {
    const value = await kvCommand(["GET", key]);
    if (value) {
      const data = JSON.parse(value);
      invoices.push({ code: key.replace("invoice:", ""), ...data });
    }
  }
  invoices.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return invoices.slice(0, limit);
}

export async function deleteInvoice(code) {
  await kvCommand(["DEL", `invoice:${code}`]);
}

// ---- Rate limiting ----
// Returns true if the action is allowed, false if the limit was hit.
// Uses a simple fixed-window counter per key.
export async function checkRateLimit(key, maxCount, windowSeconds) {
  const rateKey = `ratelimit:${key}`;
  const count = await kvCommand(["INCR", rateKey]);
  if (count === 1) {
    await kvCommand(["EXPIRE", rateKey, windowSeconds]);
  }
  return count <= maxCount;
}

// ---- Pending large-payment confirmations ----
export async function savePendingPay(chatId, data) {
  await kvCommand(["SET", `pendingpay:${chatId}`, JSON.stringify(data), "EX", 120]);
}

export async function getPendingPay(chatId) {
  const value = await kvCommand(["GET", `pendingpay:${chatId}`]);
  if (!value) return null;
  return JSON.parse(value);
}

export async function clearPendingPay(chatId) {
  await kvCommand(["DEL", `pendingpay:${chatId}`]);
}
export async function recordFailedAttempt(code) {
  const key = `failcount:${code}`;
  const count = await kvCommand(["INCR", key]);
  if (count === 1) {
    await kvCommand(["EXPIRE", key, 60 * 15]); // 15 minute window
  }
  return count;
}

export async function isLockedOut(code, maxAttempts = 5) {
  const count = await kvCommand(["GET", `failcount:${code}`]);
  return count && Number(count) >= maxAttempts;
}
