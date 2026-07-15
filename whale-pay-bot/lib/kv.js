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
