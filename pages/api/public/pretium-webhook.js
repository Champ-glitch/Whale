// pages/api/public/pretium-webhook.js
// Receives Pretium's two callback types: payout/off-ramp status, and
// on-ramp asset release confirmation. Verifies the shared secret before
// trusting anything in the payload.

import crypto from "crypto";
import { updatePretiumTxStatus, getPretiumTx } from "../../../lib/kv.js";
import { sendTelegramMessage } from "../../../lib/telegram.js";

function verifySecret(providedSecret) {
  const expected = process.env.PRETIUM_WEBHOOK_SECRET;
  if (!expected || !providedSecret) return false;

  const a = Buffer.from(providedSecret);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const providedSecret = req.query.s;
  if (!verifySecret(providedSecret)) {
    console.warn("Pretium webhook: invalid or missing secret");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body;
  console.log("Pretium webhook received:", JSON.stringify(body));

  const owner = process.env.OWNER_CHAT_ID;

  try {
    // Off-ramp / payout status callback
    if (body.status && body.transaction_code) {
      await updatePretiumTxStatus(body.transaction_code, body.status, {
        receiptNumber: body.receipt_number,
        publicName: body.public_name,
        message: body.message,
      });

      if (owner) {
        const icon = body.status === "COMPLETE" ? "✅" : body.status === "FAILED" ? "❌" : "⏳";
        await sendTelegramMessage(
          owner,
          `${icon} *Crypto Payout Update*\nStatus: ${body.status}\n` +
            (body.receipt_number ? `Receipt: \`${body.receipt_number}\`\n` : "") +
            (body.message ? `${body.message}` : "")
        );
      }
    }

    // On-ramp / asset release callback
    if (typeof body.is_released !== "undefined" && body.transaction_code) {
      await updatePretiumTxStatus(body.transaction_code, body.is_released ? "RELEASED" : "PENDING", {
        transactionHash: body.transaction_hash,
      });

      if (owner) {
        await sendTelegramMessage(
          owner,
          body.is_released
            ? `✅ *Crypto Released*\nTx: \`${body.transaction_hash}\``
            : `⏳ Crypto release still pending for transaction \`${body.transaction_code}\``
        );
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Pretium webhook processing error:", err);
    // Still acknowledge with 200 so Pretium doesn't endlessly retry a broken handler
    return res.status(200).json({ ok: true });
  }
}
