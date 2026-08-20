// pages/pay/link.js
import Head from 'next/head';
import { useState, useRef } from 'react';
import { ShieldCheck, Zap, CheckCircle2, XCircle, Banknote, Phone, FileText } from 'lucide-react';

const VERIFY_MESSAGES = [
  "Waiting for you to enter your M-Pesa PIN...",
  "Still confirming with M-Pesa...",
  "Almost there...",
];

function BrandHeader({ compact = false }) {
  return (
    <div className={`text-center ${compact ? 'mb-5' : 'mb-6'}`}>
      <div className="relative w-16 h-16 mx-auto mb-3">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 to-teal-400 animate-pulse opacity-40 blur-md" />
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-teal-400 p-[2px]">
          <div className="w-full h-full rounded-full bg-[#0B0F1A] flex items-center justify-center text-2xl">
            🐋
          </div>
        </div>
      </div>
      <p className="font-serif italic font-bold text-2xl">
        <span className="text-white">Whale </span>
        <span className="bg-gradient-to-r from-yellow-400 to-teal-400 bg-clip-text text-transparent">
          Enterprise
        </span>
      </p>
      <p className="text-xs text-teal-400 mt-1 flex items-center justify-center gap-1">
        <ShieldCheck size={12} /> Merchant Verified
      </p>
    </div>
  );
}

export default function PayLink() {
  const [stage, setStage] = useState('idle');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
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
        body: JSON.stringify({ amount, phone, description }),
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
            <>
              <BrandHeader compact />
              <div className="relative bg-white/5 backdrop-blur-xl border border-teal-400/20 rounded-3xl shadow-2xl p-8 text-center overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 -top-10 h-32 bg-teal-400/10 blur-2xl" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-teal-400 flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(45,212,191,0.4)]">
                    <CheckCircle2 size={30} className="text-teal-400" />
                  </div>
                  <p className="text-white font-bold text-lg mb-3">Payment Confirmed</p>
                  <p className="text-xs text-slate-400 mb-1">Amount</p>
                  <p className="text-4xl font-bold text-yellow-400 mb-4">KES {Number(amount).toLocaleString()}</p>
                  <p className="text-slate-400 text-sm">Paid to Whale Enterprise</p>
                </div>
              </div>
            </>
          ) : stage === 'verifying' || stage === 'sending' ? (
            <>
              <BrandHeader compact />
              <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 text-center overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 -top-10 h-32 bg-gradient-to-r from-yellow-400/10 to-teal-400/10 blur-2xl" />
                <div className="relative">
                  <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 to-teal-400 animate-ping opacity-20" />
                    <div className="relative w-16 h-16 rounded-full border-2 border-yellow-400/40 flex items-center justify-center text-2xl">
                      📱
                    </div>
                  </div>
                  <p className="text-white font-bold text-lg mb-1">
                    {stage === 'sending' ? 'Processing payment...' : 'Verifying payment'}
                  </p>
                  <p className="text-slate-400 text-sm mb-4">Check your phone and enter your M-Pesa PIN.</p>

                  {amount && (
                    <>
                      <p className="text-xs text-slate-400 mb-1">Amount</p>
                      <p className="text-3xl font-bold text-yellow-400 mb-4">
                        KES {Number(amount).toLocaleString()}
                      </p>
                    </>
                  )}

                  {stage === 'verifying' && (
                    <>
                      <p className="text-teal-400 text-xs mb-1">
                        {VERIFY_MESSAGES[Math.min(Math.floor(elapsed / 6), VERIFY_MESSAGES.length - 1)]}
                      </p>
                      <p className="text-slate-500 text-xs">{elapsed}s elapsed</p>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : stage === 'failed' ? (
            <>
              <BrandHeader compact />
              <div className="relative bg-white/5 backdrop-blur-xl border border-red-400/20 rounded-3xl shadow-2xl p-8 text-center overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 -top-10 h-32 bg-red-400/10 blur-2xl" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-red-400 flex items-center justify-center mx-auto mb-4">
                    <XCircle size={30} className="text-red-400" />
                  </div>
                  <p className="text-white font-bold text-lg mb-1">Payment not completed</p>
                  <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
                  <button
                    onClick={retry}
                    className="px-6 py-2.5 rounded-full text-sm font-bold bg-gradient-to-r from-yellow-400 to-teal-400 text-[#0B0F1A]"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <BrandHeader />
              <p className="text-slate-400 text-xs text-center mb-6 max-w-[280px] mx-auto leading-relaxed -mt-3">
                Send a secure M-Pesa payment directly to Whale Enterprise. Enter your details
                below — you'll get a prompt on your phone to confirm.
              </p>

              <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6">
                <label className="block text-xs text-slate-400 mb-1.5">Amount (KES)</label>
                <div className="flex items-center bg-black/30 border border-white/10 rounded-xl px-4 mb-4 focus-within:border-teal-400">
                  <Banknote size={16} className="text-slate-500 mr-2 flex-shrink-0" />
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="500"
                    required
                    className="flex-1 bg-transparent py-3 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <label className="block text-xs text-slate-400 mb-1.5">Phone number</label>
                <div className="flex items-center bg-black/30 border border-white/10 rounded-xl px-4 mb-4 focus-within:border-teal-400">
                  <Phone size={16} className="text-slate-500 mr-2 flex-shrink-0" />
                  <span className="text-slate-400 text-sm mr-1">+254</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="712 345 678"
                    required
                    className="flex-1 bg-transparent py-3 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <label className="block text-xs text-slate-400 mb-1.5">Payment for (optional)</label>
                <div className="flex items-center bg-black/30 border border-white/10 rounded-xl px-4 mb-5 focus-within:border-teal-400">
                  <FileText size={16} className="text-slate-500 mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Consulting fee"
                    className="flex-1 bg-transparent py-3 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full text-sm font-bold bg-gradient-to-r from-yellow-400 to-teal-400 text-[#0B0F1A] flex items-center justify-center gap-1.5"
                >
                  PAY NOW <Zap size={14} />
                </button>

                <div className="flex items-center justify-center gap-3 mt-5 text-[10px] text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><ShieldCheck size={11} /> SSL Encrypted</span>
                  <span>·</span>
                  <span>Secured by Makamesco Pay</span>
                  <span>·</span>
                  <span>No hidden fees</span>
                </div>
              </form>

              <p className="text-center text-slate-600 text-[11px] mt-6">
                © 2026 Whale Enterprise · Payments are secured by Makamesco Pay
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
