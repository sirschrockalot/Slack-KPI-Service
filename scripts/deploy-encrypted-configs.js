#!/usr/bin/env node

/**
 * Node.js script to deploy encrypted configuration to Heroku
 * Alternative to the bash script - works cross-platform
 * 
 * Usage: node scripts/deploy-encrypted-configs.js [app-name]
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { execSync } = require('child_process');
const readline = require('readline');

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

function execCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe', ...options });
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║      Deploy Encrypted Configuration to Heroku                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Get app name from command line or prompt
  const appName = process.argv[2] || await prompt('Heroku app name (default: slack-kpi-service): ') || 'slack-kpi-service';

  console.log(`\n📦 App: ${appName}\n`);

  // Check if Heroku CLI is installed
  try {
    execCommand('heroku --version');
  } catch (error) {
    console.error('❌ Heroku CLI is not installed. Please install it first.');
    console.error('   Visit: https://devcenter.heroku.com/articles/heroku-cli');
    process.exit(1);
  }

  // Check if logged in
  try {
    const whoami = execCommand('heroku auth:whoami').trim();
    console.log(`✅ Logged in as: ${whoami}`);
  } catch (error) {
    console.error('❌ Not logged in to Heroku. Please login first.');
    console.error('   Run: heroku login');
    process.exit(1);
  }

  // Check if app exists
  try {
    execCommand(`heroku apps:info --app ${appName}`, { stdio: 'ignore' });
    console.log(`✅ App found: ${appName}`);
  } catch (error) {
    console.error(`❌ App '${appName}' not found or you don't have access to it.`);
    process.exit(1);
  }

  // Check required environment variables
  const required = {
    USE_ENCRYPTION: process.env.USE_ENCRYPTION,
    MASTER_ENCRYPTION_KEY: process.env.MASTER_ENCRYPTION_KEY,
    AIRCALL_API_ID_ENCRYPTED: process.env.AIRCALL_API_ID_ENCRYPTED,
    AIRCALL_API_TOKEN_ENCRYPTED: process.env.AIRCALL_API_TOKEN_ENCRYPTED,
    SLACK_API_TOKEN_ENCRYPTED: process.env.SLACK_API_TOKEN_ENCRYPTED,
    JWT_SECRET: process.env.JWT_SECRET
  };

  const missing = Object.entries(required)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n   Make sure .env.local has all required values.');
    process.exit(1);
  }

  if (required.USE_ENCRYPTION !== 'true') {
    console.error('❌ USE_ENCRYPTION must be set to "true"');
    process.exit(1);
  }

  console.log('✅ All required variables found in .env.local\n');

  // Build config vars object
  const configVars = {
    'USE_ENCRYPTION': 'true',
    'MASTER_ENCRYPTION_KEY': required.MASTER_ENCRYPTION_KEY,
    'AIRCALL_API_ID_ENCRYPTED': required.AIRCALL_API_ID_ENCRYPTED,
    'AIRCALL_API_TOKEN_ENCRYPTED': required.AIRCALL_API_TOKEN_ENCRYPTED,
    'SLACK_API_TOKEN_ENCRYPTED': required.SLACK_API_TOKEN_ENCRYPTED,
    'JWT_SECRET': required.JWT_SECRET
  };

  // Add optional variables
  if (process.env.SLACK_CHANNEL_ID_ENCRYPTED) {
    configVars['SLACK_CHANNEL_ID_ENCRYPTED'] = process.env.SLACK_CHANNEL_ID_ENCRYPTED;
  } else if (process.env.SLACK_CHANNEL_ID) {
    configVars['SLACK_CHANNEL_ID'] = process.env.SLACK_CHANNEL_ID;
  }

  if (process.env.DISPO_AGENTS) {
    configVars['DISPO_AGENTS'] = process.env.DISPO_AGENTS;
  }

  if (process.env.ACQUISITION_AGENTS) {
    configVars['ACQUISITION_AGENTS'] = process.env.ACQUISITION_AGENTS;
  }

  if (process.env.EXCLUDED_USERS) {
    configVars['EXCLUDED_USERS'] = process.env.EXCLUDED_USERS;
  }

  // Build heroku config:set command
  const configPairs = Object.entries(configVars)
    .map(([key, value]) => `${key}="${value.replace(/"/g, '\\"')}"`)
    .join(' ');

  console.log(`📝 Setting ${Object.keys(configVars).length} config vars...\n`);

  try {
    execCommand(`heroku config:set ${configPairs} --app ${appName}`, { stdio: 'inherit' });
    console.log('\n✅ Config vars set successfully!');
  } catch (error) {
    console.error('\n❌ Failed to set config vars:', error.message);
    process.exit(1);
  }

  // Check for old plaintext variables
  console.log('\n🔍 Checking for old plaintext variables...\n');
  const oldVars = ['AIRCALL_API_ID', 'AIRCALL_API_TOKEN', 'SLACK_API_TOKEN'];

  for (const varName of oldVars) {
    try {
      execCommand(`heroku config:get ${varName} --app ${appName}`, { stdio: 'ignore' });
      const answer = await prompt(`Found old plaintext variable: ${varName}. Remove it? (y/n): `);
      if (answer.toLowerCase() === 'y') {
        execCommand(`heroku config:unset ${varName} --app ${appName}`, { stdio: 'inherit' });
        console.log(`✅ Removed ${varName}\n`);
      }
    } catch (error) {
      // Variable doesn't exist, skip
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(64));
  console.log('✅ Configuration deployment complete!');
  console.log('═'.repeat(64));
  console.log(`\n📋 Summary:`);
  console.log(`  App: ${appName}`);
  console.log(`  Encryption: Enabled`);
  console.log(`  Config vars set: ${Object.keys(configVars).length}`);
  console.log(`\n🔍 Verify configuration:`);
  console.log(`  heroku config --app ${appName}`);
  console.log(`\n🚀 Next steps:`);
  console.log(`  1. Deploy your code: git push heroku main`);
  console.log(`  2. Check logs: heroku logs --tail --app ${appName}`);
  console.log(`  3. Test health: curl https://${appName}.herokuapp.com/health\n`);

  rl.close();
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  rl.close();
  process.exit(1);
});
