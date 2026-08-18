// lib/adminAuth.js
import crypto from 'crypto';

const COOKIE_NAME = 'whale_admin_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createSessionCookie() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return `${COOKIE_NAME}=${secret}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function isAuthenticated(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  return safeEqual(decodeURIComponent(match[1]), process.env.ADMIN_SESSION_SECRET);
}

export function checkPassword(input) {
  return safeEqual(input || '', process.env.ADMIN_PASSWORD || '');
}

export { COOKIE_NAME };
