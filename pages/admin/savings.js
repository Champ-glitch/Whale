// pages/admin/savings.js
import { useEffect, useState } from 'react';
import { PiggyBank, CircleDot } from 'lucide-react';
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

export default function AdminSavings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [approving, setApproving] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

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

  return (
    <TailwindShell title="Savings Split">
      <p className="text-lg font-serif italic text-white">Savings Split</p>
      <p className="text-sm text-slate-400 mb-5">
        The 40% share accumulates here until you physically move it and approve.
      </p>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : loadError ? (
        <p className="text-red-400 text-sm">{loadError}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <GlassCard
              icon={<PiggyBank size={18} className="text-teal-400" />}
              iconBg="bg-gradient-to-br from-teal-400/20 to-teal-600/10"
              label="Savings Balance"
              value={fmt(data.savings)}
            />
            <GlassCard
              icon={<CircleDot size={18} className="text-orange-400" />}
              iconBg="bg-gradient-to-br from-orange-400/20 to-red-500/10"
              label="Pending"
              value={fmt(data.pending)}
              sub="Not yet moved"
              subClass="text-orange-400"
            />
          </div>

          <GlassCard className="mb-4">
            <p className="text-sm font-semibold text-white mb-3">Savings Goal</p>
            <p className="text-xs text-slate-400 mb-3">
              {data.savingsGoal ? `Current goal: ${fmt(data.savingsGoal)}` : 'No goal set yet.'}
            </p>
            <form onSubmit={handleSetGoal} className="flex gap-2">
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                placeholder="e.g. 5000"
                required
              />
              <button
                type="submit"
                disabled={savingGoal}
                className="bg-teal-400 text-[#0B0F1A] font-bold text-xs px-4 rounded-xl disabled:opacity-60"
              >
                {savingGoal ? '...' : data.savingsGoal ? 'Update' : 'Set'}
              </button>
            </form>
          </GlassCard>

          <GlassCard className="mb-6">
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <p className="text-sm font-semibold text-white mb-1">Auto-approve</p>
                <p className="text-xs text-slate-400">
                  {data.autoApprove
                    ? 'ON — deposits mark as moved instantly.'
                    : 'OFF — approve manually after sending money.'}
                </p>
              </div>
              <button
                onClick={toggleAutoApprove}
                className={`w-11 h-6 rounded-full relative flex-shrink-0 ${data.autoApprove ? 'bg-teal-400' : 'bg-white/15'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${data.autoApprove ? 'left-5' : 'left-0.5'}`}
                />
              </button>
            </div>
          </GlassCard>

          <button
            onClick={handleApprove}
            disabled={approving || data.pending <= 0}
            className="w-full rounded-full py-3.5 text-sm font-bold bg-gradient-to-r from-blue-500 to-yellow-400 text-[#0B0F1A] disabled:opacity-40 mb-6"
          >
            {approving ? 'Processing...' : data.pending > 0 ? `Approve & clear ${fmt(data.pending)}` : 'Nothing pending to approve'}
          </button>

          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Pending split log</p>
          {data.log.length === 0 ? (
            <p className="text-slate-400 text-sm">Nothing pending right now.</p>
          ) : (
            <div className="space-y-2">
              {data.log.map((l, i) => (
                <div key={i} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
                  <span className="text-sm text-slate-100">{l.accountReference || l.reference || 'Deposit'}</span>
                  <span className="text-sm font-bold text-teal-400">{fmt(l.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </TailwindShell>
  );
}
