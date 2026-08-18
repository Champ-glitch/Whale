// lib/kv.js
// Thin wrapper around Vercel's Upstash Redis REST API.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvCommand(command) {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  return data.result;
}

// ---- Invoices ----

// Store invoice data with a 48-hour expiry (auto-cleans itself, nothing to maintain)
export async function saveInvoice(code, invoiceData) {
  const value = JSON.stringify(invoiceData);
  await kvCommand(["SET", `invoice:${code}`, value, "EX", 60 * 60 * 48]);
}

export async function getInvoice(code) {
  const value = await kvCommand(["GET", `invoice:${code}`]);
  if (!value) return null;
  return JSON.parse(value);
}

export async function updateInvoiceStatus(code, status) {
  const invoice = await getInvoice(code);
  if (!invoice) return;
  invoice.status = status;
  await saveInvoice(code, invoice);
}

// Lists recent invoices. Uses KEYS (fine at this volume - only invoices within
// the 48h TTL window ever exist, so the key count stays small).
export async function listInvoices(limit = 20) {
  const keys = await kvCommand(["KEYS", "invoice:*"]);
  if (!keys || keys.length === 0) return [];

  const invoices = [];
  for (const key of keys) {
    const value = await kvCommand(["GET", key]);
    if (value) {
      const data = JSON.parse(value);
      invoices.push({ code: key.replace("invoice:", ""), ...data });
    }
  }
  invoices.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return invoices.slice(0, limit);
}

export async function deleteInvoice(code) {
  await kvCommand(["DEL", `invoice:${code}`]);
}

// ---- Rate limiting ----
// Returns true if the action is allowed, false if the limit was hit.
// Uses a simple fixed-window counter per key.
export async function checkRateLimit(key, maxCount, windowSeconds) {
  const rateKey = `ratelimit:${key}`;
  const count = await kvCommand(["INCR", rateKey]);
  if (count === 1) {
    await kvCommand(["EXPIRE", rateKey, windowSeconds]);
  }
  return count <= maxCount;
}

// ---- Pending large-payment confirmations ----
export async function savePendingPay(chatId, data) {
  await kvCommand(["SET", `pendingpay:${chatId}`, JSON.stringify(data), "EX", 120]);
}

export async function getPendingPay(chatId) {
  const value = await kvCommand(["GET", `pendingpay:${chatId}`]);
  if (!value) return null;
  return JSON.parse(value);
}

export async function clearPendingPay(chatId) {
  await kvCommand(["DEL", `pendingpay:${chatId}`]);
}
export async function recordFailedAttempt(code) {
  const key = `failcount:${code}`;
  const count = await kvCommand(["INCR", key]);
  if (count === 1) {
    await kvCommand(["EXPIRE", key, 60 * 15]); // 15 minute window
  }
  return count;
}

export async function isLockedOut(code, maxAttempts = 5) {
  const count = await kvCommand(["GET", `failcount:${code}`]);
  return count && Number(count) >= maxAttempts;
}

// ---- Nicknames (so /pay 500 @mama_mboga works) ----
export async function saveNickname(chatId, name, phone) {
  await kvCommand(["SET", `nickname:${chatId}:${name.toLowerCase()}`, phone]);
}

export async function getNickname(chatId, name) {
  return await kvCommand(["GET", `nickname:${chatId}:${name.toLowerCase()}`]);
}

export async function listNicknames(chatId) {
  const keys = await kvCommand(["KEYS", `nickname:${chatId}:*`]);
  if (!keys || keys.length === 0) return [];
  const results = [];
  for (const key of keys) {
    const phone = await kvCommand(["GET", key]);
    const name = key.split(":").slice(2).join(":");
    results.push({ name, phone });
  }
  return results;
}

// ---- Permanent stats (never expire, separate from 48h invoice TTL) ----
const MILESTONES = [1000, 5000, 10000, 50000, 100000, 500000, 1000000];

