const crypto = require('crypto');

/**
 * Sanitize error messages for production
 * Logs full error internally, returns safe message to client
 */
function sanitizeError(error, logger, options = {}) {
  const { includeDetails = false, errorId = generateErrorId() } = options;

  // Log full error internally with error ID for tracking
  logger.error('Error occurred:', {
    errorId,
    message: error.message,
    stack: error.stack,
    code: error.code,
    timestamp: new Date().toISOString()
  });

  // In production, return generic message unless explicitly allowed
  if (process.env.NODE_ENV === 'production' && !includeDetails) {
    return {
      success: false,
      error: 'An internal server error occurred. Please try again later.',
      errorId, // For support tracking
      support: 'If this persists, contact support with the error ID'
    };
  }

  // In development, include more details for debugging
  return {
    success: false,
    error: error.message,
    errorId
  };
}

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = {
  sanitizeError,
  generateErrorId
};
