// pages/api/admin/deductions.js
import { isAuthenticated } from '../../../lib/adminAuth';
import { listDeductions, logDeduction, getTotalDeducted } from '../../../lib/kv';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const [deductions, total] = await Promise.all([listDeductions(30), getTotalDeducted()]);
      return res.status(200).json({ deductions, total });
    } catch (err) {
      console.error('admin/deductions GET error:', err);
      return res.status(500).json({ error: 'Failed to load deductions' });
    }
  }

  if (req.method === 'POST') {
    const { amount, reason } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount' });
    }
    try {
      await logDeduction(Number(amount), reason);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('admin/deductions POST error:', err);
      return res.status(500).json({ error: 'Failed to log deduction' });
    }
  }

  return res.status(405).end();
}
