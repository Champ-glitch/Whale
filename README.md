# Whale Enterprise Pay Bot (WHALE_SYS)

A Telegram-based M-Pesa payment system with a built-in 60/40 savings
split, crypto rails via Pretium, and a public invoice/checkout page —
built and deployed entirely from an Android phone using Termux.

**Live:** whale-gamma-pied.vercel.app
**Built by:** Anthony "Whale" Mwendwa ([@Whale_sys](https://twitter.com/Whale_sys))

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (Pages Router) |
| Hosting | Vercel (serverless + Edge functions) |
| Database | Vercel KV (Redis), accessed via a lightweight `fetch`-based REST wrapper — no `@vercel/kv` package |
| Bot | Telegram Bot API |
| Payments | PayHero (M-Pesa STK push + C2B callbacks) |
| Crypto | Pretium — both REST API and a real MCP server (`mcp.pretium.africa`) |
| AI | Groq (`llama-3.3-70b-versatile`) for natural-language command parsing |
| Images | `next/og` (Edge) for the generated "bank card" balance image and PNG receipts |
| Dev environment | Termux on Android — no PC. Edit → `git push` → `vercel --prod` |

---

## Brand

- Dark navy (`#0A1628` / `#060b14` gradient) background
- Gold (`#FFD700`) serif italic wordmark
- Teal (`#00CED1`) interactive accent
- Invoice-facing pages use **Whale Enterprise**; internal bot/dashboard branding is **WHALE_SYS**

---

## Core Concept: the 60/40 Split

Every confirmed deposit — however it arrives — is automatically split:

- **60%** stays in the **Main** account
- **40%** goes into a **pending Savings pool**

The split is triggered from inside the PayHero webhook itself
(`pages/api/payhero-callback.js`), never from a bot command — so it
fires the same way whether the money came from a payment link, a
self-sent STK push, or someone paying the Till number directly with
no reference code at all.

By default, the 40% share sits **pending** until you reply
**`WHALE approve`**. Turn on `/autoapprove on` to skip that step and
have it move to Savings the instant a deposit lands.

---

## Telegram Commands

### Payments
| Command | Description |
|---|---|
| `/pay <amount> <phone>` | Send an STK push (alias: `/p`) |
| `/pay <amount> @nickname` | Pay a saved contact |
| `/link <amount> <description>` | Create a shareable payment link (alias: `/l`) |
| Natural language | "send 500 to john", "how'd I do today" — routed through Groq with strict validation on money-moving actions |

### Two-Account System
| Command | Description |
|---|---|
| `/balance` | Visual bank card + Net Worth (Main + Savings), split bar, goal progress, recent activity |
| `WHALE approve` | Move the pending 40% split into Savings |
| `/autoapprove on \| off` | Skip manual approval — split moves instantly |
| `/deduct main <amount> [reason]` | Log an expense from Main (checks balance first) |
| `/deduct savings <amount> [reason]` | Log an expense from Savings (checks balance first) |
| `/transfer <amount>` | Manually move money Main → Savings |
| `/setsavings <amount>` | Manually override the Savings balance (doesn't touch Main or the split) |
| `/goal <amount>` | Set a savings target |
| `/report` | Weekly savings total, goal %, avg/day, top 3 spending categories |

### Invoices
| Command | Description |
|---|---|
| `/invoices` | Recent invoices |
| `/cancel <code>` | Deactivate a link |
| `/resend <code>` | Resend a link |
| `/today` / `/stats` | Daily / all-time summaries, streaks, milestones |

### Contacts & Admin
| Command | Description |
|---|---|
| `/nickname add <name> <phone>` / `/nickname list` | Saved contacts |
| `/refund <code> <reason>` / `/refunds` | Manual refund notes (M-Pesa has no reversal API) |
| `/reset` | Full data wipe (type `RESET` to confirm) |
| `/dashboard` | Telegram Mini-App style personal dashboard |

### Crypto — REST (tx-hash based)
`/rate` `/deposit [chain]` `/cryptobalance` `/payout` `/buycrypto` `/cryptohistory` `/cryptorefund`

### Crypto — Pretium Agent via MCP (balance-based, no tx hash)
`/registeragent` `/agentinfo` `/agentpolicy` `/agentbalance` `/agentpayout` `/agentsend` `/agentstatus`

---

## Architecture Notes

- **Single-user system.** Gated by `OWNER_CHAT_ID` — every KV key is
  global, not per-user, by design.
- **Two confirmation patterns, intentionally different:**
  - M-Pesa payments >KES 10,000 require a plain `YES` reply.
  - Crypto actions (any amount) require the actual `PRETIUM_PIN`, not `YES` — these are harder to reverse.
- **Manual Till deposits are caught, not ignored.** The webhook used
  to silently drop C2B payments with no `WHALE::` reference (i.e. no
  invoice/link behind them). It now records them and notifies the
  owner directly via `OWNER_CHAT_ID`.
- **Spending categories** are just the `/deduct` reason text,
  lowercased and tallied — no separate taxonomy to maintain.
- **Low-balance alerts** fire after any `/deduct` that drops Main
  below KES 100.

---

## Key Files

```
pages/api/telegram-webhook.js    Command routing, Groq fallback, all bot logic
pages/api/payhero-callback.js    C2B webhook — triggers the 60/40 split
pages/api/public/pretium-webhook.js   Crypto transaction callbacks
pages/pay/[code].js              Public invoice/checkout page (Whale Enterprise branded)
lib/kv.js                        All Redis reads/writes (invoices, balances, split, stats...)
lib/payhero.js, lib/pretium.js, lib/pretium-mcp.js   External API clients
lib/groq.js                      Natural-language intent parsing
lib/reference.js                 Builds/parses the WHALE::chatId::timestamp::code reference format
```

---

## Deploy Workflow (Termux)

```bash
cd ~/Whale
# edit files with nano, or unzip a patch into place
git add -A
git commit -m "..."
git push
vercel --prod
```

No PC involved at any point — every feature in this project, from
the first STK push integration through the 60/40 split system, the
Pretium MCP agent, and this rebrand, was built and shipped from an
Android phone.

---

*Self-Taught. Self-Made.*