export async function recordSuccessStats(amount) {
  const total = await kvCommand(["INCRBYFLOAT", "stats:alltime_total", amount]);
  const count = await kvCommand(["INCR", "stats:alltime_count"]);

  // Every successful payment (work or personal) counts as money in.
  await kvCommand(["INCRBYFLOAT", "stats:balance", amount]);
  const currentBiggestIn = Number((await kvCommand(["GET", "stats:biggest_in"])) || 0);
  if (Number(amount) > currentBiggestIn) {
    await kvCommand(["SET", "stats:biggest_in", amount]);
  }

  // Streak: consecutive days with at least one successful payment
  const today = new Date().toISOString().split("T")[0];
  const lastDate = await kvCommand(["GET", "stats:streak_last_date"]);
  let streak = Number((await kvCommand(["GET", "stats:streak_count"])) || 0);

  if (lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    streak = lastDate === yesterday ? streak + 1 : 1;
    await kvCommand(["SET", "stats:streak_count", streak]);
    await kvCommand(["SET", "stats:streak_last_date", today]);
  }

  // Check if a milestone was just crossed
  const totalBefore = Number(total) - Number(amount);
  const crossedMilestone = MILESTONES.find((m) => totalBefore < m && Number(total) >= m);

  return { total: Number(total), count: Number(count), streak, crossedMilestone };
}

export async function getStats() {
  const total = await kvCommand(["GET", "stats:alltime_total"]);
  const count = await kvCommand(["GET", "stats:alltime_count"]);
  const streak = await kvCommand(["GET", "stats:streak_count"]);
  return {
    total: Number(total || 0),
    count: Number(count || 0),
    streak: Number(streak || 0),
  };
}

// ---- Refund notes (manual log only - M-Pesa has no API reversal) ----
export async function saveRefundNote(code, reason) {
  const key = `refund:${code}:${Date.now()}`;
  await kvCommand(["SET", key, JSON.stringify({ code, reason, at: Date.now() }), "EX", 60 * 60 * 24 * 30]);
}

export async function listRefundNotes(limit = 10) {
  const keys = await kvCommand(["KEYS", "refund:*"]);
  if (!keys || keys.length === 0) return [];
  const notes = [];
  for (const key of keys) {
    const value = await kvCommand(["GET", key]);
    if (value) notes.push(JSON.parse(value));
  }
  notes.sort((a, b) => b.at - a.at);
  return notes.slice(0, limit);
}

// ---- Full reset (dev/testing cleanup) ----
export async function savePendingReset(chatId) {
  await kvCommand(["SET", `pendingreset:${chatId}`, "1", "EX", 60]);
}

export async function getPendingReset(chatId) {
  return await kvCommand(["GET", `pendingreset:${chatId}`]);
}

export async function clearPendingReset(chatId) {
  await kvCommand(["DEL", `pendingreset:${chatId}`]);
}

// Wipes invoices, nicknames, stats, refund notes, and pending states.
// Does NOT touch rate limit counters - those are system safety, not user data.
export async function resetAll() {
  const prefixes = ["invoice:", "nickname:", "stats:", "refund:", "pendingpay:", "failcount:", "pendingreset:", "deduction:", "split:", "transfer:", "category_spent:", "weekly_saved:"];
  let deletedCount = 0;
  for (const prefix of prefixes) {
    const keys = await kvCommand(["KEYS", `${prefix}*`]);
    if (keys && keys.length > 0) {
      for (const key of keys) {
        await kvCommand(["DEL", key]);
        deletedCount++;
      }
    }
  }
  return deletedCount;
}

// ---- Short-term chat memory (for natural conversation context) ----
// Expires after 10 minutes of inactivity - enough for a real back-and-forth
// without holding onto stale context forever.
export async function getChatHistory(chatId) {
  const value = await kvCommand(["GET", `chathistory:${chatId}`]);
  if (!value) return [];
  return JSON.parse(value);
}

export async function appendChatHistory(chatId, userMsg, assistantMsg) {
  const history = await getChatHistory(chatId);
  history.push({ role: "user", content: userMsg });
  history.push({ role: "assistant", content: assistantMsg });
  // Keep only the last 3 exchanges (6 messages) to control token usage
  const trimmed = history.slice(-6);
  await kvCommand(["SET", `chathistory:${chatId}`, JSON.stringify(trimmed), "EX", 600]);
}

// ---- Groq usage tracking ----
export async function incrementGroqUsage() {
  await kvCommand(["INCR", "stats:groq_handled"]);
}

export async function getGroqUsage() {
  const count = await kvCommand(["GET", "stats:groq_handled"]);
  return Number(count || 0);
}

// ---- Bank balance tracking ----
// "In" is automatic (every successful payment adds to this via recordSuccessStats).
// "Out" is manual - nothing can see real bank withdrawals, so it relies on
// Whale telling the bot when money leaves his account.
export async function setBalance(amount) {
  await kvCommand(["SET", "stats:balance", amount]);
}

