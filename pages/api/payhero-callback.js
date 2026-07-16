import { sendTelegramMessage, sendTelegramAnimation } from "../../lib/telegram.js";
import { kesToUsdt } from "../../lib/rates.js";
import { getRandomQuote, getRandomGif } from "../../lib/extras.js";
import { parseReference } from "../../lib/reference.js";
import { updateInvoiceStatus } from "../../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  try {
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
    const senderPhone = response.Phone;
    const mpesaReceipt = response.MpesaReceiptNumber;

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
        (senderPhone ? `From: ${senderPhone}\n` : "") +
        (mpesaReceipt ? `M-Pesa Receipt: ${mpesaReceipt}\n` : "") +
        `Reference: \`${rawReference}\`\n\n` +
        `_${quote}_`;

      await sendTelegramAnimation(chatId, getRandomGif(), caption);
    } else {
      await sendTelegramMessage(
        chatId,
        `❌ Payment not completed (cancelled or failed). Reference: \`${rawReference}\``
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("payhero-callback error:", err);
    const owner = process.env.OWNER_CHAT_ID;
    if (owner) {
      try {
        await sendTelegramMessage(owner, `🚨 *System error in payment callback*\n\`${err.message}\`\n\nCheck Vercel logs for details.`);
      } catch (e) {
        console.error("Failed to send error alert:", e);
      }
    }
    // Always return 200 so PayHero doesn't endlessly retry a broken callback
    return res.status(200).json({ ok: true });
  }
}
