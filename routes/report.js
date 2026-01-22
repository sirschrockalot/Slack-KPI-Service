const express = require('express');
const { body, validationResult } = require('express-validator');
const { sanitizeError } = require('../utils/errorHandler');


module.exports = (logger, generateReport, slackService) => {
  const router = express.Router();
  
  /**
   * Helper function to organize users by agent category
   */
  const organizeUsersByCategory = (users) => {
    const dispoAgents = users.filter(user => user.agentCategory === 'dispo');
    const acquisitionAgents = users.filter(user => user.agentCategory === 'acquisition');
    const otherUsers = users.filter(user => !user.agentCategory || user.agentCategory === 'other');
    
    return {
      dispoAgents,
      acquisitionAgents,
      otherUsers,
      totalUsers: users.length,
      dispoCount: dispoAgents.length,
      acquisitionCount: acquisitionAgents.length,
      otherCount: otherUsers.length
    };
  };
  
  /**
   * Helper function to format user data for API responses
   */
  const formatUserData = (user) => ({
    name: user.name,
    user_id: user.user_id,
    email: user.email,
    agentCategory: user.agentCategory || 'other',
    totalCalls: user.totalCalls,
    answeredCalls: user.answeredCalls,
    missedCalls: user.missedCalls,
    totalDurationMinutes: user.totalDurationMinutes,
    outboundCalls: user.outboundCalls,
    answeredOutboundCalls: user.answeredOutboundCalls,
    inboundCalls: user.inboundCalls,
    answeredInboundCalls: user.answeredInboundCalls,
    inboundDurationMinutes: user.inboundDurationMinutes,
    outboundDurationMinutes: user.outboundDurationMinutes,
    callCount: user.calls ? user.calls.length : 0,
    availability: user.availability,
    error: user.error
  });

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
      
      // Debug: Log the data structure organized by category
      const organized = organizeUsersByCategory(data.users || []);
      logger.info('DEBUG: Raw activity data structure:', {
        period: data.period,
        summary: {
          totalUsers: organized.totalUsers,
          dispoCount: organized.dispoCount,
          acquisitionCount: organized.acquisitionCount,
          otherCount: organized.otherCount
        },
        dispoAgents: organized.dispoAgents.map(u => ({
          name: u.name,
          user_id: u.user_id,
          totalCalls: u.totalCalls,
          answeredCalls: u.answeredCalls,
          totalDurationMinutes: u.totalDurationMinutes
        })),
        acquisitionAgents: organized.acquisitionAgents.map(u => ({
          name: u.name,
          user_id: u.user_id,
          totalCalls: u.totalCalls,
          answeredCalls: u.answeredCalls,
          totalDurationMinutes: u.totalDurationMinutes
        }))
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
      const sanitized = sanitizeError(error, logger);
      res.status(500).json(sanitized);
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
      
      // Debug: Log the data structure organized by category
      const organized = organizeUsersByCategory(data.users || []);
      logger.info('DEBUG: Raw activity data structure:', {
        period: data.period,
        summary: {
          totalUsers: organized.totalUsers,
          dispoCount: organized.dispoCount,
          acquisitionCount: organized.acquisitionCount,
          otherCount: organized.otherCount
        },
        dispoAgents: organized.dispoAgents.map(u => ({
          name: u.name,
          user_id: u.user_id,
          totalCalls: u.totalCalls,
          answeredCalls: u.answeredCalls,
          totalDurationMinutes: u.totalDurationMinutes
        })),
        acquisitionAgents: organized.acquisitionAgents.map(u => ({
          name: u.name,
          user_id: u.user_id,
          totalCalls: u.totalCalls,
          answeredCalls: u.answeredCalls,
          totalDurationMinutes: u.totalDurationMinutes
        }))
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
      const sanitized = sanitizeError(error, logger);
      res.status(500).json(sanitized);
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
          const organized = organizeUsersByCategory(data.users || []);
          
          return res.json({
            success: true,
            data: {
              period: data.period,
              startTime: data.startTime,
              endTime: data.endTime,
              summary: {
                totalUsers: organized.totalUsers,
                dispoCount: organized.dispoCount,
                acquisitionCount: organized.acquisitionCount,
                otherCount: organized.otherCount
              },
              dispoAgents: organized.dispoAgents.map(formatUserData),
              acquisitionAgents: organized.acquisitionAgents.map(formatUserData),
              otherUsers: organized.otherUsers.map(formatUserData),
              // Keep flat users array for backward compatibility
              users: data.users ? data.users.map(formatUserData) : []
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
            
            // Debug: Log the data structure organized by category
            const organized = organizeUsersByCategory(data.users || []);
            logger.info('DEBUG: Custom report data structure:', {
              period: data.period,
              startTime: data.startTime,
              endTime: data.endTime,
              summary: {
                totalUsers: organized.totalUsers,
                dispoCount: organized.dispoCount,
                acquisitionCount: organized.acquisitionCount,
                otherCount: organized.otherCount
              },
              dispoAgents: organized.dispoAgents.map(u => ({
                name: u.name,
                user_id: u.user_id,
                totalCalls: u.totalCalls,
                answeredCalls: u.answeredCalls,
                totalDurationMinutes: u.totalDurationMinutes,
                outboundCalls: u.outboundCalls,
                inboundCalls: u.inboundCalls
              })),
              acquisitionAgents: organized.acquisitionAgents.map(u => ({
                name: u.name,
                user_id: u.user_id,
                totalCalls: u.totalCalls,
                answeredCalls: u.answeredCalls,
                totalDurationMinutes: u.totalDurationMinutes,
                outboundCalls: u.outboundCalls,
                inboundCalls: u.inboundCalls
              }))
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
      
      const organized = organizeUsersByCategory(data.users || []);
      
      // Return organized data
      res.json({
        success: true,
        data: {
          period: data.period,
          startTime: data.startTime,
          endTime: data.endTime,
          summary: {
            totalUsers: organized.totalUsers,
            dispoCount: organized.dispoCount,
            acquisitionCount: organized.acquisitionCount,
            otherCount: organized.otherCount
          },
          dispoAgents: organized.dispoAgents.map(formatUserData),
          acquisitionAgents: organized.acquisitionAgents.map(formatUserData),
          otherUsers: organized.otherUsers.map(formatUserData),
          // Keep flat users array for backward compatibility
          users: data.users ? data.users.map(formatUserData) : []
        }
      });
    } catch (error) {
      const sanitized = sanitizeError(error, logger);
      res.status(500).json(sanitized);
    }
  });

  // Debug endpoint removed for security (was accessible without authentication)

  // Removed GET /report/custom/raw in favor of returnRaw flag on POST /report/custom

  /**
   * Helper function to get current week range (Monday to Friday)
   */
  const getCurrentWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Calculate days to subtract to get to Monday
    // If today is Sunday (0), go back 6 days to get last Monday
    // If today is Monday (1), go back 0 days
    // If today is Tuesday (2), go back 1 day, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    // Get Monday of current week
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    
    // Get Friday of current week
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4); // Monday + 4 days = Friday
    friday.setHours(23, 59, 59, 999);
    
    return {
      startTime: monday,
      endTime: friday,
      startTimeISO: monday.toISOString(),
      endTimeISO: friday.toISOString()
    };
  };

  /**
   * @swagger
   * /report/weekly-avg:
   *   post:
   *     summary: Generate and send weekly average report
   *     description: Generates a weekly average report for the current week (Monday-Friday) and sends it to Slack. Calculates daily averages and checks Dispo agent KPIs.
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
  router.post('/report/weekly-avg', async (req, res) => {
    try {
      logger.info('Weekly average report triggered via API');
      
      // Get current week range (Monday to Friday)
      const weekRange = getCurrentWeekRange();
      logger.info(`Weekly report: ${weekRange.startTimeISO} to ${weekRange.endTimeISO}`);
      
      // Get data for the week
      const data = await generateReport('Weekly Average', weekRange.startTimeISO, weekRange.endTimeISO);
      
      // Calculate daily averages (5 working days: Monday-Friday)
      const workingDays = 5;
      const organized = organizeUsersByCategory(data.users || []);
      
      // Process each category and calculate averages
      const processWeeklyData = (users) => {
        return users.map(user => {
          const avgDialsPerDay = workingDays > 0 ? (user.totalCalls / workingDays) : 0;
          const avgTalkTimePerDay = workingDays > 0 ? (user.totalDurationMinutes / workingDays) : 0;
          
          return {
            ...formatUserData(user),
            weeklyTotal: {
              totalCalls: user.totalCalls,
              totalDurationMinutes: user.totalDurationMinutes,
              answeredCalls: user.answeredCalls,
              inboundCalls: user.inboundCalls || 0,
              outboundCalls: user.outboundCalls || 0
            },
            dailyAverage: {
              dialsPerDay: Math.round(avgDialsPerDay * 100) / 100,
              talkTimePerDay: Math.round(avgTalkTimePerDay * 100) / 100
            },
            workingDays: workingDays
          };
        });
      };
      
      const processedDispo = processWeeklyData(organized.dispoAgents);
      const processedAcquisition = processWeeklyData(organized.acquisitionAgents);
      const processedOther = processWeeklyData(organized.otherUsers);
      
      // Check Dispo agent KPIs (avg 60+ min talk time/day AND avg 60+ dials/day)
      const dispoKpiTalkTime = 60; // minutes per day
      const dispoKpiDials = 60; // dials per day
      
      const dispoNotMeetingKPIs = processedDispo.filter(agent => {
        return agent.dailyAverage.talkTimePerDay < dispoKpiTalkTime || 
               agent.dailyAverage.dialsPerDay < dispoKpiDials;
      });
      
      // Prepare data for Slack
      const weeklyData = {
        period: 'Weekly Average',
        startTime: weekRange.startTimeISO,
        endTime: weekRange.endTimeISO,
        workingDays: workingDays,
        summary: {
          totalUsers: organized.totalUsers,
          dispoCount: organized.dispoCount,
          acquisitionCount: organized.acquisitionCount,
          otherCount: organized.otherCount,
          dispoNotMeetingKPIs: dispoNotMeetingKPIs.length
        },
        dispoAgents: processedDispo,
        acquisitionAgents: processedAcquisition,
        otherUsers: processedOther,
        kpiThresholds: {
          dispo: {
            dialsPerDay: dispoKpiDials,
            talkTimePerDay: dispoKpiTalkTime
          }
        }
      };
      
      // Send to Slack
      const sent = await slackService.sendWeeklyAverageReport(weeklyData);
      
      if (sent) {
        logger.info('Weekly average report sent to Slack successfully');
        res.json({ 
          success: true, 
          message: 'Weekly average report sent to Slack successfully',
          data: {
            period: weeklyData.period,
            startTime: weeklyData.startTime,
            endTime: weeklyData.endTime,
            workingDays: weeklyData.workingDays,
            summary: weeklyData.summary
          }
        });
      } else {
        logger.error('Failed to send weekly average report to Slack');
        res.status(500).json({ success: false, error: 'Failed to send weekly average report to Slack' });
      }
    } catch (error) {
      const sanitized = sanitizeError(error, logger);
      res.status(500).json(sanitized);
    }
  });

  return router;
}; 