// pages/api/cron/weekly-summary.js
// Triggered by Vercel Cron every Monday morning. Protected by a secret so
// randoms can't trigger it by guessing the URL.

import { sendTelegramMessage } from "../../../lib/telegram.js";
import { listInvoices, getBalance, saveBalanceSnapshot } from "../../../lib/kv.js";

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const invoices = await listInvoices(200);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekInvoices = invoices.filter((i) => i.createdAt && i.createdAt >= weekAgo);

  const success = weekInvoices.filter((i) => i.status === "success");
  const failed = weekInvoices.filter((i) => i.status === "failed");
  const total = success.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const successRate = weekInvoices.length ? Math.round((success.length / weekInvoices.length) * 100) : 0;

  // Simple emoji bar instead of a rendered chart image - no native canvas
  // dependency needed, works reliably on serverless.
  const filledBlocks = Math.round(successRate / 10);
  const bar = "▓".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);

  const owner = process.env.OWNER_CHAT_ID;
  if (owner) {
    await sendTelegramMessage(
      owner,
      `📅 *Weekly Summary*\n\n` +
        `✅ Successful: ${success.length}\n` +
        `❌ Failed: ${failed.length}\n` +
        `💰 Total collected: KES ${total.toLocaleString()}\n` +
        `📈 Success rate: ${successRate}% ${bar}`
    );
  }

  // Snapshot current balance so next week's /balance can show a trend comparison.
  const currentBalance = await getBalance();
  await saveBalanceSnapshot(currentBalance);

  return res.status(200).json({ ok: true, sent: !!owner });
}
