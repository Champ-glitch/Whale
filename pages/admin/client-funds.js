// pages/admin/client-funds.js
import { useEffect, useState } from 'react';
import { Users, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
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

export default function ClientFunds() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    fetch('/api/admin/client-funds')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }

  useEffect(load, []);

  async function handleDisburse(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/client-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setAmount('');
      setNote('');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <TailwindShell title="Client Funds">
      <p className="text-lg font-serif italic text-white">Client Funds</p>
      <p className="text-sm text-slate-400 mb-6">
        Money you're holding on a client's behalf — this is never split into your savings.
      </p>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : (
        <>
          <GlassCard
            icon={<Users size={18} className="text-purple-300" />}
            iconBg="bg-gradient-to-br from-purple-400/20 to-purple-600/10"
            label="Currently Held"
            value={fmt(data.held)}
            sub="Not yet disbursed"
            subClass="text-purple-300"
            className="mb-6"
          />

          <form onSubmit={handleDisburse} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-6">
            <p className="text-sm font-semibold text-white mb-3">Log a disbursement</p>
            <label className="block text-xs text-slate-400 mb-1.5">Amount paid out (KES)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 3000"
              required
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 mb-4 focus:outline-none focus:border-teal-400"
            />
            <label className="block text-xs text-slate-400 mb-1.5">What was this for?</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid KRA filing for John's business"
              required
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 mb-4 focus:outline-none focus:border-teal-400"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-full text-sm font-bold bg-gradient-to-r from-purple-400 to-blue-500 text-[#0B0F1A] disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Log disbursement'}
            </button>
          </form>

          <h2 className="text-white font-bold text-base mb-3">History</h2>
          {data.log.length === 0 ? (
            <p className="text-slate-400 text-sm">No client fund activity yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.log.map((l, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    l.type === 'received' ? 'bg-teal-400/15 text-teal-400' : 'bg-purple-400/15 text-purple-300'
                  }`}>
                    {l.type === 'received' ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-100 truncate">{l.note}</p>
                    <p className="text-xs text-slate-500">{timeAgo(l.at)}</p>
                  </div>
                  <span className={`text-sm font-bold ${l.type === 'received' ? 'text-teal-400' : 'text-purple-300'}`}>
                    {l.type === 'received' ? '+' : '−'}{fmt(l.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </TailwindShell>
  );
}
