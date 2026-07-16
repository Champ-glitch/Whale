// pages/api/invoice-pay.js
// Called from the public /pay/[code] page when a client submits their phone number.

import { initiateSTKPush } from "../../lib/payhero.js";
import { getInvoice, updateInvoiceStatus, isLockedOut, recordFailedAttempt, checkRateLimit } from "../../lib/kv.js";
import { buildReference } from "../../lib/reference.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, phoneNumber } = req.body || {};

  if (!code || !phoneNumber) {
    return res.status(400).json({ error: "Missing code or phone number" });
  }

  // Basic abuse protection: cap attempts per invoice code and per IP.
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  const ipAllowed = await checkRateLimit(`invoicepay-ip:${ip}`, 10, 60);
  if (!ipAllowed) {
    return res.status(429).json({ error: "Too many attempts. Please wait a moment and try again." });
  }

  const locked = await isLockedOut(code);
  if (locked) {
    return res.status(429).json({ error: "Too many failed attempts on this invoice. Please contact support." });
  }

  const invoice = await getInvoice(code);

  if (!invoice) {
    return res.status(404).json({ error: "Invoice not found or expired" });
  }

  if (invoice.status === "success") {
    return res.status(410).json({ error: "This invoice has already been paid" });
  }

  await updateInvoiceStatus(code, "processing");

  const reference = buildReference(invoice.chatId, code);

  try {
    await initiateSTKPush({
      amount: invoice.amount,
      phoneNumber,
      reference,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Invoice STK push error:", err);
    await updateInvoiceStatus(code, "failed");
    await recordFailedAttempt(code);
    return res.status(500).json({ error: err.message });
  }
}
