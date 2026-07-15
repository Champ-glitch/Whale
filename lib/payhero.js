export function normalizePhone(raw) {
  let phone = raw.replace(/\D/g, "");

  if (phone.startsWith("0") && phone.length === 10) {
    phone = "254" + phone.slice(1);
  } else if (phone.length === 9) {
    phone = "254" + phone;
  } else if (phone.startsWith("254") && phone.length === 12) {
    // already correct
  } else {
    return null;
  }
  return phone;
}

export async function initiateSTKPush({ amount, phoneNumber, reference }) {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) {
    throw new Error(`Invalid phone number: ${phoneNumber}`);
  }
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  const authToken =
    process.env.PAYHERO_BASIC_AUTH_TOKEN ||
    Buffer.from(
      `${process.env.PAYHERO_API_USERNAME}:${process.env.PAYHERO_API_PASSWORD}`
    ).toString("base64");

  const res = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${authToken}`,
    },
    body: JSON.stringify({
      amount: Number(amount),
      phone_number: normalized,
      channel_id: Number(process.env.PAYHERO_CHANNEL_ID),
      provider: "m-pesa",
      external_reference: reference || `WHALE-${Date.now()}`,
      callback_url: process.env.PAYHERO_CALLBACK_URL,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error_message || `PayHero request failed (${res.status})`);
  }

  return data;
}
