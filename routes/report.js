const express = require('express');
const { body, validationResult } = require('express-validator');
const Report = require('../models/Report');
const UserCallStats = require('../models/UserCallStats');

module.exports = (logger, generateReport, slackService) => {
  const router = express.Router();

  // Afternoon report
  router.post('/report/afternoon', async (req, res) => {
    try {
      logger.info('Afternoon report triggered via API');
      await generateReport('afternoon');
      res.json({ success: true, message: 'Afternoon report sent successfully' });
    } catch (error) {
      logger.error('Error running afternoon report:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Night report
  router.post('/report/night', async (req, res) => {
    try {
      logger.info('Night report triggered via API');
      await generateReport('night');
      res.json({ success: true, message: 'Night report sent successfully' });
    } catch (error) {
      logger.error('Error running night report:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Custom report
  router.post(
    '/report/custom',
    [
      body('startTime').exists().withMessage('startTime is required').isISO8601().withMessage('startTime must be ISO8601'),
      body('endTime').exists().withMessage('endTime is required').isISO8601().withMessage('endTime must be ISO8601'),
      body('reportName').optional().isString().trim().escape(),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      try {
        const { startTime, endTime, reportName } = req.body;
        logger.info(`Custom report triggered: ${reportName || 'Custom'} from ${startTime} to ${endTime}`);
        await generateReport(reportName || 'Custom', startTime, endTime);
        res.json({ success: true, message: 'Custom report sent successfully' });
      } catch (error) {
        logger.error('Error running custom report:', error.message);
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // Today's report (from start of day to now)
  router.get('/report/today', async (req, res) => {
    try {
      logger.info("/report/today route called");
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      logger.info(`Today's report triggered: from ${startOfDay.toISOString()} to ${now.toISOString()}`);
      // Get raw data from Aircall
      const data = await generateReport('Today', startOfDay.toISOString(), now.toISOString());
      logger.info("Received response from Aircall for today's report");
      const userStats = data.users.map(user => ({
        userId: user.user_id,
        name: user.name,
        totalDials: user.totalCalls,
        totalTalkTimeMinutes: user.totalDurationMinutes,
        startDate: startOfDay,
        endDate: now
      }));
      await UserCallStats.insertMany(userStats);
      logger.info("Today's formatted report data saved to MongoDB");
      res.json({ success: true });
    } catch (error) {
      logger.error("Error running today's report:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}; 