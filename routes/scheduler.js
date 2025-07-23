const express = require('express');
const { body, validationResult } = require('express-validator');

module.exports = function(logger, reportScheduler) {
  const router = express.Router();

  /**
   * Get scheduler status
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
   * Start the scheduler
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
   * Stop the scheduler
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
   * Manually trigger afternoon report
   */
  router.post('/scheduler/trigger/afternoon', async (req, res) => {
    try {
      logger.info('Manual afternoon report trigger requested');
      await reportScheduler.triggerAfternoonReport();
      res.json({
        success: true,
        message: 'Afternoon report triggered successfully'
      });
    } catch (error) {
      logger.error('Error triggering afternoon report:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Manually trigger night report
   */
  router.post('/scheduler/trigger/night', async (req, res) => {
    try {
      logger.info('Manual night report trigger requested');
      await reportScheduler.triggerNightReport();
      res.json({
        success: true,
        message: 'Night report triggered successfully'
      });
    } catch (error) {
      logger.error('Error triggering night report:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Get next scheduled run times
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