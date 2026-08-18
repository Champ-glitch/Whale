// pages/admin/index.js
import AdminLayout from '../../components/AdminLayout';
import { isAuthenticated } from '../../lib/adminAuth';

export async function getServerSideProps({ req }) {
  if (!isAuthenticated(req)) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
  return { props: {} };
}

export default function AdminDashboard() {
  const pulse = [
    { name: 'KV', ok: true },
    { name: 'Telegram', ok: true },
    { name: 'Makamesco', ok: true },
  ];

  return (
    <AdminLayout title="Dashboard" pulse={pulse}>
      <h1 className="pageTitle">Dashboard</h1>
      <p className="pageSub">Live data wiring in progress — this is the shell.</p>

      <div className="cardGrid">
        <div className="card">
          <p className="cardLabel">Main Balance</p>
          <p className="cardValue">—</p>
        </div>
        <div className="card">
          <p className="cardLabel">Savings (pending)</p>
          <p className="cardValue">—</p>
        </div>
        <div className="card">
          <p className="cardLabel">Net Worth</p>
          <p className="cardValue">—</p>
        </div>
      </div>

      <style jsx>{`
        .pageTitle {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-size: 28px;
          margin: 0 0 4px;
          color: #fff;
        }
        .pageSub {
          color: #94a3b8;
          font-size: 14px;
          margin: 0 0 28px;
        }
        .cardGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .card {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
        }
        .cardLabel {
          font-size: 12px;
          color: #94a3b8;
          margin: 0 0 8px;
        }
        .cardValue {
          font-size: 26px;
          font-weight: 700;
          color: #ffd700;
          margin: 0;
        }
      `}</style>
    </AdminLayout>
  );
}
