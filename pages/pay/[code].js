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
const VERIFY_MESSAGES = [
  "Connecting to M-Pesa...",
  "Waiting for you to enter your PIN...",
  "Almost there, hang tight...",
  "Still confirming with M-Pesa...",
];
const TIP_MESSAGES = [
  "💡 Tip: Keep this page open until you see confirmation.",
  "💡 Tip: Save your number next time for a faster checkout.",
  "💡 Tip: You'll get a receipt automatically once confirmed.",
];
const TIKTOK_URL = "https://www.tiktok.com/@Whale_sys";
const EXPIRY_HOURS = 12;
const WHALE_IMG = "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f40b.svg";
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%90%8B%3C/text%3E%3C/svg%3E";

function isValidKenyanPhone(phone) {
  return /^(0|\+?254)(7|1)\d{8}$/.test(phone.replace(/\s/g, ""));
}

function formatPhoneDisplay(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 9));
  return parts.join(" ");
}

function useCountUp(target, active, durationMs = 650) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target || !active) return;
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
  }, [target, active, durationMs]);
  return value;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function generateReceiptCanvas(invoice, code) {
  const W = 680, H = 920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Clean light document background — reads as an official receipt, not a UI screenshot
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, W, H);

  // Top brand accent bar
  const barGrad = ctx.createLinearGradient(0, 0, W, 0);
  barGrad.addColorStop(0, "#0A1628");
  barGrad.addColorStop(0.5, "#00CED1");
  barGrad.addColorStop(1, "#FFD700");
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, W, 8);

  const pad = 56;

  // Header row: logo mark + wordmark left, "RECEIPT" label right
  ctx.beginPath();
  ctx.arc(pad + 26, 90, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#0A1628";
  ctx.fill();
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = WHALE_IMG;
    });
    ctx.save();
    ctx.beginPath();
    ctx.arc(pad + 26, 90, 20, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, pad + 6, 70, 40, 40);
    ctx.restore();
  } catch (e) {}

  ctx.textAlign = "left";
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("WHALE ENTERPRISE", pad + 64, 84);
  ctx.fillStyle = "#64748b";
  ctx.font = "12px sans-serif";
  ctx.fillText("Self-Taught. Self-Made.", pad + 64, 102);

  ctx.textAlign = "right";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("PAYMENT RECEIPT", W - pad, 84);
  ctx.fillStyle = "#00CED1";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(code, W - pad, 102);

  // Divider
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 140);
  ctx.lineTo(W - pad, 140);
  ctx.stroke();

  // Status ring + check
  ctx.beginPath();
  ctx.arc(W / 2, 210, 36, 0, Math.PI * 2);
  ctx.strokeStyle = "#00CED1";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✓", W / 2, 222);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("Payment Successful", W / 2, 280);

  // Amount
  ctx.fillStyle = "#64748b";
  ctx.font = "13px sans-serif";
  ctx.fillText("AMOUNT PAID", W / 2, 330);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 54px sans-serif";
  ctx.fillText(`KES ${invoice.amount.toLocaleString()}`, W / 2, 390);

  // Details table
  ctx.textAlign = "left";
  let y = 470;
  const rowH = 46;
  const detailRow = (label, value) => {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px sans-serif";
    ctx.fillText(label.toUpperCase(), pad, y);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(value, pad, y + 22);
    y += rowH + 20;
  };
  detailRow("Description", invoice.description);
  detailRow("Invoice Number", code);
  detailRow("Date & Time", new Date().toLocaleString());
  detailRow("Status", "Completed");

  // Footer divider
  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(pad, H - 130);
  ctx.lineTo(W - pad, H - 130);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#334155";
  ctx.font = "italic 15px sans-serif";
  ctx.fillText("Thank you for trusting WHALE ENTERPRISE 🐋", W / 2, H - 90);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px sans-serif";
  ctx.fillText("This receipt is auto-generated and does not require a signature.", W / 2, H - 64);

  return canvas;
}

