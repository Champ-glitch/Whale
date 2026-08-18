// pages/admin/deductions.js
import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { isAuthenticated } from '../../lib/adminAuth';

export async function getServerSideProps({ req }) {
  if (!isAuthenticated(req)) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
  return { props: {} };
}

function fmt(n) {
  return `KES ${Number(n || 0).toLocaleString()}`;
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminDeductions() {
  const [deductions, setDeductions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    fetch('/api/admin/deductions')
      .then((r) => r.json())
      .then((data) => {
        setDeductions(data.deductions || []);
        setTotal(data.total || 0);
        setLoading(false);
      });
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAmount('');
      setReason('');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const pulse = [{ name: 'KV', ok: true }, { name: 'Telegram', ok: true }, { name: 'Makamesco', ok: true }];

  return (
    <AdminLayout title="Deductions" pulse={pulse}>
      <h1 className="pageTitle">Deductions</h1>
      <p className="pageSub">Total deducted: <span className="totalHighlight">{fmt(total)}</span></p>

      <form onSubmit={handleSubmit} className="createCard">
        <div className="row">
          <div className="field">
            <label className="label">Amount (KES)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              placeholder="200"
              required
            />
          </div>
          <div className="field grow">
            <label className="label">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
              placeholder="What was this for?"
            />
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn">
          {saving ? 'Logging...' : 'Log deduction'}
        </button>
      </form>

      <h2 className="sectionTitle">Recent deductions</h2>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : deductions.length === 0 ? (
        <p className="muted">No deductions logged yet.</p>
      ) : (
        <div className="table">
          {deductions.map((d, i) => (
            <div key={i} className="tableRow">
              <div className="rowMain">
                <span className="reason">{d.reason}</span>
                <span className="time">{timeAgo(d.at)}</span>
              </div>
              <span className="amount">−{fmt(d.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .pageTitle {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-size: 28px;
          margin: 0 0 4px;
          color: #fff;
        }
        .pageSub { color: #94a3b8; font-size: 14px; margin: 0 0 24px; }
        .totalHighlight { color: #ff6b6b; font-weight: 700; }
        .createCard {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 32px;
        }
        .row { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field.grow { flex: 1; min-width: 160px; }
        .label { font-size: 12px; color: #94a3b8; }
        .input {
          background: #060b14;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 10px 12px;
          color: #e2e8f0;
          font-size: 14px;
          font-family: inherit;
          width: 100%;
        }
        .input:focus { outline: none; border-color: #00ced1; }
        .btn {
          background: #ffd700;
          color: #0a1628;
          border: none;
          border-radius: 8px;
          padding: 11px 20px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
        }
        .btn:disabled { opacity: 0.6; }
        .sectionTitle {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #94a3b8;
          margin: 0 0 12px;
        }
        .loading, .muted { color: #94a3b8; font-size: 14px; }
        .table { display: flex; flex-direction: column; gap: 6px; }
        .tableRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0a1628;
          padding: 14px 16px;
          border-radius: 8px;
        }
        .rowMain { display: flex; flex-direction: column; gap: 3px; }
        .reason { font-size: 13px; color: #e2e8f0; }
        .time { font-size: 11px; color: #94a3b8; }
        .amount { font-weight: 700; color: #ff6b6b; font-size: 14px; }
      `}</style>
    </AdminLayout>
  );
}
