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
const { sanitizeError } = require('./utils/errorHandler');
const { decrypt } = require('./utils/encryption');
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
    // Check if encryption is enabled
    const useEncryption = process.env.USE_ENCRYPTION === 'true';

    if (useEncryption) {
      this.logger.info('🔐 Encryption enabled - decrypting API keys from Heroku Config Vars');
      this.config = this.loadEncryptedConfiguration();
    } else {
      this.logger.info('⚠️  Encryption disabled - using plaintext API keys (not recommended for production)');
      this.config = this.loadPlaintextConfiguration();
    }
    
    // Parse excluded users
    const excludedUsersEnv = process.env.EXCLUDED_USERS || process.env.INPUT_EXCLUDED_USERS || 'Joel Schrock';
    this.config.excludedUsers = excludedUsersEnv.split(',').map(name => name.trim()).filter(name => name);

    // Parse Dispo agents
    const dispoAgentsEnv = process.env.DISPO_AGENTS || process.env.INPUT_DISPO_AGENTS || '';
    this.config.dispoAgents = dispoAgentsEnv.split(',').map(name => name.trim()).filter(name => name);

    // Parse Acquisition agents
    const acquisitionAgentsEnv = process.env.ACQUISITION_AGENTS || process.env.INPUT_ACQUISITION_AGENTS || '';
    this.config.acquisitionAgents = acquisitionAgentsEnv.split(',').map(name => name.trim()).filter(name => name);

    // Validate required environment variables
    this.validateConfiguration();

    // Log configuration status (without revealing sensitive values)
    this.logger.info('Configuration loaded from environment variables:');
    this.logger.info('✓ AIRCALL_API_ID:', this.config.aircallApiId ? 'configured' : 'missing');
    this.logger.info('✓ AIRCALL_API_TOKEN:', this.config.aircallApiToken ? 'configured' : 'missing');
    this.logger.info('✓ SLACK_API_TOKEN:', this.config.slackApiToken ? 'configured' : 'missing');
    this.logger.info('✓ SLACK_CHANNEL_ID:', this.config.slackChannelId ? 'configured' : 'missing');
    this.logger.info('✓ EXCLUDED_USERS:', this.config.excludedUsers.join(', '));
    this.logger.info('✓ DISPO_AGENTS:', this.config.dispoAgents.length > 0 ? `${this.config.dispoAgents.length} configured` : 'none');
    this.logger.info('✓ ACQUISITION_AGENTS:', this.config.acquisitionAgents.length > 0 ? `${this.config.acquisitionAgents.length} configured` : 'none');
  }

  /**
   * Load configuration using encrypted values from Heroku Config Vars
   * Decrypts using master key from GitHub Secrets (injected during deployment)
   */
  loadEncryptedConfiguration() {
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;

    if (!masterKey) {
      throw new Error('MASTER_ENCRYPTION_KEY is required when USE_ENCRYPTION=true. ' +
                      'This should be injected during deployment via GitHub Actions.');
    }

    if (masterKey.length < 32) {
      throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters long');
    }

    try {
      // SLACK_CHANNEL_ID_ENCRYPTED is optional - fall back to plaintext if not encrypted
      let slackChannelId;
      if (process.env.SLACK_CHANNEL_ID_ENCRYPTED) {
        slackChannelId = this.decryptConfig('SLACK_CHANNEL_ID_ENCRYPTED', masterKey);
      } else {
        slackChannelId = process.env.SLACK_CHANNEL_ID || process.env.INPUT_SLACK_CHANNEL_ID;
        if (slackChannelId) {
          this.logger.info('Using plaintext SLACK_CHANNEL_ID (SLACK_CHANNEL_ID_ENCRYPTED not set)');
        }
      }

      return {
        aircallApiId: this.decryptConfig('AIRCALL_API_ID_ENCRYPTED', masterKey),
        aircallApiToken: this.decryptConfig('AIRCALL_API_TOKEN_ENCRYPTED', masterKey),
        slackApiToken: this.decryptConfig('SLACK_API_TOKEN_ENCRYPTED', masterKey),
        slackChannelId: slackChannelId,
        port: process.env.PORT || 6000
      };
    } catch (error) {
      this.logger.error('Failed to decrypt configuration:', error.message);
      throw new Error('Configuration decryption failed. Check that encrypted values are valid and master key is correct.');
    }
  }

  /**
   * Load configuration using plaintext values (legacy/development mode)
   */
  loadPlaintextConfiguration() {
    return {
      aircallApiId: process.env.AIRCALL_API_ID || process.env.INPUT_AIRCALL_API_ID,
      aircallApiToken: process.env.AIRCALL_API_TOKEN || process.env.INPUT_AIRCALL_API_TOKEN,
      slackApiToken: process.env.SLACK_API_TOKEN || process.env.INPUT_SLACK_API_TOKEN,
      slackChannelId: process.env.SLACK_CHANNEL_ID || process.env.INPUT_SLACK_CHANNEL_ID,
      port: process.env.PORT || 6000
    };
  }

  /**
   * Decrypt a single config value
   */
  decryptConfig(envVarName, masterKey) {
    const encryptedValue = process.env[envVarName];

    if (!encryptedValue) {
      throw new Error(`${envVarName} is not set in environment variables`);
    }

    try {
      return decrypt(encryptedValue, masterKey);
    } catch (error) {
      throw new Error(`Failed to decrypt ${envVarName}: ${error.message}`);
    }
  }
  
  /**
   * Validate that all required configuration is present
   */
  validateConfiguration() {
    const requiredFields = ['aircallApiId', 'aircallApiToken', 'slackApiToken', 'slackChannelId'];
    const missingFields = requiredFields.filter(field => !this.config[field]);

    // Validate JWT_SECRET exists (check both versioned and non-versioned)
    const hasJwtSecret = process.env.JWT_SECRET || process.env.JWT_SECRET_V1 || process.env.JWT_SECRET_V2;
    if (!hasJwtSecret) {
      throw new Error('Missing required environment variable: JWT_SECRET (or JWT_SECRET_V1/JWT_SECRET_V2 for versioning)');
    }

    // Collect all JWT secrets for validation
    const jwtSecrets = {};
    if (process.env.JWT_SECRET) {
      jwtSecrets.primary = process.env.JWT_SECRET;
    }
    if (process.env.JWT_SECRET_V1) {
      jwtSecrets.v1 = process.env.JWT_SECRET_V1;
    }
    if (process.env.JWT_SECRET_V2) {
      jwtSecrets.v2 = process.env.JWT_SECRET_V2;
    }

    // Validate JWT_SECRET strength (minimum 32 characters for security)
    for (const [version, secret] of Object.entries(jwtSecrets)) {
      if (secret.length < 32) {
        throw new Error(`JWT_SECRET${version !== 'primary' ? '_' + version.toUpperCase() : ''} must be at least 32 characters long for security`);
      }
    }

    if (missingFields.length > 0) {
      const missingVars = missingFields.map(field => field.replace(/([A-Z])/g, '_$1').toUpperCase());
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Log JWT configuration status
    const activeVersion = process.env.JWT_ACTIVE_VERSION || 'primary';
    if (Object.keys(jwtSecrets).length > 1) {
      this.logger.info(`✓ JWT Versioning: ${Object.keys(jwtSecrets).length} secrets configured (active: ${activeVersion})`);
      Object.keys(jwtSecrets).forEach(version => {
        const deprecatedDate = process.env[`JWT_DEPRECATED_DATE_${version.toUpperCase()}`];
        if (deprecatedDate) {
          this.logger.info(`  - ${version}: configured (deprecated: ${deprecatedDate})`);
        } else {
          this.logger.info(`  - ${version}: configured`);
        }
      });
    } else {
      this.logger.info('✓ JWT_SECRET: configured and validated');
    }
  }
  
  /**
   * Initialize service instances
   */
  initializeServices() {
    this.slackService = new SlackService(
      this.config.slackApiToken,
      this.config.slackChannelId,
      this.config.dispoAgents,
      this.config.acquisitionAgents
    );
    
    this.aircallService = new AircallService(
      this.config.aircallApiId,
      this.config.aircallApiToken,
      this.config.excludedUsers,
      this.config.dispoAgents,
      this.config.acquisitionAgents
    );

    // Removed: Initialize report scheduler
    // Removed: const baseUrl = `http://0.0.0.0:${this.config.port}`;
    // Removed: this.reportScheduler = new ReportScheduler(baseUrl, this.logger);
  }
  
  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // CORS configuration with environment-based allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost', 'http://localhost:3000', 'http://localhost:6000'];

    this.logger.info('✓ CORS allowed origins:', allowedOrigins.join(', '));

    this.app.use(cors({
      origin: function (origin, callback) {
        // Allow non-browser requests (curl, Postman, etc.)
        if (!origin) return callback(null, true);

        // Check if origin matches any allowed origins (exact match or with port)
        const isAllowed = allowedOrigins.some(allowedOrigin => {
          if (origin === allowedOrigin) return true;
          // Allow localhost with any port
          if (allowedOrigin === 'http://localhost' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
            return true;
          }
          if (allowedOrigin === 'https://localhost' && /^https:\/\/localhost(:\d+)?$/.test(origin)) {
            return true;
          }
          return false;
        });

        if (isAllowed) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true
    }));
    
    // Security headers with enhanced configuration
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true
      },
      frameguard: {
        action: 'deny' // Prevent clickjacking
      },
      noSniff: true, // Prevent MIME type sniffing
      xssFilter: true, // Enable XSS filter
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      }
    }));
    
    // General rate limiter for all endpoints
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many requests, please try again later' }
    });

    // Apply general limiter globally
    this.app.use(generalLimiter);
    
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
    
    // JWT authentication middleware with multi-version support (skip only public endpoints: /health, /status, /api-docs)
    this.app.use((req, res, next) => {
      // Public endpoints that don't require authentication
      const publicEndpoints = ['/health', '/status', '/api-docs'];
      const isPublicEndpoint = publicEndpoints.some(endpoint =>
        req.path === endpoint || req.path.startsWith(endpoint + '/')
      );

      if (isPublicEndpoint) {
        return next();
      }

      // All other endpoints (including /metrics) require JWT authentication
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, error: 'Missing token' });
      }

      // Build list of JWT secrets to try (supports versioning for zero-downtime rotation)
      const secrets = {};
      if (process.env.JWT_SECRET_V2) secrets.v2 = process.env.JWT_SECRET_V2;
      if (process.env.JWT_SECRET_V1) secrets.v1 = process.env.JWT_SECRET_V1;
      if (process.env.JWT_SECRET) secrets.primary = process.env.JWT_SECRET;

      // Try to verify with each active secret
      let verified = false;
      let user = null;
      let tokenVersion = null;

      for (const [version, secret] of Object.entries(secrets)) {
        // Check if this version is deprecated
        const deprecatedDate = process.env[`JWT_DEPRECATED_DATE_${version.toUpperCase()}`];
        if (deprecatedDate && new Date(deprecatedDate) < new Date()) {
          this.logger.debug(`Skipping deprecated JWT version ${version} (deprecated: ${deprecatedDate})`);
          continue; // Skip deprecated versions
        }

        try {
          user = jwt.verify(token, secret);
          verified = true;
          tokenVersion = version;
          break;
        } catch (err) {
          // Try next secret
          continue;
        }
      }

      if (!verified) {
        return res.status(403).json({ success: false, error: 'Invalid token' });
      }

      // Warn if using old version
      const activeVersion = process.env.JWT_ACTIVE_VERSION || 'primary';
      if (tokenVersion !== activeVersion && tokenVersion !== 'primary') {
        res.set('X-Token-Version', tokenVersion);
        res.set('X-Token-Deprecated', 'true');
        const deprecationDate = process.env[`JWT_DEPRECATED_DATE_${tokenVersion.toUpperCase()}`];
        if (deprecationDate) {
          res.set('X-Token-Migration-Deadline', deprecationDate);
        }
        this.logger.warn(`Client using deprecated token version ${tokenVersion} from ${req.ip} on ${req.path}`);
      }

      req.user = user;
      req.tokenVersion = tokenVersion;
      next();
    });
    
    // Error handling middleware
    this.app.use((err, req, res, next) => {
      const sanitized = sanitizeError(err, this.logger);
      res.status(500).json(sanitized);
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

    // Stricter rate limiter for report generation (expensive operations)
    const reportLimiter = rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 20, // Reports are expensive
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      message: { success: false, error: 'Report generation rate limit exceeded. Please wait before requesting another report.' }
    });

    // API routes
    this.app.use(healthRouter(this.logger, this.config));
    this.app.use('/report', reportLimiter); // Apply stricter limit to report endpoints
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
        this.logger.info('  Public endpoints (no auth required):');
        this.logger.info('    GET /health - Health check');
        this.logger.info('    GET /status - Service status');
        this.logger.info('    GET /api-docs - API documentation');
        this.logger.info('  Protected endpoints (JWT required):');
        this.logger.info('    GET /test-connections - Test service connections');
        this.logger.info('    POST /report/afternoon - Trigger afternoon report');
        this.logger.info('    POST /report/night - Trigger night report');
        this.logger.info('    POST /report/custom - Trigger custom time range report');
        this.logger.info('    GET /metrics - Prometheus metrics (requires JWT)');

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