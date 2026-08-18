// pages/api/makamesco-callback.js
import { getInvoice, updateInvoiceStatus } from '../../lib/kv';
import { sendTelegramMessage, sendTelegramAnimation } from '../../lib/telegram';
import { getRandomGif, getRandomQuote } from '../../lib/extras';
import { kesToUsdt } from '../../lib/rates';
import { parseReference } from '../../lib/reference';
import { recordSuccessStats, addPendingSplit, SPLIT_RATIO, getAutoApprove, setSavingsBalance, getSavingsBalance, updateAdminPaymentStatus, addWeeklySaved } from '../../lib/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  try {
    const body = req.body;
    console.log("Makamesco callback:", JSON.stringify(body));

    const payload = body.data || body;
    const { status, amount, phoneNumber, accountReference, mpesaReceiptNumber } = payload;
    const transactionId = mpesaReceiptNumber;

    const success = status === 'completed' || status === 'success';
    const amountNum = Number(amount);

    if (!accountReference) {
      console.warn("Could not parse reference:", body);
      return res.status(200).json({ ok: true });
    }

    // Credit the balance on ANY successful payment, regardless of source
    // (Telegram /pay, web invoice, or admin panel) - the money genuinely arrived.
    if (success) {
      await recordSuccessStats(amountNum);

      const savingsShare = Math.round(amountNum * SPLIT_RATIO);
      const autoApprove = await getAutoApprove();
      if (autoApprove) {
        const current = await getSavingsBalance();
        await setSavingsBalance(current + savingsShare);
        await addWeeklySaved(savingsShare);
      } else {
        await addPendingSplit(savingsShare, { accountReference });
      }
    }

    if (accountReference.startsWith('ADMIN-')) {
      await updateAdminPaymentStatus(accountReference, success ? 'success' : 'failed');
      return res.status(200).json({ ok: true });
    }

    const parsed = parseReference(accountReference);

    if (parsed) {
      // Direct /pay STK push (Telegram or admin) - message chatId if we have one
      const { chatId } = parsed;

      if (success) {
        const adminShare = Math.round(amountNum * 0.6);
        const userShare = amountNum - adminShare;

        const usdt = await kesToUsdt(amountNum);
        const usdtLine = usdt ? `~${usdt} USDT` : '';
        const quote = getRandomQuote();

        const caption = `*Payment received*\n` +
          `KES ${amountNum.toLocaleString()}${usdtLine}\n` +
          `Sender: ${phoneNumber}\n` +
          `M-Pesa Receipt: ${transactionId}\n\n` +
          `Admin 60%: KES ${adminShare.toLocaleString()}\n` +
          `Your 40%: KES ${userShare.toLocaleString()}\n\n` +
          `${quote}`;

        await sendTelegramAnimation(chatId, getRandomGif(), caption);
      } else {
        await sendTelegramMessage(chatId, `❌ Payment not completed.`);
      }
      return res.status(200).json({ ok: true });
    }

    // Otherwise: check if it's a stored web invoice
    const invoiceCode = accountReference;
    const invoice = await getInvoice(invoiceCode);

    if (!invoice) {
      // Balance was already credited above (e.g. admin panel direct send with no invoice)
      console.log(`No invoice/chatId to notify for:`, invoiceCode, '- balance still credited if successful');
      return res.status(200).json({ ok: true });
    }

    if (success) {
      if (invoice.status === 'success') {
        console.log(`Invoice already processed:`, invoiceCode);
        return res.status(200).json({ ok: true });
      }

      const adminShare = Math.round(amountNum * 0.6);
      const userShare = amountNum - adminShare;

      await updateInvoiceStatus(invoiceCode, "success");

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

      await sendTelegramAnimation(invoice.chatId, getRandomGif(), caption);
    } else {
      await updateInvoiceStatus(invoiceCode, "failed");
      await sendTelegramMessage(invoice.chatId, `❌ Payment not completed. Ref: ${invoiceCode}`);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("makamesco-callback error:", err);
    return res.status(200).json({ ok: true });
  }
}
