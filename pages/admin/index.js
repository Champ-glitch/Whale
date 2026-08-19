// pages/admin/index.js
import { useEffect, useState, useRef } from 'react';
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

function Sparkline({ trend }) {
  const values = trend.map((t) => t.total).filter((v) => v !== null);
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 100;
  const height = 28;
  const step = width / (trend.length - 1);
  const points = trend.map((t, i) => {
    const v = t.total === null ? min : t.total;
    return `${i * step},${height - ((v - min) / range) * height}`;
  });
  return (
    <svg width="100%" height="28" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="spark">
      <polyline points={points.join(' ')} fill="none" stroke="#ffd700" strokeWidth="2" />
    </svg>
  );
}

const LAST_COUNT_KEY = 'whale_admin_last_count';
const ARMED_KEY = 'whale_admin_alerts_armed';

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState({ kv: true, telegram: true, makamesco: true });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [armed, setArmed] = useState(false);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (sessionStorage.getItem(ARMED_KEY) === '1') setArmed(true);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      // permission requested on arm tap, not here
    }
  }, []);

  function unlockAudioAndArm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    } catch {}
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    sessionStorage.setItem(ARMED_KEY, '1');
    setArmed(true);
  }

  function playChime() {
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1175, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  function notify(message) {
    playChime();
    setToast(message);
    setTimeout(() => setToast(null), 5000);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      try { new Notification('WHALE_SYS', { body: message, icon: '/icons/icon-192.png' }); } catch {}
    }
  }

  function load() {
    Promise.all([
      fetch('/api/admin/summary').then((r) => r.json()),
      fetch('/api/admin/health').then((r) => r.json()),
    ]).then(([s, h]) => {
      const stored = sessionStorage.getItem(LAST_COUNT_KEY);
      const lastCount = stored !== null ? Number(stored) : null;
      if (armed && lastCount !== null && s.stats.count > lastCount) {
        notify(`New payment received — ${s.stats.count - lastCount} confirmed`);
      }
      sessionStorage.setItem(LAST_COUNT_KEY, String(s.stats.count));
      setSummary(s);
      setHealth(h);
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [armed]);

  const pulse = [
    { name: 'KV', ok: health.kv },
    { name: 'Telegram', ok: health.telegram },
    { name: 'Makamesco', ok: health.makamesco },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <AdminLayout title="Dashboard" pulse={pulse}>
      {toast && <div className="toast">🔔 {toast}</div>}

      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <>
          <div className="header">
            <div>
              <p className="greeting">{greeting}, Whale</p>
              <p className="greetSub">Here's your financial overview</p>
            </div>
            {!armed ? (
              <button className="bellBtn" onClick={unlockAudioAndArm} title="Enable payment alerts">🔕</button>
            ) : (
              <button className="bellBtn armed" title="Listening for payments">🔔</button>
            )}
          </div>

          <div className="statGrid">
            <div className="glassCard hero">
              <div className="cardIcon gold">↗</div>
              <p className="statLabel">Total Collected</p>
              <p className="statValue gold">{fmt(summary.netWorth)}</p>
              <Sparkline trend={summary.trend} />
            </div>
            <div className="glassCard">
              <div className="cardIcon blue">💰</div>
              <p className="statLabel">Main Balance</p>
              <p className="statValue">{fmt(summary.main)}</p>
              <p className="statHint">Available now</p>
            </div>
            <div className="glassCard">
              <div className="cardIcon teal">🐷</div>
              <p className="statLabel">Savings</p>
              <p className="statValue teal">{fmt(summary.savings)}</p>
              <p className="statHint">{summary.goalProgress !== null ? `${summary.goalProgress}% of goal` : 'No goal set'}</p>
            </div>
            <div className="glassCard">
              <div className="cardIcon coral">⇄</div>
              <p className="statLabel">Pending Split</p>
              <p className="statValue coral">{fmt(summary.pendingSplit)}</p>
              <p className="statHint">{summary.pendingSplit > 0 ? 'Awaiting approval' : 'Nothing pending'}</p>
            </div>
          </div>

          <div className="actionRow">
            <a href="/admin/send" className="actionBtn primary">＋ Request Payment</a>
            <a href="/admin/invoices" className="actionBtn outline">▤ Create Invoice</a>
          </div>

          {summary.pendingSplit > 0 && (
            <a href="/admin/savings" className="approveStrip">
              ◑ Approve Split — {fmt(summary.pendingSplit)}
            </a>
          )}

          <div className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">Recent Activity</h2>
              <a href="/admin/payments" className="seeAll">See all →</a>
            </div>

            {summary.recentActivity.length === 0 ? (
              <p className="muted">No activity yet.</p>
            ) : (
              <div className="activityList">
                {summary.recentActivity.map((a, i) => (
                  <div key={i} className="activityRow">
                    <div className={`activityIcon ${a.type}`}>{a.type === 'in' ? '↓' : '↑'}</div>
                    <div className="activityMain">
                      <p className="activityLabel">{a.label || (a.type === 'in' ? 'Payment received' : 'Deduction')}</p>
                      <p className="activityTime">{timeAgo(a.at)}</p>
                    </div>
                    <span className={`activityAmount ${a.type}`}>
                      {a.type === 'in' ? '+' : '−'}{fmt(a.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="statusLine">
            {summary.autoApprove ? 'Auto-approve is ON' : 'Auto-approve is OFF — savings clears via Approve Split'}
          </p>
        </>
      )}

      <style jsx>{`
        .loading { color: #94a3b8; }

        .toast {
          position: fixed;
          top: 70px;
          right: 16px;
          left: 16px;
          max-width: 320px;
          margin-left: auto;
          background: #0a1628;
          border: 1px solid #00ced1;
          color: #e2e8f0;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 13px;
          z-index: 50;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .greeting {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }
        .greetSub { font-size: 13px; color: #94a3b8; margin: 4px 0 0; }
        .bellBtn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 16px;
          cursor: pointer;
        }
        .bellBtn.armed { border-color: #00ced1; background: rgba(0,206,209,0.1); }

        .statGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }
        .glassCard {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          padding: 18px;
          position: relative;
          overflow: hidden;
        }
        .glassCard.hero {
          grid-column: 1 / -1;
          background: linear-gradient(135deg, rgba(255,215,0,0.08), rgba(0,206,209,0.05));
          border-color: rgba(255,215,0,0.2);
        }
        .cardIcon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          margin-bottom: 10px;
        }
        .cardIcon.gold { background: linear-gradient(135deg, #ffd700, #b8860b); color: #0a1628; }
        .cardIcon.blue { background: linear-gradient(135deg, #3b82f6, #1e40af); }
        .cardIcon.teal { background: linear-gradient(135deg, #00ced1, #087f8c); }
        .cardIcon.coral { background: linear-gradient(135deg, #ff6b6b, #b91c1c); }
        .statLabel { font-size: 12px; color: #94a3b8; margin: 0 0 6px; }
        .statValue { font-size: 20px; font-weight: 800; color: #fff; margin: 0; }
        .statValue.gold { color: #ffd700; font-size: 26px; }
        .statValue.teal { color: #00ced1; }
        .statValue.coral { color: #ff6b6b; }
        .statHint { font-size: 11px; color: #94a3b8; margin: 6px 0 0; }
        .spark { margin-top: 10px; display: block; }

        .actionRow {
          display: flex;
          gap: 10px;
          margin-bottom: 14px;
        }
        .actionBtn {
          flex: 1;
          text-align: center;
          padding: 14px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }
        .actionBtn.primary {
          background: linear-gradient(135deg, #ffd700, #f0b400);
          color: #0a1628;
        }
        .actionBtn.outline {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,215,0,0.4);
          color: #ffd700;
        }

        .approveStrip {
          display: block;
          text-align: center;
          background: rgba(255,107,107,0.08);
          border: 1px solid rgba(255,107,107,0.3);
          color: #ff6b6b;
          padding: 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          margin-bottom: 24px;
        }

        .section { margin-bottom: 20px; }
        .sectionHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .sectionTitle { font-size: 16px; font-weight: 700; color: #fff; margin: 0; }
        .seeAll { font-size: 12px; color: #ffd700; text-decoration: none; }
        .muted { color: #94a3b8; font-size: 13px; }

        .activityList { display: flex; flex-direction: column; gap: 8px; }
        .activityRow {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 12px 14px;
        }
        .activityIcon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }
        .activityIcon.in { background: rgba(0,206,209,0.15); color: #00ced1; }
        .activityIcon.out { background: rgba(255,107,107,0.15); color: #ff6b6b; }
        .activityMain { flex: 1; min-width: 0; }
        .activityLabel { font-size: 13px; color: #e2e8f0; margin: 0; }
        .activityTime { font-size: 11px; color: #94a3b8; margin: 2px 0 0; }
        .activityAmount { font-size: 13px; font-weight: 700; }
        .activityAmount.in { color: #00ced1; }
        .activityAmount.out { color: #ff6b6b; }

        .statusLine { font-size: 12px; color: #94a3b8; text-align: center; margin: 8px 0 0; }
      `}</style>
    </AdminLayout>
  );
}
