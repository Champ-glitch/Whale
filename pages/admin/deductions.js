// pages/admin/deductions.js
import { useEffect, useState } from 'react';
import { MinusCircle } from 'lucide-react';
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

  return (
    <TailwindShell title="Deductions">
      <p className="text-lg font-serif italic text-white">Deductions</p>
      <p className="text-sm text-slate-400 mb-1">Log money that physically left your till.</p>
      <p className="text-sm text-red-400 font-semibold mb-5">Total deducted: {fmt(total)}</p>

      <GlassCard className="mb-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Amount (KES)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
              placeholder="200"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
              placeholder="What was this for?"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 rounded-full py-3.5 text-sm font-bold bg-gradient-to-r from-red-500 to-orange-400 text-[#0B0F1A] disabled:opacity-60"
          >
            <MinusCircle size={16} /> {saving ? 'Logging...' : 'Log deduction'}
          </button>
        </form>
      </GlassCard>

      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Recent deductions</p>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : deductions.length === 0 ? (
        <p className="text-slate-400 text-sm">No deductions logged yet.</p>
      ) : (
        <div className="space-y-2">
          {deductions.map((d, i) => (
            <div key={i} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
              <div>
                <p className="text-sm text-slate-100">{d.reason}</p>
                <p className="text-xs text-slate-500">{timeAgo(d.at)}</p>
              </div>
              <span className="text-sm font-bold text-red-400">−{fmt(d.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </TailwindShell>
  );
}
