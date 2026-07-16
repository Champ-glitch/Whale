import { initiateSTKPush } from "../../lib/payhero.js";
import { sendTelegramMessage, answerCallbackQuery } from "../../lib/telegram.js";
import {
  saveInvoice,
  listInvoices,
  deleteInvoice,
  checkRateLimit,
  savePendingPay,
  getPendingPay,
  clearPendingPay,
  saveNickname,
  getNickname,
  listNicknames,
  getStats,
  saveRefundNote,
  listRefundNotes,
} from "../../lib/kv.js";
import { generateInvoiceCode } from "../../lib/invoice.js";
import { buildReference } from "../../lib/reference.js";

const LARGE_AMOUNT_THRESHOLD = 10000; // KES - amounts above this need confirmation

function timeGreeting() {
  // Nairobi is UTC+3
  const nairobiHour = (new Date().getUTCHours() + 3) % 24;
  if (nairobiHour < 12) return "Good morning";
  if (nairobiHour < 17) return "Good afternoon";
  return "Good evening";
}

const MAIN_MENU_BUTTONS = {
  inline_keyboard: [
    [
      { text: "📋 Invoices", callback_data: "menu_invoices" },
      { text: "📊 Today", callback_data: "menu_today" },
    ],
    [
      { text: "🏆 Stats", callback_data: "menu_stats" },
      { text: "❓ Help", callback_data: "menu_help" },
    ],
  ],
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const allowedChatId = process.env.OWNER_CHAT_ID;

  // ---- Handle inline button taps ----
  const callbackQuery = req.body?.callback_query;
  if (callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    if (allowedChatId && String(chatId) !== String(allowedChatId)) {
      return res.status(200).json({ ok: true });
    }
    await answerCallbackQuery(callbackQuery.id);

    if (callbackQuery.data === "menu_invoices") {
      await handleInvoicesCommand(chatId);
    } else if (callbackQuery.data === "menu_today") {
      await handleTodayCommand(chatId);
    } else if (callbackQuery.data === "menu_stats") {
      await handleStatsCommand(chatId);
    } else if (callbackQuery.data === "menu_help") {
      await handleHelpCommand(chatId);
    }
    return res.status(200).json({ ok: true });
  }

  const message = req.body?.message;
  if (!message || !message.text) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  let text = message.text.trim();

  if (allowedChatId && String(chatId) !== String(allowedChatId)) {
    console.warn("Ignored message from unauthorized chat:", chatId);
    return res.status(200).json({ ok: true });
  }

  const allowed = await checkRateLimit(`webhook:${chatId}`, 20, 60);
  if (!allowed) {
    await sendTelegramMessage(chatId, "⏳ Too many requests — please wait a moment.");
    return res.status(200).json({ ok: true });
  }

  // ---- Command shortcuts: /p -> /pay, /l -> /link ----
  text = text.replace(/^\/p(\s|$)/i, "/pay$1").replace(/^\/l(\s|$)/i, "/link$1");

  // ---- /help ----
  if (text === "/help") {
    await handleHelpCommand(chatId);
    return res.status(200).json({ ok: true });
  }

  // ---- /start ----
  if (text === "/start") {
    await sendTelegramMessage(
      chatId,
      `👋 ${timeGreeting()}, Whale.\n\n` +
        "Send `/help` anytime to see the full list of commands.\n\n" +
        "Quick start:\n" +
        "`/pay <amount> <phone>` — send an STK push\n" +
        "`/link <amount> <description>` — create a payment link",
      MAIN_MENU_BUTTONS
    );
    return res.status(200).json({ ok: true });
  }

  // ---- /invoices ----
  if (text === "/invoices") {
    await handleInvoicesCommand(chatId);
    return res.status(200).json({ ok: true });
  }

  // ---- /today ----
  if (text === "/today") {
    await handleTodayCommand(chatId);
    return res.status(200).json({ ok: true });
  }

  // ---- /stats ----
  if (text === "/stats") {
    await handleStatsCommand(chatId);
    return res.status(200).json({ ok: true });
  }

  // ---- /cancel WHL-2026-1234 ----
  const cancelMatch = text.match(/^\/cancel\s+(\S+)$/i);
  if (cancelMatch) {
    await deleteInvoice(cancelMatch[1]);
    await sendTelegramMessage(chatId, `🗑️ Invoice \`${cancelMatch[1]}\` cancelled and deactivated.`);
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

  // ---- /nickname add mama_mboga 0712345678 ----
  const nickAddMatch = text.match(/^\/nickname\s+add\s+(\S+)\s+(\+?\d{9,12})$/i);
  if (nickAddMatch) {
    const [, name, phone] = nickAddMatch;
    await saveNickname(chatId, name, phone);
    await sendTelegramMessage(chatId, `✅ Saved *${name}* → ${phone}\nUse it like: \`/pay 500 @${name}\``);
    return res.status(200).json({ ok: true });
  }

  // ---- /nickname list ----
  if (/^\/nickname\s+list$/i.test(text)) {
    const nicknames = await listNicknames(chatId);
    if (nicknames.length === 0) {
      await sendTelegramMessage(chatId, "No saved nicknames yet. Add one: `/nickname add mama_mboga 0712345678`");
      return res.status(200).json({ ok: true });
    }
    const lines = nicknames.map((n) => `@${n.name} → ${n.phone}`);
    await sendTelegramMessage(chatId, `📇 *Saved Nicknames*\n\n${lines.join("\n")}`);
    return res.status(200).json({ ok: true });
  }

  // ---- /refund WHL-2026-1234 reason text ----
  const refundMatch = text.match(/^\/refund\s+(\S+)\s+(.+)$/i);
  if (refundMatch) {
    const [, code, reason] = refundMatch;
    await saveRefundNote(code, reason);
    await sendTelegramMessage(
      chatId,
      `📝 Refund note logged for \`${code}\`.\n_This is a manual record only — M-Pesa payments can't be reversed automatically._`
    );
    return res.status(200).json({ ok: true });
  }

  // ---- /refunds ----
  if (text === "/refunds") {
    const notes = await listRefundNotes(10);
    if (notes.length === 0) {
      await sendTelegramMessage(chatId, "No refund notes logged.");
      return res.status(200).json({ ok: true });
    }
    const lines = notes.map((n) => `\`${n.code}\` — ${n.reason}`);
    await sendTelegramMessage(chatId, `📝 *Refund Notes*\n\n${lines.join("\n")}`);
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

  // ---- /pay 500 0712345678  OR  /pay 500 @nickname ----
  const payPhoneMatch = text.match(/^\/pay\s+(\d+)\s+(\+?\d{9,12})$/i);
  const payNicknameMatch = text.match(/^\/pay\s+(\d+)\s+@(\S+)$/i);

  if (payNicknameMatch) {
    const [, amount, name] = payNicknameMatch;
    const phone = await getNickname(chatId, name);
    if (!phone) {
      await sendTelegramMessage(chatId, `No saved nickname *${name}*. Add one: \`/nickname add ${name} 0712345678\``);
      return res.status(200).json({ ok: true });
    }
    await routePay(chatId, amount, phone);
    return res.status(200).json({ ok: true });
  }

  if (!payPhoneMatch) {
    if (text.startsWith("/pay")) {
      await sendTelegramMessage(
        chatId,
        "Format: `/pay <amount> <phone>` or `/pay <amount> @nickname`\nExample: `/pay 500 0712345678`"
      );
    }
    return res.status(200).json({ ok: true });
  }

  const [, amount, phoneNumber] = payPhoneMatch;
  await routePay(chatId, amount, phoneNumber);
  return res.status(200).json({ ok: true });
}

async function routePay(chatId, amount, phoneNumber) {
  if (Number(amount) > LARGE_AMOUNT_THRESHOLD) {
    await savePendingPay(chatId, { amount, phoneNumber });
    await sendTelegramMessage(
      chatId,
      `⚠️ You're about to send an STK push for *KES ${amount}* to *${phoneNumber}*.\nReply *YES* to confirm (expires in 2 minutes).`
    );
    return;
  }
  await executePay(chatId, amount, phoneNumber);
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

async function handleHelpCommand(chatId) {
  await sendTelegramMessage(
    chatId,
    "📖 *WHALE_SYS Pay Bot — Commands*\n\n" +
      "*Payments*\n" +
      "`/pay <amount> <phone>` — send an STK push (alias: `/p`)\n" +
      "`/pay <amount> @nickname` — pay a saved contact\n" +
      "`/link <amount> <description>` — shareable link (alias: `/l`)\n\n" +
      "*Contacts*\n" +
      "`/nickname add <name> <phone>` — save a contact\n" +
      "`/nickname list` — view saved contacts\n\n" +
      "*Managing invoices*\n" +
      "`/invoices` — recent invoices\n" +
      "`/cancel <code>` — deactivate a link\n" +
      "`/resend <code>` — resend a link\n\n" +
      "*Reports*\n" +
      "`/today` — today's summary\n" +
      "`/stats` — all-time totals & streak\n\n" +
      "*Refunds*\n" +
      "`/refund <code> <reason>` — log a manual refund note\n" +
      "`/refunds` — view refund notes\n\n" +
      "*Safety*\n" +
      "Payments over KES 10,000 need a YES confirmation.\n" +
      "This bot only responds to your account."
  );
}

async function handleInvoicesCommand(chatId) {
  const invoices = await listInvoices(10);
  if (invoices.length === 0) {
    await sendTelegramMessage(chatId, "No invoices yet. Use /link to create one.");
    return;
  }
  const statusIcon = { pending: "⏳", processing: "🔄", success: "✅", failed: "❌" };
  const lines = invoices.map(
    (inv) => `${statusIcon[inv.status] || "•"} \`${inv.code}\` — KES ${inv.amount} — ${inv.description}`
  );
  await sendTelegramMessage(chatId, `📋 *Recent Invoices*\n\n${lines.join("\n")}`);
}

async function handleTodayCommand(chatId) {
  const invoices = await listInvoices(100);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayInvoices = invoices.filter((inv) => inv.createdAt && inv.createdAt >= startOfDay.getTime());

  const success = todayInvoices.filter((i) => i.status === "success");
  const failed = todayInvoices.filter((i) => i.status === "failed");
  const total = success.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const stats = await getStats();

  await sendTelegramMessage(
    chatId,
    `📊 *Today's Summary*\n\n` +
      `✅ Successful: ${success.length}\n` +
      `❌ Failed: ${failed.length}\n` +
      `💰 Total collected: KES ${total.toLocaleString()}\n` +
      `🔥 Current streak: ${stats.streak} day${stats.streak === 1 ? "" : "s"}`
  );
}

async function handleStatsCommand(chatId) {
  const stats = await getStats();
  await sendTelegramMessage(
    chatId,
    `🏆 *All-Time Stats*\n\n` +
      `💰 Total collected: KES ${stats.total.toLocaleString()}\n` +
      `✅ Successful payments: ${stats.count}\n` +
      `🔥 Current streak: ${stats.streak} day${stats.streak === 1 ? "" : "s"}`
  );
}
