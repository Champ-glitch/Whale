// pages/admin/index.js
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

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState({ kv: true, telegram: true, makamesco: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/summary').then((r) => r.json()),
      fetch('/api/admin/health').then((r) => r.json()),
    ]).then(([s, h]) => {
      setSummary(s);
      setHealth(h);
      setLoading(false);
    });
  }, []);

  const pulse = [
    { name: 'KV', ok: health.kv },
    { name: 'Telegram', ok: health.telegram },
    { name: 'Makamesco', ok: health.makamesco },
  ];

  return (
    <AdminLayout title="Dashboard" pulse={pulse}>
      <h1 className="pageTitle">Dashboard</h1>
      <p className="pageSub">
        {summary?.autoApprove ? 'Auto-approve is ON' : 'Auto-approve is OFF — savings clears via WHALE approve'}
      </p>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <>
          <div className="cardGrid">
            <div className="card">
              <p className="cardLabel">Main Balance</p>
              <p className="cardValue">{fmt(summary.main)}</p>
            </div>
            <div className="card">
              <p className="cardLabel">Savings</p>
              <p className="cardValue teal">{fmt(summary.savings)}</p>
            </div>
            <div className="card">
              <p className="cardLabel">Net Worth</p>
              <p className="cardValue">{fmt(summary.netWorth)}</p>
            </div>
            <div className="card">
              <p className="cardLabel">Pending Split (till → savings)</p>
              <p className="cardValue coral">{fmt(summary.pendingSplit)}</p>
            </div>
          </div>

          <div className="section">
            <h2 className="sectionTitle">Savings Goal</h2>
            <div className="card">
              {summary.savingsGoal ? (
                <>
                  <div className="goalRow">
                    <span>{fmt(summary.savings)} of {fmt(summary.savingsGoal)}</span>
                    <span className="teal">{summary.goalProgress}%</span>
                  </div>
                  <div className="progressTrack">
                    <div className="progressFill" style={{ width: `${summary.goalProgress}%` }} />
                  </div>
                </>
              ) : (
                <p className="muted">No savings goal set. Use /goal in Telegram to set one.</p>
              )}
            </div>
          </div>

          <div className="cardGrid">
            <div className="card">
              <p className="cardLabel">Saved This Week</p>
              <p className="cardValue">{fmt(summary.weeklySaved)}</p>
            </div>
            <div className="card">
              <p className="cardLabel">All-Time Received</p>
              <p className="cardValue">{fmt(summary.stats.total)}</p>
              <p className="cardSub">{summary.stats.count} payments · {summary.stats.streak} day streak</p>
            </div>
            <div className="card">
              <p className="cardLabel">Biggest In</p>
              <p className="cardValue">{fmt(summary.biggestIn)}</p>
            </div>
            <div className="card">
              <p className="cardLabel">Biggest Out</p>
              <p className="cardValue">{fmt(summary.biggestOut.amount)}</p>
              <p className="cardSub">{summary.biggestOut.reason || 'No deductions yet'}</p>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .pageTitle {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-size: 28px;
          margin: 0 0 4px;
          color: #fff;
        }
        .pageSub {
          color: #94a3b8;
          font-size: 14px;
          margin: 0 0 28px;
        }
        .loading { color: #94a3b8; }
        .section { margin: 28px 0; }
        .sectionTitle {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #94a3b8;
          margin: 0 0 12px;
        }
        .cardGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 12px;
        }
        .card {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
        }
        .cardLabel {
          font-size: 12px;
          color: #94a3b8;
          margin: 0 0 8px;
        }
        .cardValue {
          font-size: 24px;
          font-weight: 700;
          color: #ffd700;
          margin: 0;
        }
        .cardValue.teal { color: #00ced1; }
        .cardValue.coral { color: #ff6b6b; }
        .cardSub {
          font-size: 12px;
          color: #94a3b8;
          margin: 6px 0 0;
        }
        .muted { color: #94a3b8; font-size: 14px; margin: 0; }
        .goalRow {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          margin-bottom: 10px;
        }
        .progressTrack {
          height: 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          overflow: hidden;
        }
        .progressFill {
          height: 100%;
          background: linear-gradient(90deg, #00ced1, #ffd700);
          border-radius: 4px;
        }
      `}</style>
    </AdminLayout>
  );
}
