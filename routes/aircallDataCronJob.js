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

  // Test endpoint to manually trigger hourly sync for a specific hour
  router.get('/test-hourly-sync', async (req, res) => {
    try {
      logger.info("/test-hourly-sync route called");
      const { hour, userId } = req.query;
      
      // Parse the hour parameter (format: YYYY-MM-DDTHH:00:00.000Z)
      let startTime, endTime;
      if (hour) {
        startTime = new Date(hour);
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      } else {
        // Default to current hour
        const now = new Date();
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      }
      
      logger.info(`Testing hourly sync: from ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      // Get data from Aircall for this hour
      const data = await generateReport('hourly', startTime.toISOString(), endTime.toISOString());
      logger.info("Received response from Aircall for hourly sync test");
      
      // Filter by userId if provided
      let filteredUsers = data.users;
      if (userId) {
        filteredUsers = filteredUsers.filter(user => String(user.user_id) === String(userId));
      }
      
      // Save to MongoDB for each filtered user with hourly timestamp
      const savedUsers = [];
      for (const user of filteredUsers) {
        const userStats = {
          userId: user.user_id,
          name: user.name,
          email: user.email,
          timestamp: startTime, // Use hourly timestamp
          totalDials: user.totalCalls,
          totalTalkTimeMinutes: user.totalDurationMinutes,
          callIds: user.calls ? user.calls.map(c => c.id) : [],
        };
        
        const result = await HourlyCallStats.updateOne(
          { userId: user.user_id, timestamp: startTime },
          { $set: userStats },
          { upsert: true }
        );
        
        savedUsers.push({
          ...userStats,
          upserted: result.upsertedCount > 0,
          modified: result.modifiedCount > 0
        });
      }
      
      res.json({ 
        success: true, 
        message: `Saved ${savedUsers.length} user records for hour ${startTime.toISOString()}`,
        data: savedUsers 
      });
    } catch (error) {
      logger.error("Error testing hourly sync:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}; 