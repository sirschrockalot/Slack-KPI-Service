const express = require('express');
const { body, validationResult } = require('express-validator');

module.exports = (logger, generateReport) => {
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

  return router;
}; 