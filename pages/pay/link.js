// pages/pay/link.js
import Head from 'next/head';
import { useState, useRef } from 'react';
import { ShieldCheck, Zap, CheckCircle2 } from 'lucide-react';

const VERIFY_MESSAGES = [
  "Waiting for you to enter your M-Pesa PIN...",
  "Still confirming with M-Pesa...",
  "Almost there...",
];

export default function PayLink() {
  const [stage, setStage] = useState('idle');
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
        <meta name="description" content="Send a secure M-Pesa payment to Whale Enterprise." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-[#0B0F1A] relative overflow-hidden flex items-center justify-center px-5 py-10">
        <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-yellow-400/10 blur-3xl" />

        <div className="relative w-full max-w-[400px]">
          {stage === 'success' ? (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-full border-2 border-teal-400 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-teal-400" />
              </div>
              <p className="text-white font-bold text-lg mb-1">Payment Successful</p>
              <p className="text-yellow-400 text-2xl font-bold">KES {Number(amount).toLocaleString()}</p>
            </div>
          ) : stage === 'verifying' || stage === 'sending' ? (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
              <div className="text-4xl mb-4">📱</div>
              <p className="text-white font-bold text-lg mb-1">
                {stage === 'sending' ? 'Sending request' : 'Verifying payment'}
              </p>
              <p className="text-slate-400 text-sm mb-4">Check your phone and enter your M-Pesa PIN.</p>
              {stage === 'verifying' && (
                <>
                  <p className="text-teal-400 text-xs mb-1">
                    {VERIFY_MESSAGES[Math.min(Math.floor(elapsed / 6), VERIFY_MESSAGES.length - 1)]}
                  </p>
                  <p className="text-slate-500 text-xs">{elapsed}s elapsed</p>
                </>
              )}
            </div>
          ) : stage === 'failed' ? (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-full border-2 border-red-400 flex items-center justify-center mx-auto mb-4 text-red-400 text-xl font-bold">
                ✕
              </div>
              <p className="text-white font-bold text-lg mb-1">Payment not completed</p>
              <p className="text-slate-400 text-sm mb-5">{errorMsg}</p>
              <button
                onClick={retry}
                className="px-6 py-2.5 rounded-full text-sm font-bold bg-gradient-to-r from-blue-500 to-yellow-400 text-[#0B0F1A]"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* Brand header */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-3xl">🐋</span>
                </div>
                <p className="font-serif italic font-bold text-2xl text-white">whale enterprise</p>
                <p className="text-xs text-teal-400 mt-1 flex items-center justify-center gap-1">
                  <ShieldCheck size={12} /> Merchant Verified
                </p>
                <p className="text-slate-400 text-xs mt-3 max-w-[280px] mx-auto leading-relaxed">
                  Send a secure M-Pesa payment directly to Whale Enterprise. Enter your amount
                  and phone number below — you'll get a prompt on your phone to confirm.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6">
                <label className="block text-xs text-slate-400 mb-1.5">Amount (KES)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  required
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 mb-4 focus:outline-none focus:border-teal-400"
                />

                <label className="block text-xs text-slate-400 mb-1.5">Phone number</label>
                <div className="flex items-center bg-black/30 border border-white/10 rounded-xl px-4 mb-5 focus-within:border-teal-400">
                  <span className="text-slate-400 text-sm mr-2">+254</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="712 345 678"
                    required
                    className="flex-1 bg-transparent py-3 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full text-sm font-bold bg-gradient-to-r from-blue-500 to-yellow-400 text-[#0B0F1A] flex items-center justify-center gap-1.5"
                >
                  PAY NOW <Zap size={14} />
                </button>

                <div className="flex items-center justify-center gap-4 mt-5 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><ShieldCheck size={11} /> Encrypted</span>
                  <span>·</span>
                  <span>256-bit SSL</span>
                  <span>·</span>
                  <span>No hidden fees</span>
                </div>
              </form>

              <p className="text-center text-slate-600 text-[11px] mt-6">
                © 2026 Whale Enterprise · Self-Taught. Self-Made.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
