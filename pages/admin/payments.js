// pages/admin/payments.js
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

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  function load() {
    fetch('/api/admin/payments')
      .then((r) => r.json())
      .then((data) => {
        setPayments(data.payments || []);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = payments.filter((p) => filter === 'all' || p.status === filter);
  const pulse = [{ name: 'KV', ok: true }, { name: 'Telegram', ok: true }, { name: 'Makamesco', ok: true }];

  return (
    <AdminLayout title="Live Payments" pulse={pulse}>
      <h1 className="pageTitle">Live Payments</h1>
      <p className="pageSub">Successful and failed transactions from the last 48 hours.</p>

      <div className="tabs">
        {['all', 'success', 'failed'].map((f) => (
          <button
            key={f}
            className={`tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="muted">No {filter !== 'all' ? filter : ''} payments yet.</p>
      ) : (
        <div className="table">
          {filtered.map((p) => (
            <div key={p.code} className="tableRow">
              <div className={`statusDot ${p.status}`} />
              <div className="rowMain">
                <span className="desc">{p.description}</span>
                <span className="code">{p.code} · {timeAgo(p.createdAt)}</span>
              </div>
              <span className={`amount ${p.status}`}>{fmt(p.amount)}</span>
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
        .pageSub { color: #94a3b8; font-size: 14px; margin: 0 0 20px; }
        .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
        .tab {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          padding: 7px 16px;
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
        }
        .tab.active {
          background: rgba(255, 215, 0, 0.1);
          border-color: #ffd700;
          color: #ffd700;
        }
        .loading, .muted { color: #94a3b8; font-size: 14px; }
        .table { display: flex; flex-direction: column; gap: 6px; }
        .tableRow {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #0a1628;
          padding: 14px 16px;
          border-radius: 8px;
        }
        .statusDot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .statusDot.success { background: #00ced1; }
        .statusDot.failed { background: #ff6b6b; }
        .rowMain { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .desc { font-size: 13px; color: #e2e8f0; }
        .code { font-size: 11px; color: #94a3b8; }
        .amount { font-weight: 700; font-size: 14px; }
        .amount.success { color: #00ced1; }
        .amount.failed { color: #ff6b6b; }
      `}</style>
    </AdminLayout>
  );
}
