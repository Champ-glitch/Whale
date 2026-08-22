// pages/admin/report.js
import { useEffect, useState } from 'react';
import TailwindShell, { GlassCard } from '../../components/TailwindShell';
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

  const maxCategory = data?.topCategories?.[0]?.amount || 1;

  return (
    <TailwindShell title="Weekly Report">
      <p className="text-lg font-serif italic text-white">Weekly Report</p>
      <p className="text-sm text-slate-400 mb-6">This till's activity and top spending categories.</p>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <GlassCard label="This Till — Received" value={fmt(data.main)} sub="Available now" subClass="text-yellow-400" />
            <GlassCard label="This Till — Spent" value={fmt(data.totalDeducted)} sub="Total deductions" subClass="text-red-400" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <GlassCard label="Payments" value={String(data.stats.count)} sub="" subClass="" />
            <GlassCard label="Streak" value={`${data.stats.streak}d`} sub="" subClass="" />
            <GlassCard label="Biggest In" value={fmt(data.biggestIn)} sub="" subClass="" />
          </div>

          <div>
            <p className="text-sm font-semibold text-white mb-3">Top Spending Categories</p>
            {data.topCategories.length === 0 ? (
              <p className="text-slate-400 text-sm">No categorized deductions yet.</p>
            ) : (
              <div className="space-y-3">
                {data.topCategories.map((cat, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-200 capitalize">{cat.category}</span>
                      <span className="text-yellow-400 font-semibold">{fmt(cat.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-teal-400 rounded-full"
                        style={{ width: `${(cat.amount / maxCategory) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </TailwindShell>
  );
}
