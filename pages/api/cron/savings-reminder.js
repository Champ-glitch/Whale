// pages/api/cron/savings-reminder.js
// Triggered by Vercel Cron every Sunday morning. Reads the same pending
// split total that "WHALE approve" has always used - deposits keep
// accumulating into it silently all week (no per-deposit message anymore,
// since Till funds can't be moved to Savings automatically). This just
// tells you the number to physically send to your personal bank.
//
// Reply "WHALE approve" once you've sent it, same as before - that's
// what actually clears this total and updates the bot's Savings number.

import { sendTelegramMessage } from "../../../lib/telegram.js";
import { getPendingSplitTotal } from "../../../lib/kv.js";

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pending = await getPendingSplitTotal();
  const owner = process.env.OWNER_CHAT_ID;

  if (owner) {
    if (pending > 0) {
      await sendTelegramMessage(
        owner,
        `🏦 *Weekend Savings Reminder*\n\n` +
          `You have *KES ${pending.toLocaleString()}* earmarked for Savings this week.\n\n` +
          `Send it to your personal bank, then reply *WHALE approve* to update the numbers.`
      );
    } else {
      await sendTelegramMessage(
        owner,
        `🏦 *Weekend Savings Reminder*\n\nNothing pending this week — you're all caught up.`
      );
    }
  }

  return res.status(200).json({ ok: true, sent: !!owner, pending });
}
