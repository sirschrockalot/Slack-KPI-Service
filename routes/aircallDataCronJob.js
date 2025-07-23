const express = require('express');
const HourlyCallStats = require('../models/HourlyCallStats');

module.exports = (logger, generateReport) => {
  const router = express.Router();

  // Today's report (from start of day to now)
  router.get('/runaircalldatajob', async (req, res) => {
    try {
      logger.info("/report/today route called");
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      logger.info(`Today's report triggered: from ${startOfDay.toISOString()} to ${now.toISOString()}`);
      const data = await generateReport('Today', startOfDay.toISOString(), now.toISOString());
      logger.info("Received response from Aircall for today's report");

      // Filter by userId if provided
      const { userId } = req.query;
      let filteredUsers = data.users;
      if (userId) {
        filteredUsers = filteredUsers.filter(user => String(user.user_id) === String(userId));
      }
      const filteredData = { ...data, users: filteredUsers };

      // Save to MongoDB for each filtered user
      for (const user of filteredUsers) {
        const userStats = {
          userId: user.user_id,
          name: user.name,
          email: user.email,
          timestamp: startOfDay,
          totalDials: user.totalCalls,
          totalTalkTimeMinutes: user.totalDurationMinutes,
          callIds: user.calls ? user.calls.map(c => c.id) : [],
        };
        await HourlyCallStats.updateOne(
          { userId: user.user_id, timestamp: startOfDay },
          { $set: userStats },
          { upsert: true }
        );
      }

      res.json({ success: true, data: filteredData });
    } catch (error) {
      logger.error("Error running today's report:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Aggregated today's report for a specific user
  router.get('/report/today/aggregate', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId query parameter is required' });
      }
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const agg = await HourlyCallStats.aggregate([
        { $match: {
            userId: String(userId),
            timestamp: { $gte: startOfDay, $lt: endOfDay }
        }},
        { $group: {
            _id: '$userId',
            name: { $first: '$name' },
            email: { $first: '$email' },
            totalDials: { $sum: '$totalDials' },
            totalTalkTimeMinutes: { $sum: '$totalTalkTimeMinutes' }
        }}
      ]);
      if (agg.length === 0) {
        return res.json({ success: true, data: null });
      }
      res.json({ success: true, data: agg[0] });
    } catch (error) {
      logger.error("Error aggregating today's report:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}; 