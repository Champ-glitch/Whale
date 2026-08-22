// pages/api/admin/push-subscribe.js
import crypto from 'crypto';
import { isAuthenticated } from '../../../lib/adminAuth';
import { savePushSubscription, removePushSubscription } from '../../../lib/kv';

function idFor(endpoint) {
  return crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 16);
}

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    try {
      await savePushSubscription(idFor(subscription.endpoint), subscription);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('push-subscribe error:', err);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    try {
      await removePushSubscription(idFor(endpoint));
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to remove subscription' });
    }
  }

  return res.status(405).end();
}
