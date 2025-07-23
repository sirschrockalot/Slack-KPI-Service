const cron = require('node-cron');
const axios = require('axios');
const winston = require('winston');

class ReportScheduler {
  constructor(baseUrl, logger) {
    this.baseUrl = baseUrl;
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'report-scheduler' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
    
    this.afternoonJob = null;
    this.nightJob = null;
  }

  /**
   * Start the scheduler
   */
  start() {
    this.logger.info('Starting report scheduler...');
    
    // Schedule afternoon report: Weekdays at 1:01 PM CST (19:01 UTC)
    this.afternoonJob = cron.schedule('1 19 * * 1-5', () => {
      this.runAfternoonReport();
    }, {
      timezone: 'America/Chicago'
    });
    
    // Schedule night report: Weekdays at 6:30 PM CST (00:30 UTC next day)
    this.nightJob = cron.schedule('30 0 * * 2-6', () => {
      this.runNightReport();
    }, {
      timezone: 'America/Chicago'
    });
    
    this.logger.info('Report scheduler started successfully');
    this.logger.info('Afternoon report scheduled: Weekdays at 1:01 PM CST');
    this.logger.info('Night report scheduled: Weekdays at 6:30 PM CST');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.afternoonJob) {
      this.afternoonJob.stop();
      this.logger.info('Afternoon report job stopped');
    }
    
    if (this.nightJob) {
      this.nightJob.stop();
      this.logger.info('Night report job stopped');
    }
    
    this.logger.info('Report scheduler stopped');
  }

  /**
   * Run the afternoon report
   */
  async runAfternoonReport() {
    try {
      this.logger.info('🕐 Running scheduled afternoon report...');
      
      const response = await axios.post(`${this.baseUrl}/report/afternoon`, {}, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        this.logger.info('✅ Afternoon report completed successfully');
      } else {
        this.logger.error('❌ Afternoon report failed:', response.data.error);
      }
      
    } catch (error) {
      this.logger.error('❌ Error running afternoon report:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
  }

  /**
   * Run the night report
   */
  async runNightReport() {
    try {
      this.logger.info('🌙 Running scheduled night report...');
      
      const response = await axios.post(`${this.baseUrl}/report/night`, {}, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        this.logger.info('✅ Night report completed successfully');
      } else {
        this.logger.error('❌ Night report failed:', response.data.error);
      }
      
    } catch (error) {
      this.logger.error('❌ Error running night report:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: !!(this.afternoonJob && this.nightJob),
      afternoonJob: {
        scheduled: !!this.afternoonJob,
        nextRun: this.afternoonJob ? this.afternoonJob.nextDate().toISOString() : null
      },
      nightJob: {
        scheduled: !!this.nightJob,
        nextRun: this.nightJob ? this.nightJob.nextDate().toISOString() : null
      }
    };
  }

  /**
   * Manually trigger afternoon report
   */
  async triggerAfternoonReport() {
    this.logger.info('🔄 Manually triggering afternoon report...');
    await this.runAfternoonReport();
  }

  /**
   * Manually trigger night report
   */
  async triggerNightReport() {
    this.logger.info('🔄 Manually triggering night report...');
    await this.runNightReport();
  }
}

module.exports = ReportScheduler; 