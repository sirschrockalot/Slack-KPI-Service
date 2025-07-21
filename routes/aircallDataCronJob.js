const express = require('express');

module.exports = (logger, generateReport) => {
  const router = express.Router();

  // Today's report (from start of day to now)
  router.get('/report/today', async (req, res) => {
    try {
      logger.info("/report/today route called");
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      logger.info(`Today's report triggered: from ${startOfDay.toISOString()} to ${now.toISOString()}`);
      const data = await generateReport('Today', startOfDay.toISOString(), now.toISOString());
      logger.info("Received response from Aircall for today's report");
      res.json({ success: true, data });
    } catch (error) {
      logger.error("Error running today's report:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}; 