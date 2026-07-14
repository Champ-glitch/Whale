// pages/api/payhero-callback.js
// PayHero POSTs the payment result here once the client responds to the STK prompt.

const { sendTelegramMessage } = require("../../lib/telegram");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  // PayHero's callback payload shape - log it once in production to confirm exact fields.
  const body = req.body;
  console.log("PayHero callback:", JSON.stringify(body));

  const reference =
    body?.external_reference || body?.reference || body?.response?.ExternalReference;
  const status = body?.status || body?.response?.ResultCode; // 0 = success, typically

  // Pull chat_id back out of "WHALE-<chatId>-<timestamp>"
  const chatIdMatch = typeof reference === "string" ? reference.match(/^WHALE-(-?\d+)-/) : null;

  if (!chatIdMatch) {
    console.warn("Could not extract chat_id from reference:", reference);
    return res.status(200).json({ ok: true });
  }

  const chatId = chatIdMatch[1];
  const success = status === 0 || status === "0" || body?.status === "Success";

  if (success) {
    await sendTelegramMessage(chatId, `✅ Payment received! Reference: \`${reference}\``);
  } else {
    await sendTelegramMessage(
      chatId,
      `❌ Payment not completed (cancelled or failed). Reference: \`${reference}\``
    );
  }

  return res.status(200).json({ ok: true });
};
