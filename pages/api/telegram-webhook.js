import { initiateSTKPush } from "../../lib/payhero.js";
import { sendTelegramMessage } from "../../lib/telegram.js";
import { saveInvoice, listInvoices, deleteInvoice, checkRateLimit, savePendingPay, getPendingPay, clearPendingPay } from "../../lib/kv.js";
import { generateInvoiceCode } from "../../lib/invoice.js";
import { buildReference } from "../../lib/reference.js";

const LARGE_AMOUNT_THRESHOLD = 10000; // KES - amounts above this need confirmation

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

  // Rate limit: max 20 commands per minute per chat, protects against a
  // leaked/compromised token being used to spam STK pushes.
  const allowed = await checkRateLimit(`webhook:${chatId}`, 20, 60);
  if (!allowed) {
    await sendTelegramMessage(chatId, "⏳ Too many requests — please wait a moment.");
    return res.status(200).json({ ok: true });
  }

  // ---- /invoices ----
  if (text === "/invoices") {
    const invoices = await listInvoices(10);
    if (invoices.length === 0) {
      await sendTelegramMessage(chatId, "No invoices yet. Use /link to create one.");
      return res.status(200).json({ ok: true });
    }
    const statusIcon = { pending: "⏳", processing: "🔄", success: "✅", failed: "❌" };
    const lines = invoices.map(
      (inv) =>
        `${statusIcon[inv.status] || "•"} \`${inv.code}\` — KES ${inv.amount} — ${inv.description}`
    );
    await sendTelegramMessage(chatId, `📋 *Recent Invoices*\n\n${lines.join("\n")}`);
    return res.status(200).json({ ok: true });
  }

  // ---- /today ----
  if (text === "/today") {
    const invoices = await listInvoices(100);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayInvoices = invoices.filter((inv) => inv.createdAt && inv.createdAt >= startOfDay.getTime());

    const success = todayInvoices.filter((i) => i.status === "success");
    const failed = todayInvoices.filter((i) => i.status === "failed");
    const total = success.reduce((sum, i) => sum + Number(i.amount || 0), 0);

    await sendTelegramMessage(
      chatId,
      `📊 *Today's Summary*\n\n` +
        `✅ Successful: ${success.length}\n` +
        `❌ Failed: ${failed.length}\n` +
        `💰 Total collected: KES ${total.toLocaleString()}`
    );
    return res.status(200).json({ ok: true });
  }

  // ---- /cancel WHL-2026-1234 ----
  const cancelMatch = text.match(/^\/cancel\s+(\S+)$/i);
  if (cancelMatch) {
    const code = cancelMatch[1];
    await deleteInvoice(code);
    await sendTelegramMessage(chatId, `🗑️ Invoice \`${code}\` cancelled and deactivated.`);
    return res.status(200).json({ ok: true });
  }

  // ---- /resend WHL-2026-1234 ----
  const resendMatch = text.match(/^\/resend\s+(\S+)$/i);
  if (resendMatch) {
    const code = resendMatch[1];
    const invoices = await listInvoices(100);
    const invoice = invoices.find((i) => i.code === code);
    if (!invoice) {
      await sendTelegramMessage(chatId, `Couldn't find invoice \`${code}\` (it may have expired).`);
      return res.status(200).json({ ok: true });
    }
    const baseUrl = `https://${req.headers.host}`;
    const link = `${baseUrl}/pay/${code}`;
    await sendTelegramMessage(
      chatId,
      `🔗 *Invoice Resent*\nAmount: KES ${invoice.amount}\nDescription: ${invoice.description}\nInvoice: \`${code}\`\n\n${link}`
    );
    return res.status(200).json({ ok: true });
  }

  // ---- /link 500 Rent payment for July ----
  const linkMatch = text.match(/^\/link\s+(\d+)\s+(.+)$/i);
  if (linkMatch) {
    const [, amount, description] = linkMatch;
    const code = generateInvoiceCode();

    await saveInvoice(code, {
      amount: Number(amount),
      description,
      chatId,
      status: "pending",
      createdAt: Date.now(),
    });

    const baseUrl = `https://${req.headers.host}`;
    const link = `${baseUrl}/pay/${code}`;

    await sendTelegramMessage(
      chatId,
      `🔗 *Invoice created*\nAmount: KES ${amount}\nDescription: ${description}\nInvoice: \`${code}\`\n\n${link}`
    );
    return res.status(200).json({ ok: true });
  }

  // ---- Confirm a pending large payment: user replies YES ----
  if (/^yes$/i.test(text)) {
    const pending = await getPendingPay(chatId);
    if (pending) {
      await clearPendingPay(chatId);
      await executePay(chatId, pending.amount, pending.phoneNumber);
      return res.status(200).json({ ok: true });
    }
  }

  // ---- /help ----
  if (text === "/help") {
    await sendTelegramMessage(
      chatId,
      "📖 *WHALE_SYS Pay Bot — Commands*\n\n" +
        "*Payments*\n" +
        "`/pay <amount> <phone>` — send an STK push directly\n" +
        "e.g. `/pay 500 0712345678`\n\n" +
        "`/link <amount> <description>` — create a shareable payment link\n" +
        "e.g. `/link 500 Rent payment for July`\n\n" +
        "*Managing invoices*\n" +
        "`/invoices` — view your 10 most recent invoices\n" +
        "`/cancel <code>` — deactivate a link\n" +
        "`/resend <code>` — resend an existing link\n\n" +
        "*Reports*\n" +
        "`/today` — today's collection summary\n\n" +
        "*Safety*\n" +
        "Payments over KES 10,000 need a YES confirmation.\n" +
        "This bot only responds to your account.\n\n" +
        "Type `/start` for a quick welcome message."
    );
    return res.status(200).json({ ok: true });
  }

  // ---- /pay 500 0712345678 ----
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
        "👋 *WHALE_SYS Pay Bot*\n\n" +
          "Send `/help` anytime to see the full list of commands.\n\n" +
          "Quick start:\n" +
          "`/pay <amount> <phone>` — send an STK push\n" +
          "`/link <amount> <description>` — create a payment link"
      );
    }
    return res.status(200).json({ ok: true });
  }

  const [, amount, phoneNumber] = match;

  if (Number(amount) > LARGE_AMOUNT_THRESHOLD) {
    await savePendingPay(chatId, { amount, phoneNumber });
    await sendTelegramMessage(
      chatId,
      `⚠️ You're about to send an STK push for *KES ${amount}* to *${phoneNumber}*.\nReply *YES* to confirm (expires in 2 minutes).`
    );
    return res.status(200).json({ ok: true });
  }

  await executePay(chatId, amount, phoneNumber);
  return res.status(200).json({ ok: true });
}

async function executePay(chatId, amount, phoneNumber) {
  const reference = buildReference(chatId);
  try {
    await sendTelegramMessage(chatId, `⏳ Sending STK push of *KES ${amount}* to *${phoneNumber}*...`);
    await initiateSTKPush({ amount, phoneNumber, reference });
    await sendTelegramMessage(chatId, `📲 Prompt sent. Waiting for client to enter M-Pesa PIN...`);
  } catch (err) {
    console.error("STK push error:", err);
    await sendTelegramMessage(chatId, `❌ Failed to send prompt: ${err.message}`);
  }
}
