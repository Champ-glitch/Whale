// lib/extras.js
// Small fun additions: random quotes + celebration GIF for successful payments.

export const SUCCESS_QUOTES = [
  "Money moves, WHALE_SYS grows. 🐋",
  "Another one in the bank. Self-taught, self-made.",
  "Consistency is the real hustle. Keep stacking.",
  "No PC, no problem. Just results.",
  "That's how legends build in silence.",
  "One payment at a time, one empire at a time.",
  "Discipline pays — literally.",
  "The grind doesn't stop. Neither does the cash flow.",
];

export function getRandomQuote() {
  return SUCCESS_QUOTES[Math.floor(Math.random() * SUCCESS_QUOTES.length)];
}

// A simple celebratory GIF - feel free to swap this URL for your own branded one.
export const SUCCESS_GIF_URL =
  "https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif";
