const express = require('express');
const HourlyCallStats = require('../models/HourlyCallStats');

module.exports = (logger) => {
  const router = express.Router();

  // GET /hourly-call-stats?userId=...&start=...&end=...
  router.get('/hourly-call-stats', async (req, res) => {
    try {
      const { userId, start, end } = req.query;
      const filter = {};
      if (userId) {
        filter.userId = userId;
      }
      if (start || end) {
        filter.timestamp = {};
        if (start) filter.timestamp.$gte = new Date(start);
        if (end) filter.timestamp.$lte = new Date(end);
      }
      logger.info('Querying HourlyCallStats with filter:', filter);
      const results = await HourlyCallStats.find(filter).sort({ timestamp: 1 });
      res.json({ success: true, data: results });
    } catch (error) {
      logger.error('Error querying HourlyCallStats:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}; 