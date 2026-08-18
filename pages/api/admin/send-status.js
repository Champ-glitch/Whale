// pages/api/admin/send-status.js
import { isAuthenticated } from '../../../lib/adminAuth';
import { getAdminPayment } from '../../../lib/kv';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { reference } = req.query;
  if (!reference) return res.status(400).json({ error: 'Missing reference' });

  const payment = await getAdminPayment(reference);
  if (!payment) return res.status(200).json({ status: 'unknown' });
  return res.status(200).json({ status: payment.status });
}
