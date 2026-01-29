const express = require('express');
const { body, validationResult } = require('express-validator');

module.exports = function(logger, reportScheduler, generateReport, slackService) {
  const router = express.Router();

  /**
   * @swagger
   * /scheduler/status:
   *   get:
   *     summary: Get scheduler status
   *     description: Returns the current status of the report scheduler
   *     tags: [Scheduler]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Scheduler status retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/SchedulerStatus'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/scheduler/status', async (req, res) => {
    try {
      const status = reportScheduler.getStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting scheduler status:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /scheduler/start:
   *   post:
   *     summary: Start the scheduler
   *     description: Starts the automated report scheduler
   *     tags: [Scheduler]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Scheduler started successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Success'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/scheduler/start', async (req, res) => {
    try {
      reportScheduler.start();
      res.json({
        success: true,
        message: 'Scheduler started successfully'
      });
    } catch (error) {
      logger.error('Error starting scheduler:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /scheduler/stop:
   *   post:
   *     summary: Stop the scheduler
   *     description: Stops the automated report scheduler
   *     tags: [Scheduler]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Scheduler stopped successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Success'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/scheduler/stop', async (req, res) => {
    try {
      reportScheduler.stop();
      res.json({
        success: true,
        message: 'Scheduler stopped successfully'
      });
    } catch (error) {
      logger.error('Error stopping scheduler:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /scheduler/trigger/afternoon:
   *   post:
   *     summary: Manually trigger afternoon report
   *     description: Manually triggers the afternoon report generation and sending
   *     tags: [Scheduler]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Afternoon report triggered successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Success'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/scheduler/trigger/afternoon', async (req, res) => {
    try {
      logger.info('Manual afternoon report trigger requested');
      
      // Generate report data
      const data = await generateReport('afternoon');
      
      // Send to Slack
      const sent = await slackService.sendActivityReport(data);
      if (sent && sent.ok) {
        logger.info('Afternoon report sent to Slack successfully');
        res.json({
          success: true,
          message: 'Afternoon report sent to Slack successfully'
        });
      } else {
        const errMsg = sent && sent.error ? sent.error : 'Failed to send afternoon report to Slack';
        logger.error('Failed to send afternoon report to Slack:', errMsg);
        res.status(500).json({ success: false, error: errMsg });
      }
    } catch (error) {
      logger.error('Error triggering afternoon report:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /scheduler/trigger/night:
   *   post:
   *     summary: Manually trigger night report
   *     description: Manually triggers the night report generation and sending
   *     tags: [Scheduler]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Night report triggered successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Success'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/scheduler/trigger/night', async (req, res) => {
    try {
      logger.info('Manual night report trigger requested');
      
      // Generate report data
      const data = await generateReport('night');
      
      // Send to Slack
      const sent = await slackService.sendActivityReport(data);
      if (sent && sent.ok) {
        logger.info('Night report sent to Slack successfully');
        res.json({
          success: true,
          message: 'Night report sent to Slack successfully'
        });
      } else {
        const errMsg = sent && sent.error ? sent.error : 'Failed to send night report to Slack';
        logger.error('Failed to send night report to Slack:', errMsg);
        res.status(500).json({ success: false, error: errMsg });
      }
    } catch (error) {
      logger.error('Error triggering night report:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /scheduler/next-runs:
   *   get:
   *     summary: Get next scheduled run times
   *     description: Returns the next scheduled run times for afternoon and night reports
   *     tags: [Scheduler]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Next run times retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     currentTime:
   *                       type: string
   *                       format: date-time
   *                       example: '2024-01-01T12:00:00.000Z'
   *                     afternoon:
   *                       type: object
   *                       properties:
   *                         nextRun:
   *                           type: string
   *                           format: date-time
   *                           example: '2024-01-01T14:00:00.000Z'
   *                         timeUntilNext:
   *                           type: number
   *                           example: 7200000
   *                     night:
   *                       type: object
   *                       properties:
   *                         nextRun:
   *                           type: string
   *                           format: date-time
   *                           example: '2024-01-01T22:00:00.000Z'
   *                         timeUntilNext:
   *                           type: number
   *                           example: 36000000
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/scheduler/next-runs', async (req, res) => {
    try {
      const status = reportScheduler.getStatus();
      const now = new Date();
      
      const nextRuns = {
        currentTime: now.toISOString(),
        afternoon: {
          nextRun: status.afternoonJob.nextRun,
          timeUntilNext: status.afternoonJob.nextRun ? 
            new Date(status.afternoonJob.nextRun) - now : null
        },
        night: {
          nextRun: status.nightJob.nextRun,
          timeUntilNext: status.nightJob.nextRun ? 
            new Date(status.nightJob.nextRun) - now : null
        }
      };
      
      res.json({
        success: true,
        data: nextRuns
      });
    } catch (error) {
      logger.error('Error getting next run times:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}; 