// pages/admin/index.js
import { useEffect, useState, useRef } from 'react';
import {
  TrendingUp,
  Wallet,
  PiggyBank,
  ArrowLeftRight,
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

const LAST_COUNT_KEY = 'whale_admin_last_count';
const ARMED_KEY = 'whale_admin_alerts_armed';

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
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
    fetch('/api/admin/summary')
      .then((r) => r.json())
      .then((s) => {
        const stored = sessionStorage.getItem(LAST_COUNT_KEY);
        const lastCount = stored !== null ? Number(stored) : null;
        if (armed && lastCount !== null && s.stats.count > lastCount) {
          notify(`New payment received — ${s.stats.count - lastCount} confirmed`);
        }
        sessionStorage.setItem(LAST_COUNT_KEY, String(s.stats.count));
        setSummary(s);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [armed]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <TailwindShell title="Dashboard" armed={armed} onToggleArm={unlockAudioAndArm} toast={toast}>
      <p className="text-lg font-serif italic text-white">{greeting}, Whale</p>
      <p className="text-sm text-slate-400 mb-6">Here's your financial overview</p>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : (
        <>
          <div className="relative mb-6">
            <div className="pointer-events-none absolute -inset-4 bg-gradient-to-br from-blue-500/10 via-transparent to-yellow-400/10 blur-2xl rounded-3xl" />
            <div className="relative grid grid-cols-2 gap-3">
              <GlassCard
                icon={<TrendingUp size={18} className="text-yellow-400" />}
                iconBg="bg-gradient-to-br from-yellow-400/20 to-yellow-600/10"
                label="Total Collected"
                value={fmt(summary.netWorth)}
                sub="This week"
                subClass="text-yellow-400"
              />
              <GlassCard
                icon={<Wallet size={18} className="text-blue-400" />}
                iconBg="bg-gradient-to-br from-blue-400/20 to-blue-600/10"
                label="Main Balance"
                value={fmt(summary.main)}
                sub="Available now"
                subClass="text-blue-400"
              />
              <GlassCard
                icon={<PiggyBank size={18} className="text-teal-400" />}
                iconBg="bg-gradient-to-br from-teal-400/20 to-teal-600/10"
                label="Savings"
                value={fmt(summary.savings)}
                sub={summary.goalProgress !== null ? `${summary.goalProgress}% of goal` : 'No goal set'}
                subClass="text-yellow-400"
              />
              <GlassCard
                icon={<ArrowLeftRight size={18} className="text-orange-400" />}
                iconBg="bg-gradient-to-br from-orange-400/20 to-red-500/10"
                label="Pending Split"
                value={fmt(summary.pendingSplit)}
                sub={summary.pendingSplit > 0 ? 'Awaiting approval' : 'Nothing pending'}
                subClass="text-orange-400"
              />
            </div>
          </div>

          <div className="flex gap-3 mb-8">
            <a
              href="/admin/transfers"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-3.5 text-sm font-bold bg-gradient-to-r from-blue-500 to-yellow-400 text-[#0B0F1A]"
            >
              <Plus size={16} /> Request Payment
            </a>
            <a
              href="/admin/transfers?tab=invoices"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-3.5 text-sm font-bold border-2 border-yellow-400 text-yellow-400"
            >
              <FileText size={16} /> Create Invoice
            </a>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base">Recent Transactions</h2>
            <a href="/admin/transfers?tab=payments" className="text-yellow-400 text-xs font-medium flex items-center gap-1">
              See all <span>→</span>
            </a>
          </div>

          {summary.recentActivity.length === 0 ? (
            <p className="text-slate-400 text-sm">No activity yet.</p>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
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
                    <p className="text-xs text-slate-500">{timeAgo(a.at)}</p>
                  </div>
                  <span className={`text-sm font-bold ${a.type === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                    {a.type === 'in' ? '+' : '−'}{fmt(a.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500 text-center mt-4">
            {summary.autoApprove ? 'Auto-approve is ON' : 'Auto-approve is OFF — savings clears via Approve Split'}
          </p>
        </>
      )}
    </TailwindShell>
  );
}
