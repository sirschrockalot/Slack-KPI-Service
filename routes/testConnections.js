const express = require('express');
const { sanitizeError } = require('../utils/errorHandler');

module.exports = (logger, slackService, aircallService) => {
  const router = express.Router();

  router.get('/test-connections', async (req, res) => {
    try {
      const slackValid = await slackService.validateConnection();
      const aircallValid = await aircallService.testConnection();
      res.json({
        success: slackValid && aircallValid,
        connections: {
          slack: slackValid ? 'connected' : 'failed',
          aircall: aircallValid ? 'connected' : 'failed'
        }
      });
    } catch (error) {
      const sanitized = sanitizeError(error, logger);
      res.status(500).json(sanitized);
    }
  });

  return router;
}; 