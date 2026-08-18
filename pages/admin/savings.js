// pages/admin/savings.js
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

export default function AdminSavings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const [loadError, setLoadError] = useState('');

  function load() {
    fetch('/api/admin/savings')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
        setLoadError('');
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to load');
        setLoading(false);
      });
  }

  useEffect(load, []);

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await fetch('/api/admin/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      alert(`Moved ${fmt(result.moved)} to savings. Confirm you've physically sent it from your till.`);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setApproving(false);
    }
  }

  async function handleSetGoal(e) {
    e.preventDefault();
    setSavingGoal(true);
    try {
      const res = await fetch('/api/admin/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setgoal', amount: goalInput }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setGoalInput('');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingGoal(false);
    }
  }

  async function toggleAutoApprove() {
    const newVal = !data.autoApprove;
    await fetch('/api/admin/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'autoapprove', enabled: newVal }),
    });
    load();
  }

  const pulse = [{ name: 'KV', ok: true }, { name: 'Telegram', ok: true }, { name: 'Makamesco', ok: true }];

  return (
    <AdminLayout title="Savings Split" pulse={pulse}>
      <h1 className="pageTitle">Savings Split</h1>
      <p className="pageSub">The 40% share accumulates here until you physically move it and approve.</p>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : loadError ? (
        <p className="loading" style={{ color: '#ff6b6b' }}>{loadError}</p>
      ) : (
        <>
          <div className="cardGrid">
            <div className="card">
              <p className="cardLabel">Savings Balance</p>
              <p className="cardValue teal">{fmt(data.savings)}</p>
            </div>
            <div className="card">
              <p className="cardLabel">Pending (not yet moved)</p>
              <p className="cardValue coral">{fmt(data.pending)}</p>
            </div>
          </div>

          <div className="actionCard">
            <p className="actionTitle" style={{ marginBottom: 10 }}>Savings Goal</p>
            {data.savingsGoal ? (
              <p className="actionSub" style={{ marginBottom: 12 }}>
                Current goal: {fmt(data.savingsGoal)}
              </p>
            ) : (
              <p className="actionSub" style={{ marginBottom: 12 }}>No goal set yet.</p>
            )}
            <form onSubmit={handleSetGoal} className="goalForm">
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="goalInput"
                placeholder="e.g. 5000"
                required
              />
              <button type="submit" disabled={savingGoal} className="goalBtn">
                {savingGoal ? 'Saving...' : data.savingsGoal ? 'Update' : 'Set goal'}
              </button>
            </form>
          </div>

          <div className="actionCard">
            <div className="actionRow">
              <div>
                <p className="actionTitle">Auto-approve</p>
                <p className="actionSub">
                  {data.autoApprove
                    ? 'ON — deposits mark as moved instantly. Turn off unless money is really landing in a personal account.'
                    : 'OFF — approve manually after physically sending money from your till.'}
                </p>
              </div>
              <button className={`toggle ${data.autoApprove ? 'on' : ''}`} onClick={toggleAutoApprove}>
                <span className="toggleKnob" />
              </button>
            </div>
          </div>

          <button
            className="approveBtn"
            onClick={handleApprove}
            disabled={approving || data.pending <= 0}
          >
            {approving
              ? 'Processing...'
              : data.pending > 0
              ? `Approve & clear ${fmt(data.pending)}`
              : 'Nothing pending to approve'}
          </button>

          <h2 className="sectionTitle">Pending split log</h2>
          {data.log.length === 0 ? (
            <p className="muted">Nothing pending right now.</p>
          ) : (
            <div className="table">
              {data.log.map((l, i) => (
                <div key={i} className="tableRow">
                  <span className="desc">{l.accountReference || l.reference || 'Deposit'}</span>
                  <span className="amount">{fmt(l.amount)}</span>
                </div>
              ))}
            </div>
          )}
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
        .pageSub { color: #94a3b8; font-size: 14px; margin: 0 0 24px; }
        .loading, .muted { color: #94a3b8; font-size: 14px; }
        .cardGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .card {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
        }
        .cardLabel { font-size: 12px; color: #94a3b8; margin: 0 0 8px; }
        .cardValue { font-size: 24px; font-weight: 700; margin: 0; }
        .cardValue.teal { color: #00ced1; }
        .cardValue.coral { color: #ff6b6b; }
        .actionCard {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 18px 20px;
          margin-bottom: 16px;
        }
        .actionRow { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .actionTitle { font-size: 14px; font-weight: 600; margin: 0 0 4px; color: #e2e8f0; }
        .actionSub { font-size: 12px; color: #94a3b8; margin: 0; }
        .toggle {
          width: 44px;
          height: 24px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.12);
          border: none;
          position: relative;
          cursor: pointer;
          flex-shrink: 0;
        }
        .toggle.on { background: #00ced1; }
        .toggleKnob {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          transition: left 0.15s;
        }
        .toggle.on .toggleKnob { left: 23px; }
        .goalForm { display: flex; gap: 8px; }
        .goalInput {
          flex: 1;
          background: #060b14;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 10px 12px;
          color: #e2e8f0;
          font-size: 14px;
          font-family: inherit;
        }
        .goalInput:focus { outline: none; border-color: #00ced1; }
        .goalBtn {
          background: #00ced1;
          color: #0a1628;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .goalBtn:disabled { opacity: 0.6; }
        .approveBtn {
          width: 100%;
          background: #ffd700;
          color: #0a1628;
          border: none;
          border-radius: 8px;
          padding: 13px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          margin-bottom: 28px;
        }
        .approveBtn:disabled { opacity: 0.6; }
        .sectionTitle {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #94a3b8;
          margin: 0 0 12px;
        }
        .table { display: flex; flex-direction: column; gap: 6px; }
        .tableRow {
          display: flex;
          justify-content: space-between;
          background: #0a1628;
          padding: 12px 16px;
          border-radius: 8px;
        }
        .desc { font-size: 13px; color: #e2e8f0; }
        .amount { font-weight: 700; color: #00ced1; font-size: 13px; }
      `}</style>
    </AdminLayout>
  );
}
