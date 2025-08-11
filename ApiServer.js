const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const winston = require('winston');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');
const monitoring = require('./monitoring');
const SlackService = require('./SlackService');
const AircallService = require('./AircallService');
const healthRouter = require('./routes/health');
const reportRouter = require('./routes/report');
const testConnectionsRouter = require('./routes/testConnections');
const mongoose = require('mongoose');

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
      port: process.env.PORT || 6000
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

    // Removed: Initialize report scheduler
    // Removed: const baseUrl = `http://0.0.0.0:${this.config.port}`;
    // Removed: this.reportScheduler = new ReportScheduler(baseUrl, this.logger);
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
    
    // Monitoring middleware (must be before other middleware to capture all requests)
    this.app.use(monitoring.prometheusMiddlewareConfig);
    this.app.use(monitoring.customMetricsMiddleware);
    
    // Request logging middleware
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });
    
    // JWT authentication middleware (skip /health, /status, debug endpoints, and scheduler endpoints)
    this.app.use((req, res, next) => {
      if (['/health', '/status'].includes(req.path) || 
          req.path.startsWith('/debug/')) {
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
    // Swagger documentation
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Aircall Slack Agent API Documentation'
    }));
    
    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', monitoring.register.contentType);
        res.end(await monitoring.register.metrics());
      } catch (err) {
        res.status(500).end(err);
      }
    });
    
    // API routes
    this.app.use(healthRouter(this.logger, this.config));
    this.app.use(reportRouter(this.logger, this.generateReport.bind(this), this.slackService));
    this.app.use(testConnectionsRouter(this.logger, this.slackService, this.aircallService));
    // Removed: this.app.use(schedulerRouter(this.logger, this.reportScheduler, this.generateReport.bind(this), this.slackService));
  }
  
  /**
   * Generate and send a report
   */
  async generateReport(reportType, customStart = null, customEnd = null) {
    const startTime = Date.now();
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
      
      const duration = (Date.now() - startTime) / 1000;
      monitoring.recordReportGeneration(reportType, duration, 'success');
      
      return activityData;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      monitoring.recordReportGeneration(reportType, duration, 'error');
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
      // Try to validate connections, but don't fail if they don't work
      try {
        await this.validateConnections();
        this.logger.info('All service connections validated successfully');
      } catch (validationError) {
        this.logger.warn('Service connection validation failed, but continuing startup:', validationError.message);
        this.logger.warn('The service will start but some features may not work without valid credentials');
      }
      
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
        this.logger.info('  GET /api-docs - API documentation');
        this.logger.info('  GET /metrics - Prometheus metrics');
        
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
    // Stop the report scheduler
    // Removed: if (this.reportScheduler) {
    // Removed:   this.reportScheduler.stop();
    // Removed: }
    
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