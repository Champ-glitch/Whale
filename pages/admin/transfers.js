// pages/admin/transfers.js
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { Plus, FileText, Radio, Copy, Check, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
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

const TABS = [
  { key: 'request', label: 'Request' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Live Payments' },
];

export default function AdminTransfers() {
  const router = useRouter();
  const [tab, setTab] = useState('request');

  useEffect(() => {
    const q = router.query.tab;
    if (q && TABS.some((t) => t.key === q)) setTab(q);
  }, [router.query.tab]);

  return (
    <TailwindShell title="Transfers">
      <p className="text-lg font-serif italic text-white">Transfers</p>
      <p className="text-sm text-slate-400 mb-5">Request money, create invoice links, and watch payments land.</p>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap ${
              tab === t.key
                ? 'bg-gradient-to-r from-blue-500 to-yellow-400 text-[#0B0F1A]'
                : 'bg-white/5 border border-white/10 text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'request' && <RequestTab />}
      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'payments' && <PaymentsTab />}
    </TailwindShell>
  );
}

function RequestTab() {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('income');
  const [clientNote, setClientNote] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  function poll(reference, attempts = 0) {
    fetch(`/api/admin/send-status?reference=${reference}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'success' || data.status === 'failed') {
          setStatus(data.status);
          return;
        }
        if (attempts >= 20) {
          setStatus('timeout');
          return;
        }
        pollRef.current = setTimeout(() => poll(reference, attempts + 1), 3000);
      });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setStatus(null);
    setError('');
    clearTimeout(pollRef.current);
    try {
      const res = await fetch('/api/admin/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, phoneNumber: phone, purpose, clientNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus('pending');
      poll(data.reference);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const statusText = {
    pending: '⏳ Prompt sent — waiting for M-Pesa confirmation...',
    success: '✅ Payment confirmed',
    failed: '❌ Payment failed or was cancelled',
    timeout: '⚠️ No confirmation yet — check Live Payments in a moment',
  };
  const statusColor = {
    pending: 'text-yellow-400',
    success: 'text-teal-400',
    failed: 'text-red-400',
    timeout: 'text-orange-400',
  };

  return (
    <GlassCard>
      <p className="text-sm text-slate-300 mb-4">
        Send an M-Pesa prompt — the customer enters their PIN and the money lands in your till.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Amount (KES)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
            placeholder="500"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Phone number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
            placeholder="0712345678"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Whose money is this?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPurpose('income')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${
                purpose === 'income' ? 'bg-yellow-400/15 border-yellow-400 text-yellow-400' : 'bg-black/30 border-white/10 text-slate-400'
              }`}
            >
              My Income
            </button>
            <button
              type="button"
              onClick={() => setPurpose('client')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${
                purpose === 'client' ? 'bg-purple-400/15 border-purple-400 text-purple-300' : 'bg-black/30 border-white/10 text-slate-400'
              }`}
            >
              Client Funds
            </button>
          </div>
        </div>
        {purpose === 'client' && (
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">What's this for?</label>
            <input
              type="text"
              value={clientNote}
              onChange={(e) => setClientNote(e.target.value)}
              className="w-full bg-black/30 border border-purple-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
              placeholder="e.g. Business account opening for Mary"
              required
            />
            <p className="text-xs text-purple-300/80 mt-2">
              This won't be split into your savings — it'll show up in Client Funds instead.
            </p>
          </div>
        )}
        <button
          type="submit"
          disabled={sending}
          className="w-full flex items-center justify-center gap-1.5 rounded-full py-3.5 text-sm font-bold bg-gradient-to-r from-blue-500 to-yellow-400 text-[#0B0F1A] disabled:opacity-60"
        >
          <Plus size={16} /> {sending ? 'Sending...' : 'Request Payment'}
        </button>

        {error && <p className="text-red-400 text-xs">{error}</p>}
        {status && <p className={`text-xs ${statusColor[status]}`}>{statusText[status]}</p>}
      </form>
    </GlassCard>
  );
}

function InvoicesTab() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('income');
  const [clientNote, setClientNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('all');

  function load() {
    fetch('/api/admin/invoices')
      .then((r) => r.json())
      .then((d) => {
        setInvoices(d.invoices || []);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setNewLink(null);
    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description, purpose, clientNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewLink(`https://whale-gamma-pied.vercel.app${data.url}`);
      setAmount('');
      setDescription('');
      setClientNote('');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function markFailed(code) {
    await fetch('/api/admin/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, status: 'failed' }),
    });
    load();
  }

  function copyLink() {
    navigator.clipboard.writeText(newLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const statusColor = { success: 'text-teal-400', pending: 'text-yellow-400', failed: 'text-red-400' };
  const filtered = invoices.filter((i) => filter === 'all' || i.status === filter);

  return (
    <div className="space-y-5">
      <GlassCard>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Amount (KES)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
              placeholder="500"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
              placeholder="What's this for?"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Whose money is this?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPurpose('income')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${
                  purpose === 'income' ? 'bg-yellow-400/15 border-yellow-400 text-yellow-400' : 'bg-black/30 border-white/10 text-slate-400'
                }`}
              >
                My Income
              </button>
              <button
                type="button"
                onClick={() => setPurpose('client')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${
                  purpose === 'client' ? 'bg-purple-400/15 border-purple-400 text-purple-300' : 'bg-black/30 border-white/10 text-slate-400'
                }`}
              >
                Client Funds
              </button>
            </div>
          </div>
          {purpose === 'client' && (
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">What's this for?</label>
              <input
                type="text"
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                className="w-full bg-black/30 border border-purple-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                placeholder="e.g. Business account opening for Mary"
                required
              />
              <p className="text-xs text-purple-300/80 mt-2">
                This won't be split into your savings — it'll show up in Client Funds instead.
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={creating}
            className="w-full flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-bold border-2 border-yellow-400 text-yellow-400 disabled:opacity-60"
          >
            <FileText size={16} /> {creating ? 'Creating...' : 'Create invoice link'}
          </button>

          {newLink && (
            <div className="flex items-center gap-2 bg-black/30 border border-teal-400/30 rounded-xl px-3 py-2.5">
              <span className="flex-1 text-xs text-teal-400 break-all">{newLink}</span>
              <button type="button" onClick={copyLink} className="text-slate-300">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </form>
      </GlassCard>

      <div className="flex gap-2 overflow-x-auto">
        {['all', 'pending', 'success', 'failed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              filter === f ? 'bg-yellow-400/15 border border-yellow-400 text-yellow-400' : 'bg-white/5 border border-white/10 text-slate-400'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-400 text-sm">No matching invoices.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => (
            <div key={inv.code} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-slate-100 truncate">{inv.code}</p>
                <p className="text-xs text-slate-500 truncate">{inv.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold text-yellow-400">{fmt(inv.amount)}</span>
                <span className={`text-xs capitalize ${statusColor[inv.status] || 'text-slate-400'}`}>{inv.status}</span>
                {inv.status === 'pending' && (
                  <button onClick={() => markFailed(inv.code)} className="text-xs text-red-400 border border-red-500/30 rounded-full px-2 py-1">
                    Fail
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    function load() {
      fetch('/api/admin/payments')
        .then((r) => r.json())
        .then((d) => {
          setPayments(d.payments || []);
          setLoading(false);
        });
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = payments.filter((p) => filter === 'all' || p.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-xs text-teal-400">
        <Radio size={12} className="animate-pulse" /> Live — updates every 15s
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {['all', 'success', 'failed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              filter === f ? 'bg-yellow-400/15 border border-yellow-400 text-yellow-400' : 'bg-white/5 border border-white/10 text-slate-400'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-400 text-sm">No {filter !== 'all' ? filter : ''} payments yet.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.code} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${p.status === 'success' ? 'bg-teal-400/15 text-teal-400' : 'bg-red-500/15 text-red-400'}`}>
                {p.status === 'success' ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-100 truncate">{p.description}</p>
                <p className="text-xs text-slate-500">{p.code} · {timeAgo(p.createdAt)}</p>
              </div>
              <span className={`text-sm font-bold ${p.status === 'success' ? 'text-teal-400' : 'text-red-400'}`}>{fmt(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
