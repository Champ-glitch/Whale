// lib/extras.js
// Fun additions: random quotes + rotating celebration GIFs for successful payments.

export const SUCCESS_QUOTES = [
  "Money moves, WHALE_SYS grows. 🐋",
  "Another one in the bank. Self-taught, self-made.",
  "Consistency is the real hustle. Keep stacking.",
  "No PC, no problem. Just results.",
  "That's how legends build in silence.",
  "One payment at a time, one empire at a time.",
  "Discipline pays — literally.",
  "The grind doesn't stop. Neither does the cash flow.",
  "Built different. Paid different.",
  "Every shilling counted is a shilling earned.",
  "Small drops, big ocean. Keep going.",
  "This is what showing up looks like.",
  "Termux to transactions. That's the journey.",
  "You didn't wait for permission. Respect.",
  "Self-taught doesn't mean self-limited.",
  "Another W for the books.",
  "The bag doesn't build itself. You did that.",
  "Quiet hustle, loud results.",
  "Systems > motivation. This is proof.",
  "From code to cash. Full circle.",
];

export function getRandomQuote() {
  return SUCCESS_QUOTES[Math.floor(Math.random() * SUCCESS_QUOTES.length)];
}

// Rotating pool of celebration GIFs — a different one each time instead of
// always the same clip.
export const SUCCESS_GIFS = [
  "https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif", // Bart Simpson dab
  "https://media.giphy.com/media/Ud0jIDEksXLhSwufo7/giphy.gif", // celebration money
  "https://media.giphy.com/media/xT8qBfxbxaS8DRPnUY/giphy.gif", // make it rain money
  "https://media.giphy.com/media/WEvKT9ZqIFnhEdAlZC/giphy.gif", // treasure chest money
  "https://media.giphy.com/media/PqVBpJna7r8Gs/giphy.gif", // make it rain coins
];

export function getRandomGif() {
  return SUCCESS_GIFS[Math.floor(Math.random() * SUCCESS_GIFS.length)];
}
