const axios = require('axios');
const winston = require('winston');
const { Buffer } = require('buffer');

class AircallService {
  constructor(aircallApiId, aircallApiToken, excludedUsers = []) {
    this.aircallApiId = aircallApiId;
    this.aircallApiToken = aircallApiToken;
    this.excludedUsers = excludedUsers;
    this.aircallBaseUrl = 'https://api.aircall.io/v1';
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'aircall-service' },
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
    
    this.aircallHeaders = {
      'Authorization': `Basic ${this.encodeCredentials()}`,
      'Content-Type': 'application/json'
    };
    
    this.aircallClient = axios.create({
      baseURL: this.aircallBaseUrl,
      headers: this.aircallHeaders,
      timeout: 30000
    });
  }
  
  /**
   * Encode API credentials for Basic Auth
   */
  encodeCredentials() {
    const credentials = `${this.aircallApiId}:${this.aircallApiToken}`;
    return Buffer.from(credentials).toString('base64');
  }
  
  /**
   * Check if user should be excluded from reports
   */
  isUserExcluded(userName) {
    return this.excludedUsers.some(excludedName => 
      userName.toLowerCase().includes(excludedName.toLowerCase()) ||
      excludedName.toLowerCase().includes(userName.toLowerCase())
    );
  }
  
  /**
   * Get all users from Aircall
   */
  async getUsers() {
    try {
      const response = await this.aircallClient.get('/users');
      const allUsers = response.data.users || [];
      
      // Filter out excluded users
      const users = allUsers.filter(user => {
        const isExcluded = this.isUserExcluded(user.name);
        if (isExcluded) {
          this.logger.info(`Excluding user from report: ${user.name}`);
        }
        return !isExcluded;
      });
      
      this.logger.info(`Retrieved ${users.length} users (${allUsers.length - users.length} excluded)`);
      return users;
    } catch (error) {
      this.logger.error('Error fetching users:', error.message);
      throw error;
    }
  }
  
  /**
   * Get calls for a specific user within a time range
   */
  async getUserCalls(userId, startTimestamp, endTimestamp) {
    try {
      let allCalls = [];
      let page = 1;
      const perPage = 50;
      let hasMore = true;
      
      while (hasMore) {
        let callsResponse;
        
        try {
          // Method 1: Try user-specific calls endpoint first
          callsResponse = await this.aircallClient.get(`/users/${userId}/calls`, {
            params: {
              from: startTimestamp,
              to: endTimestamp,
              per_page: perPage,
              page: page
            }
          });
        } catch (error) {
          // Method 2: Fallback to general calls endpoint with user_id filter
          callsResponse = await this.aircallClient.get('/calls', {
            params: {
              user_id: userId,
              from: startTimestamp,
              to: endTimestamp,
              per_page: perPage,
              page: page
            }
          });
        }
        
        const calls = callsResponse.data.calls || [];
        
        // Additional filtering to ensure calls belong to this specific user
        const userCalls = calls.filter(call => {
          return call.user && call.user.id === userId;
        });
        
        allCalls = [...allCalls, ...userCalls];
        
        // Check if there are more pages
        hasMore = calls.length === perPage;
        page++;
        
        // Safety check to prevent infinite loops
        if (page > 100) {
          this.logger.warn(`Reached maximum page limit for user ${userId}`);
          break;
        }
      }
      
      return allCalls;
    } catch (error) {
      this.logger.error(`Error fetching calls for user ${userId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Calculate time range based on period type
   */
  getTimeRange(timePeriod, customStart = null, customEnd = null) {
    const now = new Date();
    let startTime, endTime;
    
    if (customStart && customEnd) {
      startTime = new Date(customStart);
      endTime = new Date(customEnd);
    } else if (timePeriod === 'afternoon') {
      // 9AM CST to 1PM CST
      startTime = new Date(now);
      startTime.setHours(9, 0, 0, 0);
      endTime = new Date(now);
      endTime.setHours(13, 0, 0, 0);
    } else { // night
      // 1:01PM CST to 7:30PM CST
      startTime = new Date(now);
      startTime.setHours(13, 1, 0, 0);
      endTime = new Date(now);
      endTime.setHours(19, 30, 0, 0);
    }
    
    return {
      startTime,
      endTime,
      startTimestamp: Math.floor(startTime.getTime() / 1000),
      endTimestamp: Math.floor(endTime.getTime() / 1000)
    };
  }
  
  /**
   * Process call data to generate activity statistics
   * Modified to:
   * 1) Total calls = Outbound calls only
   * 2) Total talk time = (inbound call time) + (outbound call time)
   */
  processCallData(calls) {
    // Separate inbound and outbound calls
    const inboundCalls = calls.filter(call => call.direction === 'inbound');
    const outboundCalls = calls.filter(call => call.direction === 'outbound');
    
    // Total calls = Outbound calls only
    const totalCalls = outboundCalls.length;
    
    // Answered calls = Answered outbound calls only
    const answeredCalls = outboundCalls.filter(call => call.answered_at).length;
    
    // Missed calls = Outbound calls that weren't answered
    const missedCalls = totalCalls - answeredCalls;
    
    // Total talk time = (inbound call time) + (outbound call time)
    const inboundDuration = inboundCalls.reduce((sum, call) => {
      return sum + (call.duration || 0);
    }, 0);
    
    const outboundDuration = outboundCalls.reduce((sum, call) => {
      return sum + (call.duration || 0);
    }, 0);
    
    const totalDuration = inboundDuration + outboundDuration;
    
    // Additional metrics for transparency
    const inboundCount = inboundCalls.length;
    const answeredInboundCalls = inboundCalls.filter(call => call.answered_at).length;
    
    return {
      totalCalls, // Outbound calls only
      answeredCalls, // Answered outbound calls
      missedCalls, // Missed outbound calls
      totalDurationMinutes: Math.round((totalDuration / 60) * 100) / 100, // Total talk time (inbound + outbound)
      // Additional breakdown for transparency
      outboundCalls: outboundCalls.length,
      answeredOutboundCalls: answeredCalls,
      inboundCalls: inboundCount,
      answeredInboundCalls: answeredInboundCalls,
      inboundDurationMinutes: Math.round((inboundDuration / 60) * 100) / 100,
      outboundDurationMinutes: Math.round((outboundDuration / 60) * 100) / 100
    };
  }
  
  /**
   * Get user activity for a specific time period
   */
  async getUserActivity(timePeriod = 'afternoon', customStart = null, customEnd = null) {
    try {
      const timeRange = this.getTimeRange(timePeriod, customStart, customEnd);
      
      this.logger.info(`Fetching ${timePeriod} activity from ${timeRange.startTime.toISOString()} to ${timeRange.endTime.toISOString()}`);
      
      // Get all users
      const users = await this.getUsers();
      
      const activitySummary = {
        period: timePeriod,
        startTime: timeRange.startTime.toISOString(),
        endTime: timeRange.endTime.toISOString(),
        users: []
      };
      
      // Get activity for each user
      for (const user of users) {
        try {
          const calls = await this.getUserCalls(user.id, timeRange.startTimestamp, timeRange.endTimestamp);
          const callStats = this.processCallData(calls);
          
          const userActivity = {
            name: user.name,
            ...callStats,
            availability: user.availability_status || 'unknown'
          };
          
          activitySummary.users.push(userActivity);
          
          // Log detailed breakdown for debugging
          this.logger.info(`User ${user.name} activity:`, {
            totalCalls: callStats.totalCalls,
            outboundCalls: callStats.outboundCalls,
            inboundCalls: callStats.inboundCalls,
            totalTalkTime: callStats.totalDurationMinutes,
            inboundTalkTime: callStats.inboundDurationMinutes,
            outboundTalkTime: callStats.outboundDurationMinutes
          });
          
        } catch (error) {
          this.logger.error(`Error processing user ${user.name} (ID: ${user.id}):`, error.message);
          // Add user with zero activity if API call fails
          activitySummary.users.push({
            name: user.name,
            totalCalls: 0,
            answeredCalls: 0,
            missedCalls: 0,
            totalDurationMinutes: 0,
            outboundCalls: 0,
            answeredOutboundCalls: 0,
            inboundCalls: 0,
            answeredInboundCalls: 0,
            inboundDurationMinutes: 0,
            outboundDurationMinutes: 0,
            availability: user.availability_status || 'unknown',
            error: 'Failed to fetch call data'
          });
        }
      }
      
      this.logger.info(`Retrieved activity for ${activitySummary.users.length} users`);
      return activitySummary;
      
    } catch (error) {
      this.logger.error('Error fetching Aircall activity data:', error.message);
      throw error;
    }
  }
  
  /**
   * Test Aircall API connection
   */
  async testConnection() {
    try {
      const response = await this.aircallClient.get('/users');
      return response.data && response.data.users;
    } catch (error) {
      this.logger.error('Aircall connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = AircallService;