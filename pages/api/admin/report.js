// pages/api/admin/report.js
import { isAuthenticated } from '../../../lib/adminAuth';
import {
  getWeeklySaved,
  getDaysElapsedInWeek,
  getTopCategories,
  getSavingsGoal,
  getSavingsBalance,
  getStats,
  getBalance,
  getTotalDeducted,
  getBiggestIn,
} from '../../../lib/kv';

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [weeklySaved, topCategories, savingsGoal, savings, stats, main, totalDeducted, biggestIn] = await Promise.all([
      getWeeklySaved(),
      getTopCategories(3),
      getSavingsGoal(),
      getSavingsBalance(),
      getStats(),
      getBalance(),
      getTotalDeducted(),
      getBiggestIn(),
    ]);

    const daysElapsed = getDaysElapsedInWeek();
    const avgPerDay = daysElapsed > 0 ? weeklySaved / daysElapsed : 0;
    const goalProgress = savingsGoal ? Math.min(100, Math.round((savings / savingsGoal) * 100)) : null;

    return res.status(200).json({
      weeklySaved,
      avgPerDay,
      daysElapsed,
      topCategories,
      savingsGoal,
      savings,
      goalProgress,
      stats,
      main,
      totalDeducted,
      biggestIn,
    });
  } catch (err) {
    console.error('admin/report error:', err);
    return res.status(500).json({ error: 'Failed to load report' });
  }
}
