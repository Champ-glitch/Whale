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

function Sparkline({ trend }) {
  const values = trend.map((t) => t.total).filter((v) => v !== null);
  if (values.length < 2) {
    return <div className="sparkEmpty">Not enough history yet</div>;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 280;
  const height = 48;
  const step = width / (trend.length - 1);

  const points = trend.map((t, i) => {
    const v = t.total === null ? min : t.total;
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkSvg">
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
  const [notifPermission, setNotifPermission] = useState('default');
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (sessionStorage.getItem(ARMED_KEY) === '1') {
      setArmed(true);
    }
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    }
  }, []);

  function unlockAudioAndArm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      // Silent primer tone to satisfy the browser's user-gesture requirement
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    } catch {}

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then(setNotifPermission);
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

    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      document.hidden
    ) {
      try {
        new Notification('WHALE_SYS', { body: message, icon: '/icons/icon-192.png' });
      } catch {}
    }
  }

  function load() {
    Promise.all([
      fetch('/api/admin/summary').then((r) => r.json()),
      fetch('/api/admin/health').then((r) => r.json()),
    ]).then(([s, h]) => {
      const storedCount = sessionStorage.getItem(LAST_COUNT_KEY);
      const lastCount = storedCount !== null ? Number(storedCount) : null;

      if (armed && lastCount !== null && s.stats.count > lastCount) {
        const diff = s.stats.count - lastCount;
        notify(`New payment received — ${diff} confirmed`);
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

  return (
    <AdminLayout title="Dashboard" pulse={pulse}>
      {toast && <div className="toast">🔔 {toast}</div>}

      {!armed ? (
        <button className="armBar" onClick={unlockAudioAndArm}>
          🔕 Tap to enable payment alerts (sound + notification)
        </button>
      ) : (
        <div className="armedBar">
          <span className="armedDot" />
          Listening for payments
          {notifPermission === 'denied' && (
            <span className="armedWarn"> · notifications blocked in browser settings</span>
          )}
        </div>
      )}

      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <>
          <div className="heroCard">
            <p className="heroLabel">Total Collected</p>
            <p className="heroValue">{fmt(summary.netWorth)}</p>
            <Sparkline trend={summary.trend} />
            <p className="heroCaption">Last 7 days</p>
          </div>

          <div className="tileRow">
            <div className="tile">
              <p className="tileLabel">Main</p>
              <p className="tileValue">{fmt(summary.main)}</p>
            </div>
            <div className="tile">
              <p className="tileLabel">Savings</p>
              <p className="tileValue teal">{fmt(summary.savings)}</p>
            </div>
            <div className="tile">
              <p className="tileLabel">Pending Split</p>
              <p className="tileValue coral">{fmt(summary.pendingSplit)}</p>
            </div>
          </div>

          <div className="quickActions">
            <a href="/admin/send" className="actionBtn primary">➤ Send Payment</a>
            <a href="/admin/invoices" className="actionBtn">▤ Create Invoice</a>
            <a href="/admin/savings" className="actionBtn">
              ◑ Approve Split{summary.pendingSplit > 0 ? ` (${fmt(summary.pendingSplit)})` : ''}
            </a>
          </div>

          {summary.savingsGoal && (
            <div className="section">
              <div className="goalCard">
                <div className="goalRow">
                  <span className="goalLabel">Savings goal</span>
                  <span className="teal">{summary.goalProgress}%</span>
                </div>
                <div className="progressTrack">
                  <div className="progressFill" style={{ width: `${summary.goalProgress}%` }} />
                </div>
                <p className="goalSub">{fmt(summary.savings)} of {fmt(summary.savingsGoal)}</p>
              </div>
            </div>
          )}

          <div className="section">
            <h2 className="sectionTitle">This week</h2>
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
          </div>

          <p className="statusLine">
            {summary.autoApprove ? 'Auto-approve is ON' : 'Auto-approve is OFF — savings clears via Approve Split'}
          </p>
        </>
      )}

      <style jsx>{`
        .loading { color: #94a3b8; }

        .armBar {
          width: 100%;
          background: rgba(255, 215, 0, 0.08);
          border: 1px solid rgba(255, 215, 0, 0.3);
          color: #ffd700;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          margin-bottom: 16px;
          text-align: center;
        }
        .armedBar {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 16px;
        }
        .armedDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #00ced1;
          animation: pulseDot 2s infinite;
          flex-shrink: 0;
        }
        .armedWarn { color: #ff6b6b; }
        @keyframes pulseDot {
          0% { box-shadow: 0 0 0 0 rgba(0, 206, 209, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(0, 206, 209, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 206, 209, 0); }
        }

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

        .heroCard {
          background: linear-gradient(135deg, #0a1628 0%, #0d1d33 100%);
          border: 1px solid rgba(255, 215, 0, 0.15);
          border-radius: 16px;
          padding: 28px 24px;
          margin-bottom: 16px;
        }
        .heroLabel {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #94a3b8;
          margin: 0 0 6px;
        }
        .heroValue {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-size: 40px;
          font-weight: 700;
          color: #ffd700;
          margin: 0 0 16px;
        }
        .sparkSvg { display: block; width: 100%; height: 48px; }
        .sparkEmpty { color: #94a3b8; font-size: 12px; height: 48px; display: flex; align-items: center; }
        .heroCaption { font-size: 11px; color: #94a3b8; margin: 8px 0 0; }

        .tileRow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        .tile {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 14px;
        }
        .tileLabel { font-size: 11px; color: #94a3b8; margin: 0 0 4px; }
        .tileValue { font-size: 17px; font-weight: 700; color: #ffd700; margin: 0; }
        .tileValue.teal { color: #00ced1; }
        .tileValue.coral { color: #ff6b6b; }

        .quickActions {
          display: flex;
          gap: 10px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .actionBtn {
          flex: 1;
          min-width: 140px;
          text-align: center;
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
          padding: 13px 10px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
        }
        .actionBtn.primary {
          background: #ffd700;
          color: #0a1628;
          border-color: #ffd700;
        }

        .section { margin-bottom: 24px; }
        .sectionTitle {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #94a3b8;
          margin: 0 0 12px;
        }

        .goalCard {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 18px 20px;
        }
        .goalRow { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 10px; }
        .goalLabel { color: #94a3b8; }
        .teal { color: #00ced1; }
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
        .goalSub { font-size: 12px; color: #94a3b8; margin: 10px 0 0; }

        .cardGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .card {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 16px;
        }
        .cardLabel { font-size: 11px; color: #94a3b8; margin: 0 0 6px; }
        .cardValue { font-size: 19px; font-weight: 700; color: #ffd700; margin: 0; }
        .cardSub { font-size: 11px; color: #94a3b8; margin: 4px 0 0; }

        .statusLine { font-size: 12px; color: #94a3b8; text-align: center; margin: 8px 0 0; }
      `}</style>
    </AdminLayout>
  );
}
