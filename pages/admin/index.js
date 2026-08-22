// pages/admin/index.js
import { useEffect, useState, useRef } from 'react';
import {
  TrendingUp,
  Wallet,
  MinusCircle,
  Users,
  Plus,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';
import TailwindShell, { GlassCard } from '../../components/TailwindShell';
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

  return (
    <TailwindShell title="Dashboard" pulse={pulse}>
      {toast && <div className="toast">🔔 {toast}</div>}

      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <>
          <div className="relative mb-6">
            <div className="pointer-events-none absolute -inset-4 bg-gradient-to-br from-yellow-400/10 via-transparent to-teal-400/10 blur-2xl rounded-3xl" />
            <div className="relative bg-white/5 backdrop-blur-xl border border-yellow-400/20 rounded-2xl px-4 py-4">
              <p className="text-xs text-slate-400 mb-1">Total Ever Received — This Till</p>
              <p className="text-3xl font-bold text-white">{fmt(summary.totalProcessed)}</p>
              <div className="h-px bg-white/10 my-3" />
              <div className="text-xs text-slate-400">
                Today: <span className="text-teal-400 font-semibold">{fmt(summary.today?.total)}</span>
                {' '}·{' '}
                Transactions: <span className="text-yellow-400 font-semibold">{summary.today?.count ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <GlassCard
              icon={<Wallet size={17} className="text-yellow-400" />}
              iconBg="bg-gradient-to-br from-yellow-400/20 to-yellow-600/10"
              label="Available Now"
              value={fmt(summary.main)}
              sub="Spendable"
              subClass="text-yellow-400"
            />
            <GlassCard
              icon={<MinusCircle size={17} className="text-red-400" />}
              iconBg="bg-gradient-to-br from-red-400/20 to-red-600/10"
              label="Spent So Far"
              value={fmt(summary.totalDeducted)}
              sub="Deductions"
              subClass="text-red-400"
            />
            <GlassCard
              icon={<Users size={17} className="text-purple-300" />}
              iconBg="bg-gradient-to-br from-purple-400/20 to-purple-600/10"
              label="Client Funds"
              value={fmt(summary.clientFundsHeld)}
              sub="Held for others"
              subClass="text-purple-300"
            />
          </div>

          <div className="flex gap-3 mb-8">
            <a
              href="/admin/send"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-3.5 text-sm font-bold bg-gradient-to-r from-yellow-400 to-teal-400 text-[#0B0F1A]"
            >
              <Plus size={16} /> Request Payment
            </a>
            <a
              href="/admin/invoices"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-3.5 text-sm font-bold border-2 border-yellow-400 text-yellow-400"
            >
              <FileText size={16} /> Create Invoice
            </a>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base">Recent Transactions</h2>
            <a href="/admin/payments" className="text-yellow-400 text-xs font-medium flex items-center gap-1">
              See all <span>→</span>
            </a>
          </div>

          {summary.recentActivity.length === 0 ? (
            <p className="text-slate-400 text-sm mb-6">No activity yet.</p>
          ) : (
            <div className="flex flex-col gap-2 mb-6">
              {summary.recentActivity.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      a.type === 'in' ? 'bg-teal-400/15 text-teal-400' : 'bg-red-500/15 text-red-400'
                    }`}
                  >
                    {a.type === 'in' ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-100 truncate">
                      {a.label || (a.type === 'in' ? 'Payment received' : 'Deduction')}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${a.type === 'in' ? 'text-teal-400' : 'text-red-400'}`}>
                    {a.type === 'in' ? '+' : '−'}{fmt(a.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <GlassCard
              icon={<TrendingUp size={17} className="text-teal-400" />}
              iconBg="bg-gradient-to-br from-teal-400/20 to-teal-600/10"
              label="All-Time Payments"
              value={String(summary.stats.count)}
              sub={`${summary.stats.streak} day streak`}
              subClass="text-slate-400"
            />
            <GlassCard
              label="Biggest Payment"
              value={fmt(summary.biggestIn)}
              sub="Single largest"
              subClass="text-slate-400"
            />
          </div>
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
      `}</style>
    </TailwindShell>
  );
}
