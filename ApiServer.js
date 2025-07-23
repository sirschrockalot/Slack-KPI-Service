const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const winston = require('winston');
const SlackService = require('./SlackService');
const AircallService = require('./AircallService');
const healthRouter = require('./routes/health');
const reportRouter = require('./routes/report');
const testConnectionsRouter = require('./routes/testConnections');
const aircallDataCronJobRouter = require('./routes/aircallDataCronJob');
const mongoose = require('mongoose');
const cron = require('node-cron');
const HourlySyncService = require('./services/syncAircallHourly');
const AggregateStatsService = require('./services/aggregateStats');
const hourlyCallStatsRouter = require('./routes/hourlyCallStats');

class ApiServer {
  constructor() {
    this.app = express();
    this.server = null;
    
    // Connect to MongoDB
    mongoose.connect(process.env.MONGODB_URI)
      .then(() => console.log('MongoDB connected'))
      .catch(err => console.error('MongoDB connection error:', err));
    
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

    this.hourlySyncService = new HourlySyncService(this.aircallService, this.logger);
  }
  
  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // CORS configuration to allow localhost
    this.app.use(cors({
      origin: function (origin, callback) {
        console.log('CORS request from origin:', origin);
        if (!origin) return callback(null, true); // allow non-browser requests
        if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true
    }));
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
    
    // JWT authentication middleware (skip /health, /status, and debug endpoints)
    this.app.use((req, res, next) => {
      if (['/health', '/status'].includes(req.path) || req.path.startsWith('/debug/')) {
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
    this.app.use(healthRouter(this.logger, this.config));
    this.app.use(reportRouter(this.logger, this.generateReport.bind(this), this.slackService));
    this.app.use(aircallDataCronJobRouter(this.logger, this.generateReport.bind(this)));
    this.app.use(hourlyCallStatsRouter(this.logger));
    this.app.use(testConnectionsRouter(this.logger, this.slackService, this.aircallService));
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
      
      return activityData;
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
      
      // Schedule hourly sync job
      cron.schedule('0 * * * *', () => {
        this.logger.info('Triggering hourly Aircall data sync...');
        this.hourlySyncService.syncCatchUp();
      });

      // Start the Express server
      this.server = this.app.listen(this.config.port, '0.0.0.0', () => {
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
        // Trigger catch-up sync immediately on startup
        this.logger.info('Triggering catch-up sync on startup...');
        this.hourlySyncService.syncCatchUp();
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