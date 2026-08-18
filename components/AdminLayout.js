// components/AdminLayout.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '◆' },
  { href: '/admin/invoices', label: 'Invoices', icon: '▤' },
  { href: '/admin/payments', label: 'Live Payments', icon: '◉' },
  { href: '/admin/send', label: 'Send Payment', icon: '➤' },
  { href: '/admin/deductions', label: 'Deductions', icon: '−' },
  { href: '/admin/savings', label: 'Savings Split', icon: '◑' },
];

export default function AdminLayout({ children, title = 'Dashboard', pulse = [] }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <>
      <Head>
        <title>{title} — WHALE_SYS Admin</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <div className="brand">
            <span className="brandMark">whale enterprise</span>
            <span className="brandSub">Admin Console</span>
          </div>

          <nav className="nav">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`navItem ${router.pathname === item.href ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="navIcon">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>

          <button className="logoutBtn" onClick={handleLogout}>
            Log out
          </button>
        </aside>

        <div className="main">
          <div className="pulseBar">
            {pulse.map((p) => (
              <div key={p.name} className="pulseItem">
                <span className={`pulseDot ${p.ok ? 'ok' : 'down'}`} />
                {p.name}
              </div>
            ))}
            <button className="menuToggle" onClick={() => setMenuOpen((o) => !o)}>
              ☰
            </button>
          </div>

          <main className="content">{children}</main>
        </div>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #060b14;
          color: #e2e8f0;
          font-family: 'Inter', -apple-system, sans-serif;
          font-variant-numeric: tabular-nums;
        }
      `}</style>

      <style jsx>{`
        .shell {
          display: flex;
          min-height: 100vh;
        }

        .sidebar {
          width: 240px;
          background: linear-gradient(180deg, #0a1628 0%, #060b14 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          flex-direction: column;
          padding: 28px 20px;
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .brand {
          margin-bottom: 36px;
        }
        .brandMark {
          display: block;
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-weight: 700;
          font-size: 21px;
          color: #ffffff;
        }
        .brandSub {
          display: block;
          font-size: 11px;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: #00ced1;
          margin-top: 4px;
        }

        .nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .navItem {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 12px;
          border-radius: 8px;
          color: #94a3b8;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.15s, color 0.15s;
        }
        .navItem:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #e2e8f0;
        }
        .navItem.active {
          background: rgba(255, 215, 0, 0.08);
          color: #ffd700;
        }
        .navIcon {
          font-size: 13px;
          width: 16px;
          text-align: center;
        }

        .logoutBtn {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
        }
        .logoutBtn:hover {
          border-color: #ff6b6b;
          color: #ff6b6b;
        }

        .main {
          flex: 1;
          min-width: 0;
        }

        .pulseBar {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 14px 28px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(10, 22, 40, 0.5);
          position: sticky;
          top: 0;
          z-index: 10;
          backdrop-filter: blur(8px);
        }
        .pulseItem {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          color: #94a3b8;
        }
        .pulseDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .pulseDot.ok {
          background: #00ced1;
          box-shadow: 0 0 0 0 rgba(0, 206, 209, 0.6);
          animation: pulseGlow 2s infinite;
        }
        .pulseDot.down {
          background: #ff6b6b;
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(0, 206, 209, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(0, 206, 209, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 206, 209, 0); }
        }

        .menuToggle {
          display: none;
          margin-left: auto;
          background: none;
          border: none;
          color: #e2e8f0;
          font-size: 18px;
        }

        .content {
          padding: 28px;
        }

        @media (max-width: 820px) {
          .sidebar {
            position: fixed;
            left: -260px;
            z-index: 20;
            transition: left 0.2s;
            box-shadow: 8px 0 24px rgba(0, 0, 0, 0.4);
          }
          .sidebar.open {
            left: 0;
          }
          .menuToggle {
            display: block;
          }
          .content {
            padding: 18px;
          }
        }
      `}</style>
    </>
  );
}
