// lib/makamesco.js
const BASE_URL = 'https://makamescopay.com';

export async function createSTKPush({ phone, amount, reference }) {
  const formattedPhone = phone.startsWith('0') ? `254${phone.slice(1)}` : phone;

  const res = await fetch(`${BASE_URL}/api/payments/stkpush`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.MAKAMESCO_SECRET_KEY
    },
    body: JSON.stringify({
      phoneNumber: formattedPhone,
      amount: Number(amount),
      accountReference: reference,
    })
  });

  const data = await res.json();
  
  if (!res.ok) {
    console.error('Makamesco Error:', data);
    throw new Error(data.message || 'STK Push failed');
  }

  return data;
}
