import { createSTKPush } from "../../lib/makamesco.js";
import { sendTelegramMessage, answerCallbackQuery, sendTelegramPhoto } from "../../lib/telegram.js";
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
  getSavingsBalance,
  getPendingSplitTotal,
  approvePendingSplit,
  deductFromSavings,
  setAutoApprove,
  getWeeklySaved,
  getDaysElapsedInWeek,
  trackCategorySpend,
  getTopCategories,
  transferToSavings,
  setSavingsBalance,
  logSavingsSet,
} from "../../lib/kv.js";
import { kesToUsdt } from "../../lib/rates.js";
import { generateInvoiceCode } from "../../lib/invoice.js";
import { buildReference } from "../../lib/reference.js";
import { getExchangeRate, getAccountDetail, payoutKES, onrampKES, getTransactionHistory, refundTransaction, isSupportedChainAsset } from "../../lib/pretium.js";
import { savePretiumTx, listPretiumTx, savePendingCrypto, getPendingCrypto, clearPendingCrypto, saveAgentId, getAgentId } from "../../lib/kv.js";
import {
  registerAgent,
  getAgent,
  createAgentSpendPolicy,
  getAgentBalance,
  agentCreateStablecoinOrder,
  agentCreateFiatOrder,
  getAgentFiatOrderStatus,
} from "../../lib/pretium-mcp.js";
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

if (/^whale approve$/i.test(text)) {
  const pending = await getPendingSplitTotal();
  if (pending <= 0) {
    await sendTelegramMessage(chatId, "✅ No pending savings transfer right now.");
    return res.status(200).json({ ok: true });
  }
  const moved = await approvePendingSplit();
  const savings = await getSavingsBalance();
  const main = await getBalance();
  await sendTelegramMessage(
    chatId,
    `✅ *Transferred to Savings*\nKES ${moved.toLocaleString()} moved.\n\n💰 Main: KES ${main.toLocaleString()}\n🏦 Savings: KES ${savings.toLocaleString()}`
  );
  return res.status(200).json({ ok: true });
}

if (/^\/autoapprove\s+(on|off)$/i.test(text)) {
  const [, state] = text.match(/^\/autoapprove\s+(on|off)$/i);
  const enabled = state.toLowerCase() === "on";
  await setAutoApprove(enabled);
  await sendTelegramMessage(
    chatId,
    enabled
      ? "✅ Auto-approve is *ON*. Every deposit's 40% share moves to Savings automatically — no need to reply WHALE approve."
      : "✅ Auto-approve is *OFF*. Reply *WHALE approve* to move each pending split into Savings."
  );
  return res.status(200).json({ ok: true });
}

