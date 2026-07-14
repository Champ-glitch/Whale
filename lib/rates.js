export async function getKesToUsdtRate() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=kes"
    );
    const data = await res.json();
    const kesPerUsdt = data?.tether?.kes;
    if (!kesPerUsdt) return null;
    return kesPerUsdt;
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
