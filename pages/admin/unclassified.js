// pages/admin/unclassified.js
import { useEffect, useState } from 'react';
import { HelpCircle, Wallet, Users } from 'lucide-react';
import TailwindShell from '../../components/TailwindShell';
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

export default function Unclassified() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRef, setActiveRef] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    fetch('/api/admin/unclassified')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setLoading(false);
      });
  }

  useEffect(load, []);

  async function markIncome(reference) {
    setBusy(true);
    try {
      await fetch('/api/admin/unclassified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, classification: 'income' }),
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function markClient(reference) {
    if (!note.trim()) {
      alert('Add a note describing what this is for');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/unclassified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, classification: 'client', note }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setActiveRef(null);
      setNote('');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <TailwindShell title="Needs Classification">
      <p className="text-lg font-serif italic text-white">Needs Classification</p>
      <p className="text-sm text-slate-400 mb-6">
        Payments from your general link — decide if each one is your income or client funds.
      </p>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
          <HelpCircle size={28} className="text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Nothing to review right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.reference} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-lg font-bold text-white">{fmt(item.amount)}</p>
                <span className="text-xs text-slate-500">{timeAgo(item.at)}</span>
              </div>
              <p className="text-xs text-slate-400 mb-1">{item.description}</p>
              <p className="text-xs text-slate-500 mb-3">From {item.phoneNumber}</p>

              {activeRef === item.reference ? (
                <div>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Business account opening for Mary"
                    className="w-full bg-black/30 border border-purple-400/30 rounded-xl px-3 py-2.5 text-sm text-slate-100 mb-2 focus:outline-none focus:border-purple-400"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => markClient(item.reference)}
                      disabled={busy}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-purple-400 text-[#0B0F1A] disabled:opacity-60"
                    >
                      Confirm — Client Funds
                    </button>
                    <button
                      onClick={() => { setActiveRef(null); setNote(''); }}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-white/10 text-slate-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => markIncome(item.reference)}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-yellow-400 to-teal-400 text-[#0B0F1A] disabled:opacity-60"
                  >
                    <Wallet size={13} /> My Income
                  </button>
                  <button
                    onClick={() => setActiveRef(item.reference)}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border border-purple-400/40 text-purple-300 disabled:opacity-60"
                  >
                    <Users size={13} /> Client Funds
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </TailwindShell>
  );
}
