const HourlyCallStats = require('../models/HourlyCallStats');

class AggregateStatsService {
  /**
   * Generates an aggregation pipeline to compute stats for a given period.
   * @param {string} userId - The user's ID to aggregate for.
   * @param {'hourly'|'daily'|'weekly'|'monthly'|'quarterly'|'yearly'} period - The aggregation period.
   * @param {Date} date - The date to base the period on.
   */
  async getStatsForPeriod(userId, period, date) {
    const matchStage = {
      $match: {
        timestamp: {}
      }
    };
    
    if (userId) {
      matchStage.$match.userId = userId;
    }

    const groupStage = {
      $group: {
        _id: {
          userId: '$userId',
          name: { $first: '$name' }
        },
        totalDials: { $sum: '$totalDials' },
        totalTalkTimeMinutes: { $sum: '$totalTalkTimeMinutes' }
      }
    };
    
    const now = date || new Date();
    let startTime, endTime;

    switch (period) {
      case 'hourly':
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
        endTime = new Date(startTime.getTime() + (60 * 60 * 1000));
        break;
      case 'daily':
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endTime = new Date(startTime.getTime() + (24 * 60 * 60 * 1000));
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        endTime = new Date(startTime.getTime() + (7 * 24 * 60 * 60 * 1000));
        break;
      case 'monthly':
        startTime = new Date(now.getFullYear(), now.getMonth(), 1);
        endTime = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        startTime = new Date(now.getFullYear(), quarter * 3, 1);
        endTime = new Date(now.getFullYear(), quarter * 3 + 3, 1);
        break;
      case 'yearly':
        startTime = new Date(now.getFullYear(), 0, 1);
        endTime = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        throw new Error('Invalid aggregation period specified.');
    }

    matchStage.$match.timestamp = { $gte: startTime, $lt: endTime };
    
    const pipeline = [matchStage, groupStage];
    
    return await HourlyCallStats.aggregate(pipeline);
  }
}

module.exports = AggregateStatsService; 