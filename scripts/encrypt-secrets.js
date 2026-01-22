#!/usr/bin/env node

/**
 * CLI tool to encrypt API keys for storage in Heroku Config Vars
 *
 * Usage:
 *   node scripts/encrypt-secrets.js
 *
 * This tool will:
 * 1. Generate a master encryption key (store in GitHub Secrets)
 * 2. Prompt for your API keys
 * 3. Encrypt them
 * 4. Output encrypted values for Heroku Config Vars
 */

const readline = require('readline');
const { encrypt, generateMasterKey } = require('../utils/encryption');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to prompt for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper to prompt for secret (hidden input)
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
        case '\u0004': // Ctrl-D
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(secret);
          break;
        case '\u0003': // Ctrl-C
          process.exit();
          break;
        case '\u007f': // Backspace
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
  console.log('║           API Key Encryption Tool for Heroku                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('This tool will encrypt your API keys for secure storage.\n');

  // Step 1: Check if user has master key or needs to generate one
  console.log('STEP 1: Master Encryption Key');
  console.log('────────────────────────────────────────────────────────────────');

  const hasKey = await prompt('Do you already have a MASTER_ENCRYPTION_KEY? (yes/no): ');

  let masterKey;
  if (hasKey.toLowerCase() === 'yes' || hasKey.toLowerCase() === 'y') {
    masterKey = await promptSecret('Enter your MASTER_ENCRYPTION_KEY: ');

    if (!masterKey || masterKey.length < 32) {
      console.log('\n❌ Error: Master key must be at least 32 characters long');
      process.exit(1);
    }
  } else {
    console.log('\nGenerating a new master encryption key...');
    masterKey = generateMasterKey();
    console.log('\n🔑 Your new MASTER_ENCRYPTION_KEY (save this in GitHub Secrets):');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(masterKey);
    console.log('════════════════════════════════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: Store this key in GitHub Secrets as MASTER_ENCRYPTION_KEY');
    console.log('   DO NOT lose this key - you cannot decrypt without it!\n');

    const confirmed = await prompt('Have you saved the master key? (yes/no): ');
    if (confirmed.toLowerCase() !== 'yes' && confirmed.toLowerCase() !== 'y') {
      console.log('\n⚠️  Please save the master key before continuing.');
      process.exit(0);
    }
  }

  // Step 2: Encrypt API keys
  console.log('\n\nSTEP 2: Encrypt Your API Keys');
  console.log('────────────────────────────────────────────────────────────────');
  console.log('Enter your API keys. They will be encrypted using the master key.\n');

  const secrets = {};

  // Aircall API ID
  const aircallApiId = await promptSecret('AIRCALL_API_ID: ');
  if (aircallApiId) {
    secrets.AIRCALL_API_ID_ENCRYPTED = encrypt(aircallApiId, masterKey);
  }

  // Aircall API Token
  const aircallApiToken = await promptSecret('AIRCALL_API_TOKEN: ');
  if (aircallApiToken) {
    secrets.AIRCALL_API_TOKEN_ENCRYPTED = encrypt(aircallApiToken, masterKey);
  }

  // Slack API Token
  const slackApiToken = await promptSecret('SLACK_API_TOKEN: ');
  if (slackApiToken) {
    secrets.SLACK_API_TOKEN_ENCRYPTED = encrypt(slackApiToken, masterKey);
  }

  // JWT Secret
  const jwtSecret = await promptSecret('JWT_SECRET: ');
  if (jwtSecret) {
    secrets.JWT_SECRET_ENCRYPTED = encrypt(jwtSecret, masterKey);
  }

  // Slack Channel ID (not sensitive, but encrypt anyway for consistency)
  const slackChannelId = await prompt('\nSLACK_CHANNEL_ID (not hidden): ');
  if (slackChannelId) {
    secrets.SLACK_CHANNEL_ID_ENCRYPTED = encrypt(slackChannelId, masterKey);
  }

  // Step 3: Output encrypted values
  console.log('\n\nSTEP 3: Encrypted Values for Heroku Config Vars');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('Copy these to your Heroku Config Vars:\n');

  for (const [key, value] of Object.entries(secrets)) {
    console.log(`${key}="${value}"`);
  }

  // Step 4: Output Heroku commands
  console.log('\n\nSTEP 4: Heroku Commands (Optional)');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('Or run these commands (replace YOUR_APP_NAME):\n');

  for (const [key, value] of Object.entries(secrets)) {
    console.log(`heroku config:set ${key}="${value}" -a YOUR_APP_NAME`);
  }

  // Step 5: GitHub Secrets reminder
  console.log('\n\nSTEP 5: GitHub Secrets Configuration');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('Add this secret to GitHub:');
  console.log('\n1. Go to: https://github.com/sirschrockalot/Slack-KPI-Service/settings/secrets/actions');
  console.log('2. Click "New repository secret"');
  console.log('3. Name: MASTER_ENCRYPTION_KEY');
  console.log('4. Value: (the master key shown above)');
  console.log('5. Click "Add secret"\n');

  // Step 6: Environment variable reminder
  console.log('\nSTEP 6: Update Environment Variables');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('Remove the old unencrypted variables from Heroku:');
  console.log('heroku config:unset AIRCALL_API_ID AIRCALL_API_TOKEN SLACK_API_TOKEN JWT_SECRET -a YOUR_APP_NAME\n');

  console.log('Add the USE_ENCRYPTION flag:');
  console.log('heroku config:set USE_ENCRYPTION=true -a YOUR_APP_NAME\n');

  // Done
  console.log('\n✅ Encryption complete!\n');
  console.log('Next steps:');
  console.log('1. Set up GitHub Secrets (see above)');
  console.log('2. Update Heroku Config Vars (see above)');
  console.log('3. Deploy your application');
  console.log('4. Test that decryption works\n');

  rl.close();
}

// Run the tool
main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
