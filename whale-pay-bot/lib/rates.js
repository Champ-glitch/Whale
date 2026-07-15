// lib/rates.js
// Fetches a live KES -> USDT conversion rate from a free public API.

export async function getKesToUsdtRate() {
  try {
    // CoinGecko public endpoint - no API key needed for this simple lookup.
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=kes"
    );
    const data = await res.json();
    const kesPerUsdt = data?.tether?.kes;

    if (!kesPerUsdt) return null;
    return kesPerUsdt; // e.g. 129.3 KES per 1 USDT
  } catch (err) {
    console.error("Rate fetch failed:", err);
    return null;
  }
}

export async function kesToUsdt(kesAmount) {
  const rate = await getKesToUsdtRate();
  if (!rate) return null;
  return (kesAmount / rate).toFixed(2);
}
