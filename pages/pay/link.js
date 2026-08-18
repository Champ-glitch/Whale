// pages/pay/link.js
import Head from 'next/head';
import { useState, useRef } from 'react';

const VERIFY_MESSAGES = [
  "Waiting for you to enter your M-Pesa PIN...",
  "Still confirming with M-Pesa...",
  "Almost there...",
];

export default function PayLink() {
  const [stage, setStage] = useState('idle'); // idle | sending | verifying | success | failed
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  function startPolling(code) {
    let attempts = 0;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/invoice-status?code=${code}`);
        const data = await res.json();
        if (data.status === 'success') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStage('success');
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setErrorMsg('The transaction was cancelled or failed.');
          setStage('failed');
        }
      } catch {}
      if (attempts >= 30) {
        clearInterval(pollRef.current);
        clearInterval(timerRef.current);
        setErrorMsg('Still processing. Check back shortly.');
        setStage('failed');
      }
    }, 3000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStage('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/public-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setStage('verifying');
      setElapsed(0);
      startPolling(data.code);
    } catch (err) {
      setErrorMsg(err.message);
      setStage('failed');
    }
  }

  function retry() {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setStage('idle');
    setErrorMsg('');
  }

  return (
    <>
      <Head>
        <title>Pay Whale Enterprise</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div className="wrap">
        <div className="card">
          {stage === 'success' ? (
            <div className="centerState">
              <div className="ring success">✓</div>
              <p className="stateTitle">Payment Successful</p>
              <p className="amountBig">KES {Number(amount).toLocaleString()}</p>
            </div>
          ) : stage === 'verifying' || stage === 'sending' ? (
            <div className="centerState">
              <div className="pulseIcon">📱</div>
              <p className="stateTitle">
                {stage === 'sending' ? 'Sending request' : 'Verifying payment'}
              </p>
              <p className="stateSub">Check your phone and enter your M-Pesa PIN.</p>
              {stage === 'verifying' && (
                <>
                  <p className="rotatingStatus">
                    {VERIFY_MESSAGES[Math.min(Math.floor(elapsed / 6), VERIFY_MESSAGES.length - 1)]}
                  </p>
                  <p className="expectationNote">{elapsed}s elapsed</p>
                </>
              )}
            </div>
          ) : stage === 'failed' ? (
            <div className="centerState">
              <div className="ring error">✕</div>
              <p className="stateTitle">Payment not completed</p>
              <p className="stateSub">{errorMsg}</p>
              <button className="primaryBtn" onClick={retry}>Try again</button>
            </div>
          ) : (
            <>
              <p className="brandName">whale enterprise</p>
              <p className="verifiedSub">Merchant Verified</p>
              <div className="divider" />

              <form onSubmit={handleSubmit}>
                <label className="fieldLabel">Amount (KES)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input"
                  placeholder="500"
                  required
                />

                <label className="fieldLabel">Phone number</label>
                <div className="phoneGroup">
                  <span className="prefix">+254</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="phoneInput"
                    placeholder="712 345 678"
                    required
                  />
                </div>

                <button type="submit" className="payNowBtn">
                  PAY NOW <span className="arrow">→</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: 'Inter', -apple-system, sans-serif;
        }
      `}</style>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 30% 20%, #0a1628 0%, #060b14 60%);
          padding: 20px;
        }
        .card {
          width: 100%;
          max-width: 380px;
          background: rgba(10, 22, 40, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 32px 28px;
        }
        .brandName {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-weight: 700;
          font-size: 26px;
          color: #fff;
          margin: 0;
          text-align: center;
        }
        .verifiedSub {
          text-align: center;
          color: #cbd5e1;
          font-size: 13px;
          margin: 6px 0 0;
        }
        .divider {
          width: 80%;
          height: 1px;
          background: rgba(255, 255, 255, 0.15);
          margin: 24px auto;
        }
        .fieldLabel {
          display: block;
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 6px;
        }
        .input {
          width: 100%;
          background: #060b14;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 12px 14px;
          color: #e2e8f0;
          font-size: 15px;
          font-family: inherit;
          margin-bottom: 18px;
        }
        .input:focus { outline: none; border-color: #00ced1; }
        .phoneGroup {
          display: flex;
          align-items: center;
          background: #060b14;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 0 14px;
          margin-bottom: 22px;
        }
        .prefix { color: #94a3b8; font-size: 15px; margin-right: 6px; }
        .phoneInput {
          flex: 1;
          background: none;
          border: none;
          padding: 12px 0;
          color: #e2e8f0;
          font-size: 15px;
          font-family: inherit;
        }
        .phoneInput:focus { outline: none; }
        .payNowBtn {
          width: 100%;
          background: #ffd700;
          color: #0a1628;
          border: none;
          border-radius: 10px;
          padding: 15px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          font-family: inherit;
        }
        .centerState { text-align: center; padding: 12px 0; }
        .ring {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          margin: 0 auto 18px;
        }
        .ring.success { border: 2px solid #00ced1; color: #00ced1; }
        .ring.error { border: 2px solid #ff6b6b; color: #ff6b6b; }
        .pulseIcon { font-size: 40px; margin-bottom: 14px; }
        .stateTitle { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 6px; }
        .stateSub { color: #94a3b8; font-size: 13px; margin: 0 0 14px; }
        .amountBig { font-size: 24px; font-weight: 700; color: #ffd700; margin: 0; }
        .rotatingStatus { color: #00ced1; font-size: 13px; margin: 0 0 4px; }
        .expectationNote { color: #94a3b8; font-size: 12px; margin: 0; }
        .primaryBtn {
          background: #ffd700;
          color: #0a1628;
          border: none;
          border-radius: 8px;
          padding: 11px 24px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          margin-top: 8px;
        }
      `}</style>
    </>
  );
}
