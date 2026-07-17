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
  savePendingReset,
  getPendingReset,
  clearPendingReset,
  resetAll,
  getChatHistory,
  appendChatHistory,
  incrementGroqUsage,
  getGroqUsage,
  setBalance,
  getBalance,
  logDeduction,
  getTotalDeducted,
  getBiggestIn,
  getBiggestOut,
  getBalanceSnapshot,
  saveBalanceSnapshot,
  setSavingsGoal,
  getSavingsGoal,
  getRecentActivity,
} from "../../lib/kv.js";
import { kesToUsdt } from "../../lib/rates.js";
import { generateInvoiceCode } from "../../lib/invoice.js";
import { buildReference } from "../../lib/reference.js";
import { parseIntent } from "../../lib/groq.js";

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

  // ---- /setbalance 5000 ----
  const setBalanceMatch = text.match(/^\/setbalance\s+([\d,.]+)$/i);
  if (setBalanceMatch) {
    const amount = Number(setBalanceMatch[1].replace(/,/g, ""));
    await setBalance(amount);
    await sendTelegramMessage(chatId, `✅ Balance set to *KES ${amount.toLocaleString()}*`);
    return res.status(200).json({ ok: true });
  }

  // ---- /deduct 500 groceries ----
  const deductMatch = text.match(/^\/deduct\s+([\d,.]+)(?:\s+(.+))?$/i);
  if (deductMatch) {
    const amount = Number(deductMatch[1].replace(/,/g, ""));
    const reason = deductMatch[2] || "Not specified";
    await logDeduction(amount, reason);
    const newBalance = await getBalance();
    await sendTelegramMessage(
      chatId,
      `📤 *Deduction logged*\nKES ${amount.toLocaleString()} — ${reason}\n\nBalance: *KES ${newBalance.toLocaleString()}*`
    );
    return res.status(200).json({ ok: true });
  }

  // ---- /goal 10000 ----
  const goalMatch = text.match(/^\/goal\s+([\d,.]+)$/i);
  if (goalMatch) {
    const amount = Number(goalMatch[1].replace(/,/g, ""));
    await setSavingsGoal(amount);
    await sendTelegramMessage(chatId, `🎯 Savings goal set to *KES ${amount.toLocaleString()}*`);
    return res.status(200).json({ ok: true });
  }

  // ---- /balance ----
  if (text === "/balance") {
    await handleBalanceCommand(chatId);
    return res.status(200).json({ ok: true });
  }

  // ---- /reset ----
  if (text === "/reset") {
    await savePendingReset(chatId);
    await sendTelegramMessage(
      chatId,
      "⚠️ *This will permanently delete:*\n" +
        "• All invoices\n• All saved nicknames\n• All stats & streak\n• All refund notes\n\n" +
        "This cannot be undone.\n\n" +
        "Type *RESET* (exact word, all caps) within 60 seconds to confirm."
    );
    return res.status(200).json({ ok: true });
  }

  if (text === "RESET") {
    const pending = await getPendingReset(chatId);
    if (pending) {
      await clearPendingReset(chatId);
      const deletedCount = await resetAll();
      await sendTelegramMessage(
        chatId,
        `🧹 *System reset complete.*\n${deletedCount} records cleared.\n\nStarting fresh — send /start to begin.`
      );
    } else {
      await sendTelegramMessage(chatId, "No reset in progress. Type /reset first.");
    }
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
    await createInvoiceLink(chatId, amount, description, req.headers.host);
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
      return res.status(200).json({ ok: true });
    }

    // Anything else that didn't match a known command - hand off to Groq.
    // It only classifies intent; actual money actions still run through the
    // exact same strict functions used above.
    const groqAllowed = await checkRateLimit(`groq:${chatId}`, 15, 60);
    if (!groqAllowed) {
      return res.status(200).json({ ok: true });
    }

    await incrementGroqUsage();
    const history = await getChatHistory(chatId);
    const parsed = await parseIntent(text, history);

    // Guard: never let a malformed amount/recipient reach real money logic.
    const validAmount = parsed.amount && Number(parsed.amount) > 0 && Number.isFinite(Number(parsed.amount));
    const validRecipient =
      parsed.recipient &&
      (/^@\S+$/.test(parsed.recipient) || /^\+?\d{9,12}$/.test(parsed.recipient.replace(/\s/g, "")));

    let replyForHistory = parsed.reply || "";

    if (parsed.intent === "pay" && validAmount && validRecipient) {
      let phone = parsed.recipient;
      if (phone.startsWith("@")) {
        const name = phone.slice(1);
        const savedPhone = await getNickname(chatId, name);
        if (!savedPhone) {
          const msg = `No saved nickname *${name}*. Add one: \`/nickname add ${name} 0712345678\``;
          await sendTelegramMessage(chatId, msg);
          await appendChatHistory(chatId, text, msg);
          return res.status(200).json({ ok: true });
        }
        phone = savedPhone;
      }
      await routePay(chatId, parsed.amount, phone);
      replyForHistory = `[Sent STK push of KES ${parsed.amount} to ${phone}]`;
    } else if (parsed.intent === "pay") {
      // Groq said "pay" but amount/recipient didn't pass validation - treat as chat instead of guessing.
      const msg = parsed.reply || "I need a clear amount and phone number (or @nickname) to send that.";
      await sendTelegramMessage(chatId, msg);
      replyForHistory = msg;
    } else if (parsed.intent === "link" && parsed.amount && parsed.description) {
      await createInvoiceLink(chatId, parsed.amount, parsed.description, req.headers.host);
      replyForHistory = `[Created invoice link for KES ${parsed.amount}: ${parsed.description}]`;
    } else if (parsed.intent === "invoices") {
      await handleInvoicesCommand(chatId);
      replyForHistory = "[Showed recent invoices]";
    } else if (parsed.intent === "today") {
      await handleTodayCommand(chatId);
      replyForHistory = "[Showed today's summary]";
    } else if (parsed.intent === "stats") {
      await handleStatsCommand(chatId);
      replyForHistory = "[Showed all-time stats]";
    } else if (parsed.intent === "help") {
      await handleHelpCommand(chatId);
      replyForHistory = "[Showed help menu]";
    } else if (parsed.intent === "deduct" && validAmount) {
      const reason = parsed.description || "Not specified";
      await logDeduction(parsed.amount, reason);
      const newBalance = await getBalance();
      const msg = `📤 *Deduction logged*\nKES ${Number(parsed.amount).toLocaleString()} — ${reason}\n\nBalance: *KES ${newBalance.toLocaleString()}*`;
      await sendTelegramMessage(chatId, msg);
      replyForHistory = `[Logged deduction of KES ${parsed.amount}]`;
    } else if (parsed.intent === "setbalance" && validAmount) {
      await setBalance(Number(parsed.amount));
      const msg = `✅ Balance set to *KES ${Number(parsed.amount).toLocaleString()}*`;
      await sendTelegramMessage(chatId, msg);
      replyForHistory = `[Set balance to KES ${parsed.amount}]`;
    } else if (parsed.intent === "balance") {
      await handleBalanceCommand(chatId);
      replyForHistory = "[Showed balance]";
    } else {
      const msg = parsed.reply || "Not sure what you meant — try /help.";
      await sendTelegramMessage(chatId, msg);
      replyForHistory = msg;
    }

    await appendChatHistory(chatId, text, replyForHistory);
    return res.status(200).json({ ok: true });
  }

  const [, amount, phoneNumber] = payPhoneMatch;
  await routePay(chatId, amount, phoneNumber);
  return res.status(200).json({ ok: true });
}

