import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { getInvoice } from "../../lib/kv.js";

export async function getServerSideProps({ params }) {
  const invoice = await getInvoice(params.code);
  if (!invoice) {
    return { props: { invoice: null, code: params.code } };
  }
  return {
    props: {
      invoice: {
        amount: invoice.amount,
        description: invoice.description,
        status: invoice.status,
        createdAt: invoice.createdAt || null,
      },
      code: params.code,
    },
  };
}

const SUPPORT_WHATSAPP = "254798016597";
const TIKTOK_URL = "https://www.tiktok.com/@Whale_sys";
const EXPIRY_HOURS = 48;
const WHALE_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%90%8B%3C/text%3E%3C/svg%3E";

function isValidKenyanPhone(phone) {
  return /^(0|\+?254)(7|1)\d{8}$/.test(phone.replace(/\s/g, ""));
}

function formatPhoneDisplay(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 7));
  if (digits.length > 7) parts.push(digits.slice(7, 10));
  return parts.join(" ");
}

function useCountUp(target, durationMs = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = null;
    let frame;
    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / durationMs, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

function downloadReceiptImage(invoice, code) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 760;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#10233b");
  grad.addColorStop(1, "#0A1628");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("WHALE_SYS", canvas.width / 2, 80);

  ctx.font = "56px sans-serif";
  ctx.fillText("✅", canvas.width / 2, 200);

  ctx.fillStyle = "#4ade80";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("Payment Completed", canvas.width / 2, 260);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px sans-serif";
  ctx.fillText(`KES ${invoice.amount}`, canvas.width / 2, 330);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "20px sans-serif";
  ctx.fillText(invoice.description, canvas.width / 2, 380);

  ctx.strokeStyle = "rgba(0,206,209,0.4)";
  ctx.beginPath();
  ctx.moveTo(80, 430);
  ctx.lineTo(canvas.width - 80, 430);
  ctx.stroke();

  ctx.fillStyle = "#00CED1";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`Invoice: ${code}`, canvas.width / 2, 480);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "16px sans-serif";
  ctx.fillText(new Date().toLocaleString(), canvas.width / 2, 520);

  ctx.fillStyle = "#FFD700";
  ctx.font = "italic 16px sans-serif";
  ctx.fillText("Thank you for trusting WHALE_SYS 🐋", canvas.width / 2, 600);

  const link = document.createElement("a");
  link.download = `WHALE_SYS-receipt-${code}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function downloadICS(invoice, code) {
  const now = new Date();
  const dt = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics =
    "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n" +
    `UID:${code}@whale-sys\n` +
    `DTSTAMP:${dt}\nDTSTART:${dt}\n` +
    `SUMMARY:WHALE_SYS Payment Received - KES ${invoice.amount}\n` +
    `DESCRIPTION:${invoice.description} (Invoice ${code})\n` +
    "END:VEVENT\nEND:VCALENDAR";
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `WHALE_SYS-${code}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PayPage({ invoice, code }) {
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [shake, setShake] = useState(false);
  const [stage, setStage] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [ready, setReady] = useState(false);
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);

  const countedAmount = useCountUp(stage === "idle" || stage === "sending" ? invoice?.amount : 0);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  if (!invoice) {
    return (
      <Shell title="Invalid Link">
        <StatusIcon type="error" />
        <p className="statusText error">This payment link is invalid or has expired.</p>
      </Shell>
    );
  }

  if (invoice.status === "success" && stage === "idle") {
    return (
      <Shell title="Already Paid">
        <StatusIcon type="success" />
        <p className="statusText success">This invoice has already been paid. ✅</p>
      </Shell>
    );
  }

  function startPolling() {
    pollCountRef.current = 0;
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      try {
        const res = await fetch(`/api/invoice-status?code=${code}`);
        const data = await res.json();
        if (data.status === "success") {
          clearInterval(pollRef.current);
          setStage("success");
        } else if (data.status === "failed") {
          clearInterval(pollRef.current);
          setStage("failed");
        }
      } catch (e) {}
      if (pollCountRef.current > 30) {
        clearInterval(pollRef.current);
        setStage("timeout");
      }
    }, 3000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanPhone = phone.replace(/\s/g, "");
    if (!isValidKenyanPhone(cleanPhone)) {
      setPhoneError("Enter a valid Kenyan number, e.g. 0712345678");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setPhoneError("");
    setStage("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/invoice-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phoneNumber: cleanPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setStage("verifying");
      startPolling();
    } catch (err) {
      setStage("failed");
      setErrorMsg(err.message);
    }
  }

  function retry() {
    clearInterval(pollRef.current);
    setStage("idle");
    setErrorMsg("");
  }

  function shareExperience() {
    const text = `Just paid via WHALE_SYS Pay — fast, simple M-Pesa checkout. Check them out!`;
    if (navigator.share) {
      navigator.share({ text, url: TIKTOK_URL }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + TIKTOK_URL)}`, "_blank");
    }
  }

  return (
    <Shell
      title={invoice.status === "success" ? "Payment Complete" : `Pay KES ${invoice.amount}`}
      description={invoice.description}
    >
      {!ready ? (
        <Skeleton />
      ) : stage === "success" ? (
        <>
          <Confetti />
          <StatusIcon type="success" />
          <p className="statusText success">Payment completed! 🎉</p>
          <p className="subtle">KES {invoice.amount} received successfully.</p>
          <div className="receiptCard">
            <p className="thankYou">Thank you for trusting WHALE_SYS 🐋</p>
            <p className="receiptLine">Invoice: <span>{code}</span></p>
            <p className="receiptLine">{invoice.description}</p>
          </div>
          <div className="actionsRow">
            <button className="smallBtn" onClick={() => downloadReceiptImage(invoice, code)}>
              📄 Save Receipt
            </button>
            <button className="smallBtn" onClick={() => downloadICS(invoice, code)}>
              📅 Add to Calendar
            </button>
          </div>
          <button className="shareBtn" onClick={shareExperience}>
            ✨ Share your experience
          </button>
        </>
      ) : stage === "verifying" || stage === "sending" ? (
        <>
          <Spinner />
          <p className="statusText">
            {stage === "sending" ? "Sending prompt..." : "Verifying payment..."}
          </p>
          <p className="subtle">Check your phone and enter your M-Pesa PIN.</p>
        </>
      ) : stage === "failed" ? (
        <>
          <StatusIcon type="error" />
          <p className="statusText error">
            {errorMsg || "Payment was not completed (cancelled or failed)."}
          </p>
          <button className="payBtn" onClick={retry}>Try Again</button>
        </>
      ) : stage === "timeout" ? (
        <>
          <StatusIcon type="warn" />
          <p className="statusText">Taking longer than expected.</p>
          <p className="subtle">If you already paid, it may still confirm shortly. Otherwise, try again or contact support.</p>
          <button className="payBtn" onClick={retry}>Try Again</button>
        </>
      ) : (
        <>
          <div className="amountBlock fadeIn1">
            <p className="label">Amount Due</p>
            <p className="amount">KES {countedAmount.toLocaleString()}</p>
          </div>

          <div className="whaleWrap fadeIn2">
            <Sparkles />
            <WhaleSVG />
          </div>

          <form onSubmit={handleSubmit} className={`fadeIn3 ${shake ? "shake" : ""}`}>
            <label className="label" htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))}
              className="phoneInput"
              aria-invalid={!!phoneError}
              aria-describedby="phone-error"
            />
            {phoneError && <p id="phone-error" className="fieldError">{phoneError}</p>}

            <div className="descCard">
              <p className="descLabel">Description</p>
              <p className="descText">{invoice.description}</p>
            </div>

            <button type="submit" className="payBtn">Pay Now</button>

            <div className="trustRow">
              <span className="trustBadge">🔒 Secured by M-Pesa</span>
              <span className="trustBadge">✓ Verified Merchant</span>
            </div>

            {invoice.createdAt && <Countdown createdAt={invoice.createdAt} />}

            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP}?text=Hi%2C%20I%20need%20help%20with%20invoice%20${code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="helpBtn"
            >
              💬 Need Help?
            </a>
          </form>
        </>
      )}

      <style jsx>{`
        .amountBlock { text-align: center; margin-bottom: 8px; }
        .label { color: #e2e8f0; font-weight: 600; font-size: 14px; margin: 0 0 6px; letter-spacing: 0.5px; text-transform: uppercase; }
        .amount {
          color: #ffffff; font-size: 34px; font-weight: 800; margin: 0;
          background: linear-gradient(90deg, #fff, #FFD700, #fff);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          animation: shimmerText 3s linear infinite;
        }
        @keyframes shimmerText {
          to { background-position: 200% center; }
        }
        .whaleWrap { display: flex; justify-content: center; margin: 20px 0 28px; position: relative; height: 110px; align-items: center; }
        .phoneInput {
          width: 100%;
          padding: 14px 16px;
          border-radius: 10px;
          border: 1px solid #2c3a52;
          background: #0f1c30;
          color: #fff;
          font-size: 16px;
          box-sizing: border-box;
          margin-bottom: 6px;
          transition: box-shadow 0.2s, border-color 0.2s;
        }
        .phoneInput:focus {
          outline: none;
          border-color: #00CED1;
          box-shadow: 0 0 0 3px rgba(0,206,209,0.25);
        }
        .fieldError { color: #f87171; font-size: 13px; margin: 0 0 12px; }
        .descCard {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,215,0,0.25);
          border-radius: 10px;
          padding: 14px 16px;
          margin: 18px 0 22px;
        }
        .descLabel { color: #FFD700; font-size: 12px; font-weight: 700; text-transform: uppercase; margin: 0 0 4px; letter-spacing: 0.5px; }
        .descText { color: #e2e8f0; font-size: 15px; margin: 0; line-height: 1.4; }
        .payBtn {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          border: none;
          background: #00CED1;
          color: #06202a;
          font-size: 17px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          position: relative;
          overflow: hidden;
        }
        .payBtn:hover { transform: scale(1.03); box-shadow: 0 0 24px rgba(0,206,209,0.5); }
        .payBtn:active { transform: scale(0.97); }
        .trustRow { display: flex; gap: 8px; justify-content: center; margin-top: 14px; flex-wrap: wrap; }
        .trustBadge {
          font-size: 11px;
          color: #94a3b8;
          background: rgba(255,255,255,0.05);
          padding: 5px 10px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .helpBtn {
          display: block;
          text-align: center;
          margin-top: 14px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #00CED1;
          color: #00CED1;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
        }
        .statusText { color: #fff; font-size: 18px; text-align: center; margin: 12px 0 4px; }
        .statusText.success { color: #4ade80; }
        .statusText.error { color: #f87171; }
        .subtle { color: #94a3b8; font-size: 14px; text-align: center; margin: 0 0 20px; }
        .receiptCard {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(0,206,209,0.3);
          border-radius: 12px;
          padding: 16px 18px;
          margin-top: 14px;
        }
        .thankYou { color: #FFD700; font-weight: 700; font-size: 15px; text-align: center; margin: 0 0 10px; }
        .receiptLine { color: #cbd5e1; font-size: 13px; text-align: center; margin: 4px 0; }
        .receiptLine span { color: #00CED1; font-weight: 600; }
        .actionsRow { display: flex; gap: 10px; margin-top: 16px; }
        .smallBtn {
          flex: 1;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid rgba(0,206,209,0.4);
          background: transparent;
          color: #00CED1;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .shareBtn {
          width: 100%;
          margin-top: 14px;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(90deg, #FF1493, #9D00FF);
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .fadeIn1 { animation: fadeIn 0.5s ease both; }
        .fadeIn2 { animation: fadeIn 0.5s ease 0.15s both; }
        .fadeIn3 { animation: fadeIn 0.5s ease 0.3s both; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .shake { animation: shakeAnim 0.4s; }
        @keyframes shakeAnim {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </Shell>
  );
}

function Countdown({ createdAt }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const expiry = createdAt + EXPIRY_HOURS * 60 * 60 * 1000;
      const diff = expiry - Date.now();
      if (diff <= 0) {
        setTimeLeft("expired");
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${h}h ${m}m`);
    }
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [createdAt]);

  if (!timeLeft) return null;

  return (
    <p className="countdown">
      {timeLeft === "expired" ? "⏰ This link has expired" : `⏰ Link expires in ${timeLeft}`}
      <style jsx>{`
        .countdown { text-align: center; color: #64748b; font-size: 11px; margin: 10px 0 0; }
      `}</style>
    </p>
  );
}

function Sparkles() {
  const stars = Array.from({ length: 8 });
  return (
    <div className="sparklesWrap" aria-hidden="true">
      {stars.map((_, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            fontSize: `${8 + Math.random() * 8}px`,
          }}
        >
          ✦
        </span>
      ))}
      <style jsx>{`
        .sparklesWrap { position: absolute; inset: 0; pointer-events: none; }
        .star {
          position: absolute;
          color: #FFD700;
          opacity: 0;
          animation: twinkle 2.4s ease-in-out infinite;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function WhaleSVG() {
  return (
    <svg width="120" height="90" viewBox="0 0 200 150" className="whaleSvg">
      <defs>
        <linearGradient id="whaleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00CED1" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      <path
        d="M20 90 Q10 70 30 55 Q60 30 110 35 Q150 38 175 60 Q185 68 175 75 Q160 85 130 85 L130 100 Q130 110 120 108 L110 90 Q70 100 40 95 Q25 93 20 90 Z"
        fill="url(#whaleGrad)"
        stroke="#FFD700"
        strokeWidth="2"
      />
      <circle cx="150" cy="58" r="4" fill="#0A1628" />
      <path d="M175 60 Q195 50 190 40 Q185 45 178 55" fill="#00CED1" opacity="0.7" />
      <style jsx>{`
        .whaleSvg {
          filter: drop-shadow(0 0 16px #00CED1) drop-shadow(0 0 8px #FFD700);
          animation: float 3.5s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="skeletonWrap">
      <div className="sk sk-title" />
      <div className="sk sk-amount" />
      <div className="sk sk-circle" />
      <div className="sk sk-input" />
      <div className="sk sk-desc" />
      <div className="sk sk-btn" />
      <style jsx>{`
        .skeletonWrap { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .sk { background: linear-gradient(90deg, #1e293b 25%, #2c3a52 37%, #1e293b 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; border-radius: 8px; }
        .sk-title { width: 100px; height: 12px; }
        .sk-amount { width: 140px; height: 30px; }
        .sk-circle { width: 90px; height: 90px; border-radius: 50%; margin: 10px 0; }
        .sk-input { width: 100%; height: 46px; border-radius: 10px; }
        .sk-desc { width: 100%; height: 60px; border-radius: 10px; }
        .sk-btn { width: 100%; height: 50px; border-radius: 12px; }
        @keyframes shimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0 50%; }
        }
      `}</style>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 18 });
  const colors = ["#00CED1", "#FFD700", "#FF1493", "#9D00FF", "#00FF7F"];
  return (
    <div className="confettiWrap" aria-hidden="true">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="piece"
          style={{
            left: `${Math.random() * 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.4}s`,
            animationDuration: `${1.2 + Math.random() * 0.8}s`,
          }}
        />
      ))}
      <style jsx>{`
        .confettiWrap { position: absolute; top: 0; left: 0; right: 0; height: 0; overflow: visible; pointer-events: none; }
        .piece { position: absolute; top: -10px; width: 7px; height: 12px; opacity: 0.9; animation-name: fall; animation-timing-function: ease-in; animation-fill-mode: forwards; border-radius: 2px; }
        @keyframes fall { to { transform: translateY(280px) rotate(360deg); opacity: 0; } }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <div className="spinnerWrap">
      <div className="spinner" />
      <style jsx>{`
        .spinnerWrap { display: flex; justify-content: center; margin: 30px 0 16px; }
        .spinner { width: 48px; height: 48px; border: 4px solid rgba(0,206,209,0.2); border-top-color: #00CED1; border-radius: 50%; animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatusIcon({ type }) {
  const icon = type === "success" ? "✅" : type === "warn" ? "⏳" : "❌";
  return <div style={{ fontSize: 56, textAlign: "center", marginBottom: 8 }}>{icon}</div>;
}

function Shell({ children, title, description }) {
  return (
    <>
      <Head>
        <title>{title ? `${title} | WHALE_SYS` : "WHALE_SYS Pay"}</title>
        <link rel="icon" href={WHALE_FAVICON} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <meta property="og:title" content={title || "WHALE_SYS Pay"} />
        <meta property="og:description" content={description || "Fast, secure M-Pesa checkout by WHALE_SYS."} />
        <meta name="twitter:card" content="summary" />
      </Head>
      <div className="page">
        <div className="blob blob1" />
        <div className="blob blob2" />
        <div className="blob blob3" />
        <div className="card">
          <div className="brandRow">
            <span className="brandIcon">🐋</span>
            <p className="brand">WHALE_SYS</p>
          </div>
          {children}
        </div>
      </div>
      <style jsx global>{`
        * { font-family: 'Poppins', system-ui, sans-serif; }
        body { margin: 0; }
      `}</style>
      <style jsx>{`
        .page {
          min-height: 100vh;
          background: radial-gradient(circle at 50% 0%, #10233b 0%, #0A1628 60%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.35; }
        .blob1 { width: 260px; height: 260px; background: #9D00FF; top: -60px; left: -60px; }
        .blob2 { width: 220px; height: 220px; background: #FF1493; bottom: -40px; right: -40px; }
        .blob3 { width: 200px; height: 200px; background: #00FF7F; bottom: 20%; left: -60px; }
        .card {
          max-width: 400px;
          width: 100%;
          background: rgba(15, 28, 48, 0.85);
          backdrop-filter: blur(6px);
          border-radius: 20px;
          padding: 32px 28px;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 0 0 1px rgba(0,206,209,0.08), 0 20px 60px rgba(0,0,0,0.4);
          position: relative;
          z-index: 1;
          overflow: hidden;
        }
        .card::before {
          content: "";
          position: absolute;
          top: -50%; left: -50%;
          width: 200%; height: 200%;
          background: conic-gradient(from 0deg, transparent, rgba(0,206,209,0.08), transparent 30%);
          animation: rotate 8s linear infinite;
          pointer-events: none;
        }
        @keyframes rotate { to { transform: rotate(360deg); } }
        .brandRow { display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 22px; }
        .brandIcon { font-size: 16px; }
        .brand { color: #FFD700; font-weight: 800; letter-spacing: 2px; font-size: 14px; margin: 0; }
      `}</style>
    </>
  );
}
