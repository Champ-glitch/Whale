import { getInvoice, updateInvoiceStatus } from '../../lib/kv';
import { createSTKPush } from '../../lib/makamesco';

function formatPhone(phone) {
  let p = phone.toString().replace(/\D/g, ''); // "712345678"
  
  // If user types 7XXXXXXXX, make it 2547XXXXXXXX
  if (p.length === 9 && p.startsWith('7')) {
    p = '254' + p;
  }
  // If user types 07XXXXXXXX, make it 2547XXXXXXXX  
  if (p.length === 10 && p.startsWith('0')) {
    p = '254' + p.slice(1);
  }

  if (p.length !== 12 || !p.startsWith('254')) {
    throw new Error('Invalid phone number');
  }
  return p;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { invoiceId, phone } = req.body; // phone will be "712345678"
  
  if (!invoiceId || !phone) {
    return res.status(400).json({ error: 'Missing invoiceId or phone' });
  }

  try {
    const invoice = await getInvoice(invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const formattedPhone = formatPhone(phone); // "712345678" -> "254712345678"

    await createSTKPush({
      amount: invoice.amount,
      phoneNumber: formattedPhone,
      reference: invoiceId
    });

    await updateInvoiceStatus(invoiceId, 'sent');
    return res.status(200).json({ success: true, message: 'STK sent' });

  } catch (err) {
    console.error('invoice-pay error:', err);
    return res.status(500).json({ error: err.message });
  }
}
