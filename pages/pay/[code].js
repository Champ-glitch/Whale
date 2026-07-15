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
      },
      code: params.code,
    },
  };
}

const SUPPORT_WHATSAPP = "254798016597";

function isValidKenyanPhone(phone) {
  return /^(0|\+?254)(7|1)\d{8}$/.test(phone.replace(/\s/g, ""));
}

export default function PayPage({ invoice, code }) {
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [stage, setStage] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  if (!invoice) {
    return (
      <Shell>
        <StatusIcon type="error" />
        <p className="statusText error">This payment link is invalid or has expired.</p>
      </Shell>
    );
  }

  if (invoice.status === "success" && stage === "idle") {
    return (
      <Shell>
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

  return (
    <Shell>
      {stage === "success" ? (
        <>
          <StatusIcon type="success" />
          <p className="statusText success">Payment completed! 🎉</p>
          <p className="subtle">KES {invoice.amount} received successfully.</p>
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
            <p className="amount">KES {invoice.amount?.toLocaleString()}</p>
          </div>

          <div className="whaleWrap fadeIn2">
            <span className="whale">🐋</span>
          </div>

          <form onSubmit={handleSubmit} className="fadeIn3">
            <label className="label" htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="07 XXX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
        .amount { color: #ffffff; font-size: 34px; font-weight: 800; margin: 0; }
        .whaleWrap { display: flex; justify-content: center; margin: 20px 0 28px; }
        .whale {
          font-size: 72px;
          display: inline-block;
          filter: drop-shadow(0 0 18px #00CED1) drop-shadow(0 0 8px #FFD700);
          animation: float 3.5s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
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
        }
        .payBtn:hover { transform: scale(1.03); box-shadow: 0 0 24px rgba(0,206,209,0.5); }
        .payBtn:active { transform: scale(0.98); }
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
        .fadeIn1 { animation: fadeIn 0.5s ease both; }
        .fadeIn2 { animation: fadeIn 0.5s ease 0.15s both; }
        .fadeIn3 { animation: fadeIn 0.5s ease 0.3s both; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Shell>
  );
}

function Spinner() {
  return (
    <div className="spinnerWrap">
      <div className="spinner" />
      <style jsx>{`
        .spinnerWrap { display: flex; justify-content: center; margin: 30px 0 16px; }
        .spinner {
          width: 48px; height: 48px;
          border: 4px solid rgba(0,206,209,0.2);
          border-top-color: #00CED1;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatusIcon({ type }) {
  const icon = type === "success" ? "✅" : type === "warn" ? "⏳" : "❌";
  return (
    <div style={{ fontSize: 56, textAlign: "center", marginBottom: 8 }}>{icon}</div>
  );
}

function Shell({ children }) {
  return (
    <>
      <Head>
        <title>WHALE_SYS Pay</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>
      <div className="page">
        <div className="blob blob1" />
        <div className="blob blob2" />
        <div className="blob blob3" />
        <div className="card">
          <p className="brand">WHALE_SYS</p>
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
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.35;
        }
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
          position: relative;
          z-index: 1;
        }
        .brand {
          color: #FFD700;
          font-weight: 800;
          letter-spacing: 2px;
          font-size: 14px;
          text-align: center;
          margin: 0 0 22px;
        }
      `}</style>
    </>
  );
}
