#!/usr/bin/env node
/**
 * Utility script to generate JWT tokens for testing
 *
 * Usage:
 *   node utils/generateJwtToken.js
 *   node utils/generateJwtToken.js --version v2
 *   node utils/generateJwtToken.js --expiration 1h
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
let version = 'primary';
let expiration = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--version' && args[i + 1]) {
    version = args[i + 1];
    i++;
  } else if (args[i] === '--expiration' && args[i + 1]) {
    expiration = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
JWT Token Generator
===================

Usage:
  node utils/generateJwtToken.js [options]

Options:
  --version <version>      JWT secret version to use (primary, v1, v2) [default: primary or JWT_ACTIVE_VERSION]
  --expiration <duration>  Token expiration (e.g., 1h, 7d, 30d, or seconds) [default: no expiration]
  --help, -h               Show this help message

Examples:
  node utils/generateJwtToken.js
  node utils/generateJwtToken.js --version v2
  node utils/generateJwtToken.js --expiration 1h
  node utils/generateJwtToken.js --version v2 --expiration 24h

Environment Variables:
  JWT_SECRET              Primary JWT secret
  JWT_SECRET_V1           Version 1 JWT secret
  JWT_SECRET_V2           Version 2 JWT secret
  JWT_ACTIVE_VERSION      Active version to use (overrides --version if not specified)
`);
    process.exit(0);
  }
}

// Determine which secret to use
let secret;
let secretName;

// If version not explicitly set, use JWT_ACTIVE_VERSION
if (version === 'primary' && process.env.JWT_ACTIVE_VERSION) {
  version = process.env.JWT_ACTIVE_VERSION;
}

if (version === 'v1') {
  secret = process.env.JWT_SECRET_V1;
  secretName = 'JWT_SECRET_V1';
} else if (version === 'v2') {
  secret = process.env.JWT_SECRET_V2;
  secretName = 'JWT_SECRET_V2';
} else {
  secret = process.env.JWT_SECRET;
  secretName = 'JWT_SECRET';
}

// Validate secret exists
if (!secret) {
  console.error(`Error: ${secretName} not found in environment variables`);
  console.error('\nMake sure you have a .env file with the required JWT secret.');
  console.error('Generate a secret with: openssl rand -base64 32');
  process.exit(1);
}

// Validate secret strength
if (secret.length < 32) {
  console.error(`Error: ${secretName} must be at least 32 characters long`);
  process.exit(1);
}

// Generate token
const payload = {
  sub: 'test-user',
  name: 'Test User',
  version: version,
  iat: Math.floor(Date.now() / 1000)
};

const options = {};
if (expiration) {
  options.expiresIn = expiration;
}

try {
  const token = jwt.sign(payload, secret, options);

  console.log('\n========================================');
  console.log('JWT Token Generated Successfully');
  console.log('========================================\n');
  console.log(`Secret Version: ${version}`);
  console.log(`Secret Used:    ${secretName}`);
  console.log(`Expiration:     ${expiration || 'Never (no expiration set)'}`);
  console.log(`\nToken:\n`);
  console.log(token);
  console.log('\n========================================');
  console.log('Test with curl:');
  console.log('========================================\n');
  console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:6000/metrics`);
  console.log('\n');

  // Decode and display payload
  const decoded = jwt.decode(token, { complete: true });
  console.log('Decoded Token:');
  console.log(JSON.stringify(decoded, null, 2));
  console.log('\n');

} catch (err) {
  console.error('Error generating token:', err.message);
  process.exit(1);
}
