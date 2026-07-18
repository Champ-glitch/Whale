// lib/telegramAuth.js
// Verifies that a Mini App request genuinely came from Telegram, and from
// the correct account, using Telegram's official initData verification
// algorithm (HMAC-SHA256 against the bot token). This is what makes it
// impossible for anyone outside Telegram - a random visitor, a crawler, a
// leaked link - to load real data on the dashboard.

import crypto from "crypto";

export function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (computedHash !== hash) return null;

    // Reject stale auth attempts (older than 24h) as extra protection
    const authDate = Number(params.get("auth_date"));
    if (authDate && Date.now() / 1000 - authDate > 86400) return null;

    const userStr = params.get("user");
    return userStr ? JSON.parse(userStr) : null;
  } catch (err) {
    console.error("initData verification error:", err);
    return null;
  }
}
