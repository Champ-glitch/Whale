import { useEffect, useState } from "react";
import Head from "next/head";

const WHALE_IMG = "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f40b.svg";

export default function Dashboard() {
  const [status, setStatus] = useState("loading"); // loading | unauthorized | ready
  const [data, setData] = useState(null);

  useEffect(() => {
    function fetchData(body) {
      fetch("/api/dashboard-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(async (res) => ({ ok: res.ok, json: await res.json() }))
        .then(({ ok, json }) => {
          if (!ok) {
            setStatus("unauthorized");
            return;
          }
          setData(json);
          setStatus("ready");
        })
        .catch(() => setStatus("unauthorized"));
    }

    function tryInit() {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.initData) {
        tg.ready();
        tg.expand();
        fetchData({ initData: tg.initData });
        return true;
      }

      // Fallback: a secret key in the URL, for clients that don't support
      // proper Mini App launches (e.g. some third-party Telegram clients).
      const urlKey = new URLSearchParams(window.location.search).get("key");
      if (urlKey) {
        fetchData({ key: urlKey });
        return true;
      }

      return false;
    }

    if (tryInit()) return;

    // Telegram's script may still be loading - poll briefly before giving up
    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval);
    }, 150);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setStatus((s) => (s === "loading" ? "unauthorized" : s));
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      <Head>
        <title>WHALE_SYS — Personal Finance & Payments on Telegram</title>
        <meta
          name="description"
          content="A personal M-Pesa payments and savings tool that runs entirely inside Telegram — payment links, STK push, automatic 60/40 savings split, and crypto rails. Built by @Whale_sys."
        />
        <meta property="og:title" content="WHALE_SYS — Personal Finance & Payments on Telegram" />
        <meta
          property="og:description"
          content="M-Pesa payment links, STK push, automatic 60/40 savings split, and crypto rails — all inside Telegram. DM @Whale_sys to see it."
        />
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </Head>

      <div className="page">
        {status === "loading" && (
          <div className="center">
            <div className="spinner" />
          </div>
        )}

        {status === "unauthorized" && (
          <div className="explainer">
            <div className="brandRow center">
              <img src={WHALE_IMG} alt="" width="22" height="22" />
              <span>whale_sys</span>
            </div>

            <p className="explainerTitle">A personal finance &amp; payments tool, built entirely for Telegram.</p>

            <p className="explainerBody">
              WHALE_SYS sends M-Pesa payment links and STK push requests,
              automatically splits every deposit 60/40 into Main and Savings
              accounts, tracks spending by category, and connects to crypto
              rails for converting to fiat — all from inside a single
              Telegram chat, no app required.
            </p>

            <div className="featureGrid">
              <div className="featureItem">
                <div className="featureIcon">🔗</div>
                <div className="featureLabel">Payment Links</div>
              </div>
              <div className="featureItem">
                <div className="featureIcon">⚡</div>
                <div className="featureLabel">Instant STK Push</div>
              </div>
              <div className="featureItem">
                <div className="featureIcon">🏦</div>
                <div className="featureLabel">Auto 60/40 Split</div>
              </div>
              <div className="featureItem">
                <div className="featureIcon">🪙</div>
                <div className="featureLabel">Crypto Rails</div>
              </div>
            </div>

            <p className="explainerSub">This dashboard is private and only opens from inside the bot.</p>

            <div className="ctaGroup">
              <a
                className="ctaBtn telegram"
                href="https://t.me/Whale_sys"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 DM @Whale_sys on Telegram
              </a>
              <a
                className="ctaBtn whatsapp"
                href="https://wa.me/254732751315"
                target="_blank"
                rel="noopener noreferrer"
              >
                📱 Message on WhatsApp
              </a>
            </div>

            <p className="explainerFooter">Self-Taught. Self-Made.</p>
          </div>
        )}

        {status === "ready" && data && (
          <div className="dash">
            <div className="brandRow">
              <img src={WHALE_IMG} alt="" width="22" height="22" />
              <span>whale_sys</span>
            </div>

            <div className="card">
              <div className="geoAccent" />
              <p className="label">Current Balance</p>
              <p className="amount">KES {data.balance.toLocaleString()}</p>
              <div className="subRow">
                {data.usdt && <span className="usdt">≈ {data.usdt} USDT</span>}
                {data.trendPct !== null && (
                  <span className={`trend ${data.trendPct >= 0 ? "up" : "down"}`}>
                    {data.trendPct >= 0 ? "📈" : "📉"} {data.trendPct >= 0 ? "+" : ""}{data.trendPct}%
                  </span>
                )}
              </div>
            </div>

            <div className="statGrid">
              <div className="statBox">
                <p className="statLabel">Today</p>
                <p className="statValue">KES {data.today.total.toLocaleString()}</p>
                <p className="statSub">{data.today.successCount} paid · {data.today.failedCount} failed</p>
              </div>
              <div className="statBox">
                <p className="statLabel">All-Time</p>
                <p className="statValue">KES {data.totalIn.toLocaleString()}</p>
                <p className="statSub">{data.allTimeCount} payments</p>
              </div>
              <div className="statBox">
                <p className="statLabel">Streak</p>
                <p className="statValue">{data.streak}🔥</p>
                <p className="statSub">day{data.streak === 1 ? "" : "s"} running</p>
              </div>
              <div className="statBox">
                <p className="statLabel">Total Out</p>
                <p className="statValue">KES {data.totalOut.toLocaleString()}</p>
                <p className="statSub">logged deductions</p>
              </div>
            </div>

            <p className="footerNote">Self-Taught. Self-Made.</p>
          </div>
        )}
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }
        body { background: #060b14; }
      `}</style>
      <style jsx>{`
        .page {
          min-height: 100vh;
          min-height: 100dvh;
          background:
            radial-gradient(circle at 50% -10%, rgba(0,206,209,0.07), transparent 45%),
            linear-gradient(160deg, #060b14 0%, #0a1420 55%, #060b14 100%);
          padding: 20px;
        }
        .center {
          min-height: 80vh;
          min-height: 80dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .spinner {
          width: 36px; height: 36px;
          border: 3px solid rgba(0,206,209,0.2);
          border-top-color: #00CED1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .lockIcon { font-size: 40px; margin-bottom: 12px; }
        .lockTitle { color: #fff; font-size: 18px; font-weight: 700; margin-bottom: 8px; }
        .lockSub { color: #64748b; font-size: 13px; max-width: 280px; }

        .explainer {
          max-width: 420px;
          margin: 36px auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .brandRow.center { justify-content: center; margin-bottom: 18px; }
        .explainerTitle {
          color: #fff;
          font-size: 19px;
          font-weight: 700;
          line-height: 1.3;
          margin-bottom: 14px;
        }
        .explainerBody {
          color: #94a3b8;
          font-size: 13px;
          line-height: 1.55;
          margin-bottom: 14px;
        }
        .explainerSub {
          color: #475569;
          font-size: 11px;
          margin-bottom: 20px;
        }
        .featureGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          width: 100%;
          margin-bottom: 20px;
        }
        .featureItem {
          background: #0d1826;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 14px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .featureIcon { font-size: 20px; }
        .featureLabel { color: #cbd5e1; font-size: 12px; font-weight: 600; }
        .explainerFooter {
          text-align: center;
          color: #334155;
          font-size: 12px;
          margin-top: 22px;
        }
        .ctaGroup {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }
        .ctaBtn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 700;
          font-size: 14px;
          padding: 12px 20px;
          border-radius: 999px;
          text-decoration: none;
        }
        .ctaBtn.telegram {
          background: linear-gradient(135deg, #00CED1, #06B6D4);
          color: #060b14;
        }
        .ctaBtn.whatsapp {
          background: rgba(37, 211, 102, 0.12);
          color: #25D366;
          border: 1px solid rgba(37, 211, 102, 0.35);
        }

        .dash { max-width: 480px; margin: 0 auto; }
        .brandRow { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
        .brandRow span {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-weight: 700;
          color: #fff;
          font-size: 18px;
        }

        .card {
          background: #0d1826;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .geoAccent {
          position: absolute;
          top: -50px; right: -50px;
          width: 160px; height: 160px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #3B82F6, #06B6D4);
          opacity: 0.15;
        }
        .label { color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; position: relative; }
        .amount { color: #fff; font-size: 36px; font-weight: 800; font-family: 'JetBrains Mono', monospace; position: relative; }
        .subRow { display: flex; gap: 10px; margin-top: 8px; position: relative; }
        .usdt { color: #00CED1; font-size: 13px; }
        .trend { font-size: 12px; padding: 3px 10px; border-radius: 20px; }
        .trend.up { color: #4ade80; background: rgba(74,222,128,0.12); }
        .trend.down { color: #f87171; background: rgba(248,113,113,0.12); }

        .statGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .statBox { background: #0d1826; border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 16px; }
        .statLabel { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .statValue { color: #fff; font-size: 20px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
        .statSub { color: #475569; font-size: 11px; margin-top: 4px; }

        .footerNote { text-align: center; color: #334155; font-size: 12px; margin-top: 28px; }
      `}</style>
    </>
  );
}
