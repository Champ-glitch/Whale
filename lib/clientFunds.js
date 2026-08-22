// lib/clientFunds.js
// Separate ledger for money you're holding on a client's behalf (e.g. opening
// a business account for them, paying KRA filing fees) - NOT your income.
// This money still physically sits in the till (counted in Main Balance,
// same as everything else), but it must never be split 40% into savings,
// since it was never yours to begin with.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvCommand(command) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  return data.result;
}

// Running total of client money currently held (received but not yet disbursed)
export async function getClientFundsHeld() {
  const value = await kvCommand(['GET', 'stats:client_funds_held']);
  return Number(value || 0);
}

// Call this when a client-funds payment is confirmed successful.
export async function addClientFundsHeld(amount, note = '') {
  const total = await kvCommand(['INCRBYFLOAT', 'stats:client_funds_held', amount]);
  // Lifetime total - never decreases, even when funds are later disbursed.
  // This is what lets us report "total money processed" honestly.
  await kvCommand(['INCRBYFLOAT', 'stats:client_funds_alltime', amount]);
  const key = `clientfund:${Date.now()}`;
  await kvCommand([
    'SET',
    key,
    JSON.stringify({ type: 'received', amount: Number(amount), note, at: Date.now() }),
    'EX',
    60 * 60 * 24 * 180, // 6 months of history
  ]);
  return Number(total);
}

// Lifetime total of client funds ever received - unaffected by disbursements.
export async function getClientFundsAllTime() {
  const value = await kvCommand(['GET', 'stats:client_funds_alltime']);
  return Number(value || 0);
}

// Call this when you've actually paid the money out on the client's behalf
// (e.g. sent it to KRA, deposited into their new business account).
// This reduces both the client-funds-held balance AND Main balance, since
// the money is physically leaving the till.
export async function disburseClientFunds(amount, note = '') {
  await kvCommand(['INCRBYFLOAT', 'stats:client_funds_held', -Number(amount)]);
  await kvCommand(['INCRBYFLOAT', 'stats:balance', -Number(amount)]);
  const key = `clientfund:${Date.now()}`;
  await kvCommand([
    'SET',
    key,
    JSON.stringify({ type: 'disbursed', amount: Number(amount), note, at: Date.now() }),
    'EX',
    60 * 60 * 24 * 180,
  ]);
}

export async function listClientFundsLog(limit = 20) {
  const keys = await kvCommand(['KEYS', 'clientfund:*']);
  if (!keys || keys.length === 0) return [];
  const items = [];
  for (const key of keys) {
    const value = await kvCommand(['GET', key]);
    if (value) items.push(JSON.parse(value));
  }
  items.sort((a, b) => b.at - a.at);
  return items.slice(0, limit);
}

// Money was already counted in Main balance when it arrived unclassified.
// Reclassifying reverses that credit and moves it into the client funds
// ledger instead, so the money is never counted twice.
export async function reclassifyAsClientFunds(amount, note = '') {
  await kvCommand(['INCRBYFLOAT', 'stats:balance', -Number(amount)]);
  await addClientFundsHeld(amount, note);
}