async function createInvoiceLink(chatId, amount, description, host) {
  const code = generateInvoiceCode();

  await saveInvoice(code, {
    amount: Number(amount),
    description,
    chatId,
    status: "pending",
    createdAt: Date.now(),
  });

  const baseUrl = `https://${host}`;
  const link = `${baseUrl}/pay/${code}`;

  await sendTelegramMessage(
    chatId,
    `🔗 *Invoice created*\nAmount: KES ${amount}\nDescription: ${description}\nInvoice: \`${code}\`\n\n${link}`
  );
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
      "*Just talk to me too*\n" +
      "You don't need exact commands — try \"send 500 to john\" or \"how'd I do today\" and I'll figure it out.\n\n" +
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
      "*Bank Balance*\n" +
      "`/balance` — current balance, total in/out\n" +
      "`/setbalance <amount>` — set your starting balance\n" +
      "`/deduct <amount> <reason>` — log money leaving your account\n" +
      "`/goal <amount>` — set a savings target\n" +
      "_Income tracks automatically from every payment received._\n\n" +
      "*Refunds*\n" +
      "`/refund <code> <reason>` — log a manual refund note\n" +
      "`/refunds` — view refund notes\n\n" +
      "*Safety*\n" +
      "Payments over KES 10,000 need a YES confirmation.\n" +
      "This bot only responds to your account.\n\n" +
      "*Admin*\n" +
      "`/reset` — wipe all data and start fresh (requires typing RESET to confirm)"
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

async function handleBalanceCommand(chatId) {
  const balance = await getBalance();
  const stats = await getStats();
  const totalOut = await getTotalDeducted();

  const totalMoved = stats.total + totalOut;
  const inRatio = totalMoved > 0 ? stats.total / totalMoved : 1;
  const filledBlocks = Math.round(inRatio * 10);
  const bar = "🟩".repeat(filledBlocks) + "🟥".repeat(10 - filledBlocks);
  const inPct = Math.round(inRatio * 100);

  // Masked card number - cosmetic only, deterministic from chatId so it stays consistent
  const cardDigits = String(Math.abs(Number(chatId)) % 10000).padStart(4, "0");

  // USDT equivalent
  const usdt = await kesToUsdt(balance);
  const usdtLine = usdt ? `≈ ${usdt} USDT\n` : "";

  // Trend vs last snapshot (seeds itself on first check if none exists yet)
  let trendLine = "";
  const snapshot = await getBalanceSnapshot();
  if (snapshot === null) {
    await saveBalanceSnapshot(balance);
    trendLine = "_📊 Trend tracking starts now — check back next week._\n";
  } else if (snapshot > 0) {
    const change = balance - snapshot;
    const changePct = Math.round((change / snapshot) * 100);
    const arrow = change > 0 ? "📈" : change < 0 ? "📉" : "➡️";
    trendLine = `${arrow} ${change >= 0 ? "+" : ""}${changePct}% vs last week\n`;
  }

  // Biggest transactions
  const biggestIn = await getBiggestIn();
  const biggestOutData = await getBiggestOut();
  let biggestLine = "";
  if (biggestIn > 0 || biggestOutData.amount > 0) {
    biggestLine = `\n🏆 *Biggest In:* KES ${biggestIn.toLocaleString()}\n`;
    if (biggestOutData.amount > 0) {
      biggestLine += `🏆 *Biggest Out:* KES ${biggestOutData.amount.toLocaleString()} (${biggestOutData.reason})\n`;
    }
  }

  // Savings goal
  let goalLine = "";
  const goal = await getSavingsGoal();
  if (goal && goal > 0) {
    const goalPct = Math.min(Math.round((balance / goal) * 100), 100);
    const goalFilled = Math.round((goalPct / 100) * 10);
    const goalBar = "🟦".repeat(goalFilled) + "⬜".repeat(10 - goalFilled);
    goalLine = `\n🎯 *Goal:* KES ${goal.toLocaleString()}\n${goalBar} ${goalPct}%\n`;
  }

  // Recent activity feed
  const activity = await getRecentActivity(4);
  let activityLine = "";
  if (activity.length > 0) {
    const lines = activity.map((a) => {
      const icon = a.type === "in" ? "⬆️" : "⬇️";
      const sign = a.type === "in" ? "+" : "-";
      return `${icon} ${sign}KES ${Number(a.amount).toLocaleString()} — ${a.label}`;
    });
    activityLine = `\n📋 *Recent Activity*\n${lines.join("\n")}\n`;
  }

  await sendTelegramMessage(
    chatId,
    `🏦 *WHALE_SYS BANK CARD*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `💳 \`•••• •••• •••• ${cardDigits}\`\n\n` +
      `*KES ${balance.toLocaleString()}*\n` +
      `${usdtLine}` +
      `_current balance_\n` +
      `${trendLine}` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⬆️ In    \`KES ${stats.total.toLocaleString()}\`\n` +
      `⬇️ Out   \`KES ${totalOut.toLocaleString()}\`\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `${bar}\n` +
      `${inPct}% in · ${100 - inPct}% out\n` +
      `${biggestLine}` +
      `${goalLine}` +
      `${activityLine}` +
      `\n_Updates automatically on every payment. /deduct to log spending, /goal to set a target._`
  );
}

async function handleStatsCommand(chatId) {
  const stats = await getStats();
  const groqCount = await getGroqUsage();
  await sendTelegramMessage(
    chatId,
    `🏆 *All-Time Stats*\n\n` +
      `💰 Total collected: KES ${stats.total.toLocaleString()}\n` +
      `✅ Successful payments: ${stats.count}\n` +
      `🔥 Current streak: ${stats.streak} day${stats.streak === 1 ? "" : "s"}\n` +
      `🧠 Chat messages handled: ${groqCount}`
  );
}
