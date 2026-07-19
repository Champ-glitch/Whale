// lib/telegram.js
// Minimal wrapper around Telegram's sendMessage API.

export async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const body = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Telegram send failed (Markdown):", errText);

    // If the failure was a Markdown parsing error (e.g. an unescaped
    // underscore/asterisk in dynamic content like an API key or error
    // message), retry once as plain text so the message still gets through.
    if (errText.includes("can't parse entities")) {
      const plainBody = { chat_id: chatId, text };
      if (replyMarkup) plainBody.reply_markup = replyMarkup;

      const retryRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plainBody),
      });
      if (!retryRes.ok) {
        console.error("Telegram send failed (plain text retry):", await retryRes.text());
      }
    }
  }
}

export async function sendTelegramAnimation(chatId, animationUrl, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendAnimation`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      animation: animationUrl,
      caption,
      parse_mode: "Markdown",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram animation send failed:", err);
  }
}

export async function sendTelegramPhoto(chatId, photoUrl, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "Markdown",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram photo send failed:", err);
  }
}

// Acknowledges a button tap so Telegram stops showing the loading spinner on it.
export async function answerCallbackQuery(callbackQueryId, text = "") {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}
