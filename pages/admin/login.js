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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="wrap">
        <div className="card">
          <p className="brandMark">whale enterprise</p>
          <p className="brandSub">Admin Console</p>

          <form onSubmit={handleSubmit}>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Enter admin password"
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading} className="btn">
              {loading ? 'Checking...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: 'Inter', -apple-system, sans-serif;
        }
      `}</style>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 30% 20%, #0a1628 0%, #060b14 60%);
          padding: 20px;
        }
        .card {
          width: 100%;
          max-width: 360px;
          background: rgba(10, 22, 40, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 36px 32px;
          text-align: center;
        }
        .brandMark {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-weight: 700;
          font-size: 26px;
          color: #ffffff;
          margin: 0;
        }
        .brandSub {
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #00ced1;
          margin: 6px 0 32px;
        }
        .label {
          display: block;
          text-align: left;
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 6px;
        }
        .input {
          width: 100%;
          background: #060b14;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 12px 14px;
          color: #e2e8f0;
          font-size: 15px;
          font-family: inherit;
          margin-bottom: 16px;
        }
        .input:focus {
          outline: none;
          border-color: #00ced1;
        }
        .error {
          color: #ff6b6b;
          font-size: 13px;
          margin: -6px 0 14px;
          text-align: left;
        }
        .btn {
          width: 100%;
          background: #ffd700;
          color: #0a1628;
          border: none;
          border-radius: 8px;
          padding: 13px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .btn:disabled {
          opacity: 0.6;
        }
      `}</style>
    </>
  );
}