export async function getBalance() {
  const value = await kvCommand(["GET", "stats:balance"]);
  return Number(value || 0);
}

export async function logDeduction(amount, reason) {
  const key = `deduction:${Date.now()}`;
  await kvCommand(["SET", key, JSON.stringify({ amount: Number(amount), reason: reason || "Not specified", at: Date.now() }), "EX", 60 * 60 * 24 * 90]);
  await kvCommand(["INCRBYFLOAT", "stats:total_deducted", amount]);
  await kvCommand(["INCRBYFLOAT", "stats:balance", -Number(amount)]);

  const currentBiggestOut = Number((await kvCommand(["GET", "stats:biggest_out"])) || 0);
  if (Number(amount) > currentBiggestOut) {
    await kvCommand(["SET", "stats:biggest_out", amount]);
    await kvCommand(["SET", "stats:biggest_out_reason", reason || "Not specified"]);
  }
}

export async function listDeductions(limit = 10) {
  const keys = await kvCommand(["KEYS", "deduction:*"]);
  if (!keys || keys.length === 0) return [];
  const items = [];
  for (const key of keys) {
    const value = await kvCommand(["GET", key]);
    if (value) items.push(JSON.parse(value));
  }
  items.sort((a, b) => b.at - a.at);
  return items.slice(0, limit);
}

export async function getTotalDeducted() {
  const value = await kvCommand(["GET", "stats:total_deducted"]);
  return Number(value || 0);
}

// ---- Biggest transaction tracking (persistent records, no TTL) ----
export async function recordIfBiggestIn(amount) {
  const current = Number((await kvCommand(["GET", "stats:biggest_in"])) || 0);
  if (Number(amount) > current) {
    await kvCommand(["SET", "stats:biggest_in", amount]);
  }
}

export async function recordIfBiggestOut(amount, reason) {
  const current = Number((await kvCommand(["GET", "stats:biggest_out"])) || 0);
  if (Number(amount) > current) {
    await kvCommand(["SET", "stats:biggest_out", amount]);
    await kvCommand(["SET", "stats:biggest_out_reason", reason || "Not specified"]);
  }
}

export async function getBiggestIn() {
  const value = await kvCommand(["GET", "stats:biggest_in"]);
  return Number(value || 0);
}

export async function getBiggestOut() {
  const amount = await kvCommand(["GET", "stats:biggest_out"]);
  const reason = await kvCommand(["GET", "stats:biggest_out_reason"]);
  return { amount: Number(amount || 0), reason: reason || null };
}

// ---- Balance trend (weekly snapshot, updated by cron) ----
export async function saveBalanceSnapshot(amount) {
  await kvCommand(["SET", "stats:balance_snapshot", amount]);
}

export async function getBalanceSnapshot() {
  const value = await kvCommand(["GET", "stats:balance_snapshot"]);
  return value === null ? null : Number(value);
}

// ---- Savings goal ----
export async function setSavingsGoal(amount) {
  await kvCommand(["SET", "stats:savings_goal", amount]);
}

export async function getSavingsGoal() {
  const value = await kvCommand(["GET", "stats:savings_goal"]);
  return value === null ? null : Number(value);
}

// ---- Combined recent activity feed (mixes income + deductions) ----
export async function getRecentActivity(limit = 4) {
  const invoices = await listInvoices(50);
  const deductions = await listDeductions(50);

  const income = invoices
    .filter((i) => i.status === "success")
    .map((i) => ({ type: "in", amount: i.amount, label: i.description, at: i.createdAt || 0 }));

  const outgoing = deductions.map((d) => ({ type: "out", amount: d.amount, label: d.reason, at: d.at }));

  const combined = [...income, ...outgoing].sort((a, b) => b.at - a.at);
  return combined.slice(0, limit);
}

// ---- Pretium crypto transactions (separate namespace from M-Pesa invoices) ----
export async function savePretiumTx(transactionCode, data) {
  await kvCommand([
    "SET",
    `pretiumtx:${transactionCode}`,
    JSON.stringify(data),
    "EX",
    60 * 60 * 24 * 7, // 7 days, plenty for a demo/personal-use volume
  ]);
}

export async function getPretiumTx(transactionCode) {
  const value = await kvCommand(["GET", `pretiumtx:${transactionCode}`]);
  if (!value) return null;
  return JSON.parse(value);
}

export async function updatePretiumTxStatus(transactionCode, status, extra = {}) {
  const tx = await getPretiumTx(transactionCode);
  if (!tx) return;
  await savePretiumTx(transactionCode, { ...tx, status, ...extra, updatedAt: Date.now() });
}

