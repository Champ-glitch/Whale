// pages/api/admin/login.js
import { createSessionCookie, checkPassword } from '../../../lib/adminAuth';
import { checkRateLimit } from '../../../lib/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  const allowed = await checkRateLimit(`admin_login:${ip}`, 5, 300);

  if (!allowed) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  const { password } = req.body;

  if (!checkPassword(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  res.setHeader('Set-Cookie', createSessionCookie());
  return res.status(200).json({ ok: true });
}
