// pages/api/admin/savings.js
import { isAuthenticated } from '../../../lib/adminAuth';
import {
  getSavingsBalance,
  getPendingSplitTotal,
  listPendingSplitLog,
  approvePendingSplit,
  getAutoApprove,
  setAutoApprove,
  getSavingsGoal,
  setSavingsGoal,
} from '../../../lib/kv';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const [savings, pending, log, autoApprove, savingsGoal] = await Promise.all([
        getSavingsBalance(),
        getPendingSplitTotal(),
        listPendingSplitLog(10),
        getAutoApprove(),
        getSavingsGoal(),
      ]);
      return res.status(200).json({ savings, pending, log, autoApprove, savingsGoal });
    } catch (err) {
      console.error('admin/savings GET error:', err);
      return res.status(500).json({ error: 'Failed to load savings data' });
    }
  }

  if (req.method === 'POST') {
    const { action, enabled } = req.body;
    try {
      if (action === 'approve') {
        const moved = await approvePendingSplit();
        return res.status(200).json({ ok: true, moved });
      }
      if (action === 'autoapprove') {
        await setAutoApprove(!!enabled);
        return res.status(200).json({ ok: true });
      }
      if (action === 'setgoal') {
        const { amount } = req.body;
        if (!amount || Number(amount) <= 0) {
          return res.status(400).json({ error: 'Enter a valid goal amount' });
        }
        await setSavingsGoal(Number(amount));
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
      console.error('admin/savings POST error:', err);
      return res.status(500).json({ error: 'Failed to update savings' });
    }
  }

  return res.status(405).end();
}
