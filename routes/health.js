const express = require('express');

module.exports = (logger, config) => {
  const router = express.Router();

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check endpoint
   *     description: Returns the health status of the service
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'aircall-slack-agent'
    });
  });

  /**
   * @swagger
   * /status:
   *   get:
   *     summary: Service status endpoint
   *     description: Returns detailed service status and configuration
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service status information
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StatusResponse'
   */
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
          customReport: 'POST /report/custom',
          scheduler: 'GET /scheduler/status',
          apiDocs: 'GET /api-docs',
          metrics: 'GET /metrics'
        }
    });
  });

  return router;
}; 