import { createSTKPush } from '../lib/makamesco';
import { getInvoice, updateInvoiceStatus, isLockedOut, recordFailedAttempt, checkRateLimit } from '../lib/kv';
import { buildReference } from '../lib/reference';

function formatPhone(phone) {
  if (!phone) return null;
  let p = phone.replace(/[\D\g, ""]/);
  if (p.startsWith("0") && p.length === 10) p = "254" + p.slice(1);
  if (p.startsWith("7") && p.length === 9) p = "254" + p;
  if (p.startsWith("254") && p.length === 12) return p;
  return null;
}

export default async function handler(req, res) {
  if (req.method!== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, phoneNumber, phone } = req.body || {};
  const finalPhone = phoneNumber || phone;

  if (!code ||!finalPhone) {
    return res.status(400).json({ error: "Missing code or phone number" });
  }

  const formattedPhone = formatPhone(finalPhone);

  if (!formattedPhone || formattedPhone.length!== 12 ||!formattedPhone.startsWith("254")) {
    return res.status(400).json({ error: "Invalid phone number. Use 07XX XXX XXX or 2547XX XXX XXX" });
  }

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
    await createSTKPush({
      amount: invoice.amount,
      phone: formattedPhone,
      accountReference: reference,
    });
    return res.status(200).json({ ok: true, message: "STK sent" });
  } catch (err) {
    await updateInvoiceStatus(code, "failed");
    await recordFailedAttempt(code);
    return res.status(500).json({ error: err.message || "Failed to send STK" });
  }
}
