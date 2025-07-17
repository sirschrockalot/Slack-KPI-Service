const express = require('express');

module.exports = (logger, config) => {
  const router = express.Router();

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'aircall-slack-agent'
    });
  });

  // Service status endpoint
  router.get('/status', (req, res) => {
    res.json({
      service: 'aircall-slack-agent',
      mode: 'on-demand',
      timestamp: new Date().toISOString(),
      excludedUsers: config.excludedUsers,
      endpoints: {
        health: 'GET /health',
        status: 'GET /status',
        afternoonReport: 'POST /report/afternoon',
        nightReport: 'POST /report/night',
        customReport: 'POST /report/custom'
      }
    });
  });

  return router;
}; 