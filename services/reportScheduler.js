const cron = require('node-cron');
const axios = require('axios');
const winston = require('winston');

class ReportScheduler {
  constructor(baseUrl, logger, reportGenerator = null) {
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
    
    this.reportGenerator = reportGenerator;
    this.afternoonJob = null;
    this.nightJob = null;
  }

  /**
   * Start the scheduler
   */
  start() {
    this.logger.info('Starting report scheduler...');
    
    // Schedule afternoon report: Weekdays at 1:01 PM local time
    this.afternoonJob = cron.schedule('1 13 * * 1-5', () => {
      this.runAfternoonReport();
    });
    
    // Schedule night report: Weekdays at 6:30 PM local time
    this.nightJob = cron.schedule('30 18 * * 1-5', () => {
      this.runNightReport();
    });
    
    this.logger.info('Report scheduler started successfully');
    this.logger.info('Afternoon report scheduled: Weekdays at 1:01 PM local time');
    this.logger.info('Night report scheduled: Weekdays at 6:30 PM local time');
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
      
      if (this.reportGenerator) {
        // Use direct report generator if available
        await this.reportGenerator('afternoon');
        this.logger.info('✅ Afternoon report completed successfully');
      } else {
        // Use scheduler trigger endpoint
        const response = await axios.post(`${this.baseUrl}/scheduler/trigger/afternoon`, {}, {
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
      
      if (this.reportGenerator) {
        // Use direct report generator if available
        await this.reportGenerator('night');
        this.logger.info('✅ Night report completed successfully');
      } else {
        // Use scheduler trigger endpoint
        const response = await axios.post(`${this.baseUrl}/scheduler/trigger/night`, {}, {
          timeout: 10000, // 10s enough for 202 response; report runs in background
          headers: {
            'Content-Type': 'application/json'
          }
        });
        const accepted = response.status === 202;
        if (response.data.success || accepted) {
          this.logger.info(accepted ? '✅ Night report started (running in background)' : '✅ Night report completed successfully');
        } else {
          this.logger.error('❌ Night report failed:', response.data.error);
        }
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
        nextRun: this.afternoonJob ? this.getNextRunTime('1 13 * * 1-5', 'America/Chicago') : null
      },
      nightJob: {
        scheduled: !!this.nightJob,
        nextRun: this.nightJob ? this.getNextRunTime('30 18 * * 1-5', 'America/Chicago') : null
      }
    };
  }

  /**
   * Calculate next run time for a cron expression
   */
  getNextRunTime(cronExpression, timezone) {
    try {
      // Use local timezone for calculations
      if (cronExpression === '1 13 * * 1-5') {
        // Afternoon report: Weekdays at 1:01 PM local time
        return this.getNextWeekdayTime(new Date(), 13, 1);
      } else if (cronExpression === '30 18 * * 1-5') {
        // Night report: Weekdays at 6:30 PM local time
        return this.getNextWeekdayTime(new Date(), 18, 30);
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error calculating next run time:', error.message, error.stack);
      return null;
    }
  }

  /**
   * Get next weekday time for a specific hour and minute in a specific timezone
   */
  getNextWeekdayTimeInTimezone(now, hour, minute, timezone) {
    try {
      // For America/Chicago timezone, use a simpler approach
      // America/Chicago is UTC-6 (CST) or UTC-5 (CDT)
      // We'll use the legacy method with proper offset calculation
      
      const nextRun = new Date(now);
      nextRun.setHours(hour, minute, 0, 0);
      
      // If the time has passed today, move to next weekday
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      // Move to next weekday if current day is weekend
      while (nextRun.getDay() === 0 || nextRun.getDay() === 6) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      // Convert to UTC for storage
      // For America/Chicago, we need to account for daylight saving time
      // Get the timezone offset for the target date
      const targetTimeString = nextRun.toLocaleString("en-US", {timeZone: timezone});
      const utcTimeString = nextRun.toLocaleString("en-US", {timeZone: "UTC"});
      
      // Calculate the offset
      const targetDate = new Date(targetTimeString);
      const utcDate = new Date(utcTimeString);
      const offsetMs = targetDate.getTime() - utcDate.getTime();
      
      // Apply the offset to get the correct UTC time
      const finalUtcTime = new Date(nextRun.getTime() - offsetMs);
      
      return finalUtcTime.toISOString();
    } catch (error) {
      this.logger.error('Error in getNextWeekdayTimeInTimezone:', error.message);
      // Fallback to legacy method
      return this.getNextWeekdayTime(now, hour, minute);
    }
  }

  /**
   * Get next weekday time for a specific hour and minute (local timezone)
   */
  getNextWeekdayTime(now, hour, minute) {
    const nextRun = new Date(now);
    nextRun.setHours(hour, minute, 0, 0);
    
    // If the time has passed today, move to next weekday
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    // Move to next weekday if current day is weekend
    while (nextRun.getDay() === 0 || nextRun.getDay() === 6) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    // Return the local time as ISO string
    return nextRun.toISOString();
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