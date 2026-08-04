// lib/sms.js
// Thin wrapper around Nena Solutions' SMS API.
// https://nenasolutions.co.ke/api-docs

const NENA_BASE_URL = "https://nenasolutions.co.ke/v1/api";

// Sends an SMS. Never throws - logs and returns null on any failure, so a
// down SMS provider can never break the payment flow that calls it.
export async function sendSMS(phone, message) {
  const token = process.env.NENA_API_TOKEN;
  if (!token) {
    console.warn("NENA_API_TOKEN not set - skipping SMS.");
    return null;
  }

  try {
    const body = { to: phone, message };
    const senderId = process.env.NENA_SENDER_ID;
    if (senderId) body.sender_id = senderId;

    const res = await fetch(`${NENA_BASE_URL}/sms/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data?.data?.status === "failed") {
      console.error("Nena SMS reported failed:", JSON.stringify(data));
    }
    return data;
  } catch (err) {
    console.error("sendSMS error:", err);
    return null;
  }
}