if (text === "/report") {
  const weeklySaved = await getWeeklySaved();
  const goal = await getSavingsGoal();
  const savings = await getSavingsBalance();
  const daysElapsed = getDaysElapsedInWeek();
  const avgPerDay = daysElapsed > 0 ? Math.round(weeklySaved / daysElapsed) : 0;
  const goalPct = goal && goal > 0 ? Math.min(Math.round((savings / goal) * 100), 100) : null;
  const topCategories = await getTopCategories(3);

  let categoryLines = "";
  if (topCategories.length > 0) {
    const lines = topCategories.map((c, i) => `${i + 1}. ${c.category} — KES ${c.amount.toLocaleString()}`);
    categoryLines = `\n\n*Top Categories*\n${lines.join("\n")}`;
  }

  await sendTelegramMessage(
    chatId,
    `📊 *Weekly Report*\n\n` +
      `💰 Saved: KES ${weeklySaved.toLocaleString()} this week\n` +
      (goalPct !== null ? `🎯 Goal Progress: ${goalPct}%\n` : "") +
      `📈 Avg/day: KES ${avgPerDay.toLocaleString()}` +
      categoryLines
  );
  return res.status(200).json({ ok: true });
}

  // ---- Command shortcuts: /p -> /pay, /l -> /link ----
  text = text.replace(/^\/p(\s|$)/i, "/pay$1").replace(/^\/l(\s|$)/i, "/link$1");

  // ---- /dashboard ----
  if (text === "/dashboard") {
    await sendTelegramMessage(chatId, "📊 Tap below to open your dashboard:", {
      inline_keyboard: [[{ text: "📊 Open Dashboard", url: `https://${req.headers.host}?key=${process.env.DASHBOARD_SECRET || ""}` }]],
    });
    return res.status(200).json({ ok: true });
  }

  // ---- /help ----
  if (text === "/help") {
    await handleHelpCommand(chatId);
    return res.status(200).json({ ok: true });
  }

  // ---- /start ----
  if (text === "/start") {
    const menuWithDashboard = {
      inline_keyboard: [
        [{ text: "📊 Open Dashboard", url: `https://${req.headers.host}?key=${process.env.DASHBOARD_SECRET || ""}` }],
        ...MAIN_MENU_BUTTONS.inline_keyboard,
      ],
    };
    await sendTelegramMessage(
      chatId,
      `👋 ${timeGreeting()}, Whale.\n\n` +
        "Send `/help` anytime to see the full list of commands.\n\n" +
        "Quick start:\n" +
        "`/pay <amount> <phone>` — send an STK push\n" +
        "`/link <amount> <description>` — create a payment link",
      menuWithDashboard
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
  const deductAccountMatch = text.match(/^\/deduct\s+(main|savings)\s+([\d,.]+)(?:\s+(.+))?$/i);
if (deductAccountMatch) {
  const [, account, amtStr, reason] = deductAccountMatch;
  const amount = Number(amtStr.replace(/,/g, ""));
  const reasonText = reason || "Not specified";
  if (account.toLowerCase() === "savings") {
    await deductFromSavings(amount, reasonText);
    await trackCategorySpend(reasonText, amount);
    const newSavings = await getSavingsBalance();
    await sendTelegramMessage(chatId, `📤 *Savings deduction logged*\nKES ${amount.toLocaleString()} — ${reasonText}\n\nSavings: *KES ${newSavings.toLocaleString()}*`);
  } else {
    await logDeduction(amount, reasonText);
    const newBalance = await getBalance();
    await trackCategorySpend(reasonText, amount);
    await checkLowBalanceAlert(chatId, newBalance);
    await sendTelegramMessage(chatId, `📤 *Main deduction logged*\nKES ${amount.toLocaleString()} — ${reasonText}\n\nMain: *KES ${newBalance.toLocaleString()}*`);
  }
  return res.status(200).json({ ok: true });
}

  const deductMatch = text.match(/^\/deduct\s+([\d,.]+)(?:\s+(.+))?$/i);
  if (deductMatch) {
    const amount = Number(deductMatch[1].replace(/,/g, ""));
    const reason = deductMatch[2] || "Not specified";
    await logDeduction(amount, reason);
    await trackCategorySpend(reason, amount);
    const newBalance = await getBalance();
    await checkLowBalanceAlert(chatId, newBalance);
    await sendTelegramMessage(
      chatId,
      `📤 *Deduction logged*\nKES ${amount.toLocaleString()} — ${reason}\n\nBalance: *KES ${newBalance.toLocaleString()}*`
    );
    return res.status(200).json({ ok: true });
  }

const transferMatch = text.match(/^\/transfer\s+([\d,.]+)$/i);
if (transferMatch) {
  const amount = Number(transferMatch[1].replace(/,/g, ""));
  const mainBalance = await getBalance();

  if (mainBalance < amount) {
    await sendTelegramMessage(chatId, `❌ Not enough in Main. You have KES ${mainBalance.toLocaleString()}`);
    return res.status(200).json({ ok: true });
  }

  await transferToSavings(amount);
  const main = await getBalance();
  const savings = await getSavingsBalance();
  const total = main + savings;
  const savingsPercent = total > 0 ? Math.round((savings / total) * 100) : 0;
  const goalAmount = await getSavingsGoal();
  const goalPercent = goalAmount && goalAmount > 0 ? Math.min(100, Math.round((savings / goalAmount) * 100)) : 0;

  await sendTelegramMessage(
    chatId,
    `📦 *Transfer Complete*\n` +
      `\`KES ${amount.toLocaleString()}\` moved from *Main* → *Savings*\n\n` +
      `*Main:* KES ${main.toLocaleString()}\n` +
      `*Savings:* KES ${savings.toLocaleString()}\n` +
      `*Total:* KES ${total.toLocaleString()}\n\n` +
      `*Discipline:* ${savingsPercent}% in Savings 🟢\n` +
      `*Goal:* ${goalPercent}% of ${goalAmount ? goalAmount.toLocaleString() : 0}`
  );
  return res.status(200).json({ ok: true });
}

const setSavingsMatch = text.match(/^\/setsavings\s+([\d,.]+)$/i);
if (setSavingsMatch) {
  const amount = Number(setSavingsMatch[1].replace(/,/g, ""));
  await setSavingsBalance(amount);
  await logSavingsSet(amount);

  const main = await getBalance();
  const savings = await getSavingsBalance();
  const total = main + savings;
  const savingsPercent = total > 0 ? Math.round((savings / total) * 100) : 0;
  const goalAmount = await getSavingsGoal();
  const goalPercent = goalAmount && goalAmount > 0 ? Math.min(100, Math.round((savings / goalAmount) * 100)) : 0;

  await sendTelegramMessage(
    chatId,
    `✅ *Savings Balance Set*\n` +
      `*Savings:* KES ${savings.toLocaleString()}\n` +
      `*Main:* KES ${main.toLocaleString()}\n` +
      `*Total:* KES ${total.toLocaleString()}\n\n` +
      `*Discipline:* ${savingsPercent}% in Savings 🟢\n` +
      `*Goal:* ${goalPercent}% of ${goalAmount ? goalAmount.toLocaleString() : 0}`
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
    await handleBalanceCommand(chatId, req.headers.host);
    return res.status(200).json({ ok: true });
  }

  // ---- /rate ----
  if (text === "/rate") {
    try {
      const rate = await getExchangeRate("KES");
      console.log("Pretium exchange-rate raw response:", JSON.stringify(rate));

      const quotedLine = rate.quoted_rate !== undefined ? `\nQuoted: ${rate.quoted_rate}` : "";
      await sendTelegramMessage(
        chatId,
        `💱 *KES Exchange Rate*\n\nBuying: ${rate.buying_rate}\nSelling: ${rate.selling_rate}${quotedLine}`
      );
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ Couldn't fetch rate: ${err.message}`);
    }
    return res.status(200).json({ ok: true });
  }

  // ---- /deposit [chain] ----
  const depositMatch = text.match(/^\/deposit(?:\s+(\w+))?$/i);
  if (depositMatch) {
    const requestedChain = depositMatch[1];
    try {
      const account = await getAccountDetail();
      const networks = account.networks || [];

      if (networks.length === 0) {
        await sendTelegramMessage(chatId, "No network data returned from Pretium.");
        return res.status(200).json({ ok: true });
      }

      if (requestedChain) {
        const match = networks.find((n) => n.name?.toUpperCase() === requestedChain.toUpperCase());
        if (!match) {
          const available = networks.map((n) => n.name).join(", ");
          await sendTelegramMessage(chatId, `❌ No network found matching "${requestedChain}".\nAvailable: ${available}`);
          return res.status(200).json({ ok: true });
        }
        const assets = (match.assets || []).map((a) => a.name).join(", ");
        await sendTelegramMessage(
          chatId,
          `📥 *${match.name} Deposit Address*\n\n\`${match.settlement_wallet_address}\`\n\nAccepted assets: ${assets || "n/a"}\n\n_Send only these assets on this network to this address._`
        );
      } else {
        const lines = networks.map((n) => {
          const assets = (n.assets || []).map((a) => a.name).join("/");
          return `*${n.name}* (${assets})\n\`${n.settlement_wallet_address}\``;
        });
        await sendTelegramMessage(chatId, `📥 *All Deposit Addresses*\n\n${lines.join("\n\n")}`);
      }
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ Couldn't fetch deposit address: ${err.message}`);
    }
    return res.status(200).json({ ok: true });
  }

  // ---- /cryptobalance ----
  if (text === "/cryptobalance") {
    try {
      const account = await getAccountDetail();
      const walletLines = (account.wallets || [])
        .map((w) => `💰 ${w.currency}: ${Number(w.balance).toLocaleString()} (${w.country_name})`)
        .join("\n");
      await sendTelegramMessage(
        chatId,
        `🏦 *Pretium Account*\n\n${account.name || ""}\nStatus: ${account.status || "unknown"}\n\n${walletLines || "No wallet data returned."}`
      );
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ Couldn't fetch account: ${err.message}`);
    }
    return res.status(200).json({ ok: true });
  }

  // ---- /payout <amount> <destination> <chain> <txhash> ----
  const payoutMatch = text.match(/^\/payout\s+(\d+)\s+(\+?\d{9,12})\s+(\w+)\s+(\S+)$/i);
  if (payoutMatch) {
    const [, amount, destination, chain, txHash] = payoutMatch;

    if (!isSupportedChainAsset(chain, "USDT") && !isSupportedChainAsset(chain, "USDC")) {
      await sendTelegramMessage(chatId, `❌ Unsupported chain: ${chain}. See /help for supported networks.`);
      return res.status(200).json({ ok: true });
    }
    if (!isValidTxHash(txHash)) {
      await sendTelegramMessage(chatId, `❌ That doesn't look like a valid transaction hash. Double-check and try again.`);
      return res.status(200).json({ ok: true });
    }

    await savePendingCrypto(chatId, { action: "payout", amount, destination, chain, txHash });
    await sendTelegramMessage(
      chatId,
      `⚠️ *Confirm Payout*\nKES ${amount} → ${destination}\nChain: ${chain.toUpperCase()}\nTx: \`${txHash}\`\n\n` +
        `This sends real money out and can't be undone once confirmed. Reply with your PIN within 2 minutes to proceed.`
    );
    return res.status(200).json({ ok: true });
  }

  // ---- /buycrypto <amount> <phone> <chain> <asset> <wallet> ----
  const buyCryptoMatch = text.match(/^\/buycrypto\s+(\d+)\s+(\+?\d{9,12})\s+(\w+)\s+(\w+)\s+(\S+)$/i);
  if (buyCryptoMatch) {
    const [, amount, phone, chain, asset, wallet] = buyCryptoMatch;

    if (!isSupportedChainAsset(chain, asset)) {
      await sendTelegramMessage(chatId, `❌ ${asset.toUpperCase()} isn't supported on ${chain.toUpperCase()}. Check /help for valid combinations.`);
      return res.status(200).json({ ok: true });
    }

    await savePendingCrypto(chatId, { action: "buycrypto", amount, phone, chain, asset, wallet });
    await sendTelegramMessage(
      chatId,
      `⚠️ *Confirm Purchase*\nKES ${amount} → ${asset.toUpperCase()} on ${chain.toUpperCase()}\nWallet: \`${wallet}\`\n\n` +
        `Reply with your PIN within 2 minutes to trigger the M-Pesa prompt.`
    );
    return res.status(200).json({ ok: true });
  }

  // ---- /cryptohistory ----
  if (text === "/cryptohistory") {
    const txs = await listPretiumTx(10);
    if (txs.length === 0) {
      await sendTelegramMessage(chatId, "No crypto transactions logged yet.");
      return res.status(200).json({ ok: true });
    }
    const lines = txs.map((tx) => {
      const icon = tx.status === "COMPLETE" || tx.status === "RELEASED" ? "✅" : tx.status === "FAILED" ? "❌" : "⏳";
      return `${icon} ${tx.type === "payout" ? "Payout" : "Buy"} KES ${tx.amount} — ${tx.status}`;
    });
    await sendTelegramMessage(chatId, `📋 *Recent Crypto Activity*\n\n${lines.join("\n")}`);
    return res.status(200).json({ ok: true });
  }

  // ---- /registeragent <secret_key> ----
  const registerAgentMatch = text.match(/^\/registeragent\s+(\S+)$/i);
  if (registerAgentMatch) {
    const secretKey = registerAgentMatch[1].replace(/^<|>$/g, "").trim();
    try {
      const result = await registerAgent(secretKey);
      const agentId = result.agent_id || result.id || result.data?.agent_id;
      if (!agentId) {
        await sendTelegramMessage(chatId, `⚠️ Registered, but couldn't find an agent_id in the response. Raw: \`${JSON.stringify(result).slice(0, 300)}\``);
      } else {
        await saveAgentId(agentId);
        await sendTelegramMessage(chatId, `✅ *Agent registered!*\nAgent ID: \`${agentId}\`\n\nSaved — you won't need to register again.`);
      }
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ Registration failed: ${err.message}`);
    }
    return res.status(200).json({ ok: true });
  }

  // ---- /agentinfo ----
  if (text === "/agentinfo") {
    const agentId = await getAgentId();
    if (!agentId) {
      await sendTelegramMessage(chatId, "No agent registered yet. Use `/registeragent <secret_key>` first.");
      return res.status(200).json({ ok: true });
    }
    try {
      const result = await getAgent(agentId);
      const info = result.data || result;
      const policies = info.spend_policies || [];
      const policyLines = policies.length > 0
        ? policies.map((p) => `  • ${p.asset_type}: auto-approve up to ${p.max_auto_approve_amount}`).join("\n")
        : "  None set — use /agentpolicy to add one";

      await sendTelegramMessage(
        chatId,
        `🤖 *${info.partner_name || "Agent"}*\n` +
          `━━━━━━━━━━━━━━━━━━━\n\n` +
          `🆔 \`${info.agent_identity || agentId}\`\n` +
          `💳 Wallet: \`${info.agent_erc20_wallet || "n/a"}\`\n` +
          `📅 Created: ${info.created_at ? new Date(info.created_at).toLocaleDateString() : "n/a"}\n\n` +
          `*Spend Policies*\n${policyLines}`
      );
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ Couldn't fetch agent info: ${err.message}`);
    }
    return res.status(200).json({ ok: true });
  }

  // ---- /agentpolicy <fiat|stablecoin> <max_amount> [currency] [daily] [monthly] ----
  const agentPolicyMatch = text.match(/^\/agentpolicy\s+(fiat|stablecoin)\s+([\d.]+)(?:\s+(\w+))?(?:\s+([\d.]+))?(?:\s+([\d.]+))?$/i);
  if (agentPolicyMatch) {
    const [, assetType, maxAmount, currencyCode, dailyLimit, monthlyLimit] = agentPolicyMatch;
    const agentId = await getAgentId();
    if (!agentId) {
      await sendTelegramMessage(chatId, "No agent registered yet. Use `/registeragent <secret_key>` first.");
      return res.status(200).json({ ok: true });
    }
    try {
      await createAgentSpendPolicy({ agentId, assetType, currencyCode, maxAutoApproveAmount: maxAmount, dailyLimit, monthlyLimit });
      await sendTelegramMessage(
        chatId,
        `✅ *Spend policy set*\nType: ${assetType}\nAuto-approve up to: ${maxAmount}${currencyCode ? ` ${currencyCode}` : ""}` +
          (dailyLimit ? `\nDaily limit: ${dailyLimit}` : "") +
          (monthlyLimit ? `\nMonthly limit: ${monthlyLimit}` : "")
      );
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ Couldn't set policy: ${err.message}`);
    }
    return res.status(200).json({ ok: true });
  }

  // ---- /agentbalance <fiat|stablecoin> [currency_or_asset] [network] ----
  const agentBalanceMatch = text.match(/^\/agentbalance\s+(fiat|stablecoin)(?:\s+(\w+))?(?:\s+(\w+))?$/i);
  if (agentBalanceMatch) {
    const [, assetType, second, network] = agentBalanceMatch;
    const agentId = await getAgentId();
    if (!agentId) {
      await sendTelegramMessage(chatId, "No agent registered yet. Use `/registeragent <secret_key>` first.");
      return res.status(200).json({ ok: true });
    }
    try {
      const params = { agentId, assetType };
      if (assetType.toLowerCase() === "fiat") params.currencyCode = second;
      else {
        params.assetCode = second;
        params.network = network;
      }
      const result = await getAgentBalance(params);
      const data = result.data || result;

      // Try common field names for the actual balance value - we haven't
      // seen a complete response yet, so stay defensive here.
      const balanceValue = data.balance ?? data.amount ?? data.available_balance ?? null;
      const unit = assetType.toLowerCase() === "fiat" ? data.currency_code : data.asset_code;

      if (balanceValue !== null) {
        await sendTelegramMessage(
          chatId,
          `💰 *Agent Balance*\n\n` +
            `${assetType === "fiat" ? "💵" : "🪙"} *${Number(balanceValue).toLocaleString()} ${unit || ""}*\n` +
            (data.network ? `Network: ${data.network}\n` : "") +
            `\n_Agent: ${data.agent_id || agentId}_`
        );
      } else {
        // Balance field name didn't match our guesses - show raw so nothing's hidden
        await sendTelegramMessage(chatId, `💰 *Agent Balance*\n\n\`${JSON.stringify(data, null, 2).slice(0, 800)}\``);
      }
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ Couldn't fetch balance: ${err.message}`);
    }
    return res.status(200).json({ ok: true });
  }

  // ---- /agentpayout <amount> <currency> <mobile|paybill|bank_transfer|buy_goods> <destination> [mobile_network] ----
  const agentPayoutMatch = text.match(/^\/agentpayout\s+([\d.]+)\s+(\w+)\s+(mobile|paybill|bank_transfer|buy_goods)\s+(\S+)(?:\s+(\w+))?$/i);
  if (agentPayoutMatch) {
    const [, amount, currencyCode, type, destination, mobileNetwork] = agentPayoutMatch;
    const agentId = await getAgentId();
    if (!agentId) {
      await sendTelegramMessage(chatId, "No agent registered yet. Use `/registeragent <secret_key>` first.");
      return res.status(200).json({ ok: true });
    }
    await savePendingCrypto(chatId, {
      action: "agentpayout",
      agentId,
      amount,
      currencyCode: currencyCode.toUpperCase(),
      type,
      destination,
      mobileNetwork: mobileNetwork || "mpesa",
    });
    await sendTelegramMessage(
      chatId,
      `⚠️ *Confirm Agent Payout*\n${currencyCode.toUpperCase()} ${amount} → ${destination}\nType: ${type}\n\nThis pays out directly from your agent's balance — no transaction hash needed. Reply with your PIN within 2 minutes to proceed.`
    );
    return res.status(200).json({ ok: true });
  }

  // ---- /agentsend <amount> <network> <address> [asset] ----
  const agentSendMatch = text.match(/^\/agentsend\s+([\d.]+)\s+(celo|base|bnb)\s+(\S+)(?:\s+(\w+))?$/i);
  if (agentSendMatch) {
    const [, amount, network, address, assetCode] = agentSendMatch;
    const agentId = await getAgentId();
    if (!agentId) {
      await sendTelegramMessage(chatId, "No agent registered yet. Use `/registeragent <secret_key>` first.");
      return res.status(200).json({ ok: true });
    }
    await savePendingCrypto(chatId, {
      action: "agentsend",
      agentId,
      amount,
      network: network.toLowerCase(),
      address,
      assetCode: assetCode || "USDT",
    });
    await sendTelegramMessage(
      chatId,
      `⚠️ *Confirm Agent Stablecoin Send*\n${amount} ${assetCode || "USDT"} on ${network.toUpperCase()}\nTo: \`${address}\`\n\nReply with your PIN within 2 minutes to proceed.`
    );
    return res.status(200).json({ ok: true });
  }

  // ---- /agentstatus <reference> [currency] ----
  const agentStatusMatch = text.match(/^\/agentstatus\s+(\S+)(?:\s+(\w+))?$/i);
  if (agentStatusMatch) {
    const [, reference, currencyCode] = agentStatusMatch;
    const agentId = await getAgentId();
    if (!agentId) {
      await sendTelegramMessage(chatId, "No agent registered yet. Use `/registeragent <secret_key>` first.");
      return res.status(200).json({ ok: true });
    }
    try {
      const status = await getAgentFiatOrderStatus({ agentId, reference, currencyCode });
      await sendTelegramMessage(chatId, `📋 *Order Status*\n\n\`${JSON.stringify(status, null, 2).slice(0, 800)}\``);
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ Couldn't fetch status: ${err.message}`);
    }
    return res.status(200).json({ ok: true });
  }

  // ---- /cryptorefund <chain> <txhash> ----
  const cryptoRefundMatch = text.match(/^\/cryptorefund\s+(\w+)\s+(\S+)$/i);
  if (cryptoRefundMatch) {
    const [, chain, txHash] = cryptoRefundMatch;
    try {
      await refundTransaction(chain.toUpperCase(), txHash);
      await sendTelegramMessage(chatId, `✅ Refund requested for transaction \`${txHash}\` on ${chain.toUpperCase()}.`);
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ Refund request failed: ${err.message}`);
    }
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

  // ---- Crypto confirmation requires the actual PIN, not just "YES" ----
  const pendingCrypto = await getPendingCrypto(chatId);
  if (pendingCrypto) {
    const pin = process.env.PRETIUM_PIN;
    if (pin && text === pin) {
      await clearPendingCrypto(chatId);
      if (pendingCrypto.action === "payout") {
        await executePayout(chatId, pendingCrypto, req.headers.host);
      } else if (pendingCrypto.action === "buycrypto") {
        await executeBuyCrypto(chatId, pendingCrypto, req.headers.host);
      } else if (pendingCrypto.action === "agentpayout") {
        await executeAgentPayout(chatId, pendingCrypto);
      } else if (pendingCrypto.action === "agentsend") {
        await executeAgentSend(chatId, pendingCrypto);
      }
      return res.status(200).json({ ok: true });
    } else if (/^yes$/i.test(text)) {
      await sendTelegramMessage(chatId, "🔒 Crypto actions need your PIN to confirm, not YES. Reply with your PIN.");
      return res.status(200).json({ ok: true });
    }
    // Any other message: fall through to normal processing, pending crypto
    // just expires naturally after 2 minutes if never confirmed.
  }

  // ---- Confirm a pending large M-Pesa payment: user replies YES ----
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
      await handleBalanceCommand(chatId, req.headers.host);
      replyForHistory = "[Showed balance]";
    } else if (parsed.intent === "crypto_rate") {
      try {
        const rate = await getExchangeRate("KES");
        const quotedLine = rate.quoted_rate !== undefined ? `\nQuoted: ${rate.quoted_rate}` : "";
        const msg = `💱 *KES Exchange Rate*\n\nBuying: ${rate.buying_rate}\nSelling: ${rate.selling_rate}${quotedLine}`;
        await sendTelegramMessage(chatId, msg);
        replyForHistory = "[Showed exchange rate]";
      } catch (err) {
        await sendTelegramMessage(chatId, `❌ Couldn't fetch rate: ${err.message}`);
        replyForHistory = "[Rate fetch failed]";
      }
    } else if (parsed.intent === "crypto_balance") {
      try {
        const account = await getAccountDetail();
        const walletLines = (account.wallets || [])
          .map((w) => `💰 ${w.currency}: ${Number(w.balance).toLocaleString()} (${w.country_name})`)
          .join("\n");
        await sendTelegramMessage(chatId, `🏦 *Pretium Account*\n\n${account.name || ""}\n\n${walletLines || "No wallet data returned."}`);
        replyForHistory = "[Showed Pretium balance]";
      } catch (err) {
        await sendTelegramMessage(chatId, `❌ Couldn't fetch account: ${err.message}`);
        replyForHistory = "[Pretium balance fetch failed]";
      }
    } else if (parsed.intent === "crypto_deposit") {
      try {
        const account = await getAccountDetail();
        const networks = account.networks || [];
        if (parsed.chain) {
          const match = networks.find((n) => n.name?.toUpperCase() === parsed.chain.toUpperCase());
          if (match) {
            const assets = (match.assets || []).map((a) => a.name).join(", ");
            await sendTelegramMessage(chatId, `📥 *${match.name} Deposit Address*\n\n\`${match.settlement_wallet_address}\`\n\nAccepted: ${assets}`);
          } else {
            await sendTelegramMessage(chatId, `❌ No network matching "${parsed.chain}". Available: ${networks.map((n) => n.name).join(", ")}`);
          }
        } else {
          const lines = networks.map((n) => `*${n.name}*\n\`${n.settlement_wallet_address}\``);
          await sendTelegramMessage(chatId, `📥 *All Deposit Addresses*\n\n${lines.join("\n\n")}`);
        }
        replyForHistory = "[Showed deposit address]";
      } catch (err) {
        await sendTelegramMessage(chatId, `❌ Couldn't fetch deposit address: ${err.message}`);
        replyForHistory = "[Deposit address fetch failed]";
      }
    } else if (parsed.intent === "crypto_history") {
      const txs = await listPretiumTx(10);
      if (txs.length === 0) {
        await sendTelegramMessage(chatId, "No crypto transactions logged yet.");
      } else {
        const lines = txs.map((tx) => {
          const icon = tx.status === "COMPLETE" || tx.status === "RELEASED" ? "✅" : tx.status === "FAILED" ? "❌" : "⏳";
          return `${icon} ${tx.type === "payout" ? "Payout" : "Buy"} KES ${tx.amount} — ${tx.status}`;
        });
        await sendTelegramMessage(chatId, `📋 *Recent Crypto Activity*\n\n${lines.join("\n")}`);
      }
      replyForHistory = "[Showed crypto history]";
    } else if (parsed.intent === "crypto_payout" && validAmount && parsed.chain && parsed.txHash && parsed.recipient) {
      if (!isSupportedChainAsset(parsed.chain, "USDT") && !isSupportedChainAsset(parsed.chain, "USDC")) {
        const msg = `❌ Unsupported chain: ${parsed.chain}`;
        await sendTelegramMessage(chatId, msg);
        replyForHistory = msg;
      } else if (!isValidTxHash(parsed.txHash)) {
        const msg = `❌ That transaction hash doesn't look valid — double-check it.`;
        await sendTelegramMessage(chatId, msg);
        replyForHistory = msg;
      } else {
        await savePendingCrypto(chatId, {
          action: "payout",
          amount: parsed.amount,
          destination: parsed.recipient,
          chain: parsed.chain,
          txHash: parsed.txHash,
        });
        const msg = `⚠️ *Confirm Payout*\nKES ${parsed.amount} → ${parsed.recipient}\nChain: ${parsed.chain.toUpperCase()}\nTx: \`${parsed.txHash}\`\n\nThis can't be undone. Reply with your PIN within 2 minutes to proceed.`;
        await sendTelegramMessage(chatId, msg);
        replyForHistory = "[Awaiting payout confirmation]";
      }
    } else if (parsed.intent === "crypto_buy" && validAmount && parsed.chain && parsed.asset && parsed.wallet && parsed.recipient) {
      if (!isSupportedChainAsset(parsed.chain, parsed.asset)) {
        const msg = `❌ ${parsed.asset.toUpperCase()} isn't supported on ${parsed.chain.toUpperCase()}.`;
        await sendTelegramMessage(chatId, msg);
        replyForHistory = msg;
      } else {
        await savePendingCrypto(chatId, {
          action: "buycrypto",
          amount: parsed.amount,
          phone: parsed.recipient,
          chain: parsed.chain,
          asset: parsed.asset,
          wallet: parsed.wallet,
        });
        const msg = `⚠️ *Confirm Purchase*\nKES ${parsed.amount} → ${parsed.asset.toUpperCase()} on ${parsed.chain.toUpperCase()}\nWallet: \`${parsed.wallet}\`\n\nReply with your PIN within 2 minutes to trigger the M-Pesa prompt.`;
        await sendTelegramMessage(chatId, msg);
        replyForHistory = "[Awaiting purchase confirmation]";
      }
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
    await createSTKPush({ amount, phoneNumber, reference });
    await sendTelegramMessage(chatId, `📲 Prompt sent. Waiting for client to enter M-Pesa PIN...`);
  } catch (err) {
    console.error("STK push error:", err);
    await sendTelegramMessage(chatId, `❌ Failed to send prompt: ${err.message}`);
  }
}

// Loose sanity check - real hash formats vary by chain, this just catches
// obvious typos/empty values before we waste an API call on them.
function isValidTxHash(hash) {
  return typeof hash === "string" && hash.length >= 10 && !/\s/.test(hash);
}

async function executePayout(chatId, { amount, destination, chain, txHash }, host) {
  try {
    const callbackUrl = `https://${host}/api/public/pretium-webhook?s=${process.env.PRETIUM_WEBHOOK_SECRET}`;
    const result = await payoutKES({
      type: "MOBILE",
      shortcode: destination,
      amount,
      mobileNetwork: "Safaricom",
      chain: chain.toUpperCase(),
      transactionHash: txHash,
      callbackUrl,
    });

    const txCode = result.data?.transaction_code || result.data?.id || `unknown-${Date.now()}`;
    await savePretiumTx(txCode, {
      type: "payout",
      amount: Number(amount),
      destination,
      chain: chain.toUpperCase(),
      transactionHash: txHash,
      status: "PENDING",
      chatId,
      createdAt: Date.now(),
    });

    await sendTelegramMessage(
      chatId,
      `⏳ *Payout initiated*\nKES ${amount} → ${destination}\nChain: ${chain.toUpperCase()}\nTracking: \`${txCode}\`\n\nWaiting for Pretium confirmation...`
    );
  } catch (err) {
    console.error("Payout error:", err);
    await sendTelegramMessage(chatId, `❌ Payout failed: ${err.message}`);
  }
}

async function executeBuyCrypto(chatId, { amount, phone, chain, asset, wallet }, host) {
  try {
    const callbackUrl = `https://${host}/api/public/pretium-webhook?s=${process.env.PRETIUM_WEBHOOK_SECRET}`;
    const result = await onrampKES({
      shortcode: phone,
      amount,
      mobileNetwork: "Safaricom",
      chain: chain.toUpperCase(),
      asset: asset.toUpperCase(),
      address: wallet,
      callbackUrl,
    });

    const txCode = result.data?.transaction_code || result.data?.id || `unknown-${Date.now()}`;
    await savePretiumTx(txCode, {
      type: "onramp",
      amount: Number(amount),
      phone,
      chain: chain.toUpperCase(),
      asset: asset.toUpperCase(),
      wallet,
      status: "PENDING",
      chatId,
      createdAt: Date.now(),
    });

    await sendTelegramMessage(
      chatId,
      `⏳ *STK sent for crypto purchase*\nKES ${amount} → ${asset.toUpperCase()} on ${chain.toUpperCase()}\nWallet: \`${wallet}\`\nTracking: \`${txCode}\`\n\nEnter your M-Pesa PIN, then wait for release confirmation.`
    );
  } catch (err) {
    console.error("Buy crypto error:", err);
    await sendTelegramMessage(chatId, `❌ Purchase failed: ${err.message}`);
  }
}

async function executeAgentPayout(chatId, { agentId, amount, currencyCode, type, destination, mobileNetwork }) {
  try {
    const args = { agentId, amount, currencyCode, type };
    if (type === "mobile" || type === "paybill" || type === "buy_goods") {
      args.shortcode = destination;
      if (type === "mobile") args.mobileNetwork = mobileNetwork;
      if (type === "paybill") args.accountNumber = destination; // adjust if paybill needs separate account number
    } else if (type === "bank_transfer") {
      args.accountNumber = destination;
    }

    const result = await agentCreateFiatOrder(args);
    const reference = result.reference || result.internal_reference_id || result.id || "unknown";

    await sendTelegramMessage(
      chatId,
      `✅ *Agent payout sent*\n${currencyCode} ${amount} → ${destination}\nReference: \`${reference}\`\n\nCheck status anytime with \`/agentstatus ${reference}\``
    );
  } catch (err) {
    console.error("Agent payout error:", err);
    await sendTelegramMessage(chatId, `❌ Agent payout failed: ${err.message}`);
  }
}

async function executeAgentSend(chatId, { agentId, amount, network, address, assetCode }) {
  try {
    const result = await agentCreateStablecoinOrder({ agentId, address, network, amount, assetCode });
    await sendTelegramMessage(
      chatId,
      `✅ *Stablecoin sent from agent balance*\n${amount} ${assetCode} on ${network.toUpperCase()}\nTo: \`${address}\`\n\n\`${JSON.stringify(result).slice(0, 300)}\``
    );
  } catch (err) {
    console.error("Agent send error:", err);
    await sendTelegramMessage(chatId, `❌ Agent send failed: ${err.message}`);
  }
}

async function checkLowBalanceAlert(chatId, mainBalance) {
  if (mainBalance < 100) {
    await sendTelegramMessage(chatId, `⚠️ Low Main Balance: KES ${mainBalance.toLocaleString()}. Top up?`);
  }
}

async function handleHelpCommand(chatId) {
  await sendTelegramMessage(
    chatId,
    "📖 *WHALE_SYS Pay Bot — Commands*\n\n" +
      "*Just talk to me too*\n" +
      "You don't need exact commands — try \"send 500 to john\" or \"how'd I do today\" and I'll figure it out.\n\n" +
      "`/dashboard` — open your visual dashboard\n\n" +
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
            "`/transfer <amount>` - Move money from Main to Savings\n" +
      "`/setsavings <amount>` - Manually set Savings balance\n" +
      "_Income tracks automatically from every payment received._\n\n" +
      "*Refunds*\n" +
      "`/refund <code> <reason>` — log a manual refund note\n" +
      "`/refunds` — view refund notes\n\n" +
      "*Crypto (Pretium)*\n" +
      "`/rate` — current KES exchange rate\n" +
      "`/cryptobalance` — Pretium account & wallet balances\n" +
      "`/deposit <chain>` — get deposit address for one network (or leave blank for all)\n" +
      "`/payout <amount> <phone> <chain> <txhash>` — send stablecoin proceeds to M-Pesa\n" +
      "`/buycrypto <amount> <phone> <chain> <asset> <wallet>` — buy crypto with M-Pesa\n" +
      "`/cryptohistory` — recent crypto transactions\n" +
      "`/cryptorefund <chain> <txhash>` — refund a failed crypto transaction\n" +
      "_Supported chains: CELO, BASE, STELLAR, TRON, SCROLL, SOLANA, POLYGON, ETHEREUM, BNB_\n\n" +
      "*Pretium Agent (MCP)*\n" +
      "`/registeragent <secret_key>` — one-time, activates your agent\n" +
      "`/agentinfo` — agent details\n" +
      "`/agentpolicy <fiat|stablecoin> <max> [currency] [daily] [monthly]` — set spend limits\n" +
      "`/agentbalance <fiat|stablecoin> [currency/asset] [network]` — check balance\n" +
      "`/agentpayout <amount> <currency> <type> <destination> [network]` — withdraw to fiat, no tx hash needed\n" +
      "`/agentsend <amount> <celo|base|bnb> <address> [asset]` — send stablecoin from agent balance\n" +
      "`/agentstatus <reference> [currency]` — check a payout's status\n\n" +
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

async function handleBalanceCommand(chatId, host) {
  const balance = await getBalance();
  const savings = await getSavingsBalance();
  const pendingSplit = await getPendingSplitTotal();
  const stats = await getStats();
  const totalOut = await getTotalDeducted();

  const totalMoved = stats.total + totalOut;
  const inRatio = totalMoved > 0 ? stats.total / totalMoved : 1;
  const inPct = Math.round(inRatio * 100);

  // Trend snapshot seeding (still needed here so first-ever check starts tracking)
  const snapshot = await getBalanceSnapshot();
  if (snapshot === null) {
    await saveBalanceSnapshot(balance);
  }

  const totalAssets = balance + savings;

  const header =
    `💰 *Main:* KES ${balance.toLocaleString()}\n` +
    `🏦 *Savings:* KES ${savings.toLocaleString()}\n` +
    `💎 *Net Worth:* KES ${totalAssets.toLocaleString()}\n\n` +
    `⬆️ In: KES ${stats.total.toLocaleString()}   ⬇️ Out: KES ${totalOut.toLocaleString()}  _(${inPct}% retained)_`;

  const sections = [];

  // Discipline: split bar + biggest transactions, grouped as one card section
  let discipline = "";
  if (totalAssets > 0) {
    const savingsSplitPct = Math.round((savings / totalAssets) * 100);
    const savingsFilled = Math.round((savingsSplitPct / 100) * 10);
    const splitBar = "🟢".repeat(savingsFilled) + "⚪".repeat(10 - savingsFilled);
    discipline += `🧭 *Main vs Savings*\n${splitBar}  ${savingsSplitPct}% in Savings`;
  }
  const biggestIn = await getBiggestIn();
  const biggestOutData = await getBiggestOut();
  if (biggestIn > 0 || biggestOutData.amount > 0) {
    if (discipline) discipline += "\n\n";
    discipline += `🏆 *Biggest In:* KES ${biggestIn.toLocaleString()}`;
    if (biggestOutData.amount > 0) {
      discipline += `\n🏆 *Biggest Out:* KES ${biggestOutData.amount.toLocaleString()} — ${biggestOutData.reason}`;
    }
  }
  if (discipline) sections.push(discipline);

  // Savings goal (progress tracks the SAVINGS balance, not main)
  const goal = await getSavingsGoal();
  if (goal && goal > 0) {
    const goalPct = Math.min(Math.round((savings / goal) * 100), 100);
    const goalFilled = Math.round((goalPct / 100) * 10);
    const goalBar = "🟦".repeat(goalFilled) + "⬜".repeat(10 - goalFilled);
    sections.push(`🎯 *Goal:* KES ${goal.toLocaleString()}\n${goalBar}  ${goalPct}%`);
  }

  // Pending savings transfer awaiting "WHALE approve"
  if (pendingSplit > 0) {
    sections.push(`⏳ *Pending Transfer:* KES ${pendingSplit.toLocaleString()}\nReply *WHALE approve* to move it.`);
  }

  // Recent activity feed
  const activity = await getRecentActivity(4);
  if (activity.length > 0) {
    const lines = activity.map((a) => {
      const icon = a.type === "in" ? "⬆️" : "⬇️";
      const sign = a.type === "in" ? "+" : "−";
      return `${icon} ${sign}KES ${Number(a.amount).toLocaleString()} — ${a.label}`;
    });
    sections.push(`📋 *Recent Activity*\n${lines.join("\n")}`);
  }

  const divider = "\n\n▫️▫️▫️▫️▫️▫️▫️▫️▫️▫️▫️▫️▫️▫️▫️\n\n";
  const body = sections.length > 0 ? divider + sections.join(divider) : "";

  const footer =
    `\n\n_40% is earmarked for Savings — a reminder goes out every Sunday · \`/deduct main|savings <amount>\` to log spending · \`/goal\` to set a target_`;

  const caption = header + body + footer;

  const secret = process.env.BALANCE_CARD_SECRET;
  const params = new URLSearchParams();
  if (secret) params.set("key", secret);
  params.set("t", Date.now()); // cache-bust: force Telegram to fetch a fresh image, not a cached one
  const cardUrl = `https://${host}/api/balance-card?${params.toString()}`;

  await sendTelegramPhoto(chatId, cardUrl, caption);
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
