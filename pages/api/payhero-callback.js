import { sendTelegramMessage, sendTelegramAnimation } from "../../lib/telegram.js";
import { kesToUsdt } from "../../lib/rates.js";
import { getRandomQuote, SUCCESS_GIF_URL } from "../../lib/extras.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const body = req.body;
  console.log("PayHero callback:", JSON.stringify(body));

  const response = body?.response || {};
  const reference =
    response.ExternalReference || body?.external_reference || body?.reference;

  const chatIdMatch = typeof reference === "string" ? reference.match(/^WHALE-(-?\d+)-/) : null;

  if (!chatIdMatch) {
    console.warn("Could not extract chat_id from reference:", reference);
    return res.status(200).json({ ok: true });
  }

  const chatId = chatIdMatch[1];
  const success = response.ResultCode === 0 || response.Status === "Success";
  const amount = response.Amount;

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
      `Reference: \`${reference}\`\n\n` +
      `_${quote}_`;

    await sendTelegramAnimation(chatId, SUCCESS_GIF_URL, caption);
  } else {
    await sendTelegramMessage(
      chatId,
      `❌ Payment not completed (cancelled or failed). Reference: \`${reference}\``
    );
  }

  return res.status(200).json({ ok: true });
}
