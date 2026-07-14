import { initiateSTKPush } from "../../lib/payhero.js";
import { getInvoice, markInvoiceUsed } from "../../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, phoneNumber } = req.body || {};

  if (!code || !phoneNumber) {
    return res.status(400).json({ error: "Missing code or phone number" });
  }

  const invoice = await getInvoice(code);

  if (!invoice) {
    return res.status(404).json({ error: "Invoice not found or expired" });
  }

  if (invoice.status === "used") {
    return res.status(410).json({ error: "This link has already been used" });
  }

  await markInvoiceUsed(code);

  const reference = `WHALE-${invoice.chatId}-${Date.now()}`;

  try {
    await initiateSTKPush({
      amount: invoice.amount,
      phoneNumber,
      reference,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Invoice STK push error:", err);
    return res.status(500).json({ error: err.message });
  }
}
