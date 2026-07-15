# WHALE_SYS Pay Bot — Setup

## 1. Push to GitHub (Termux)
```
cd whale-pay-bot
git init
git add .
git commit -m "STK push telegram bot MVP"
gh repo create whale-pay-bot --private --source=. --push
```
(or push manually to an existing repo, your usual flow)

## 2. Deploy to Vercel
- Import the repo at vercel.com, or `vercel --prod` from Termux
- Add these Environment Variables in Vercel dashboard (Settings → Environment Variables):
  - `TELEGRAM_BOT_TOKEN`
  - `PAYHERO_API_USERNAME`
  - `PAYHERO_API_PASSWORD`
  - `PAYHERO_CHANNEL_ID`
  - `PAYHERO_CALLBACK_URL` → set this to `https://<your-vercel-domain>/api/payhero-callback`
- Redeploy after adding env vars so they take effect

## 3. Register the Telegram webhook
Once deployed, run this ONE time (replace placeholders):
```
curl -X POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook \
  -d "url=https://<your-vercel-domain>/api/telegram-webhook"
```
You should get `{"ok":true,"result":true,...}` back.

## 4. Test
In Telegram, message your bot:
```
/start
/pay 10 0712345678
```
Use a small amount (KES 10) for the first live test.

## Notes
- No database — the chat_id is embedded in the PayHero `external_reference` field and decoded again in the callback. Good enough for MVP / demo.
- Log the raw payload from `/api/payhero-callback` on your first real test (`console.log`, visible in Vercel → Deployments → Functions → Logs) to confirm PayHero's exact callback field names — I wrote the parser off typical PayHero docs, but confirm against the real payload before showing the client.
- If you want per-transaction history later (for the client's use case), that's where we'd bring in Supabase — same pattern as Axon Merchant.
