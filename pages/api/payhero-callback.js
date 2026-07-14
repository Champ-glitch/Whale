import { sendTelegramMessage } from "../../lib/telegram.js";

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

  if (success) {
    await sendTelegramMessage(chatId, `✅ Payment received! Reference: \`${reference}\``);
  } else {
    await sendTelegramMessage(
      chatId,
      `❌ Payment not completed (cancelled or failed). Reference: \`${reference}\``
    );
  }

  return res.status(200).json({ ok: true });
}
