const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const SlackService = require('./SlackService');
const AircallService = require('./AircallService');

class ApiServer {
  constructor() {
    this.app = express();
    this.server = null;
    
    // Configure logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'api-server' },
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
    
    this.initializeConfiguration();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  /**
   * Initialize configuration from environment variables
   */
  initializeConfiguration() {
    // Load configuration from GitHub secrets (via environment variables)
    this.config = {
      aircallApiId: process.env.AIRCALL_API_ID || process.env.INPUT_AIRCALL_API_ID,
      aircallApiToken: process.env.AIRCALL_API_TOKEN || process.env.INPUT_AIRCALL_API_TOKEN,
      slackApiToken: process.env.SLACK_API_TOKEN || process.env.INPUT_SLACK_API_TOKEN,
      slackChannelId: process.env.SLACK_CHANNEL_ID || process.env.INPUT_SLACK_CHANNEL_ID,
      port: process.env.PORT || 3000
    };
    
    // Parse excluded users
    const excludedUsersEnv = process.env.EXCLUDED_USERS || process.env.INPUT_EXCLUDED_USERS || 'Joel Schrock';
    this.config.excludedUsers = excludedUsersEnv.split(',').map(name => name.trim()).filter(name => name);
    
    // Validate required environment variables
    this.validateConfiguration();
    
    // Log configuration status (without revealing sensitive values)
    this.logger.info('Configuration loaded from environment variables:');
    this.logger.info('✓ AIRCALL_API_ID:', this.config.aircallApiId ? 'configured' : 'missing');
    this.logger.info('✓ AIRCALL_API_TOKEN:', this.config.aircallApiToken ? 'configured' : 'missing');
    this.logger.info('✓ SLACK_API_TOKEN:', this.config.slackApiToken ? 'configured' : 'missing');
    this.logger.info('✓ SLACK_CHANNEL_ID:', this.config.slackChannelId ? 'configured' : 'missing');
    this.logger.info('✓ EXCLUDED_USERS:', this.config.excludedUsers.join(', '));
  }
  
  /**
   * Validate that all required configuration is present
   */
  validateConfiguration() {
    const requiredFields = ['aircallApiId', 'aircallApiToken', 'slackApiToken', 'slackChannelId'];
    const missingFields = requiredFields.filter(field => !this.config[field]);
    
    if (missingFields.length > 0) {
      const missingVars = missingFields.map(field => field.replace(/([A-Z])/g, '_$1').toUpperCase());
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }
  
  /**
   * Initialize service instances
   */
  initializeServices() {
    this.slackService = new SlackService(
      this.config.slackApiToken,
      this.config.slackChannelId
    );
    
    this.aircallService = new AircallService(
      this.config.aircallApiId,
      this.config.aircallApiToken,
      this.config.excludedUsers
    );
  }
  
  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security headers
    this.app.use(helmet());
    // Rate limiting middleware (100 requests per 15 minutes per IP)
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    });
    this.app.use(limiter);
    
    this.app.use(express.json());
    
