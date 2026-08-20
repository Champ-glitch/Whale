// pages/admin/login.js
import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      router.push('/admin');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Admin Login — WHALE_SYS</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a1628" />
      </Head>

      <div className="min-h-screen bg-[#0B0F1A] relative overflow-hidden flex items-center justify-center px-5">
        <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-yellow-400/10 blur-3xl" />

        <div className="relative w-full max-w-[360px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl">🐋</span>
          </div>
          <p className="font-serif italic font-bold text-2xl text-white">whale enterprise</p>
          <p className="text-xs uppercase tracking-wide text-teal-400 mb-8">Admin Console</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="password" className="block text-left text-xs text-slate-400 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 mb-4 focus:outline-none focus:border-teal-400"
            />
            {error && <p className="text-red-400 text-xs text-left mb-4 -mt-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full text-sm font-bold bg-gradient-to-r from-blue-500 to-yellow-400 text-[#0B0F1A] disabled:opacity-60"
            >
              {loading ? 'Checking...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
