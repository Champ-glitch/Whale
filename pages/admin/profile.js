// pages/admin/profile.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  FileText,
  MinusCircle,
  PiggyBank,
  Users,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import TailwindShell, { GlassCard } from '../../components/TailwindShell';
import { isAuthenticated } from '../../lib/adminAuth';

export async function getServerSideProps({ req }) {
  if (!isAuthenticated(req)) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
  return { props: {} };
}

const MENU_ITEMS = [
  { href: '/admin/transfers?tab=invoices', label: 'Invoices', icon: FileText, color: 'text-blue-400' },
  { href: '/admin/deductions', label: 'Deductions', icon: MinusCircle, color: 'text-red-400' },
  { href: '/admin/savings', label: 'Savings Split', icon: PiggyBank, color: 'text-teal-400' },
  { href: '/admin/client-funds', label: 'Client Funds', icon: Users, color: 'text-purple-300' },
  { href: '/admin/report', label: 'Weekly Report', icon: BarChart3, color: 'text-yellow-400' },
  { href: '/admin/settings', label: 'Settings', icon: SettingsIcon, color: 'text-slate-400' },
];

export default function AdminProfile() {
  const router = useRouter();
  const [health, setHealth] = useState({ kv: true, telegram: true, makamesco: true });

  useEffect(() => {
    fetch('/api/admin/health')
      .then((r) => r.json())
      .then(setHealth);
  }, []);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  const services = [
    { name: 'KV Store', ok: health.kv },
    { name: 'Telegram', ok: health.telegram },
    { name: 'Makamesco', ok: health.makamesco },
  ];

  return (
    <TailwindShell title="Profile">
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-yellow-400 flex items-center justify-center text-[#0B0F1A] font-bold text-2xl mb-3">
          W
        </div>
        <p className="text-white font-bold text-lg">Whale Enterprise</p>
        <p className="text-slate-400 text-xs">Admin Console</p>
      </div>

      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">System Status</p>
      <GlassCard className="mb-6">
        <div className="space-y-3">
          {services.map((s) => (
            <div key={s.name} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{s.name}</span>
              <span className={`flex items-center gap-1.5 ${s.ok ? 'text-teal-400' : 'text-red-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.ok ? 'bg-teal-400 animate-pulse' : 'bg-red-500'}`} />
                {s.ok ? 'Online' : 'Down'}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Manage</p>
      <div className="flex flex-col gap-2 mb-6">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3.5"
            >
              <Icon size={18} className={item.color} />
              <span className="flex-1 text-sm text-slate-100">{item.label}</span>
              <ChevronRight size={16} className="text-slate-500" />
            </a>
          );
        })}
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 border border-red-500/30 bg-red-500/5 text-red-400 rounded-2xl py-3.5 text-sm font-semibold"
      >
        <LogOut size={16} /> Log out
      </button>
    </TailwindShell>
  );
}
