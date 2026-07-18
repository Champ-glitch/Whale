import { ImageResponse } from "next/og";
import { getBalance, getStats, getBalanceSnapshot } from "../../lib/kv.js";
import { kesToUsdt } from "../../lib/rates.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (process.env.BALANCE_CARD_SECRET && key !== process.env.BALANCE_CARD_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const balance = await getBalance();
  const stats = await getStats();
  const usdt = await kesToUsdt(balance);
  const snapshot = await getBalanceSnapshot();

  let trendText = null;
  let trendUp = true;
  if (snapshot && snapshot > 0) {
    const change = balance - snapshot;
    const changePct = Math.round((change / snapshot) * 100);
    trendUp = change >= 0;
    trendText = `${trendUp ? "+" : ""}${changePct}% vs last week`;
  }

  const cardDigits = String(Math.abs(Number(process.env.OWNER_CHAT_ID || 0)) % 10000).padStart(4, "0");

  return new ImageResponse(
    (
      <div
        style={{
          width: "600px",
          height: "380px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "34px 38px",
          borderRadius: "28px",
          backgroundImage:
            "linear-gradient(155deg, #10233b 0%, #060b14 100%)",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Corner glow accent */}
        <div
          style={{
            position: "absolute",
            top: "-60px",
            right: "-60px",
            width: "220px",
            height: "220px",
            borderRadius: "9999px",
            backgroundImage: "linear-gradient(135deg, #3B82F6, #06B6D4)",
            opacity: 0.18,
            display: "flex",
          }}
        />

        {/* Top row: brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "26px", display: "flex" }}>🐋</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#ffffff", display: "flex" }}>
            whale_sys
          </div>
        </div>

        {/* Middle row: chip + balance */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              width: "58px",
              height: "44px",
              borderRadius: "8px",
              backgroundImage: "linear-gradient(135deg, #FFD700, #B8860B)",
              display: "flex",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "14px", color: "#64748b", letterSpacing: "1px", display: "flex" }}>
              CURRENT BALANCE
            </div>
            <div style={{ fontSize: "44px", fontWeight: 800, color: "#ffffff", display: "flex" }}>
              KES {balance.toLocaleString()}
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
              {usdt && (
                <div style={{ fontSize: "16px", color: "#00CED1", display: "flex" }}>
                  ≈ {usdt} USDT
                </div>
              )}
              {trendText && (
                <div
                  style={{
                    fontSize: "14px",
                    color: trendUp ? "#4ade80" : "#f87171",
                    backgroundColor: trendUp ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                    padding: "3px 12px",
                    borderRadius: "20px",
                    display: "flex",
                  }}
                >
                  {trendUp ? "📈" : "📉"} {trendText}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom row: masked number + holder */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: "20px", color: "#94a3b8", letterSpacing: "3px", display: "flex" }}>
            •••• •••• •••• {cardDigits}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: "12px", color: "#FFD700", letterSpacing: "1px", display: "flex" }}>
              CARD HOLDER
            </div>
            <div style={{ fontSize: "15px", color: "#ffffff", fontWeight: 600, display: "flex" }}>
              WHALE_SYS PAY
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 600,
      height: 380,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
