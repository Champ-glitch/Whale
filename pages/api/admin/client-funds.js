// pages/api/admin/client-funds.js
import { isAuthenticated } from '../../../lib/adminAuth';
import { getClientFundsHeld, disburseClientFunds, listClientFundsLog } from '../../../lib/clientFunds';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const [held, log] = await Promise.all([getClientFundsHeld(), listClientFundsLog(20)]);
      return res.status(200).json({ held, log });
    } catch (err) {
      console.error('admin/client-funds GET error:', err);
      return res.status(500).json({ error: 'Failed to load client funds' });
    }
  }

  if (req.method === 'POST') {
    const { amount, note } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount' });
    }
    if (!note) {
      return res.status(400).json({ error: 'Add a note describing this disbursement' });
    }
    try {
      await disburseClientFunds(Number(amount), note);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('admin/client-funds POST error:', err);
      return res.status(500).json({ error: 'Failed to log disbursement' });
    }
  }

  return res.status(405).end();
}
