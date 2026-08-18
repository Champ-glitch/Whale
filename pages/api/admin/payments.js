// pages/api/admin/payments.js
import { isAuthenticated } from '../../../lib/adminAuth';
import { listInvoices } from '../../../lib/kv';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const invoices = await listInvoices(50);
    const payments = invoices
      .filter((i) => i.status === 'success' || i.status === 'failed')
      .map((i) => ({
        code: i.code,
        amount: i.amount,
        description: i.description,
        status: i.status,
        createdAt: i.createdAt || 0,
      }));
    return res.status(200).json({ payments });
  } catch (err) {
    console.error('admin/payments error:', err);
    return res.status(500).json({ error: 'Failed to load payments' });
  }
}
