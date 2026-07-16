import Head from "next/head";

const WHALE_IMG = "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f40b.svg";

export default function Home() {
  return (
    <>
      <Head>
        <title>WHALE_SYS Pay</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:ital,wght@1,700&display=swap" rel="stylesheet" />
      </Head>
      <div className="page">
        <img src={WHALE_IMG} alt="WHALE_SYS" width="70" height="70" />
        <p className="brand">whale_sys</p>
        <p className="tagline">Self-Taught. Self-Made.</p>
        <p className="desc">
          Fast, secure M-Pesa checkout links — built and operated independently.
        </p>
        <a
          href="https://wa.me/254798016597"
          target="_blank"
          rel="noopener noreferrer"
          className="cta"
        >
          Contact on WhatsApp
        </a>
        <p className="footer">© {new Date().getFullYear()} WHALE_SYS</p>
      </div>
      <style jsx global>{`
        * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }
        body { margin: 0; }
      `}</style>
      <style jsx>{`
        .page {
          min-height: 100vh;
          background: linear-gradient(160deg, #060b14 0%, #0a1420 55%, #060b14 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
        }
        .brand {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-weight: 700;
          font-size: 34px;
          color: #fff;
          margin: 16px 0 0;
        }
        .tagline { color: #cbd5e1; font-size: 14px; margin: 6px 0 24px; }
        .desc { color: #64748b; font-size: 13px; max-width: 320px; line-height: 1.6; margin-bottom: 28px; }
        .cta {
          padding: 13px 28px;
          border: 2px solid #fff;
          border-radius: 8px;
          color: #fff;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          transition: background 0.2s, color 0.2s;
        }
        .cta:hover { background: #fff; color: #0A1628; }
        .footer { color: #334155; font-size: 11px; margin-top: 48px; }
      `}</style>
    </>
  );
}
