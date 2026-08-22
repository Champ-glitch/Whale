// pages/api/makamesco-callback.js
import { getInvoice, updateInvoiceStatus, getAdminPayment, recordSuccessStats, updateAdminPaymentStatus, logDirectPayment, recordTodayStats } from '../../lib/kv';
import { sendTelegramMessage, sendTelegramAnimation } from '../../lib/telegram';
import { getRandomGif, getRandomQuote } from '../../lib/extras';
import { kesToUsdt } from '../../lib/rates';
import { parseReference } from '../../lib/reference';
import { addClientFundsHeld } from '../../lib/clientFunds';
import { sendSMS } from '../../lib/sms';

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
    // client funds must be held separately, never mixed into Main as income.
    let purpose = 'income';
    let clientNote = null;

    if (accountReference.startsWith('ADMIN-')) {
      const adminPayment = await getAdminPayment(accountReference);
      if (adminPayment) {
        purpose = adminPayment.purpose || 'income';
        clientNote = adminPayment.clientNote || null;
      }
    } else if (!parseReference(accountReference)) {
      const invoice = await getInvoice(accountReference);
      if (invoice) {
        purpose = invoice.purpose || 'income';
        clientNote = invoice.clientNote || null;
      }
    }

    if (success) {
      // Main balance grows on any successful payment - the money is
      // physically in the till either way. No split, no savings - it just
      // sits in Main until you manually deduct or disburse it.
      await recordSuccessStats(amountNum);
      await recordTodayStats(amountNum);

      if (phoneNumber) {
        await sendSMS(
          phoneNumber,
          `Thank you for trading with Whale Enterprise. We've received your payment of KES ${amountNum.toLocaleString()}. Ref: ${accountReference}.`
        );
      }

      if (purpose === 'client') {
        // Client's money - held separately, tracked in Client Funds, not
        // counted as your income.
        await addClientFundsHeld(amountNum, clientNote || `Ref: ${accountReference}`);
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

        const usdt = await kesToUsdt(amountNum);
        const usdtLine = usdt ? `~${usdt} USDT` : '';
        const quote = getRandomQuote();

        const caption = `*Payment received*\n` +
          `KES ${amountNum.toLocaleString()}${usdtLine}\n` +
          `Sender: ${phoneNumber}\n` +
          `M-Pesa Receipt: ${transactionId}\n\n` +
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
        const usdt = await kesToUsdt(amountNum);
        const usdtLine = usdt ? `~${usdt} USDT` : '';
        const quote = getRandomQuote();

        const caption = `*Payment received*\n` +
          `KES ${amountNum.toLocaleString()}${usdtLine}\n` +
          `Sender: ${phoneNumber}\n` +
          `M-Pesa Receipt: ${transactionId}\n` +
          `Ref: ${invoiceCode}\n\n` +
          `${quote}`;

        if (invoice.chatId) {
          await sendTelegramAnimation(invoice.chatId, getRandomGif(), caption);
        }
      } else {
        const caption = `*Client payment received*\n` +
          `KES ${amountNum.toLocaleString()}\n` +
          `Sender: ${phoneNumber}\n` +
          `M-Pesa Receipt: ${transactionId}\n` +
          `Ref: ${invoiceCode}\n` +
          `Note: ${clientNote || 'No note'}\n\n` +
          `Held for client — not counted as your income.`;
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
