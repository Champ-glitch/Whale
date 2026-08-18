// pages/admin/invoices.js
import { useEffect, useState } from 'react';
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

const STATUS_COLORS = {
  success: '#00ced1',
  pending: '#ffd700',
  failed: '#ff6b6b',
};

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingCode, setUpdatingCode] = useState(null);

  function loadInvoices() {
    fetch('/api/admin/invoices')
      .then((r) => r.json())
      .then((data) => {
        setInvoices(data.invoices || []);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadInvoices();
    const interval = setInterval(loadInvoices, 15000);
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
        body: JSON.stringify({ amount, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewLink(`https://whale-gamma-pied.vercel.app${data.url}`);
      setAmount('');
      setDescription('');
      loadInvoices();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function markFailed(code) {
    setUpdatingCode(code);
    try {
      await fetch('/api/admin/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, status: 'failed' }),
      });
      loadInvoices();
    } catch (err) {
      alert('Failed to update');
    } finally {
      setUpdatingCode(null);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(newLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const filtered = invoices.filter((inv) => {
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inv.code.toLowerCase().includes(q) ||
      (inv.description || '').toLowerCase().includes(q) ||
      String(inv.amount).includes(q);
    return matchesStatus && matchesSearch;
  });

  const pulse = [{ name: 'KV', ok: true }, { name: 'Telegram', ok: true }, { name: 'Makamesco', ok: true }];

  return (
    <AdminLayout title="Invoices" pulse={pulse}>
      <h1 className="pageTitle">Invoices</h1>
      <p className="pageSub">Create a payment link and track its status.</p>

      <form onSubmit={handleCreate} className="createCard">
        <div className="row">
          <div className="field">
            <label className="label">Amount (KES)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              placeholder="500"
              required
            />
          </div>
          <div className="field grow">
            <label className="label">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              placeholder="What's this for?"
            />
          </div>
        </div>
        <button type="submit" disabled={creating} className="btn">
          {creating ? 'Creating...' : 'Create invoice link'}
        </button>

        {newLink && (
          <div className="linkResult">
            <span className="linkText">{newLink}</span>
            <button type="button" onClick={copyLink} className="copyBtn">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </form>

      <div className="toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="searchInput"
          placeholder="Search by code, description, or amount"
        />
        <div className="tabs">
          {['all', 'pending', 'success', 'failed'].map((f) => (
            <button
              key={f}
              className={`tab ${statusFilter === f ? 'active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <h2 className="sectionTitle">
        {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
      </h2>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="muted">No matching invoices.</p>
      ) : (
        <div className="table">
          {filtered.map((inv) => (
            <div key={inv.code} className="tableRow">
              <div className="rowMain">
                <span className="code">{inv.code}</span>
                <span className="desc">{inv.description}</span>
              </div>
              <div className="rowMeta">
                <span className="amount">{fmt(inv.amount)}</span>
                <span className="status" style={{ color: STATUS_COLORS[inv.status] || '#94a3b8' }}>
                  {inv.status}
                </span>
                {inv.status === 'pending' && (
                  <button
                    className="failBtn"
                    disabled={updatingCode === inv.code}
                    onClick={() => markFailed(inv.code)}
                  >
                    {updatingCode === inv.code ? '...' : 'Mark failed'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .pageTitle {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-size: 28px;
          margin: 0 0 4px;
          color: #fff;
        }
        .pageSub { color: #94a3b8; font-size: 14px; margin: 0 0 24px; }
        .createCard {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .row { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field.grow { flex: 1; min-width: 160px; }
        .label { font-size: 12px; color: #94a3b8; }
        .input {
          background: #060b14;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 10px 12px;
          color: #e2e8f0;
          font-size: 14px;
          font-family: inherit;
          width: 100%;
        }
        .input:focus { outline: none; border-color: #00ced1; }
        .btn {
          background: #ffd700;
          color: #0a1628;
          border: none;
          border-radius: 8px;
          padding: 11px 20px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
        }
        .btn:disabled { opacity: 0.6; }
        .linkResult {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: #060b14;
          border: 1px solid rgba(0, 206, 209, 0.3);
          border-radius: 8px;
          padding: 10px 12px;
        }
        .linkText {
          flex: 1;
          font-size: 12px;
          color: #00ced1;
          word-break: break-all;
        }
        .copyBtn {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #e2e8f0;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .toolbar {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }
        .searchInput {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 14px;
          color: #e2e8f0;
          font-size: 14px;
          font-family: inherit;
        }
        .searchInput:focus { outline: none; border-color: #00ced1; }
        .tabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .tab {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          padding: 7px 16px;
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
        }
        .tab.active {
          background: rgba(255, 215, 0, 0.1);
          border-color: #ffd700;
          color: #ffd700;
        }
        .sectionTitle {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #94a3b8;
          margin: 0 0 12px;
        }
        .loading, .muted { color: #94a3b8; font-size: 14px; }
        .table { display: flex; flex-direction: column; gap: 6px; }
        .tableRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0a1628;
          padding: 14px 16px;
          border-radius: 8px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .rowMain { display: flex; flex-direction: column; gap: 3px; }
        .code { font-size: 13px; color: #e2e8f0; font-weight: 600; }
        .desc { font-size: 12px; color: #94a3b8; }
        .rowMeta { display: flex; align-items: center; gap: 12px; }
        .amount { font-weight: 700; color: #ffd700; font-size: 14px; }
        .status { font-size: 12px; text-transform: capitalize; }
        .failBtn {
          background: none;
          border: 1px solid rgba(255, 107, 107, 0.4);
          color: #ff6b6b;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 11px;
          cursor: pointer;
          font-family: inherit;
        }
        .failBtn:disabled { opacity: 0.6; }
      `}</style>
    </AdminLayout>
  );
}
