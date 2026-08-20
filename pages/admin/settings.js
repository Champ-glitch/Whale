// pages/admin/settings.js
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import TailwindShell, { GlassCard } from '../../components/TailwindShell';
import { isAuthenticated } from '../../lib/adminAuth';

export async function getServerSideProps({ req }) {
  if (!isAuthenticated(req)) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
  return { props: {} };
}

export default function AdminSettings() {
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleReset() {
    setResetting(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ ok: true, message: `Reset complete — ${data.deletedCount} records cleared.` });
      setConfirmText('');
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setResetting(false);
    }
  }

  return (
    <TailwindShell title="Settings">
      <p className="text-lg font-serif italic text-white">Settings</p>
      <p className="text-sm text-slate-400 mb-6">System-level actions.</p>

      <GlassCard className="border-red-500/30">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-red-400" />
          <p className="text-sm font-bold text-red-400">Full Reset</p>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Wipes all invoices, deductions, savings, stats, and pending states. This cannot be undone.
          Type <span className="text-slate-200 font-semibold">RESET</span> below to confirm.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type RESET"
          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 mb-3 focus:outline-none focus:border-red-400"
        />
        <button
          onClick={handleReset}
          disabled={confirmText !== 'RESET' || resetting}
          className="w-full py-3 rounded-full text-sm font-bold bg-red-500/80 text-[#0B0F1A] disabled:opacity-40"
        >
          {resetting ? 'Resetting...' : 'Reset everything'}
        </button>
        {result && (
          <p className={`text-xs mt-3 ${result.ok ? 'text-teal-400' : 'text-red-400'}`}>{result.message}</p>
        )}
      </GlassCard>
    </TailwindShell>
  );
}
