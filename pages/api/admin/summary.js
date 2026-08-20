// pages/api/admin/summary.js
import { isAuthenticated } from '../../../lib/adminAuth';
import {
  getBalance,
  getSavingsBalance,
  getPendingSplitTotal,
  getSavingsGoal,
  getStats,
  getBiggestIn,
  getBiggestOut,
  getWeeklySaved,
  getAutoApprove,
  recordDailyBalanceSnapshot,
  getRecentSnapshots,
  getRecentActivity,
} from '../../../lib/kv';
import { getClientFundsAllTime } from '../../../lib/clientFunds';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [
      main,
      savings,
      pendingSplit,
      savingsGoal,
      stats,
      biggestIn,
      biggestOut,
      weeklySaved,
      autoApprove,
    ] = await Promise.all([
      getBalance(),
      getSavingsBalance(),
      getPendingSplitTotal(),
      getSavingsGoal(),
      getStats(),
      getBiggestIn(),
      getBiggestOut(),
      getWeeklySaved(),
      getAutoApprove(),
    ]);

    const netWorth = main + savings;
    const goalProgress = savingsGoal ? Math.min(100, Math.round((savings / savingsGoal) * 100)) : null;

    await recordDailyBalanceSnapshot();
    const trend = await getRecentSnapshots(7);
    const recentActivity = await getRecentActivity(5);
    const clientFundsAllTime = await getClientFundsAllTime();
    const totalProcessed = stats.total + clientFundsAllTime;

    return res.status(200).json({
      trend,
      recentActivity,
      totalProcessed,
      main,
      savings,
      netWorth,
      pendingSplit,
      savingsGoal,
      goalProgress,
      weeklySaved,
      autoApprove,
      stats,
      biggestIn,
      biggestOut,
    });
  } catch (err) {
    console.error('admin/summary error:', err);
    return res.status(500).json({ error: 'Failed to load summary' });
  }
}
