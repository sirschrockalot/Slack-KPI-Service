#!/usr/bin/env node

/**
 * Diagnostic script to check encrypted value format
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              Encryption Diagnostic Tool                       ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const encryptedVars = [
  'AIRCALL_API_ID_ENCRYPTED',
  'AIRCALL_API_TOKEN_ENCRYPTED',
  'SLACK_API_TOKEN_ENCRYPTED',
  'SLACK_CHANNEL_ID_ENCRYPTED'
];

console.log('Checking encrypted value formats...\n');

for (const varName of encryptedVars) {
  const value = process.env[varName];
  
  if (!value) {
    console.log(`⚠️  ${varName}: Not set\n`);
    continue;
  }

  console.log(`${varName}:`);
  console.log(`  Length: ${value.length} characters`);
  console.log(`  First 50 chars: ${value.substring(0, 50)}...`);
  console.log(`  Last 50 chars: ...${value.substring(value.length - 50)}`);
  
  // Check format (should be salt:iv:authTag:ciphertext)
  const parts = value.split(':');
  console.log(`  Parts (split by ':'): ${parts.length}`);
  
  if (parts.length !== 4) {
    console.log(`  ❌ ERROR: Expected 4 parts (salt:iv:authTag:ciphertext), got ${parts.length}`);
    console.log(`     This suggests the value is not in the correct encrypted format.\n`);
  } else {
    console.log(`  ✅ Format looks correct (4 parts)`);
    console.log(`     Part 1 (salt) length: ${parts[0].length}`);
    console.log(`     Part 2 (iv) length: ${parts[1].length}`);
    console.log(`     Part 3 (authTag) length: ${parts[2].length}`);
    console.log(`     Part 4 (ciphertext) length: ${parts[3].length}`);
    
    // Check if parts are valid hex
    const hexRegex = /^[0-9a-fA-F]+$/;
    const allHex = parts.every(part => hexRegex.test(part));
    
    if (allHex) {
      console.log(`  ✅ All parts are valid hex strings`);
    } else {
      console.log(`  ❌ ERROR: Some parts are not valid hex strings`);
      console.log(`     Encrypted values should only contain hex characters (0-9, a-f, A-F)`);
    }
  }
  
  // Check for common issues
  if (value.startsWith('"') && value.endsWith('"')) {
    console.log(`  ⚠️  WARNING: Value appears to have quotes around it`);
    console.log(`     Remove quotes from .env.local file`);
  }
  
  if (value.includes('\n') || value.includes('\r')) {
    console.log(`  ⚠️  WARNING: Value contains newlines`);
  }
  
  if (value.trim() !== value) {
    console.log(`  ⚠️  WARNING: Value has leading/trailing whitespace`);
  }
  
  console.log('');
}

console.log('\n' + '═'.repeat(64) + '\n');
console.log('Common Issues:\n');
console.log('1. If format is wrong (not 4 parts): The value was not encrypted correctly');
console.log('2. If not hex: The value may have extra characters or be corrupted');
console.log('3. If you see quotes: Remove quotes from .env.local');
console.log('4. If master key is wrong: Re-encrypt with the correct master key\n');
