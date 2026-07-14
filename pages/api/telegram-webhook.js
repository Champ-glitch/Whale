import { initiateSTKPush } from "../../lib/payhero.js";
import { sendTelegramMessage } from "../../lib/telegram.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const message = req.body?.message;
  if (!message || !message.text) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  const allowedChatId = process.env.OWNER_CHAT_ID;
  if (allowedChatId && String(chatId) !== String(allowedChatId)) {
    console.warn("Ignored message from unauthorized chat:", chatId);
    return res.status(200).json({ ok: true });
  }

  const match = text.match(/^\/pay\s+(\d+)\s+(\+?\d{9,12})$/i);

  if (!match) {
    if (text.startsWith("/pay")) {
      await sendTelegramMessage(
        chatId,
        "Format: `/pay <amount> <phone>`\nExample: `/pay 500 0712345678`"
      );
    } else if (text === "/start") {
      await sendTelegramMessage(
        chatId,
        "👋 *WHALE_SYS Pay Bot*\nSend `/pay <amount> <phone>` to trigger an STK push.\nExample: `/pay 500 0712345678`"
      );
    }
    return res.status(200).json({ ok: true });
  }

  const [, amount, phoneNumber] = match;
  const reference = `WHALE-${chatId}-${Date.now()}`;

  try {
    await sendTelegramMessage(chatId, `⏳ Sending STK push of *KES ${amount}* to *${phoneNumber}*...`);
    await initiateSTKPush({ amount, phoneNumber, reference });
    await sendTelegramMessage(chatId, `📲 Prompt sent. Waiting for client to enter M-Pesa PIN...`);
  } catch (err) {
    console.error("STK push error:", err);
    await sendTelegramMessage(chatId, `❌ Failed to send prompt: ${err.message}`);
  }

  return res.status(200).json({ ok: true });
}
