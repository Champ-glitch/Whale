// pages/api/admin/invoices.js
import { isAuthenticated } from '../../../lib/adminAuth';
import { listInvoices, saveInvoice } from '../../../lib/kv';

function generateCode() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `WHL-${year}-${rand}`;
}

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const invoices = await listInvoices(50);
      return res.status(200).json({ invoices });
    } catch (err) {
      console.error('admin/invoices GET error:', err);
      return res.status(500).json({ error: 'Failed to load invoices' });
    }
  }

  if (req.method === 'POST') {
    const { amount, description } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount' });
    }
    try {
      const code = generateCode();
      await saveInvoice(code, {
        amount: Number(amount),
        description: description || 'Payment',
        status: 'pending',
        createdAt: Date.now(),
        source: 'admin',
      });
      return res.status(200).json({ code, url: `/pay/${code}` });
    } catch (err) {
      console.error('admin/invoices POST error:', err);
      return res.status(500).json({ error: 'Failed to create invoice' });
    }
  }

  return res.status(405).end();
}
