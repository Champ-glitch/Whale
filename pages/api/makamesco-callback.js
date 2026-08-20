// pages/api/makamesco-callback.js
import { getInvoice, updateInvoiceStatus, getAdminPayment } from '../../lib/kv';
import { sendTelegramMessage, sendTelegramAnimation } from '../../lib/telegram';
import { getRandomGif, getRandomQuote } from '../../lib/extras';
import { kesToUsdt } from '../../lib/rates';
import { parseReference } from '../../lib/reference';
import { recordSuccessStats, addPendingSplit, SPLIT_RATIO, getAutoApprove, setSavingsBalance, getSavingsBalance, updateAdminPaymentStatus, addWeeklySaved } from '../../lib/kv';
import { addClientFundsHeld } from '../../lib/clientFunds';
import { logDirectPayment } from '../../lib/kv';

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

    // Figure out this payment's purpose before crediting anything, since
    // client funds must NEVER be split into savings.
    let purpose = 'income';
    let clientNote = null;

    if (accountReference.startsWith('ADMIN-')) {
      const adminPayment = await getAdminPayment(accountReference);
      if (adminPayment) {
        purpose = adminPayment.purpose || 'income';
        clientNote = adminPayment.clientNote || null;
      }
    } else if (!parseReference(accountReference)) {
      // Plain invoice code (web /link flow)
      const invoice = await getInvoice(accountReference);
      if (invoice) {
        purpose = invoice.purpose || 'income';
        clientNote = invoice.clientNote || null;
      }
    }
    // Note: Telegram-initiated /pay (WHALE:: reference) has no stored record
    // to tag, so it always defaults to 'income'. Use the admin panel's
    // Request Payment or Invoices tab to tag client funds.

    if (success) {
      // Main balance always grows on any successful payment - the money is
      // physically in the till either way.
      await recordSuccessStats(amountNum);

      if (purpose === 'client') {
        // Client's money - hold it separately, skip the 40% split entirely.
        await addClientFundsHeld(amountNum, clientNote || `Ref: ${accountReference}`);
      } else {
        // Your income - apply the normal 60/40 split.
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
    }

    if (accountReference.startsWith('ADMIN-')) {
      await updateAdminPaymentStatus(accountReference, success ? 'success' : 'failed');
      if (success) {
        await logDirectPayment(amountNum, clientNote || 'Requested payment');
      }
      return res.status(200).json({ ok: true });
    }

    const parsed = parseReference(accountReference);

    if (parsed) {
      const { chatId } = parsed;

      if (success) {
        await logDirectPayment(amountNum, 'Telegram payment');

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

    const invoiceCode = accountReference;
    const invoice = await getInvoice(invoiceCode);

    if (!invoice) {
      console.log(`No invoice/chatId to notify for:`, invoiceCode, '- balance still credited if successful');
      return res.status(200).json({ ok: true });
    }

    if (success) {
      if (invoice.status === 'success') {
        console.log(`Invoice already processed:`, invoiceCode);
        return res.status(200).json({ ok: true });
      }

      await updateInvoiceStatus(invoiceCode, "success");

      if (purpose !== 'client') {
        const adminShare = Math.round(amountNum * 0.6);
        const userShare = amountNum - adminShare;

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
        const caption = `*Client payment received*\n` +
          `KES ${amountNum.toLocaleString()}\n` +
          `Sender: ${phoneNumber}\n` +
          `M-Pesa Receipt: ${transactionId}\n` +
          `Ref: ${invoiceCode}\n` +
          `Note: ${clientNote || 'No note'}\n\n` +
          `Held for client — not split into savings.`;
        if (invoice.chatId) {
          await sendTelegramMessage(invoice.chatId, caption);
        }
      }
    } else {
      await updateInvoiceStatus(invoiceCode, "failed");
      if (invoice.chatId) {
        await sendTelegramMessage(invoice.chatId, `❌ Payment not completed. Ref: ${invoiceCode}`);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("makamesco-callback error:", err);
    return res.status(200).json({ ok: true });
  }
}
