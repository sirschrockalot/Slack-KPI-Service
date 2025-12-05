const express = require('express');
const { body, validationResult } = require('express-validator');


module.exports = (logger, generateReport, slackService) => {
  const router = express.Router();

  /**
   * @swagger
   * /report/afternoon:
   *   post:
   *     summary: Generate and send afternoon report
   *     description: Triggers the generation and sending of an afternoon activity report to Slack
   *     tags: [Reports]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Report sent successfully
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
  router.post('/report/afternoon', async (req, res) => {
    try {
      logger.info('Afternoon report triggered via API');
      const data = await generateReport('afternoon');
      
      // Debug: Log the data structure to see if users have unique data
      logger.info('DEBUG: Raw activity data structure:', {
        period: data.period,
        userCount: data.users ? data.users.length : 0,
        users: data.users ? data.users.map(u => ({
          name: u.name,
          user_id: u.user_id,
          totalCalls: u.totalCalls,
          answeredCalls: u.answeredCalls,
          totalDurationMinutes: u.totalDurationMinutes
        })) : []
      });
      
      const sent = await slackService.sendActivityReport(data);
      if (sent) {
        logger.info('Afternoon report sent to Slack successfully');
        res.json({ success: true, message: 'Afternoon report sent to Slack successfully' });
      } else {
        logger.error('Failed to send afternoon report to Slack');
        res.status(500).json({ success: false, error: 'Failed to send afternoon report to Slack' });
      }
    } catch (error) {
      logger.error('Error running afternoon report:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /report/night:
   *   post:
   *     summary: Generate and send night report
   *     description: Triggers the generation and sending of a night activity report to Slack
   *     tags: [Reports]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Report sent successfully
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
  router.post('/report/night', async (req, res) => {
    try {
      logger.info('Night report triggered via API');
      const data = await generateReport('night');
      
      // Debug: Log the data structure to see if users have unique data
      logger.info('DEBUG: Raw activity data structure:', {
        period: data.period,
        userCount: data.users ? data.users.length : 0,
        users: data.users ? data.users.map(u => ({
          name: u.name,
          user_id: u.user_id,
          totalCalls: u.totalCalls,
          answeredCalls: u.answeredCalls,
          totalDurationMinutes: u.totalDurationMinutes
        })) : []
      });
      
      const sent = await slackService.sendActivityReport(data);
      if (sent) {
        logger.info('Night report sent to Slack successfully');
        res.json({ success: true, message: 'Night report sent to Slack successfully' });
      } else {
        logger.error('Failed to send night report to Slack');
        res.status(500).json({ success: false, error: 'Failed to send night report to Slack' });
      }
    } catch (error) {
      logger.error('Error running night report:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /report/custom:
   *   post:
   *     summary: Generate and send custom time range report
   *     description: Triggers the generation and sending of a custom time range activity report to Slack
   *     tags: [Reports]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CustomReportRequest'
   *     responses:
   *       200:
   *         description: Report sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Success'
   *       400:
   *         description: Bad request - validation error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 errors:
   *                   type: array
   *                   items:
   *                     type: object
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
  router.post(
    '/report/custom',
    [
      body('startTime').exists().withMessage('startTime is required').isISO8601().withMessage('startTime must be ISO8601'),
      body('endTime').exists().withMessage('endTime is required').isISO8601().withMessage('endTime must be ISO8601'),
      body('returnRaw').optional().isBoolean().withMessage('returnRaw must be boolean'),
      body('reportName').optional().isString().trim().escape(),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      try {
        const { startTime, endTime, reportName, returnRaw } = req.body;
        const name = reportName || 'Custom';

        // If returnRaw is true, synchronously return data and do not send to Slack
        if (returnRaw === true || returnRaw === 'true') {
          logger.info(`Custom raw report requested: ${name} from ${startTime} to ${endTime}`);
          const data = await generateReport(name, startTime, endTime);
          return res.json({
            success: true,
            data: {
              period: data.period,
              startTime: data.startTime,
              endTime: data.endTime,
              userCount: data.users ? data.users.length : 0,
              users: data.users ? data.users.map(u => ({
                name: u.name,
                user_id: u.user_id,
                email: u.email,
                totalCalls: u.totalCalls,
                answeredCalls: u.answeredCalls,
                missedCalls: u.missedCalls,
                totalDurationMinutes: u.totalDurationMinutes,
                outboundCalls: u.outboundCalls,
                answeredOutboundCalls: u.answeredOutboundCalls,
                inboundCalls: u.inboundCalls,
                answeredInboundCalls: u.answeredInboundCalls,
                inboundDurationMinutes: u.inboundDurationMinutes,
                outboundDurationMinutes: u.outboundDurationMinutes,
                callCount: u.calls ? u.calls.length : 0
              })) : []
            }
          });
        }

        // Default behavior: fire-and-forget, send to Slack, and respond immediately
        res.json({ success: true, message: 'Custom report generation started. Check Slack for results.' });
        logger.info(`Custom report triggered: ${name} from ${startTime} to ${endTime}`);

        // Process asynchronously to avoid timeout
        setImmediate(async () => {
          try {
            logger.info(`Starting custom report generation: ${name} from ${startTime} to ${endTime}`);
            const data = await generateReport(name, startTime, endTime);
            
            // Debug: Log the data structure to see if users have data
            logger.info('DEBUG: Custom report data structure:', {
              period: data.period,
              startTime: data.startTime,
              endTime: data.endTime,
              userCount: data.users ? data.users.length : 0,
              users: data.users ? data.users.map(u => ({
                name: u.name,
                user_id: u.user_id,
                totalCalls: u.totalCalls,
                answeredCalls: u.answeredCalls,
                totalDurationMinutes: u.totalDurationMinutes,
                outboundCalls: u.outboundCalls,
                inboundCalls: u.inboundCalls
              })) : []
            });
            
            const sent = await slackService.sendActivityReport(data);
            if (sent) {
              logger.info('Custom report sent to Slack successfully');
            } else {
              logger.error('Failed to send custom report to Slack');
            }
          } catch (error) {
            logger.error('Error running custom report:', error.message);
            logger.error('Custom report error stack:', error.stack);
          }
        });
      } catch (error) {
        logger.error('Error initiating custom report:', error.message);
        if (!res.headersSent) {
          return res.status(500).json({ success: false, error: error.message });
        }
      }
    }
  );

  /**
   * @swagger
   * /report/today:
   *   get:
   *     summary: Generate today's report
   *     description: Generates a report for the current day (from start of day to now)
   *     tags: [Reports]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Report generated successfully
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
  router.get('/report/today', async (req, res) => {
    try {
      logger.info("/report/today route called");
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      logger.info(`Today's report triggered: from ${startOfDay.toISOString()} to ${now.toISOString()}`);
      // Get raw data from Aircall
      const data = await generateReport('Today', startOfDay.toISOString(), now.toISOString());
      logger.info("Received response from Aircall for today's report");
      // Removed: const userStats = data.users.map(user => ({
      // Removed:   userId: user.user_id,
      // Removed:   name: user.name,
      // Removed:   totalDials: user.totalCalls,
      // Removed:   totalTalkTimeMinutes: user.totalDurationMinutes,
      // Removed:   startDate: startOfDay,
      // Removed:   endDate: now
      // Removed: }));
      // Removed: await UserCallStats.insertMany(userStats);
      // Removed: logger.info("Today's formatted report data saved to MongoDB");
      res.json({ success: true });
    } catch (error) {
      logger.error("Error running today's report:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Debug endpoint to see raw activity data
  router.get('/debug/activity-data', async (req, res) => {
    try {
      logger.info('Debug activity data endpoint called');
      const data = await generateReport('afternoon');
      
      // Return the raw data structure for inspection
      res.json({
        success: true,
        data: {
          period: data.period,
          startTime: data.startTime,
          endTime: data.endTime,
          userCount: data.users ? data.users.length : 0,
          users: data.users ? data.users.map(u => ({
            name: u.name,
            user_id: u.user_id,
            email: u.email,
            totalCalls: u.totalCalls,
            answeredCalls: u.answeredCalls,
            missedCalls: u.missedCalls,
            totalDurationMinutes: u.totalDurationMinutes,
            outboundCalls: u.outboundCalls,
            answeredOutboundCalls: u.answeredOutboundCalls,
            inboundCalls: u.inboundCalls,
            answeredInboundCalls: u.answeredInboundCalls,
            inboundDurationMinutes: u.inboundDurationMinutes,
            outboundDurationMinutes: u.outboundDurationMinutes,
            callCount: u.calls ? u.calls.length : 0
          })) : []
        }
      });
    } catch (error) {
      logger.error('Error getting debug activity data:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Removed GET /report/custom/raw in favor of returnRaw flag on POST /report/custom

  return router;
}; 