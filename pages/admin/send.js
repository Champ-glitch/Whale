// pages/admin/send.js
import { useState, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { isAuthenticated } from '../../lib/adminAuth';

export async function getServerSideProps({ req }) {
  if (!isAuthenticated(req)) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
  return { props: {} };
}

export default function AdminSend() {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  function poll(reference, attempts = 0) {
    fetch(`/api/admin/send-status?reference=${reference}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'success' || data.status === 'failed') {
          setStatus(data.status);
          return;
        }
        if (attempts >= 20) {
          setStatus('timeout');
          return;
        }
        pollRef.current = setTimeout(() => poll(reference, attempts + 1), 3000);
      });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setStatus(null);
    setError('');
    clearTimeout(pollRef.current);
    try {
      const res = await fetch('/api/admin/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, phoneNumber: phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus('pending');
      poll(data.reference);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const pulse = [{ name: 'KV', ok: true }, { name: 'Telegram', ok: true }, { name: 'Makamesco', ok: true }];

  const statusText = {
    pending: '⏳ Prompt sent — waiting for M-Pesa confirmation...',
    success: '✅ Payment confirmed',
    failed: '❌ Payment failed or was cancelled',
    timeout: '⚠️ No confirmation yet — check Live Payments in a moment',
  };

  return (
    <AdminLayout title="Send Payment" pulse={pulse}>
      <h1 className="pageTitle">Send Payment</h1>
      <p className="pageSub">Trigger an M-Pesa STK push directly, without going through Telegram.</p>

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label className="label">Amount (KES)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            placeholder="500"
            required
          />
        </div>
        <div className="field">
          <label className="label">Phone number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            placeholder="0712345678"
            required
          />
        </div>
        <button type="submit" disabled={sending} className="btn">
          {sending ? 'Sending...' : 'Send STK push'}
        </button>

        {error && <p className="resultMsg err">{error}</p>}
        {status && (
          <p className={`resultMsg ${status === 'success' ? 'ok' : status === 'failed' ? 'err' : 'wait'}`}>
            {statusText[status]}
          </p>
        )}
      </form>

      <style jsx>{`
        .pageTitle {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-size: 28px;
          margin: 0 0 4px;
          color: #fff;
        }
        .pageSub { color: #94a3b8; font-size: 14px; margin: 0 0 24px; }
        .card {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
        }
        .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
        .label { font-size: 12px; color: #94a3b8; }
        .input {
          background: #060b14;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 11px 12px;
          color: #e2e8f0;
          font-size: 15px;
          font-family: inherit;
        }
        .input:focus { outline: none; border-color: #00ced1; }
        .btn {
          width: 100%;
          background: #ffd700;
          color: #0a1628;
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          font-family: inherit;
        }
        .btn:disabled { opacity: 0.6; }
        .resultMsg { font-size: 13px; margin: 14px 0 0; }
        .resultMsg.ok { color: #00ced1; }
        .resultMsg.err { color: #ff6b6b; }
        .resultMsg.wait { color: #ffd700; }
      `}</style>
    </AdminLayout>
  );
}
