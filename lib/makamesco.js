// lib/makamesco.js
const BASE_URL = 'https://makamescopay.com';

function normalizePhone(raw) {
  let phone = raw.replace(/\D/g, '');
  if (phone.startsWith('0') && phone.length === 10) {
    phone = `254${phone.slice(1)}`;
  } else if (phone.length === 9) {
    phone = `254${phone}`;
  } else if (phone.startsWith('254') && phone.length === 12) {
    // already correct
  } else {
    return null;
  }
  return phone;
}

export async function createSTKPush({ amount, phoneNumber, reference }) {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) {
    throw new Error(`Invalid phone number: ${phoneNumber}`);
  }

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  const payload = {
    phoneNumber: normalized,
    amount: Number(amount),
    accountReference: reference || `WHALE-${Date.now()}`,
    transactionDesc: `Payment for ${reference || "invoice"}`,
  };

  const res = await fetch(`${BASE_URL}/api/payments/stkpush`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.MAKAMESCO_SECRET_KEY
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  
  if (!res.ok) {
    console.error("Makamesco request FAILED. Status:", res.status, "Full response:", JSON.stringify(data));
    console.error("Request sent was:", JSON.stringify(payload));
    throw new Error(data.message || `Makamesco request failed (${res.status})`);
  }

  return data;
}
