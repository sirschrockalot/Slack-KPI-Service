const ApiServer = require('./ApiServer');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure main logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'aircall-slack-agent' },
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

// Application instance
let apiServer = null;

/**
 * Initialize and start the application
 */
async function startApplication() {
  try {
    logger.info('Starting Aircall Slack Agent...');
    
    // Create API server instance
    apiServer = new ApiServer();
    
    // Start the server
    await apiServer.start();
    
    logger.info('✅ Aircall Slack Agent started successfully');
    
  } catch (error) {
    logger.error('❌ Failed to start Aircall Slack Agent:', error.message);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  const shutdown = (signal) => {
    logger.info(`🔄 Received ${signal}, shutting down gracefully...`);
    
    if (apiServer) {
      apiServer.stop();
    }
    
    // Give time for cleanup
    setTimeout(() => {
      logger.info('👋 Aircall Slack Agent stopped');
      process.exit(0);
    }, 2000);
  };
  
  // Handle various termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
}

/**
 * Handle uncaught exceptions and rejections
 */
function setupErrorHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

/**
 * Display startup banner
 */
function displayBanner() {
  const banner = `
╔════════════════════════════════════════════════════════════════╗
║                    AIRCALL SLACK AGENT                        ║
║                                                                ║
║  📞 Aircall API Integration                                    ║
║  💬 Slack Reporting Service                                    ║
║  🔄 On-Demand Report Generation                                ║
║                                                                ║
║  Ready to serve call activity reports!                        ║
╚════════════════════════════════════════════════════════════════╝
  `;
  
  console.log(banner);
}

/**
 * Main execution
 */
async function main() {
  try {
    // Display banner
    displayBanner();
    
    // Setup error handlers
    setupErrorHandlers();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Start the application
    await startApplication();
    
  } catch (error) {
    logger.error('💥 Fatal error during startup:', error.message);
    process.exit(1);
  }
}

// Export for testing purposes
module.exports = {
  startApplication,
  main
};

// Start the application if this file is run directly
if (require.main === module) {
  main();
}