export async function listPretiumTx(limit = 10) {
  const keys = await kvCommand(["KEYS", "pretiumtx:*"]);
  if (!keys || keys.length === 0) return [];
  const items = [];
  for (const key of keys) {
    const value = await kvCommand(["GET", key]);
    if (value) items.push(JSON.parse(value));
  }
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return items.slice(0, limit);
}

// ---- Pending crypto confirmations ----
// Unlike M-Pesa's threshold-based confirmation, EVERY crypto payout/purchase
// requires confirmation, regardless of amount - these are harder to reverse
// than M-Pesa (refunds only work for failed/unconfirmed transactions).
export async function savePendingCrypto(chatId, data) {
  await kvCommand(["SET", `pendingcrypto:${chatId}`, JSON.stringify(data), "EX", 120]);
}

export async function getPendingCrypto(chatId) {
  const value = await kvCommand(["GET", `pendingcrypto:${chatId}`]);
  if (!value) return null;
  return JSON.parse(value);
}

export async function clearPendingCrypto(chatId) {
  await kvCommand(["DEL", `pendingcrypto:${chatId}`]);
}

// ---- Two-account split system (main + savings) ----
// Main balance reuses the existing stats:balance key (unchanged behavior).
// Savings is a new key. Pending split is a running total of 40% shares
// waiting on "WHALE approve" - it does NOT leave main until approved.

const SPLIT_RATIO = 0.4; // 40% of every deposit is earmarked for savings

export async function getSavingsBalance() {
  const value = await kvCommand(["GET", "stats:balance_savings"]);
  return Number(value || 0);
}

export async function setSavingsBalance(amount) {
  await kvCommand(["SET", "stats:balance_savings", amount]);
}

export async function getPendingSplitTotal() {
  const value = await kvCommand(["GET", "split:pending_total"]);
  return Number(value || 0);
}

// Adds this deposit's 40% share to the pending pool and logs it for
// transparency. Returns the new running pending total.
export async function addPendingSplit(amount, meta = {}) {
  const total = await kvCommand(["INCRBYFLOAT", "split:pending_total", amount]);
  const key = `split:log:${Date.now()}`;
  await kvCommand([
    "SET",
    key,
    JSON.stringify({ amount: Number(amount), ...meta, at: Date.now() }),
    "EX",
    60 * 60 * 24 * 30,
  ]);
  return Number(total);
}

export async function listPendingSplitLog(limit = 10) {
  const keys = await kvCommand(["KEYS", "split:log:*"]);
  if (!keys || keys.length === 0) return [];
  const items = [];
  for (const key of keys) {
    const value = await kvCommand(["GET", key]);
    if (value) items.push(JSON.parse(value));
  }
  items.sort((a, b) => b.at - a.at);
  return items.slice(0, limit);
}

// "WHALE approve" - moves the whole pending pool from main to savings.
// Returns the amount that was moved (0 if nothing was pending).
export async function approvePendingSplit() {
  const pending = await getPendingSplitTotal();
  if (pending <= 0) return 0;
  await kvCommand(["INCRBYFLOAT", "stats:balance", -pending]);
  await kvCommand(["INCRBYFLOAT", "stats:balance_savings", pending]);
  await kvCommand(["SET", "split:pending_total", 0]);
  const keys = await kvCommand(["KEYS", "split:log:*"]);
  if (keys && keys.length > 0) {
    for (const key of keys) await kvCommand(["DEL", key]);
  }
  await addWeeklySaved(pending);
  return pending;
}

export async function deductFromSavings(amount, reason) {
  await kvCommand(["INCRBYFLOAT", "stats:balance_savings", -Number(amount)]);
  const key = `deduction:savings:${Date.now()}`;
  await kvCommand([
    "SET",
    key,
    JSON.stringify({ amount: Number(amount), reason: reason || "Not specified", account: "savings", at: Date.now() }),
    "EX",
    60 * 60 * 24 * 90,
  ]);
}

export { SPLIT_RATIO };
// ---- Feature: Auto-approve (skip "WHALE approve", split moves instantly) ----
export async function setAutoApprove(enabled) {
  await kvCommand(["SET", "autoapprove:main", enabled ? "true" : "false"]);
}

export async function getAutoApprove() {
  const value = await kvCommand(["GET", "autoapprove:main"]);
  return value === "true";
}

