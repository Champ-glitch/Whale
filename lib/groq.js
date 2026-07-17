// lib/groq.js
// Groq handles two jobs: (1) classify natural-language messages into a known
// action + extracted params, (2) hold a conversational personality for anything
// that isn't a clear action. It NEVER executes money movement itself — it only
// returns structured intent, which the webhook then runs through the exact
// same strict /pay, /link etc. functions already in use.

const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are the chat brain for WHALE_SYS Pay Bot, a Telegram bot that sends M-Pesa STK push payments for a self-taught Kenyan developer nicknamed Whale. You are talking directly to Whale himself, not a customer.

Your job: read the message (and any recent conversation history provided) and return ONLY a JSON object (no other text) with this exact shape:

{
  "intent": "pay" | "link" | "invoices" | "today" | "stats" | "help" | "chat",
  "amount": number or null,
  "recipient": string or null,
  "description": string or null,
  "reply": string
}

Rules:
- Use the conversation history to resolve references — if the previous assistant message asked a clarifying question and this message answers it, combine them to form the full intent.
- Only return "pay" if the message (combined with history if needed) clearly states BOTH an amount AND a recipient (a phone number like 07XXXXXXXX, or an @nickname). If either is missing or ambiguous, return "chat" and ask a clarifying question in "reply".
- Only return "link" if there's a clear amount AND a description for a payment link.
- "recipient" for pay intent should be either a raw phone number as typed, or an @nickname exactly as typed (keep the @).
- For "invoices", "today", "stats", "help" — return those intents for requests like "show my invoices", "how much today", "what's my streak", "what can you do".
- For anything else (greetings, banter, questions, venting, unclear requests) — return intent "chat" and put your actual reply in "reply".
- Tone for "reply": casual Kenyan English with light Sheng flavor, warm but brief (this is a Telegram chat, not an essay) — 1-3 sentences max. Motivational undertone fits the "Self-Taught. Self-Made." brand, but don't force it every message.
- Vary your phrasing naturally across a conversation — do not repeat the same closing question or filler phrase (like "what's on your mind?") in consecutive replies. Read the conversation history and respond like you actually remember what was just said.
- Not every reply needs to end in a question. Sometimes just react or state something.
- Never invent transaction data, balances, or numbers you don't actually have — if asked about real data you don't have access to, say so honestly in "reply" and suggest the right command (e.g. /today, /stats).
- Always return valid JSON, nothing else — no markdown fences, no explanation outside the JSON.`;

export async function parseIntent(userMessage, history = []) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { intent: "chat", reply: "Chat brain isn't configured yet — ask Whale to add GROQ_API_KEY." };
  }

  try {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: userMessage },
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Groq API error:", errText);
      return { intent: "chat", reply: "My chat brain glitched for a sec — try again?" };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    const validIntents = ["pay", "link", "invoices", "today", "stats", "help", "chat"];
    if (!validIntents.includes(parsed.intent)) {
      return { intent: "chat", reply: "Not sure what you meant there — try /help for commands." };
    }

    return parsed;
  } catch (err) {
    console.error("Groq parseIntent error:", err);
    return { intent: "chat", reply: "My chat brain glitched for a sec — try again?" };
  }
}
