// pages/api/admin/send.js
import { isAuthenticated } from '../../../lib/adminAuth';
import { createSTKPush } from '../../../lib/makamesco';
import { saveAdminPayment } from '../../../lib/kv';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).end();

  const { amount, phoneNumber, purpose, clientNote } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Enter a valid amount' });
  }
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Enter a phone number' });
  }
  const finalPurpose = purpose === 'client' ? 'client' : 'income';
  if (finalPurpose === 'client' && !clientNote) {
    return res.status(400).json({ error: 'Add a note describing what this client payment is for' });
  }

  try {
    const reference = `ADMIN-${Date.now()}`;
    await saveAdminPayment(reference, {
      amount: Number(amount),
      phoneNumber,
      status: 'pending',
      createdAt: Date.now(),
      purpose: finalPurpose,
      clientNote: finalPurpose === 'client' ? clientNote : null,
    });
    await createSTKPush({ amount: Number(amount), phoneNumber, reference });
    return res.status(200).json({ ok: true, reference });
  } catch (err) {
    console.error('admin/send error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send prompt' });
  }
}
