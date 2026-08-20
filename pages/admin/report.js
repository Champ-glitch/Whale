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

function DonutChart({ segments, size = 140 }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
      </svg>
    );
  }
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <g transform="rotate(-90 50 50)">
        {segments.map((seg, i) => {
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const circle = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return circle;
        })}
      </g>
    </svg>
  );
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
  const segments = data
    ? [
        { label: 'Main', value: Math.max(0, data.main), color: '#facc15' },
        { label: 'Savings', value: Math.max(0, data.savings), color: '#2dd4bf' },
        { label: 'Deducted', value: Math.max(0, data.totalDeducted), color: '#f87171' },
      ]
    : [];
  const segmentTotal = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <TailwindShell title="Weekly Report">
      <p className="text-lg font-serif italic text-white">Weekly Report</p>
      <p className="text-sm text-slate-400 mb-6">Savings progress and top spending categories.</p>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <GlassCard label="Saved This Week" value={fmt(data.weeklySaved)} sub="" subClass="" />
            <GlassCard label="Avg / Day" value={fmt(data.avgPerDay)} sub={`${data.daysElapsed}d`} subClass="text-slate-400" />
            <GlassCard label="Payments" value={String(data.stats.count)} sub={`${data.stats.streak}d streak`} subClass="text-yellow-400" />
          </div>

          <GlassCard>
            <p className="text-sm font-semibold text-white mb-4">Distribution</p>
            <div className="flex items-center gap-6">
              <DonutChart segments={segments} />
              <div className="flex-1 space-y-2.5">
                {segments.map((seg) => (
                  <div key={seg.label} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                    <span className="text-slate-300 flex-1">{seg.label}</span>
                    <span className="text-slate-400">{fmt(seg.value)}</span>
                    <span className="text-slate-100 font-semibold w-9 text-right">
                      {segmentTotal > 0 ? Math.round((seg.value / segmentTotal) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <p className="text-sm font-semibold text-white mb-3">Savings Goal</p>
            {data.savingsGoal ? (
              <>
                <div className="flex justify-between text-xs text-slate-300 mb-2">
                  <span>{fmt(data.savings)} of {fmt(data.savingsGoal)}</span>
                  <span className="text-teal-400 font-semibold">{data.goalProgress}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-yellow-400 rounded-full"
                    style={{ width: `${data.goalProgress}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm">No savings goal set yet.</p>
            )}
          </GlassCard>

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
