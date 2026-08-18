// pages/api/admin/logout.js
import { clearSessionCookie } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.status(200).json({ ok: true });
}
