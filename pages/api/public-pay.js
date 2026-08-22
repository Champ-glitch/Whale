// pages/api/public-pay.js
import { saveInvoice, updateInvoiceStatus, checkRateLimit } from '../../lib/kv';
import { createSTKPush } from '../../lib/makamesco';

function generateCode() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `WHL-${year}-${rand}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { amount, phone, description } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Enter a valid amount' });
  }
  if (!phone) {
    return res.status(400).json({ error: 'Enter a phone number' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  const allowed = await checkRateLimit(`public_pay:${ip}`, 10, 600);
  if (!allowed) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  const code = generateCode();

  try {
    await saveInvoice(code, {
      amount: Number(amount),
      description: (description || '').trim() || 'Payment to Whale Enterprise',
      status: 'pending',
      createdAt: Date.now(),
      source: 'public',
      purpose: 'unclassified',
    });
    await createSTKPush({ amount: Number(amount), phoneNumber: phone, reference: code });
    return res.status(200).json({ code });
  } catch (err) {
    console.error('public-pay error:', err);
    await updateInvoiceStatus(code, 'failed').catch(() => {});
    return res.status(500).json({ error: err.message || 'Failed to send prompt' });
  }
}
