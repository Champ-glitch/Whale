// pages/admin/profile.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  FileText,
  MinusCircle,
  Users,
  HelpCircle,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  Bell,
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
  { href: '/admin/invoices', label: 'Invoices', icon: FileText, color: 'text-blue-400' },
  { href: '/admin/deductions', label: 'Deductions', icon: MinusCircle, color: 'text-red-400' },
  { href: '/admin/client-funds', label: 'Client Funds', icon: Users, color: 'text-purple-300' },
  { href: '/admin/unclassified', label: 'Needs Classification', icon: HelpCircle, color: 'text-purple-300' },
  { href: '/admin/report', label: 'Weekly Report', icon: BarChart3, color: 'text-yellow-400' },
  { href: '/admin/settings', label: 'Settings', icon: SettingsIcon, color: 'text-slate-400' },
];

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function AdminProfile() {
  const router = useRouter();
  const [health, setHealth] = useState({ kv: true, telegram: true, makamesco: true });
  const [pushStatus, setPushStatus] = useState('checking'); // checking | unsupported | denied | off | on
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/health')
      .then((r) => r.json())
      .then(setHealth);
  }, []);

  useEffect(() => {
    checkPushStatus();
  }, []);

  async function checkPushStatus() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushStatus('denied');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushStatus(sub ? 'on' : 'off');
    } catch {
      setPushStatus('off');
    }
  }

  async function enablePush() {
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('denied');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });
      await fetch('/api/admin/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });
      setPushStatus('on');
    } catch (err) {
      console.error('Push enable error:', err);
      alert('Could not enable notifications: ' + err.message);
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/admin/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushStatus('off');
    } finally {
      setPushBusy(false);
    }
  }

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
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-teal-400 flex items-center justify-center text-[#0B0F1A] font-bold text-2xl mb-3">
          W
        </div>
        <p className="text-white font-bold text-lg">Whale Enterprise</p>
        <p className="text-slate-400 text-xs">Admin Console</p>
      </div>

      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Notifications</p>
      <GlassCard className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400/20 to-teal-400/10 flex items-center justify-center flex-shrink-0">
            <Bell size={18} className="text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-100 font-medium">Payment alerts</p>
            <p className="text-xs text-slate-500">
              {pushStatus === 'unsupported' && "Not supported on this browser"}
              {pushStatus === 'denied' && "Blocked — enable in browser settings"}
              {pushStatus === 'off' && "Get notified even when the app is closed"}
              {pushStatus === 'on' && "Enabled on this device"}
              {pushStatus === 'checking' && "Checking..."}
            </p>
          </div>
          {(pushStatus === 'off' || pushStatus === 'on') && (
            <button
              onClick={pushStatus === 'on' ? disablePush : enablePush}
              disabled={pushBusy}
              className={`px-3.5 py-2 rounded-full text-xs font-bold flex-shrink-0 ${
                pushStatus === 'on'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                  : 'bg-gradient-to-r from-yellow-400 to-teal-400 text-[#0B0F1A]'
              } disabled:opacity-60`}
            >
              {pushBusy ? '...' : pushStatus === 'on' ? 'Disable' : 'Enable'}
            </button>
          )}
        </div>
      </GlassCard>

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
