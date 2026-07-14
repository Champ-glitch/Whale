import { useState } from "react";
import { getInvoice } from "../../lib/kv.js";

export async function getServerSideProps({ params }) {
  const invoice = await getInvoice(params.code);

  if (!invoice) {
    return { props: { invoice: null, code: params.code } };
  }

  return {
    props: {
      invoice: {
        amount: invoice.amount,
        description: invoice.description,
        status: invoice.status,
      },
      code: params.code,
    },
  };
}

export default function PayPage({ invoice, code }) {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!invoice) {
    return (
      <Shell>
        <p style={{ color: "#f87171", fontSize: 18 }}>
          This invoice link is invalid or has expired.
        </p>
      </Shell>
    );
  }

  if (invoice.status === "used") {
    return (
      <Shell>
        <p style={{ color: "#facc15", fontSize: 18 }}>
          This payment link has already been used.
        </p>
      </Shell>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setState("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/invoice-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phoneNumber: phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }
      setState("sent");
    } catch (err) {
      setState("error");
      setErrorMsg(err.message);
    }
  }

  return (
    <Shell>
      <h1 style={{ color: "#facc15", fontSize: 28, marginBottom: 4 }}>
        KES {invoice.amount}
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>{invoice.description}</p>

      {state === "sent" ? (
        <p style={{ color: "#4ade80", fontSize: 16 }}>
          📲 Prompt sent! Check your phone and enter your M-Pesa PIN.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="tel"
            placeholder="0712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#fff",
              fontSize: 16,
              marginBottom: 16,
              boxSizing: "border-box",
            }}
          />
          <button
            type="submit"
            disabled={state === "sending"}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 8,
              border: "none",
              background: "#facc15",
              color: "#0f172a",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {state === "sending" ? "Sending..." : "Pay Now"}
          </button>
          {state === "error" && (
            <p style={{ color: "#f87171", marginTop: 12 }}>{errorMsg}</p>
          )}
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          background: "#1e293b",
          borderRadius: 16,
          padding: 32,
          border: "1px solid #334155",
        }}
      >
        <p style={{ color: "#facc15", fontWeight: 700, marginBottom: 24, letterSpacing: 1 }}>
          WHALE_SYS
        </p>
        {children}
      </div>
    </div>
  );
}
