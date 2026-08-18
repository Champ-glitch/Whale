// pages/api/admin/health.js
import { isAuthenticated } from '../../../lib/adminAuth';
import { getBalance } from '../../../lib/kv';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });

  const result = { kv: false, telegram: false, makamesco: false };

  try {
    await getBalance();
    result.kv = true;
  } catch {}

  result.telegram = !!process.env.TELEGRAM_BOT_TOKEN;
  result.makamesco = !!process.env.MAKAMESCO_SECRET_KEY;

  return res.status(200).json(result);
}