async function downloadReceiptImage(invoice, code) {
  const canvas = await generateReceiptCanvas(invoice, code);
  const link = document.createElement("a");
  link.download = `Whale-Enterprise-receipt-${code}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function sendReceiptToWhatsApp(invoice, code) {
  const canvas = await generateReceiptCanvas(invoice, code);
  const text = `Whale Enterprise payment receipt — KES ${invoice.amount} for ${invoice.description} (Invoice ${code})`;

  canvas.toBlob(async (blob) => {
    const file = new File([blob], `Whale-Enterprise-receipt-${code}.png`, { type: "image/png" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (e) {
        // fall through to link fallback if user cancels or share fails
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }, "image/png");
}

function downloadICS(invoice, code) {
  const now = new Date();
  const dt = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics =
    "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n" +
    `UID:${code}@whale-sys\n` +
    `DTSTAMP:${dt}\nDTSTART:${dt}\n` +
    `SUMMARY:Whale Enterprise Payment Received - KES ${invoice.amount}\n` +
    `DESCRIPTION:${invoice.description} (Invoice ${code})\n` +
    "END:VEVENT\nEND:VCALENDAR";
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Whale-Enterprise-${code}.ics`;
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
  const [elapsed, setElapsed] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [toast, setToast] = useState("");
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);
  const elapsedRef = useRef(null);
  const phoneInputRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const countedAmount = useCountUp(invoice?.amount, ready && (stage === "idle" || stage === "sending"));
  const isPhoneValid = isValidKenyanPhone("0" + phone.replace(/\s/g, ""));

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(""), 2000);
  }

  function copyToClipboard(text, label) {
    try {
      navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch (e) {
      showToast("Couldn't copy");
    }
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready && phoneInputRef.current) {
      phoneInputRef.current.focus();
    }
  }, [ready]);

  useEffect(() => {
    function goOffline() { setIsOffline(true); }
    function goOnline() { setIsOffline(false); }
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    if (stage === "success") vibrate([100, 60, 100]);
    if (stage === "failed") vibrate(200);
  }, [stage]);

  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
      clearInterval(elapsedRef.current);
      clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  if (!invoice) {
    return (
      <Shell title="Invalid Link">
        <div className="settledState">
          <StatusRing type="error" />
          <p className="settledTitle">Link invalid or expired</p>
          <p className="settledSub">This payment link is no longer active. If you think this is a mistake, message us and we'll sort it out.</p>
          <a className="settledCta" href={`https://wa.me/${SUPPORT_WHATSAPP}?text=Hi%2C%20my%20payment%20link%20looks%20expired%20or%20invalid`} target="_blank" rel="noopener noreferrer">
            Message us →
          </a>
        </div>
        <style jsx>{`
          .settledState { text-align: center; padding: 12px 4px; }
          .settledTitle { color: #f8fafc; font-size: 20px; font-weight: 800; margin: 16px 0 6px; }
          .settledSub { color: #94a3b8; font-size: 13.5px; margin: 0 0 22px; line-height: 1.5; }
          .settledCta {
            display: inline-block;
            color: #00CED1;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            border-bottom: 1px solid rgba(0,206,209,0.3);
            padding-bottom: 2px;
          }
        `}</style>
      </Shell>
    );
  }

  if (invoice.status === "success" && stage === "idle") {
    return (
      <Shell title="Already Paid">
        <div className="settledState">
          <StatusRing type="success" />
          <p className="settledTitle">Already Paid</p>
          <p className="settledSub">This invoice was already settled — no need to pay again.</p>

          <div className="settledCard">
            <div className="settledRow">
              <span className="settledLabel">Amount</span>
              <span className="settledValue">KES {invoice.amount.toLocaleString()}</span>
            </div>
            <div className="settledRow">
              <span className="settledLabel">Description</span>
              <span className="settledValue">{invoice.description}</span>
            </div>
            <div className="settledRow">
              <span className="settledLabel">Invoice</span>
              <span className="settledValue mono">{code}</span>
            </div>
          </div>

          <a className="settledCta" href={`https://wa.me/${SUPPORT_WHATSAPP}?text=Hi%2C%20I%20need%20a%20new%20invoice`} target="_blank" rel="noopener noreferrer">
            Need a new invoice? Message us →
          </a>
        </div>
        <style jsx>{`
          .settledState { text-align: center; padding: 12px 4px; }
          .settledTitle { color: #f8fafc; font-size: 20px; font-weight: 800; margin: 16px 0 6px; }
          .settledSub { color: #94a3b8; font-size: 13.5px; margin: 0 0 22px; line-height: 1.5; }
          .settledCard {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 4px 16px;
            margin: 0 0 24px;
            text-align: left;
          }
          .settledRow {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 11px 0;
            font-size: 13px;
          }
          .settledRow + .settledRow { border-top: 1px solid rgba(255,255,255,0.06); }
          .settledLabel { color: #64748b; flex-shrink: 0; }
          .settledValue { color: #e2e8f0; text-align: right; }
          .settledValue.mono { font-family: monospace; letter-spacing: 0.3px; }
          .settledCta {
            display: inline-block;
            color: #00CED1;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            border-bottom: 1px solid rgba(0,206,209,0.3);
            padding-bottom: 2px;
          }
        `}</style>
      </Shell>
    );
  }

  function startPolling() {
    pollCountRef.current = 0;
    setElapsed(0);
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      try {
        const res = await fetch(`/api/invoice-status?code=${code}`);
        const data = await res.json();
        if (data.status === "success") {
          clearInterval(pollRef.current);
          clearInterval(elapsedRef.current);
          setStage("success");
        } else if (data.status === "failed") {
          clearInterval(pollRef.current);
          clearInterval(elapsedRef.current);
          setStage("failed");
        }
      } catch (e) {}
      if (pollCountRef.current > 30) {
        clearInterval(pollRef.current);
        clearInterval(elapsedRef.current);
        setStage("timeout");
      }
    }, 3000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanPhone = "0" + phone.replace(/\s/g, "");
    if (!isValidKenyanPhone(cleanPhone)) {
      setPhoneError("Enter a valid number, e.g. 712 345 678");
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    setPhoneError("");
    setStage("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/invoice-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, phone: cleanPhone.replace(/\D/g, "") }),
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
    const text = `Just paid via Whale Enterprise Pay — fast, secure M-Pesa checkout.`;
    if (navigator.share) {
      navigator.share({ text, url: TIKTOK_URL }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + TIKTOK_URL)}`, "_blank");
    }
  }

  const step = stage === "idle" ? 1 : stage === "sending" || stage === "verifying" ? 2 : stage === "success" ? 3 : 1;

  return (
    <Shell title={invoice.status === "success" ? "Payment Complete" : `Pay KES ${invoice.amount}`} description={invoice.description}>
      {isOffline && (
        <div className="offlineBanner">
          ⚠️ You're offline — reconnect to continue
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {!ready ? (
        <Skeleton />
      ) : (
        <>
          {stage !== "idle" && (
            <div className="topRow">
              <div className="brandMark">
                <span className="logoBadge">W</span>
                <span>WHALE ENTERPRISE</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="#00CED1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="10" stroke="#00CED1" strokeWidth="1.5"/></svg>
              </div>
            </div>
          )}

          {stage !== "idle" && stage !== "success" && stage !== "failed" && stage !== "timeout" && (
            <StepBar step={step} />
          )}

          {stage === "success" ? (
            <div className="successBlock">
              <StatusRing type="success" pulse />
              <p className="stateTitle">Payment Successful</p>
              <p className="amountBig">KES {invoice.amount.toLocaleString()}</p>

              <div className="detailsTable">
                <div className="detailRow">
                  <span>Description</span>
                  <span>{invoice.description}</span>
                </div>
                <div className="detailRow">
                  <span>Invoice</span>
                  <span className="mono">{code}</span>
                </div>
                <div className="detailRow">
                  <span>Status</span>
                  <span className="statusPill">Completed</span>
                </div>
              </div>

              <button className="primaryBtn" onClick={shareExperience}>
                Share your experience
              </button>
              <div className="linkRow">
                <button className="linkBtn" onClick={() => downloadReceiptImage(invoice, code)}>
                  Download receipt
                </button>
                <span className="dot">•</span>
                <button className="linkBtn" onClick={() => sendReceiptToWhatsApp(invoice, code)}>
                  Send to WhatsApp
                </button>
                <span className="dot">•</span>
                <button className="linkBtn" onClick={() => window.print()}>
                  Print
                </button>
                <span className="dot">•</span>
                <button className="linkBtn" onClick={() => downloadICS(invoice, code)}>
                  Add to calendar
                </button>
              </div>
            </div>
          ) : stage === "verifying" || stage === "sending" ? (
            <div className="centerState">
              {stage === "sending" ? (
                <Spinner />
              ) : (
                <PulsePhone />
              )}

              <p className="stateTitle">
                {stage === "sending" ? "Sending request" : "Verifying payment"}
              </p>
              <p className="stateSub">Check your phone and enter your M-Pesa PIN.</p>

              <div className="verifyContext">
                <p>Paying <strong>KES {invoice.amount.toLocaleString()}</strong> to Whale Enterprise</p>
                {stage === "verifying" && <p>Prompt sent to +254 {phone}</p>}
              </div>

              {stage === "verifying" && (
                <>
                  <p className="rotatingStatus">{VERIFY_MESSAGES[Math.min(Math.floor(elapsed / 4), VERIFY_MESSAGES.length - 1)]}</p>
                  <p className="expectationNote">
                    This usually takes under 30 seconds {elapsed > 0 && `· ${elapsed}s elapsed`}
                  </p>
                  <p className="reassureNote">You can safely leave this open — we'll confirm automatically.</p>

                  {elapsed >= 15 && (
                    <button
                      type="button"
                      className="helpInline"
                      style={{ marginTop: 16 }}
                      onClick={() => window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=Hi%2C%20I%20haven%27t%20received%20the%20M-Pesa%20prompt%20for%20invoice%20${code}`, "_blank")}
                    >
                      Didn't get the prompt? Get help
                    </button>
                  )}

                  <p className="tipLine">{TIP_MESSAGES[Math.floor(elapsed / 8) % TIP_MESSAGES.length]}</p>
                </>
              )}
            </div>
          ) : stage === "failed" ? (
            <div className="centerState">
              <StatusRing type="error" />
              <p className="stateTitle">Payment not completed</p>
              <p className="stateSub">{errorMsg || "The transaction was cancelled or failed."}</p>
              <button className="primaryBtn" onClick={retry}>Try again</button>
            </div>
          ) : stage === "timeout" ? (
            <div className="centerState">
              <StatusRing type="warn" />
              <p className="stateTitle">Still processing</p>
              <p className="stateSub">If you already paid, it may confirm shortly. Otherwise, try again.</p>
              <button className="primaryBtn" onClick={retry}>Try again</button>
            </div>
          ) : (
            <>
              <div className="brandHeader">
                <p className="brandName">
                  whale enterprise
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 8 }}>
                    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </p>
                <p className="verifiedSub">Merchant Verified</p>
              </div>

              <div className="divider" />

              <p className="recipientLine">You're paying <strong>Whale Enterprise</strong></p>

              <div className="amountSection">
                <p className="amountValue" onClick={() => copyToClipboard(`KES ${invoice.amount}`, "Amount")} role="button" tabIndex={0}>
                  KES {countedAmount.toLocaleString()}
                </p>
                <p className="noFees">No additional fees</p>
              </div>

              <div className="paymentMeta">
                <div className="metaRow">
                  <span className="metaLabel">Description</span>
                  <span className="metaValue">{invoice.description}</span>
                </div>
                <div
                  className="metaRow clickable"
                  onClick={() => copyToClipboard(code, "Invoice code")}
                  role="button"
                  tabIndex={0}
                >
                  <span className="metaLabel">Reference</span>
                  <span className="metaValue mono">{code} <span className="copyHint">⧉ copy</span></span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className={shake ? "shake" : ""}>
                <div className="phoneGroup">
                  <span className="prefix">+254</span>
                  <input
                    ref={phoneInputRef}
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="712 345 678"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))}
                    className="phoneInput"
                    aria-invalid={!!phoneError}
                  />
                </div>
                {phoneError && <p className="fieldError">{phoneError}</p>}

                {invoice.createdAt && (
                  <p className="expiryNote"><Countdown createdAt={invoice.createdAt} /></p>
                )}

                <button type="submit" className="payNowBtn" disabled={!isPhoneValid}>
                  PAY NOW <span className="arrow">→</span>
                </button>

                <div className="featureGrid">
                  <div className="featureItem">
                    <span className="featureIcon">🔒</span>
                    <span>Encrypted</span>
                  </div>
                  <div className="featureItem">
                    <span className="featureIcon">⚡</span>
                    <span>Instant</span>
                  </div>
                  <div className="featureItem">
                    <span className="featureIcon">✅</span>
                    <span>No Hidden Fees</span>
                  </div>
                </div>

                <div className="howItWorks">
                  <p className="howTitle">How it works</p>
                  <div className="howStep">
                    <span className="howNum">1</span>
                    <span>Enter your M-Pesa phone number above</span>
                  </div>
                  <div className="howStep">
                    <span className="howNum">2</span>
                    <span>You'll get a prompt on your phone — enter your PIN</span>
                  </div>
                  <div className="howStep">
                    <span className="howNum">3</span>
                    <span>This page confirms your payment automatically</span>
                  </div>
                </div>

                <FAQAccordion code={code} whatsapp={SUPPORT_WHATSAPP} />

                <div className="footerTrust">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" stroke="#64748b" strokeWidth="1.5"/></svg>
                  256-bit SSL
                  <span className="tDot">•</span>
                  PCI DSS
                  <span className="tDot">•</span>
                  <button type="button" className="helpInline" onClick={() => window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=Hi%2C%20I%20need%20help%20with%20invoice%20${code}`, "_blank")}>
                    Need help?
                  </button>
                  <span className="tDot">•</span>
                  <button type="button" className="helpInline" onClick={() => window.open(TIKTOK_URL, "_blank")}>
                    About
                  </button>
                </div>
              </form>
            </>
          )}
        </>
      )}

      <style jsx>{`
        .brandHeader { text-align: center; padding-top: 4px; }
        .brandName {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-weight: 700;
          font-size: 30px;
          color: #ffffff;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .verifiedSub { color: #cbd5e1; font-size: 14px; font-weight: 400; margin: 6px 0 0; letter-spacing: 0.3px; }
        .divider { width: 80%; height: 1px; background: rgba(255,255,255,0.15); margin: 26px auto; }
        .recipientLine { color: #94a3b8; font-size: 13px; text-align: center; margin: 0 0 16px; }
        .recipientLine strong { color: #e2e8f0; }
        .noFees { color: #4ade80; font-size: 11.5px; text-align: center; margin: 6px 0 0; }
        .paymentMeta {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 4px 14px;
          margin: 0 0 22px;
        }
        .metaRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 9px 0;
          font-size: 12.5px;
        }
        .metaRow + .metaRow { border-top: 1px solid rgba(255,255,255,0.05); }
        .metaRow.clickable { cursor: pointer; }
        .metaLabel { color: #64748b; flex-shrink: 0; }
        .metaValue { color: #cbd5e1; text-align: right; }
        .metaValue.mono { font-family: monospace; letter-spacing: 0.4px; }
        .copyHint { color: #475569; font-family: 'Inter', sans-serif; font-size: 10px; margin-left: 2px; }
        .offlineBanner {
          background: rgba(248,113,113,0.12);
          border: 1px solid rgba(248,113,113,0.3);
          color: #f87171;
          font-size: 12px;
          text-align: center;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: #1e293b;
          color: #e2e8f0;
          font-size: 13px;
          padding: 10px 18px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
          z-index: 50;
          animation: toastIn 0.2s ease;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @media print {
          .offlineBanner, .toast, .primaryBtn, .linkRow, .geoAccent, .pageFooter { display: none !important; }
        }
        .expectationNote { color: #475569; font-size: 12px; text-align: center; margin: 10px 0 0; }
        .verifyContext { margin: 16px 0 4px; }
        .verifyContext p { color: #94a3b8; font-size: 13px; text-align: center; margin: 4px 0; }
        .verifyContext strong { color: #e2e8f0; }
        .rotatingStatus { color: #00CED1; font-size: 13px; font-weight: 600; text-align: center; margin: 14px 0 0; min-height: 18px; }
        .reassureNote { color: #475569; font-size: 11.5px; text-align: center; margin: 10px 0 0; font-style: italic; }
        .tipLine { color: #334155; font-size: 11.5px; text-align: center; margin: 22px 0 0; }
        .payNowBtn {
          display: block;
          width: 100%;
          margin: 26px auto 0;
          padding: 15px 30px;
          background: linear-gradient(135deg, #00CED1, #06B6D4);
          border: none;
          border-radius: 10px;
          color: #060b14;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 1px;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(0,206,209,0.25);
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
        }
        .payNowBtn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(0,206,209,0.35); }
        .payNowBtn:active:not(:disabled) { transform: translateY(0); }
        .payNowBtn:disabled { background: rgba(255,255,255,0.08); color: #475569; box-shadow: none; cursor: not-allowed; }
        .payNowBtn .arrow { display: inline-block; margin-left: 4px; }
        .expiryNote { text-align: center; margin: 14px 0 0; }
        .featureGrid { display: flex; justify-content: space-between; margin-top: 24px; gap: 8px; }
        .featureItem {
          flex: 1;
          text-align: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 12px 6px;
          color: #94a3b8;
          font-size: 10.5px;
          font-weight: 600;
        }
        .featureIcon { display: block; font-size: 18px; margin-bottom: 6px; }
        .howItWorks { margin-top: 26px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 18px; }
        .howTitle { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; margin: 0 0 12px; }
        .howStep { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; color: #94a3b8; font-size: 12.5px; line-height: 1.5; }
        .howNum {
          flex-shrink: 0;
          width: 20px; height: 20px;
          border-radius: 50%;
          background: rgba(0,206,209,0.15);
          color: #00CED1;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .footerTrust { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 24px; color: #64748b; font-size: 10.5px; flex-wrap: wrap; }
        .helpInline { background: none; border: none; color: #64748b; font-size: 10.5px; cursor: pointer; padding: 0; text-decoration: underline; }
        .topRow { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .brandMark { display: flex; align-items: center; gap: 6px; color: #e2e8f0; font-weight: 700; font-size: 13px; letter-spacing: 0.4px; }
        .logoBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FFD700, #B8860B);
          color: #060b14;
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }
        .stepBar { display: flex; gap: 6px; margin-bottom: 28px; }
        .amountSection { text-align: center; margin-bottom: 4px; }
        .amountLabel { color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 6px; }
        .amountValue { color: #f8fafc; font-size: 32px; font-weight: 800; margin: 0; letter-spacing: -0.3px; font-variant-numeric: tabular-nums; }
        .currency { font-size: 18px; font-weight: 700; color: #00CED1; margin-right: 8px; vertical-align: middle; }
        .lineItem { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 24px; }
        .lineLabel { color: #64748b; font-size: 13px; }
        .lineValue { color: #e2e8f0; font-size: 13px; font-weight: 600; text-align: right; max-width: 60%; }
        .fieldLabel { display: block; color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .phoneGroup { display: flex; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden; background: #0c1524; transition: border-color 0.15s, box-shadow 0.15s; }
        .phoneGroup:focus-within { border-color: #00CED1; box-shadow: 0 0 0 3px rgba(0,206,209,0.15); }
        .prefix { padding: 13px 12px; color: #64748b; font-size: 15px; font-weight: 600; background: rgba(255,255,255,0.02); border-right: 1px solid #1e293b; }
        .phoneInput { flex: 1; border: none; background: transparent; color: #f1f5f9; font-size: 15px; padding: 13px 14px; outline: none; box-sizing: border-box; }
        .fieldError { color: #f87171; font-size: 12px; margin: 8px 0 0; }
        .primaryBtn {
          width: 100%;
          margin-top: 20px;
          padding: 15px;
          border-radius: 10px;
          border: none;
          background: #00CED1;
          color: #06202a;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: filter 0.15s, transform 0.1s;
        }
        .primaryBtn:hover { filter: brightness(1.08); }
        .primaryBtn:active { transform: scale(0.98); }
        .trustLine { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 16px; color: #64748b; font-size: 11.5px; }
        .tDot { color: #334155; }
        .helpLink { display: block; width: 100%; text-align: center; margin-top: 18px; background: none; border: none; color: #00CED1; font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px; }
        .helpLink:hover { text-decoration: underline; }
        .centerState { text-align: center; padding: 12px 0 4px; }
        .stateTitle { color: #f8fafc; font-size: 18px; font-weight: 700; margin: 14px 0 6px; }
        .stateSub { color: #64748b; font-size: 13.5px; margin: 0 0 18px; }
        .successBlock { text-align: center; }
        .amountBig { color: #f8fafc; font-size: 32px; font-weight: 800; margin: 4px 0 22px; }
        .detailsTable { text-align: left; border-top: 1px solid rgba(255,255,255,0.06); margin-bottom: 20px; }
        .detailRow { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }
        .detailRow span:first-child { color: #64748b; }
        .detailRow span:last-child { color: #e2e8f0; font-weight: 600; }
        .mono { font-family: monospace; color: #00CED1 !important; }
        .statusPill { background: rgba(74,222,128,0.12); color: #4ade80 !important; padding: 2px 10px; border-radius: 20px; font-size: 11px; }
        .linkRow { display: flex; justify-content: center; gap: 10px; margin-top: 14px; }
        .linkBtn { background: none; border: none; color: #64748b; font-size: 12.5px; font-weight: 600; cursor: pointer; text-decoration: underline; }
        .dot { color: #334155; }
        .shake { animation: shakeAnim 0.4s; }
        @keyframes shakeAnim {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </Shell>
  );
}

function StepBar({ step }) {
  return (
    <div className="stepBar">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={s === step ? "activeStep" : ""}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: s < step ? "#00CED1" : s === step ? undefined : "rgba(255,255,255,0.08)",
            transition: "background 0.3s",
          }}
        />
      ))}
      <style jsx>{`
        .stepBar { display: flex; gap: 6px; margin-bottom: 28px; }
        .activeStep {
          background: linear-gradient(90deg, #00CED1, #0891b2, #00CED1);
          background-size: 200% 100%;
          animation: shimmerStep 1.4s linear infinite;
        }
        @keyframes shimmerStep {
          to { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function FAQAccordion({ code, whatsapp }) {
  const [openIndex, setOpenIndex] = useState(null);
  const faqs = [
    {
      q: "Is this payment secure?",
      a: "Yes. Payments are processed directly through Safaricom M-Pesa via Makamesco nexus, a licensed payment processor. Whale Enterprise never sees or stores your M-Pesa PIN.",
    },
    {
      q: "I didn't get a prompt on my phone",
      a: "This can happen if your phone has no signal or you dont have sufficient funds. Try again, or tap \"Need help?\" below to reach support directly.",
    },
    {
      q: "Can I use this link again?",
      a: "No — each payment link is single-use and automatically locks once a payment is completed, so it can't be paid twice.",
    },
  ];

  return (
    <div className="faqWrap">
      <p className="faqTitle">Frequently asked</p>
      {faqs.map((item, i) => (
        <div key={i} className="faqItem">
          <button
            type="button"
            className="faqQ"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            {item.q}
            <span className={`faqCaret ${openIndex === i ? "open" : ""}`}>⌄</span>
          </button>
          {openIndex === i && <p className="faqA">{item.a}</p>}
        </div>
      ))}
      <style jsx>{`
        .faqWrap { margin-top: 28px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 18px; }
        .faqTitle { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; margin: 0 0 10px; }
        .faqItem { border-bottom: 1px solid rgba(255,255,255,0.05); }
        .faqQ {
          width: 100%;
          background: none;
          border: none;
          color: #cbd5e1;
          font-size: 13px;
          text-align: left;
          padding: 12px 0;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .faqCaret { color: #475569; transition: transform 0.2s; font-size: 16px; }
        .faqCaret.open { transform: rotate(180deg); }
        .faqA { color: #64748b; font-size: 12.5px; line-height: 1.6; margin: 0 0 14px; padding-right: 10px; }
      `}</style>
    </div>
  );
}

function Countdown({ createdAt }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    function update() {
      const expiry = createdAt + EXPIRY_HOURS * 60 * 60 * 1000;
      const diff = expiry - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${h}h ${m}m left`);
    }
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [createdAt]);
  if (!timeLeft) return null;
  return (
    <span className="countdown">
      {timeLeft}
      <style jsx>{`
        .countdown { color: #475569; font-size: 11px; font-weight: 500; }
      `}</style>
    </span>
  );
}

function StatusRing({ type, pulse }) {
  const color = type === "success" ? "#00CED1" : type === "warn" ? "#facc15" : "#f87171";
  const icon = type === "success" ? "✓" : type === "warn" ? "!" : "✕";
  return (
    <div className={`ring ${pulse ? "pulse" : ""}`} style={{ borderColor: color, color }}>
      {icon}
      <style jsx>{`
        .ring {
          width: 64px; height: 64px;
          border: 2.5px solid;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 26px; font-weight: 700;
          margin: 0 auto;
        }
        .pulse { animation: pulseRing 1.6s ease-out infinite; }
        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(0,206,209,0.35); }
          70% { box-shadow: 0 0 0 14px rgba(0,206,209,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,206,209,0); }
        }
      `}</style>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="skeletonWrap">
      <div className="sk sk-row" />
      <div className="sk sk-amount" />
      <div className="sk sk-line" />
      <div className="sk sk-input" />
      <div className="sk sk-btn" />
      <style jsx>{`
        .skeletonWrap { display: flex; flex-direction: column; gap: 16px; }
        .sk { background: linear-gradient(90deg, #0f1c30 25%, #1a2c45 37%, #0f1c30 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; border-radius: 8px; }
        .sk-row { width: 110px; height: 14px; }
        .sk-amount { width: 160px; height: 34px; align-self: center; margin: 10px 0; }
        .sk-line { width: 100%; height: 40px; }
        .sk-input { width: 100%; height: 48px; border-radius: 10px; }
        .sk-btn { width: 100%; height: 50px; border-radius: 10px; }
        @keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
      `}</style>
    </div>
  );
}

function PulsePhone() {
  return (
    <div className="pulsePhoneWrap">
      <div className="pulseRing r1" />
      <div className="pulseRing r2" />
      <div className="phoneIcon">📲</div>
      <style jsx>{`
        .pulsePhoneWrap { position: relative; width: 70px; height: 70px; margin: 6px auto 14px; display: flex; align-items: center; justify-content: center; }
        .phoneIcon { font-size: 30px; z-index: 1; }
        .pulseRing {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(0,206,209,0.4);
          animation: pulseOut 2s ease-out infinite;
        }
        .r2 { animation-delay: 1s; }
        @keyframes pulseOut {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <div className="spinnerWrap">
      <div className="spinner" />
      <style jsx>{`
        .spinnerWrap { display: flex; justify-content: center; margin: 6px 0 14px; }
        .spinner { width: 40px; height: 40px; border: 3px solid rgba(0,206,209,0.15); border-top-color: #00CED1; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Shell({ children, title, description }) {
  return (
    <>
      <Head>
        <title>{title ? `${title} | Whale Enterprise` : "Whale Enterprise Pay"}</title>
        <link rel="icon" href={FAVICON} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,700&display=swap" rel="stylesheet" />
        <meta property="og:title" content={title || "Whale Enterprise Pay"} />
        <meta property="og:description" content={description || "Fast, secure M-Pesa checkout by Whale Enterprise."} />
      </Head>
      <div className="page">
        <div className="card">
          <div className="geoAccent" aria-hidden="true" />
          {children}
        </div>
        <div className="pageFooter">
          <p>© {new Date().getFullYear()} Whale Enterprise</p>
          <p>Self-Taught. Self-Made.</p>
        </div>
      </div>
      <style jsx global>{`
        * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
      <style jsx>{`
        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 50% -10%, rgba(0,206,209,0.06), transparent 45%),
            radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(160deg, #060b14 0%, #0a1420 55%, #060b14 100%);
          background-size: auto, 22px 22px, auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0;
        }
        .card {
          width: 100%;
          max-width: 480px;
          min-height: 100vh;
          background: #0d1826;
          border-radius: 0;
          padding: 40px 26px 32px;
          border: none;
          box-shadow: none;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        @media (min-width: 480px) {
          .card {
            min-height: auto;
            margin: 40px 0;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.06);
            box-shadow: 0 20px 50px -15px rgba(0,0,0,0.6);
          }
        }
        .geoAccent {
          position: absolute;
          top: 0;
          right: 0;
          width: 140px;
          height: 140px;
          background: linear-gradient(135deg, #3B82F6, #06B6D4);
          opacity: 0.85;
          clip-path: polygon(100% 0, 100% 100%, 20% 0);
          pointer-events: none;
        }
        .pageFooter {
          padding: 24px 0 32px;
          text-align: center;
          width: 100%;
          max-width: 480px;
        }
        .pageFooter p {
          color: #2c3a52;
          font-size: 11px;
          margin: 2px 0;
          letter-spacing: 0.3px;
        }
      `}</style>
    </>
  );
}
