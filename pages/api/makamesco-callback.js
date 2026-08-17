// pages/api/makamesco-callback.js
import { getInvoice, updateInvoiceStatus } from '../../lib/kv';
import { sendTelegramMessage, sendTelegramAnimation } from '../../lib/telegram';
import { getRandomGIF, getRandomQuote } from '../../lib/extras';
import { kesToUsdt } from '../../lib/rates';

// Helper to save invoice with full data
async function saveInvoice(code, data) {
  await updateInvoiceStatus(code, data.status || 'success');
  // We don't have a generic "set" so we update status only. 
  // If you need to save more fields, add them to lib/kv.js
}

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
      const invoice = await getInvoice(invoiceCode);
      if (!invoice || invoice.status === 'success') {
        console.log(`Invoice already processed:`, invoiceCode);
        return res.status(200).json({ ok: true });
      }

      const amountNum = Number(amount);
      const adminShare = Math.round(amountNum * 0.6);
      const userShare = amountNum - adminShare;

      // Update invoice to success
      await updateInvoiceStatus(invoiceCode, "success");

      // Note: incrby for balances is not in kv.js yet. 
      // If you need this, we add it to lib/kv.js next. For now we skip to avoid crash.

      const usdt = await kesToUsdt(amountNum);
      const usdtLine = usdt ? `~${usdt} USDT` : '';
      const quote = getRandomQuote();

      const caption = `*Payment received*\n` +
        `KES ${amountNum.toLocaleString()}${usdtLine}\n` +
        `Sender: ${phoneNumber}\n` +
        `M-Pesa Receipt: ${transactionId}\n` +
        `Ref: ${invoiceCode}\n\n` +
        `Admin 60%: KES ${adminShare.toLocaleString()}\n` +
        `Your 40%: KES ${userShare.toLocaleString()}\n\n` +
        `${quote}`;

      await sendTelegramAnimation(invoice.chatId, getRandomGIF(), caption);

    } else {
      const invoice = await getInvoice(invoiceCode);
      if (invoice) {
        await updateInvoiceStatus(invoiceCode, "failed");
        await sendTelegramMessage(invoice.chatId, `❌ Payment not completed. Ref: ${invoiceCode}`);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("makamesco-callback error:", err);
    return res.status(200).json({ ok: true });
  }
}
