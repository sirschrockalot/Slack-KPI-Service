#!/usr/bin/env node

/**
 * Tool to verify master key and re-encrypt if needed
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const readline = require('readline');
const { encrypt, decrypt } = require('../utils/encryption');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

function promptSecret(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(question);

    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');

    let secret = '';

    const onData = (char) => {
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(secret);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f':
          if (secret.length > 0) {
            secret = secret.slice(0, -1);
            stdout.clearLine();
            stdout.cursorTo(0);
            stdout.write(question + '*'.repeat(secret.length));
          }
          break;
        default:
          secret += char;
          stdout.write('*');
          break;
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Verify and Fix Encryption Configuration               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const currentMasterKey = process.env.MASTER_ENCRYPTION_KEY;
  
  if (!currentMasterKey) {
    console.error('❌ MASTER_ENCRYPTION_KEY not found in .env.local');
    process.exit(1);
  }

  console.log('Current master key in .env.local:');
  console.log(`  ${currentMasterKey.substring(0, 20)}...${currentMasterKey.substring(currentMasterKey.length - 10)}\n`);

  console.log('The decryption is failing, which means either:');
  console.log('1. The master key doesn\'t match the one used for encryption');
  console.log('2. The encrypted values are corrupted or incomplete\n');

  const choice = await prompt('Do you want to:\n  1) Re-encrypt with the current master key (recommended)\n  2) Try a different master key\n  Enter choice (1 or 2): ');

  if (choice === '1') {
    console.log('\n📝 Re-encrypting with current master key...\n');
    console.log('Enter your PLAINTEXT API keys (they will be encrypted):\n');

    const secrets = {};

    // Aircall API ID
    const aircallApiId = await promptSecret('AIRCALL_API_ID: ');
    if (aircallApiId) {
      secrets.AIRCALL_API_ID_ENCRYPTED = encrypt(aircallApiId, currentMasterKey);
    }

    // Aircall API Token
    const aircallApiToken = await promptSecret('AIRCALL_API_TOKEN: ');
    if (aircallApiToken) {
      secrets.AIRCALL_API_TOKEN_ENCRYPTED = encrypt(aircallApiToken, currentMasterKey);
    }

    // Slack API Token
    const slackApiToken = await promptSecret('SLACK_API_TOKEN: ');
    if (slackApiToken) {
      secrets.SLACK_API_TOKEN_ENCRYPTED = encrypt(slackApiToken, currentMasterKey);
    }

    console.log('\n\n✅ Encrypted values (copy these to .env.local):\n');
    console.log('═'.repeat(64));
    for (const [key, value] of Object.entries(secrets)) {
      console.log(`${key}=${value}`);
    }
    console.log('═'.repeat(64));
    console.log('\n✅ Test decryption:\n');
    
    // Test decryption
    for (const [key, value] of Object.entries(secrets)) {
      try {
        const decrypted = decrypt(value, currentMasterKey);
        const preview = decrypted.length > 10 
          ? `${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)}`
          : '***';
        console.log(`✅ ${key}: Decrypts to ${decrypted.length} chars (${preview})`);
      } catch (error) {
        console.log(`❌ ${key}: Decryption failed - ${error.message}`);
      }
    }

  } else if (choice === '2') {
    console.log('\nEnter the master key that was used to encrypt your values:\n');
    const testMasterKey = await promptSecret('Master Key: ');

    if (!testMasterKey || testMasterKey.length < 32) {
      console.error('\n❌ Master key must be at least 32 characters');
      process.exit(1);
    }

    console.log('\nTesting decryption with this master key...\n');

    const encryptedVars = [
      { name: 'AIRCALL_API_ID_ENCRYPTED', displayName: 'Aircall API ID' },
      { name: 'AIRCALL_API_TOKEN_ENCRYPTED', displayName: 'Aircall API Token' },
      { name: 'SLACK_API_TOKEN_ENCRYPTED', displayName: 'Slack API Token' }
    ];

    let allPassed = true;
    for (const { name, displayName } of encryptedVars) {
      const encryptedValue = process.env[name];
      if (!encryptedValue) {
        console.log(`⚠️  ${displayName}: Not set`);
        continue;
      }

      try {
        const decrypted = decrypt(encryptedValue, testMasterKey);
        const preview = decrypted.length > 10 
          ? `${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)}`
          : '***';
        console.log(`✅ ${displayName}: Decrypted successfully (${preview})`);
      } catch (error) {
        console.log(`❌ ${displayName}: Failed - ${error.message}`);
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log('\n✅ This master key works! Update MASTER_ENCRYPTION_KEY in .env.local');
      console.log(`   MASTER_ENCRYPTION_KEY=${testMasterKey}`);
    } else {
      console.log('\n❌ This master key doesn\'t work. The encrypted values may be corrupted.');
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
