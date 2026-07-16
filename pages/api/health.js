// pages/api/health.js
// Quick way to check if everything is actually working: /api/health

export default async function handler(req, res) {
  const results = { kv: false, telegram: false, payheroConfigured: false };

  // Check KV
  try {
    const kvRes = await fetch(process.env.KV_REST_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["PING"]),
    });
    const data = await kvRes.json();
    results.kv = data.result === "PONG";
  } catch (e) {
    results.kv = false;
  }

  // Check Telegram bot token is valid
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await tgRes.json();
    results.telegram = !!data.ok;
  } catch (e) {
    results.telegram = false;
  }

  // Just confirm PayHero env vars are present (don't actually fire a payment)
  results.payheroConfigured = !!(
    process.env.PAYHERO_BASIC_AUTH_TOKEN &&
    process.env.PAYHERO_CHANNEL_ID &&
    process.env.PAYHERO_CALLBACK_URL
  );

  const allHealthy = results.kv && results.telegram && results.payheroConfigured;

  return res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "healthy" : "degraded",
    checks: results,
    timestamp: new Date().toISOString(),
  });
}
