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
   * Format activity data into Slack block format
   * Updated to reflect new metrics:
   * - Total calls = Outbound calls only
   * - Total talk time = Inbound + Outbound call time
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
    
    // Create header
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📞 Call Activity Report - ${period}`
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
          text: `📊 *Outbound Summary:* ${totalOutboundCalls} calls • ${totalAnsweredOutbound} answered • ${answerRate}% answer rate`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📞 *Inbound Summary:* ${totalInboundCalls} calls • ${totalAnsweredInbound} answered • ${Math.round(totalTalkTime)} min total talk time`
        }
      },
      {
        type: 'divider'
      }
    ];
    
    // Sort users by total outbound calls (descending) for better presentation
    const sortedUsers = [...activityData.users].sort((a, b) => b.totalCalls - a.totalCalls);
    
    // Add user activity with improved formatting
    sortedUsers.forEach((user, index) => {
      const userAnswerRate = user.totalCalls > 0 ? Math.round((user.answeredCalls / user.totalCalls) * 100) : 0;
      const inboundAnswerRate = (user.inboundCalls || 0) > 0 ? Math.round(((user.answeredInboundCalls || 0) / (user.inboundCalls || 0)) * 100) : 0;
      
      const userBlock = {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*${user.name}*`
          },
          {
            type: 'mrkdwn',
            text: `📞 *${user.totalCalls}* outbound calls`
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
            text: `⏱️ *${user.totalDurationMinutes}* min total talk time`
          }
        ]
      };
      
      // Add error field if present
      if (user.error) {
        userBlock.fields.push({
          type: 'mrkdwn',
          text: `⚠️ *Error:* ${user.error}`
        });
      }
      
      blocks.push(userBlock);
      
      // Add separator between users (except for the last one)
      if (index < sortedUsers.length - 1) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '─────────────────────────────────────────'
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
        text: `📋 *Calculation Details:*\n• Total Calls = Outbound calls only\n• Total Talk Time = Inbound + Outbound call duration\n• Answer Rate = Answered outbound calls / Total outbound calls`
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
    const message = this.formatActivityMessage(activityData);
    return await this.sendMessage(message);
  }
}

module.exports = SlackService;