// ---- Feature: Weekly savings report ----
// Week key = the Sunday that starts the current week (UTC), e.g. "2026-07-19".
// Using a real date instead of a week number avoids ambiguity across years.
function getWeekKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

export async function addWeeklySaved(amount) {
  const key = `weekly_saved:${getWeekKey()}`;
  await kvCommand(["INCRBYFLOAT", key, amount]);
  await kvCommand(["EXPIRE", key, 60 * 60 * 24 * 90]); // 90 days of history is plenty
}

export async function getWeeklySaved() {
  const key = `weekly_saved:${getWeekKey()}`;
  const value = await kvCommand(["GET", key]);
  return Number(value || 0);
}

export function getDaysElapsedInWeek() {
  const day = new Date().getUTCDay(); // 0 (Sun) .. 6 (Sat)
  return day + 1;
}

// ---- Feature: Smart spending categories ----
// Category = the /deduct reason text itself, lowercased. Deductions already
// show up in /balance's recent activity via the existing deduction log -
// this just adds a running per-category total for /report's top 3.
export async function trackCategorySpend(category, amount) {
  const clean = (category || "uncategorized").trim().toLowerCase().slice(0, 40);
  await kvCommand(["INCRBYFLOAT", `category_spent:${clean}`, amount]);
}

export async function getTopCategories(limit = 3) {
  const keys = await kvCommand(["KEYS", "category_spent:*"]);
  if (!keys || keys.length === 0) return [];
  const items = [];
  for (const key of keys) {
    const value = await kvCommand(["GET", key]);
    if (value) {
      items.push({ category: key.replace("category_spent:", ""), amount: Number(value) });
    }
  }
  items.sort((a, b) => b.amount - a.amount);
  return items.slice(0, limit);
}

// ---- Feature: Manual transfer, Main -> Savings ----
export async function transferToSavings(amount) {
  await kvCommand(["INCRBYFLOAT", "stats:balance", -Number(amount)]);
  await kvCommand(["INCRBYFLOAT", "stats:balance_savings", Number(amount)]);
  const key = `transfer:${Date.now()}`;
  await kvCommand([
    "SET",
    key,
    JSON.stringify({ amount: Number(amount), note: `Transferred KES ${amount} from Main to Savings`, at: Date.now() }),
    "EX",
    60 * 60 * 24 * 90,
  ]);
}

// ---- Feature: /setsavings - manual override, does NOT touch main or the split ----
export async function logSavingsSet(amount) {
  const key = `transfer:${Date.now()}`;
  await kvCommand([
    "SET",
    key,
    JSON.stringify({ amount: Number(amount), note: `Savings balance manually set to KES ${amount}`, at: Date.now() }),
    "EX",
    60 * 60 * 24 * 90,
  ]);
}

// ---- Pretium Agent (MCP) - persistent, no TTL ----
export async function saveAgentId(agentId) {
  await kvCommand(["SET", "pretium:agent_id", agentId]);
}

export async function getAgentId() {
  const value = await kvCommand(["GET", "pretium:agent_id"]);
  return value || null;
}

// ---- Admin-panel direct sends (short-lived, just for UI status polling) ----
export async function saveAdminPayment(reference, data) {
  await kvCommand(["SET", `adminpay:${reference}`, JSON.stringify(data), "EX", 600]);
}

export async function getAdminPayment(reference) {
  const value = await kvCommand(["GET", `adminpay:${reference}`]);
  if (!value) return null;
  return JSON.parse(value);
}

export async function updateAdminPaymentStatus(reference, status) {
  const payment = await getAdminPayment(reference);
  if (!payment) return;
  payment.status = status;
  await kvCommand(["SET", `adminpay:${reference}`, JSON.stringify(payment), "EX", 600]);
}

// ---- Balance trend for dashboard sparkline (daily snapshots, 14-day rolling) ----
export async function recordDailyBalanceSnapshot() {
  const today = new Date().toISOString().split("T")[0];
  const balance = await getBalance();
  const savings = await getSavingsBalance();
  const total = balance + savings;
  await kvCommand(["SET", `dailysnapshot:${today}`, JSON.stringify({ total, at: Date.now() }), "EX", 60 * 60 * 24 * 14]);
}

export async function getRecentSnapshots(days = 7) {
  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    const value = await kvCommand(["GET", `dailysnapshot:${d}`]);
    results.push({ date: d, total: value ? JSON.parse(value).total : null });
  }
  return results;
}
