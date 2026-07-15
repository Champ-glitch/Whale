import { initiateSTKPush } from "../../lib/payhero.js";
import { sendTelegramMessage } from "../../lib/telegram.js";
import { saveInvoice } from "../../lib/kv.js";
import { generateInvoiceCode } from "../../lib/invoice.js";
import { buildReference } from "../../lib/reference.js";

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

  const linkMatch = text.match(/^\/link\s+(\d+)\s+(.+)$/i);
  if (linkMatch) {
    const [, amount, description] = linkMatch;
    const code = generateInvoiceCode();

    await saveInvoice(code, {
      amount: Number(amount),
      description,
      chatId,
      status: "pending",
    });

    const baseUrl = `https://${req.headers.host}`;
    const link = `${baseUrl}/pay/${code}`;

    await sendTelegramMessage(
      chatId,
      `🔗 *Invoice created*\nAmount: KES ${amount}\nDescription: ${description}\nInvoice: \`${code}\`\n\n${link}`
    );
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
        "👋 *WHALE_SYS Pay Bot*\n" +
          "Send `/pay <amount> <phone>` to trigger an STK push.\n" +
          "Example: `/pay 500 0712345678`\n\n" +
          "Send `/link <amount> <description>` to create a shareable payment link.\n" +
          "Example: `/link 500 Rent payment for July`"
      );
    }
    return res.status(200).json({ ok: true });
  }

  const [, amount, phoneNumber] = match;
  const reference = buildReference(chatId);

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
