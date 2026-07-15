import { sendTelegramMessage, sendTelegramAnimation } from "../../lib/telegram.js";
import { kesToUsdt } from "../../lib/rates.js";
import { getRandomQuote, SUCCESS_GIF_URL } from "../../lib/extras.js";
import { parseReference } from "../../lib/reference.js";
import { updateInvoiceStatus } from "../../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const body = req.body;
  console.log("PayHero callback:", JSON.stringify(body));

  const response = body?.response || {};
  const rawReference =
    response.ExternalReference || body?.external_reference || body?.reference;

  const parsed = parseReference(rawReference);

  if (!parsed) {
    console.warn("Could not parse reference:", rawReference);
    return res.status(200).json({ ok: true });
  }

  const { chatId, invoiceCode } = parsed;
  const success = response.ResultCode === 0 || response.Status === "Success";
  const amount = response.Amount;

  if (invoiceCode) {
    await updateInvoiceStatus(invoiceCode, success ? "success" : "failed");
  }

  if (success) {
    let usdtLine = "";
    if (amount) {
      const usdt = await kesToUsdt(amount);
      if (usdt) usdtLine = `\n💵 ≈ ${usdt} USDT`;
    }

    const quote = getRandomQuote();
    const caption =
      `✅ *Payment received!*\n` +
      `KES ${amount ?? "?"}${usdtLine}\n` +
      `Reference: \`${rawReference}\`\n\n` +
      `_${quote}_`;

    await sendTelegramAnimation(chatId, SUCCESS_GIF_URL, caption);
  } else {
    await sendTelegramMessage(
      chatId,
      `❌ Payment not completed (cancelled or failed). Reference: \`${rawReference}\``
    );
  }

  return res.status(200).json({ ok: true });
}
