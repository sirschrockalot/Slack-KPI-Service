#!/usr/bin/env node

/**
 * Test script to verify encryption/decryption works locally
 * 
 * Usage:
 *   node scripts/test-encryption-local.js
 * 
 * This will:
 * 1. Load .env.local
 * 2. Test decrypting all encrypted values
 * 3. Verify they're not empty
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { decrypt } = require('../utils/encryption');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║         Testing Encryption Configuration Locally             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Check if encryption is enabled
const useEncryption = process.env.USE_ENCRYPTION === 'true';

if (!useEncryption) {
  console.log('⚠️  USE_ENCRYPTION is not set to "true"');
  console.log('   Encryption is disabled. Set USE_ENCRYPTION=true in .env.local\n');
  process.exit(1);
}

console.log('✅ Encryption is enabled\n');

// Check for master key
const masterKey = process.env.MASTER_ENCRYPTION_KEY;

if (!masterKey) {
  console.error('❌ MASTER_ENCRYPTION_KEY is not set in .env.local');
  console.error('   Add: MASTER_ENCRYPTION_KEY=your-master-key\n');
  process.exit(1);
}

if (masterKey.length < 32) {
  console.error('❌ MASTER_ENCRYPTION_KEY must be at least 32 characters long');
  console.error(`   Current length: ${masterKey.length}\n`);
  process.exit(1);
}

console.log('✅ Master encryption key found\n');

// Test decrypting each encrypted value
const encryptedVars = [
  { name: 'AIRCALL_API_ID_ENCRYPTED', displayName: 'Aircall API ID' },
  { name: 'AIRCALL_API_TOKEN_ENCRYPTED', displayName: 'Aircall API Token' },
  { name: 'SLACK_API_TOKEN_ENCRYPTED', displayName: 'Slack API Token' },
  { name: 'SLACK_CHANNEL_ID_ENCRYPTED', displayName: 'Slack Channel ID (optional)' }
];

let allPassed = true;

console.log('Testing decryption...\n');

for (const { name, displayName } of encryptedVars) {
  const encryptedValue = process.env[name];
  
  if (!encryptedValue) {
    if (name === 'SLACK_CHANNEL_ID_ENCRYPTED') {
      console.log(`⚠️  ${displayName}: Not set (optional, can use plaintext SLACK_CHANNEL_ID)`);
      continue;
    }
    console.error(`❌ ${displayName}: Not set in .env.local`);
    console.error(`   Add: ${name}=your-encrypted-value\n`);
    allPassed = false;
    continue;
  }

  try {
    const decrypted = decrypt(encryptedValue, masterKey);
    
    if (!decrypted || decrypted.length === 0) {
      console.error(`❌ ${displayName}: Decrypted to empty value`);
      allPassed = false;
    } else {
      // Show first/last few chars for verification (don't show full key)
      const preview = decrypted.length > 10 
        ? `${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)}`
        : '***';
      console.log(`✅ ${displayName}: Decrypted successfully (${decrypted.length} chars, preview: ${preview})`);
    }
  } catch (error) {
    console.error(`❌ ${displayName}: Decryption failed`);
    console.error(`   Error: ${error.message}`);
    allPassed = false;
  }
}

// Check JWT_SECRET
console.log('\nChecking JWT_SECRET...\n');
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  console.error('❌ JWT_SECRET is not set in .env.local');
  allPassed = false;
} else if (jwtSecret.length < 32) {
  console.error(`❌ JWT_SECRET must be at least 32 characters long (current: ${jwtSecret.length})`);
  allPassed = false;
} else {
  console.log(`✅ JWT_SECRET: Configured (${jwtSecret.length} characters)`);
}

// Summary
console.log('\n' + '═'.repeat(64) + '\n');

if (allPassed) {
  console.log('✅ All encryption tests passed!');
  console.log('   You can now start the server with: npm start\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Please fix the issues above before starting the server.\n');
  process.exit(1);
}