    // Request logging middleware
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });
    
    // JWT authentication middleware (skip /health and /status)
    this.app.use((req, res, next) => {
      if (['/health', '/status'].includes(req.path)) {
        return next();
      }
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, error: 'Missing token' });
      }
      jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
          return res.status(403).json({ success: false, error: 'Invalid token' });
        }
        req.user = user;
        next();
      });
    });
    
    // Error handling middleware
    this.app.use((err, req, res, next) => {
      this.logger.error('Unhandled error:', err.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }
  
  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'aircall-slack-agent'
      });
    });
    
    // Service status endpoint
    this.app.get('/status', (req, res) => {
      res.json({
        service: 'aircall-slack-agent',
        mode: 'on-demand',
        timestamp: new Date().toISOString(),
        excludedUsers: this.config.excludedUsers,
        endpoints: {
          health: 'GET /health',
          status: 'GET /status',
          afternoonReport: 'POST /report/afternoon',
          nightReport: 'POST /report/night',
          customReport: 'POST /report/custom'
        }
      });
    });
    
    // Trigger afternoon report
    this.app.post('/report/afternoon', async (req, res) => {
      try {
        this.logger.info('Afternoon report triggered via API');
        await this.generateReport('afternoon');
        res.json({ success: true, message: 'Afternoon report sent successfully' });
      } catch (error) {
        this.logger.error('Error running afternoon report:', error.message);
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Trigger night report
    this.app.post('/report/night', async (req, res) => {
      try {
        this.logger.info('Night report triggered via API');
        await this.generateReport('night');
        res.json({ success: true, message: 'Night report sent successfully' });
      } catch (error) {
        this.logger.error('Error running night report:', error.message);
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Trigger custom report with time range
    this.app.post(
      '/report/custom',
      [
        body('startTime').exists().withMessage('startTime is required').isISO8601().withMessage('startTime must be ISO8601'),
        body('endTime').exists().withMessage('endTime is required').isISO8601().withMessage('endTime must be ISO8601'),
        body('reportName').optional().isString().trim().escape(),
      ],
      async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }
        try {
          const { startTime, endTime, reportName } = req.body;
          this.logger.info(`Custom report triggered: ${reportName || 'Custom'} from ${startTime} to ${endTime}`);
          await this.generateReport(reportName || 'Custom', startTime, endTime);
          res.json({ success: true, message: 'Custom report sent successfully' });
        } catch (error) {
          this.logger.error('Error running custom report:', error.message);
          res.status(500).json({ success: false, error: error.message });
        }
      }
    );
    
    // Test connections endpoint
    this.app.get('/test-connections', async (req, res) => {
      try {
        const slackValid = await this.slackService.validateConnection();
        const aircallValid = await this.aircallService.testConnection();
        
        res.json({
          success: slackValid && aircallValid,
          connections: {
            slack: slackValid ? 'connected' : 'failed',
            aircall: aircallValid ? 'connected' : 'failed'
          }
        });
      } catch (error) {
        this.logger.error('Error testing connections:', error.message);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }
  
  /**
   * Generate and send a report
   */
  async generateReport(reportType, customStart = null, customEnd = null) {
    try {
      // Get activity data from Aircall
      const activityData = await this.aircallService.getUserActivity(
        reportType,
        customStart,
        customEnd
      );
      
      if (!activityData) {
        throw new Error('Failed to retrieve activity data from Aircall');
      }
      
      // Send report to Slack
      const success = await this.slackService.sendActivityReport(activityData);
      
      if (!success) {
        throw new Error('Failed to send report to Slack');
      }
      
      this.logger.info(`Successfully sent ${reportType} report to Slack`);
      return true;
      
    } catch (error) {
      this.logger.error(`Error generating ${reportType} report:`, error.message);
      throw error;
    }
  }
  
  /**
   * Validate all service connections
   */
  async validateConnections() {
    try {
      const slackValid = await this.slackService.validateConnection();
      const aircallValid = await this.aircallService.testConnection();
      
      if (!slackValid) {
        throw new Error('Slack connection validation failed');
      }
      
      if (!aircallValid) {
        throw new Error('Aircall connection validation failed');
      }
      
      this.logger.info('All service connections validated successfully');
      return true;
      
    } catch (error) {
      this.logger.error('Service connection validation failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Start the API server
   */
  async start() {
    try {
      // Validate connections first
      await this.validateConnections();
      
      // Start the Express server
      this.server = this.app.listen(this.config.port, () => {
        this.logger.info(`Aircall Slack Agent API server started on port ${this.config.port}`);
        this.logger.info('Service running in ON-DEMAND mode');
        this.logger.info(`Excluded users: ${this.config.excludedUsers.join(', ')}`);
        this.logger.info('Available endpoints:');
        this.logger.info('  GET /health - Health check');
        this.logger.info('  GET /status - Service status');
        this.logger.info('  GET /test-connections - Test service connections');
        this.logger.info('  POST /report/afternoon - Trigger afternoon report');
        this.logger.info('  POST /report/night - Trigger night report');
        this.logger.info('  POST /report/custom - Trigger custom time range report');
      });
      
      return this.server;
      
    } catch (error) {
      this.logger.error('Failed to start API server:', error.message);
      throw error;
    }
  }
  
  /**
   * Stop the API server
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        this.logger.info('API server stopped');
      });
    }
  }
  
  /**
   * Get server instance for testing
   */
  getApp() {
    return this.app;
  }
}

module.exports = ApiServer;