// pages/api/admin/reset.js
import { isAuthenticated } from '../../../lib/adminAuth';
import { resetAll } from '../../../lib/kv';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).end();

  const { confirm } = req.body;
  if (confirm !== 'RESET') {
    return res.status(400).json({ error: 'Type RESET exactly to confirm' });
  }

  try {
    const deletedCount = await resetAll();
    return res.status(200).json({ ok: true, deletedCount });
  } catch (err) {
    console.error('admin/reset error:', err);
    return res.status(500).json({ error: 'Reset failed' });
  }
}
