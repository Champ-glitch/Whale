// pages/admin/report.js
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
  return `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function AdminReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/report')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const pulse = [{ name: 'KV', ok: true }, { name: 'Telegram', ok: true }, { name: 'Makamesco', ok: true }];
  const maxCategory = data?.topCategories?.[0]?.amount || 1;

  return (
    <AdminLayout title="Weekly Report" pulse={pulse}>
      <h1 className="pageTitle">Weekly Report</h1>
      <p className="pageSub">This week's savings progress and top spending categories.</p>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <>
          <div className="cardGrid">
            <div className="card">
              <p className="cardLabel">Saved This Week</p>
              <p className="cardValue teal">{fmt(data.weeklySaved)}</p>
            </div>
            <div className="card">
              <p className="cardLabel">Average Per Day</p>
              <p className="cardValue">{fmt(data.avgPerDay)}</p>
              <p className="cardSub">Over {data.daysElapsed} day{data.daysElapsed !== 1 ? 's' : ''}</p>
            </div>
            <div className="card">
              <p className="cardLabel">All-Time Payments</p>
              <p className="cardValue">{data.stats.count}</p>
              <p className="cardSub">{data.stats.streak} day streak</p>
            </div>
          </div>

          <div className="section">
            <h2 className="sectionTitle">Savings Goal</h2>
            <div className="card">
              {data.savingsGoal ? (
                <>
                  <div className="goalRow">
                    <span>{fmt(data.savings)} of {fmt(data.savingsGoal)}</span>
                    <span className="teal">{data.goalProgress}%</span>
                  </div>
                  <div className="progressTrack">
                    <div className="progressFill" style={{ width: `${data.goalProgress}%` }} />
                  </div>
                </>
              ) : (
                <p className="muted">No savings goal set. Use /goal in Telegram to set one.</p>
              )}
            </div>
          </div>

          <div className="section">
            <h2 className="sectionTitle">Top Spending Categories</h2>
            {data.topCategories.length === 0 ? (
              <p className="muted">No categorized deductions yet.</p>
            ) : (
              <div className="barList">
                {data.topCategories.map((cat, i) => (
                  <div key={i} className="barRow">
                    <div className="barLabel">
                      <span className="catName">{cat.category}</span>
                      <span className="catAmount">{fmt(cat.amount)}</span>
                    </div>
                    <div className="barTrack">
                      <div
                        className="barFill"
                        style={{ width: `${(cat.amount / maxCategory) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
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
        .loading, .muted { color: #94a3b8; font-size: 14px; }
        .cardGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 12px;
        }
        .card {
          background: #0a1628;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
        }
        .cardLabel { font-size: 12px; color: #94a3b8; margin: 0 0 8px; }
        .cardValue { font-size: 24px; font-weight: 700; color: #ffd700; margin: 0; }
        .cardValue.teal { color: #00ced1; }
        .cardSub { font-size: 12px; color: #94a3b8; margin: 6px 0 0; }
        .section { margin: 28px 0; }
        .sectionTitle {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #94a3b8;
          margin: 0 0 12px;
        }
        .goalRow { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 10px; }
        .teal { color: #00ced1; }
        .progressTrack {
          height: 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          overflow: hidden;
        }
        .progressFill {
          height: 100%;
          background: linear-gradient(90deg, #00ced1, #ffd700);
          border-radius: 4px;
        }
        .barList { display: flex; flex-direction: column; gap: 16px; }
        .barRow { display: flex; flex-direction: column; gap: 6px; }
        .barLabel { display: flex; justify-content: space-between; font-size: 13px; }
        .catName { color: #e2e8f0; text-transform: capitalize; }
        .catAmount { color: #ffd700; font-weight: 600; }
        .barTrack {
          height: 8px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          overflow: hidden;
        }
        .barFill {
          height: 100%;
          background: linear-gradient(90deg, #ffd700, #00ced1);
          border-radius: 4px;
        }
      `}</style>
    </AdminLayout>
  );
}
