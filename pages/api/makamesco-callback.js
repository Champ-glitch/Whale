// pages/api/makamesco-callback.js
import { getInvoice, updateInvoiceStatus } from '../../lib/kv';;
import { sendTelegramMessage, sendTelegramAnimation } from '../../lib/telegram';
import { getRandomGif, getRandomQuote } from '../../lib/extras';
import { kesToUsdt } from '../../lib/rates.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  try {
    const body = req.body;
    console.log("Makamesco callback:", JSON.stringify(body));

    const { status, amount, phoneNumber, accountReference, transactionId } = body;

    const success = status === 'success';
    const invoiceCode = accountReference;

    if (!invoiceCode) {
      console.warn("Could not parse reference:", body);
      return res.status(200).json({ ok: true });
    }

    if (success) {
      const invoice = await kv.get(`invoice:${invoiceCode}`);
      if (!invoice || invoice.paid) {
        console.log('Invoice already processed:', invoiceCode);
        return res.status(200).json({ ok: true });
      }

      const amountNum = Number(amount);
      const adminShare = Math.round(amountNum * 0.6);
      const userShare = amountNum - adminShare;

      await kv.incrby('balance:admin', adminShare);
      await kv.incrby(`balance:user:${invoice.userId}`, userShare);

      await kv.set(`invoice:${invoiceCode}`, {
        ...invoice,
        paid: true,
        tx: transactionId,
        paidAt: new Date().toISOString()
      });

      const usdt = await kesToUsdt(amountNum);
      const usdtLine = usdt ? `\n${usdt} USDT` : '';
      const quote = getRandomQuote();
      
      const caption = `✅ *Payment received*\n` +
        `KES ${amountNum.toLocaleString()}${usdtLine}\n` +
        `(Sender: ${phoneNumber})\n` +
        `M-Pesa Receipt: ${transactionId}\n` +
        `Ref: ${invoiceCode}\n\n` +
        `Admin 60%: KES ${adminShare.toLocaleString()}\n` +
        `Your 40%: KES ${userShare.toLocaleString()}\n\n` +
        `_${quote}_`;

      await sendTelegramAnimation(invoice.chatId, getRandomGif(), caption);

    } else {
      const invoice = await kv.get(`invoice:${invoiceCode}`);
      if (invoice) {
        await sendTelegramMessage(invoice.chatId, `❌ Payment not completed. Ref: ${invoiceCode}`);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("makamesco-callback error:", err);
    return res.status(200).json({ ok: true });
  }
}
