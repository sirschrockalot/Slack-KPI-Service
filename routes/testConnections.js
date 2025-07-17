const express = require('express');

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
      logger.error('Error testing connections:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}; 