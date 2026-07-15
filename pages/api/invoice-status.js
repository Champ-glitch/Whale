import { getInvoice } from "../../lib/kv.js";

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "Missing code" });

  const invoice = await getInvoice(code);
  if (!invoice) return res.status(404).json({ error: "Not found" });

  return res.status(200).json({ status: invoice.status });
}
