// components/TailwindShell.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Bell, BellOff } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Home' },
  { href: '/admin/report', label: 'Analytics' },
  { href: '/admin/transfers', label: 'Transfers' },
  { href: '/admin/profile', label: 'Profile' },
];

export default function TailwindShell({ title, children, armed, onToggleArm, toast }) {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>{title} — WHALE_SYS Admin</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a1628" />
      </Head>

      <div className="min-h-screen bg-[#0B0F1A] relative overflow-hidden">
        <div className="pointer-events-none fixed -top-24 -left-24 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none fixed -top-16 -right-16 w-64 h-64 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="pointer-events-none fixed bottom-0 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full bg-teal-400/5 blur-3xl" />

        <div className="relative max-w-[428px] mx-auto px-4 pt-5 pb-28">
          {toast && (
            <div className="fixed top-4 left-4 right-4 max-w-[400px] mx-auto z-50 bg-[#0a1628] border border-teal-400 text-slate-100 text-sm px-4 py-3 rounded-xl shadow-2xl">
              🔔 {toast}
            </div>
          )}

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐋</span>
              <h1 className="text-xl font-bold">
                <span className="text-white">Whale </span>
                <span className="bg-gradient-to-r from-blue-400 to-yellow-400 bg-clip-text text-transparent">
                  Enterprise
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {onToggleArm && (
                <button
                  onClick={onToggleArm}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border ${
                    armed ? 'border-teal-400 bg-teal-400/10 text-teal-400' : 'border-white/10 bg-white/5 text-slate-400'
                  }`}
                  title="Payment alerts"
                >
                  {armed ? <Bell size={16} /> : <BellOff size={16} />}
                </button>
              )}
              <a
                href="/admin/profile"
                className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-yellow-400 flex items-center justify-center text-[#0B0F1A] font-bold text-sm"
              >
                W
              </a>
            </div>
          </div>

          {children}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-[#0B0F1A]/95 backdrop-blur-xl border-t border-white/10">
          <div className="max-w-[428px] mx-auto flex justify-around py-2 px-2">
            {NAV_ITEMS.map((item) => {
              const active = router.pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 mx-1 rounded-xl text-xs font-medium ${
                    active ? 'bg-gradient-to-r from-blue-500 to-yellow-400 text-[#0B0F1A]' : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export function GlassCard({ icon, iconBg, label, value, sub, subClass, className = '' }) {
  return (
    <div className={`relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 overflow-hidden ${className}`}>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/[0.04] to-transparent pointer-events-none" />
      {icon && (
        <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
          {icon}
        </div>
      )}
      {label && <p className="relative text-xs text-slate-400 mb-1">{label}</p>}
      {value && <p className="relative text-lg font-bold text-white leading-tight">{value}</p>}
      {sub && <p className={`relative text-xs mt-1 ${subClass}`}>{sub}</p>}
    </div>
  );
}
