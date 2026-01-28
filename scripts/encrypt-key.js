#!/usr/bin/env node

/**
 * Simple tool to encrypt a single API key
 * 
 * Usage:
 *   node scripts/encrypt-key.js
 * 
 * Or with arguments:
 *   MASTER_KEY="your-key" API_KEY="value-to-encrypt" node scripts/encrypt-key.js
 */

const readline = require('readline');
const { encrypt, generateMasterKey } = require('../utils/encryption');

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
  console.log('║              Single API Key Encryption Tool                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Check if values provided via environment variables
  let masterKey = process.env.MASTER_KEY;
  let apiKey = process.env.API_KEY;

  // Get master key
  if (!masterKey) {
    const hasKey = await prompt('Do you have a MASTER_ENCRYPTION_KEY? (yes/no): ');
    
    if (hasKey.toLowerCase() === 'yes' || hasKey.toLowerCase() === 'y') {
      masterKey = await promptSecret('Enter your MASTER_ENCRYPTION_KEY: ');
    } else {
      console.log('\nGenerating a new master encryption key...');
      masterKey = generateMasterKey();
      console.log('\n🔑 Your new MASTER_ENCRYPTION_KEY:');
      console.log('════════════════════════════════════════════════════════════════');
      console.log(masterKey);
      console.log('════════════════════════════════════════════════════════════════');
      console.log('\n⚠️  IMPORTANT: Save this key securely!\n');
    }
  }

  if (!masterKey || masterKey.length < 32) {
    console.error('\n❌ Error: Master key must be at least 32 characters long');
    process.exit(1);
  }

  // Get API key to encrypt
  if (!apiKey) {
    apiKey = await promptSecret('\nEnter the API key to encrypt: ');
  }

  if (!apiKey) {
    console.error('\n❌ Error: No API key provided');
    process.exit(1);
  }

  try {
    // Encrypt the key
    const encrypted = encrypt(apiKey, masterKey);
    
    console.log('\n\n✅ Encryption successful!\n');
    console.log('════════════════════════════════════════════════════════════════');
    console.log('Encrypted value:');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(encrypted);
    console.log('════════════════════════════════════════════════════════════════\n');
    
    console.log('Use this value in your Heroku Config Vars as:');
    console.log('  *_ENCRYPTED="' + encrypted + '"\n');
    
  } catch (error) {
    console.error('\n❌ Encryption failed:', error.message);
    process.exit(1);
  }

  rl.close();
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
