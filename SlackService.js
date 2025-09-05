const axios = require('axios');
const winston = require('winston');

class SlackService {
  constructor(slackApiToken, slackChannelId) {
    this.slackApiToken = slackApiToken;
    this.slackChannelId = slackChannelId;
    this.slackBaseUrl = 'https://slack.com/api';
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'slack-service' },
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
    
    this.slackHeaders = {
      'Authorization': `Bearer ${this.slackApiToken}`,
      'Content-Type': 'application/json'
    };
    
    this.slackClient = axios.create({
      baseURL: this.slackBaseUrl,
      headers: this.slackHeaders,
      timeout: 30000
    });
  }
  
  /**
   * Validate Slack connection and permissions
   */
  async validateConnection() {
    try {
      const response = await this.slackClient.post('/auth.test');
      
      if (response.data.ok) {
        this.logger.info(`Connected to Slack as: ${response.data.user}`);
        
        // Get channel info
        const channelResponse = await this.slackClient.get('/conversations.info', {
          params: { channel: this.slackChannelId }
        });
        
        if (channelResponse.data.ok) {
          this.logger.info(`Target channel: #${channelResponse.data.channel.name}`);
          return true;
        } else {
          this.logger.error('Invalid channel ID or bot not in channel:', channelResponse.data.error);
          return false;
        }
      } else {
        this.logger.error('Slack authentication failed:', response.data.error);
        return false;
      }
    } catch (error) {
      this.logger.error('Error validating Slack connection:', error.message);
      return false;
    }
  }
  
  /**
   * Convert minutes to hours and minutes format
   */
  formatTimeInHoursAndMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    
    if (hours === 0) {
      return `${remainingMinutes}m`;
    } else if (remainingMinutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  /**
   * Calculate working days between two dates (excluding weekends)
   */
  calculateWorkingDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    
    while (start <= end) {
      const dayOfWeek = start.getDay();
      // Count Monday (1) through Friday (5) as working days
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
      start.setDate(start.getDate() + 1);
    }
    
    return workingDays;
  }

  /**
   * Format activity data into Slack block format
   * Updated to reflect new metrics:
   * - Total calls = Outbound calls only
   * - Total talk time = Inbound + Outbound connected call time only
   */
  formatActivityMessage(activityData) {
    const period = activityData.period.charAt(0).toUpperCase() + activityData.period.slice(1);
    const startTime = new Date(activityData.startTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const endTime = new Date(activityData.endTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Calculate summary statistics (outbound calls only)
    const totalOutboundCalls = activityData.users.reduce((sum, user) => sum + user.totalCalls, 0);
    const totalAnsweredOutbound = activityData.users.reduce((sum, user) => sum + user.answeredCalls, 0);
    const totalTalkTime = activityData.users.reduce((sum, user) => sum + user.totalDurationMinutes, 0);
    const answerRate = totalOutboundCalls > 0 ? Math.round((totalAnsweredOutbound / totalOutboundCalls) * 100) : 0;
    
    // Additional summary for inbound calls
    const totalInboundCalls = activityData.users.reduce((sum, user) => sum + (user.inboundCalls || 0), 0);
    const totalAnsweredInbound = activityData.users.reduce((sum, user) => sum + (user.answeredInboundCalls || 0), 0);
    
    // Calculate working days and average daily talk time
    const workingDays = this.calculateWorkingDays(activityData.startTime, activityData.endTime);
    const avgDailyTalkTime = workingDays > 0 ? totalTalkTime / workingDays : 0;
    
    // Create header with custom title for Daily reports
    const reportTitle = period === 'Daily' ? 'End of Day Report' : period;
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📊 Call Activity Report - ${reportTitle}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📅 *Reporting Period:* ${startTime} - ${endTime}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📤 *Outbound Summary:* ${totalOutboundCalls} calls • ${totalAnsweredOutbound} answered • ${answerRate}% answer rate`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📥 *Inbound Summary:* ${totalInboundCalls} calls • ${totalAnsweredInbound} answered • ${this.formatTimeInHoursAndMinutes(totalTalkTime)} total talk time`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📊 *Period Analysis:* ${workingDays} working days • ${this.formatTimeInHoursAndMinutes(avgDailyTalkTime)} avg daily talk time`
        }
      },
      {
        type: 'divider'
      }
    ];
    
    // Sort users by total outbound calls (descending) for better presentation
    const sortedUsers = [...activityData.users].sort((a, b) => b.totalCalls - a.totalCalls);
    
    // Add KPI summary for end of day report
    if (period === 'Daily') {
      const kpiOutboundCalls = 80; // Updated to 80 outbound calls
      const kpiTalkTimeMinutes = 120; // 2 hours
      
      // New KPI logic: Only flag if under 2 hours AND under 80 outbound calls
      const usersNotMeetingKPIs = sortedUsers.filter(user => {
        const hasEnoughTalkTime = user.totalDurationMinutes >= kpiTalkTimeMinutes;
        const hasEnoughOutboundCalls = user.totalCalls >= kpiOutboundCalls;
        
        // Flag only if BOTH conditions are not met (under 2 hours AND under 80 calls)
        return !hasEnoughTalkTime && !hasEnoughOutboundCalls;
      });
      
      if (usersNotMeetingKPIs.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🚨 *KPI Alert:* ${usersNotMeetingKPIs.length} user(s) have not met daily KPIs (80 outbound calls AND 2 hours talk time)`
          }
        });
        
        const kpiAlertText = usersNotMeetingKPIs.map(user => {
          const outboundDeficit = Math.max(0, kpiOutboundCalls - user.totalCalls);
          const talkTimeDeficit = Math.max(0, kpiTalkTimeMinutes - user.totalDurationMinutes);
          return `🔸 *${user.name}*: ${outboundDeficit} more calls, ${talkTimeDeficit} more minutes needed`;
        }).join('\n');
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: kpiAlertText
          }
        });
        
        blocks.push({
          type: 'divider'
        });
      }
    }
    
    // Add user activity with improved formatting
    sortedUsers.forEach((user, index) => {
      const userAnswerRate = user.totalCalls > 0 ? Math.round((user.answeredCalls / user.totalCalls) * 100) : 0;
      const inboundAnswerRate = (user.inboundCalls || 0) > 0 ? Math.round(((user.answeredInboundCalls || 0) / (user.inboundCalls || 0)) * 100) : 0;
      const userAvgDailyTalkTime = workingDays > 0 ? user.totalDurationMinutes / workingDays : 0;
      
      // Log individual user data for debugging
      this.logger.info(`SlackService: Processing user ${index + 1}/${sortedUsers.length}:`, {
        name: user.name,
        totalCalls: user.totalCalls,
        answeredCalls: user.answeredCalls,
        inboundCalls: user.inboundCalls || 0,
        answeredInboundCalls: user.answeredInboundCalls || 0,
        totalDurationMinutes: user.totalDurationMinutes
      });
      
      // Check KPI requirements for end of day report
      const kpiOutboundCalls = 80; // Updated to 80 outbound calls
      const kpiTalkTimeMinutes = 120; // 2 hours
      
      // New KPI logic: Only flag if under 2 hours AND under 80 outbound calls
      const hasEnoughTalkTime = user.totalDurationMinutes >= kpiTalkTimeMinutes;
      const hasEnoughOutboundCalls = user.totalCalls >= kpiOutboundCalls;
      const meetsKPIs = hasEnoughTalkTime || hasEnoughOutboundCalls; // Pass if EITHER condition is met
      
      // Create KPI status indicators
      const outboundStatus = hasEnoughOutboundCalls ? '✅' : '❌';
      const talkTimeStatus = hasEnoughTalkTime ? '✅' : '❌';
      const overallStatus = meetsKPIs ? '✅' : '❌';
      
      // Add KPI flagging for end of day report with improved formatting
      let kpiText = '';
      if (period === 'Daily') {
        kpiText = `\n${overallStatus} *KPI Status:* ${outboundStatus} Outbound (${user.totalCalls}/${kpiOutboundCalls}) | ${talkTimeStatus} Talk Time (${user.totalDurationMinutes}/${kpiTalkTimeMinutes} min)`;
      }
      
      const userBlock = {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*${user.name}*`
          },
          {
            type: 'mrkdwn',
            text: `📤 *${user.totalCalls}* outbound calls`
          },
          {
            type: 'mrkdwn',
            text: `✅ *${user.answeredCalls}* answered (${userAnswerRate}%)`
          },
          {
            type: 'mrkdwn',
            text: `📥 *${user.inboundCalls || 0}* inbound calls`
          },
          {
            type: 'mrkdwn',
            text: `📞 *${user.answeredInboundCalls || 0}* inbound answered (${inboundAnswerRate}%)`
          },
          {
            type: 'mrkdwn',
            text: `⏰ *${this.formatTimeInHoursAndMinutes(user.totalDurationMinutes)}* total talk time`
          },
          {
            type: 'mrkdwn',
            text: `📊 *${this.formatTimeInHoursAndMinutes(userAvgDailyTalkTime)}* avg daily talk time`
          }
        ]
      };
      
      // Add error field if present
      if (user.error) {
        userBlock.fields.push({
          type: 'mrkdwn',
          text: `❌ *Error:* ${user.error}`
        });
      }
      
      blocks.push(userBlock);
      
      // Add KPI status section for end of day report
      if (period === 'Daily') {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `${overallStatus} *KPI Status:* ${outboundStatus} Outbound (${user.totalCalls}/${kpiOutboundCalls}) | ${talkTimeStatus} Talk Time (${user.totalDurationMinutes}/${kpiTalkTimeMinutes} min)`
            }
          ]
        });
      }
      
      // Add separator between users (except for the last one)
      if (index < sortedUsers.length - 1) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            }
          ]
        });
      }
    });
    
    // Add detailed breakdown section
    blocks.push({
      type: 'divider'
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📋 *Calculation Details:*\n• Total Calls = Outbound calls only\n• Total Talk Time = Inbound + Outbound connected call duration only\n• Answer Rate = Answered outbound calls / Total outbound calls`
      }
    });
    
    // Add footer with timestamp
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📊 Report generated on ${new Date().toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}`
        }
      ]
    });
    
    return {
      blocks,
      text: `Call Activity Report - ${period} | ${totalOutboundCalls} outbound calls, ${totalAnsweredOutbound} answered (${answerRate}%), ${totalInboundCalls} inbound calls`
    };
  }
  
  /**
   * Send message to Slack channel
   */
  async sendMessage(message) {
    try {
      const payload = {
        channel: this.slackChannelId,
        blocks: message.blocks,
        text: message.text
      };
      
      const response = await this.slackClient.post('/chat.postMessage', payload);
      
      if (response.data.ok) {
        this.logger.info('Successfully sent message to Slack');
        return true;
      } else {
        this.logger.error('Slack API error:', response.data.error);
        return false;
      }
    } catch (error) {
      this.logger.error('Error sending to Slack:', error.message);
      if (error.response) {
        this.logger.error('Slack API response:', error.response.data);
      }
      return false;
    }
  }
  
  /**
   * Send activity report to Slack
   */
  async sendActivityReport(activityData) {
    // Log the data structure for debugging
    this.logger.info('SlackService: Activity data structure:', {
      period: activityData.period,
      startTime: activityData.startTime,
      endTime: activityData.endTime,
      userCount: activityData.users ? activityData.users.length : 0,
      users: activityData.users ? activityData.users.map(u => ({
        name: u.name,
        totalCalls: u.totalCalls,
        answeredCalls: u.answeredCalls,
        totalDurationMinutes: u.totalDurationMinutes
      })) : []
    });
    
    const message = this.formatActivityMessage(activityData);
    
    // Log the formatted message structure
    this.logger.info('SlackService: Formatted message structure:', {
      blockCount: message.blocks ? message.blocks.length : 0,
      userBlocks: message.blocks ? message.blocks.filter(b => b.type === 'section' && b.fields).length : 0
    });
    
    return await this.sendMessage(message);
  }
}

module.exports = SlackService;