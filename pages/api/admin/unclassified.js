// pages/api/admin/unclassified.js
import { isAuthenticated } from '../../../lib/adminAuth';
import { listUnclassified, removeUnclassified } from '../../../lib/kv';
import { reclassifyAsClientFunds } from '../../../lib/clientFunds';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const items = await listUnclassified(30);
      return res.status(200).json({ items });
    } catch (err) {
      console.error('admin/unclassified GET error:', err);
      return res.status(500).json({ error: 'Failed to load unclassified payments' });
    }
  }

  if (req.method === 'POST') {
    const { reference, classification, note } = req.body;
    if (!reference || !['income', 'client'].includes(classification)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    try {
      const items = await listUnclassified(30);
      const item = items.find((i) => i.reference === reference);
      if (!item) return res.status(404).json({ error: 'Item not found or already classified' });

      if (classification === 'client') {
        if (!note) return res.status(400).json({ error: 'Add a note describing what this is for' });
        await reclassifyAsClientFunds(item.amount, note);
      }
      // 'income' case: money is already correctly sitting in Main, nothing more to do.

      await removeUnclassified(reference);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('admin/unclassified POST error:', err);
      return res.status(500).json({ error: 'Failed to classify payment' });
    }
  }

  return res.status(405).end();
}
