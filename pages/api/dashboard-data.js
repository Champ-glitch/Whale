// pages/api/dashboard-data.js
import { verifyTelegramInitData } from "../../lib/telegramAuth.js";
import { getBalance, getStats, getTotalDeducted, getBalanceSnapshot, listInvoices } from "../../lib/kv.js";
import { kesToUsdt } from "../../lib/rates.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { initData } = req.body || {};
  const user = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);

  if (!user) {
    return res.status(401).json({ error: "This page can only be opened from the WHALE_SYS Telegram bot." });
  }

  const ownerChatId = process.env.OWNER_CHAT_ID;
  if (ownerChatId && String(user.id) !== String(ownerChatId)) {
    return res.status(403).json({ error: "Not authorized." });
  }

  const balance = await getBalance();
  const stats = await getStats();
  const totalOut = await getTotalDeducted();
  const usdt = await kesToUsdt(balance);
  const snapshot = await getBalanceSnapshot();

  let trendPct = null;
  if (snapshot && snapshot > 0) {
    trendPct = Math.round(((balance - snapshot) / snapshot) * 100);
  }

  const invoices = await listInvoices(100);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayInvoices = invoices.filter((i) => i.createdAt && i.createdAt >= startOfDay.getTime());
  const todaySuccess = todayInvoices.filter((i) => i.status === "success");
  const todayFailed = todayInvoices.filter((i) => i.status === "failed");
  const todayTotal = todaySuccess.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return res.status(200).json({
    balance,
    usdt,
    trendPct,
    totalIn: stats.total,
    totalOut,
    allTimeCount: stats.count,
    streak: stats.streak,
    today: {
      successCount: todaySuccess.length,
      failedCount: todayFailed.length,
      total: todayTotal,
    },
  });
}
