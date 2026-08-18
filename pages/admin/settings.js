// pages/admin/settings.js
import { useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
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

  const pulse = [{ name: 'KV', ok: true }, { name: 'Telegram', ok: true }, { name: 'Makamesco', ok: true }];

  return (
    <AdminLayout title="Settings" pulse={pulse}>
      <h1 className="pageTitle">Settings</h1>
      <p className="pageSub">System-level actions.</p>

      <div className="dangerCard">
        <p className="dangerTitle">⚠ Full Reset</p>
        <p className="dangerText">
          Wipes all invoices, deductions, savings, stats, and pending states. This cannot be undone.
          Type <strong>RESET</strong> below to confirm.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="input"
          placeholder="Type RESET"
        />
        <button
          className="dangerBtn"
          disabled={confirmText !== 'RESET' || resetting}
          onClick={handleReset}
        >
          {resetting ? 'Resetting...' : 'Reset everything'}
        </button>
        {result && (
          <p className={`resultMsg ${result.ok ? 'ok' : 'err'}`}>{result.message}</p>
        )}
      </div>

      <style jsx>{`
        .pageTitle {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-size: 28px;
          margin: 0 0 4px;
          color: #fff;
        }
        .pageSub { color: #94a3b8; font-size: 14px; margin: 0 0 24px; }
        .dangerCard {
          background: #0a1628;
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: 12px;
          padding: 22px;
          max-width: 420px;
        }
        .dangerTitle { color: #ff6b6b; font-weight: 700; font-size: 15px; margin: 0 0 8px; }
        .dangerText { color: #94a3b8; font-size: 13px; margin: 0 0 16px; line-height: 1.5; }
        .input {
          width: 100%;
          background: #060b14;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 10px 12px;
          color: #e2e8f0;
          font-size: 14px;
          font-family: inherit;
          margin-bottom: 12px;
        }
        .input:focus { outline: none; border-color: #ff6b6b; }
        .dangerBtn {
          width: 100%;
          background: #ff6b6b;
          color: #060b14;
          border: none;
          border-radius: 8px;
          padding: 11px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
        }
        .dangerBtn:disabled { opacity: 0.4; cursor: not-allowed; }
        .resultMsg { font-size: 13px; margin: 12px 0 0; }
        .resultMsg.ok { color: #00ced1; }
        .resultMsg.err { color: #ff6b6b; }
      `}</style>
    </AdminLayout>
  );
}
