# Testing Encrypted Keys Locally

This guide will help you test the encryption setup locally before deploying to Heroku.

## Prerequisites

You should have:
- ✅ Your `MASTER_ENCRYPTION_KEY` (the key you used to encrypt the API keys)
- ✅ Encrypted Aircall API ID: `AIRCALL_API_ID_ENCRYPTED`
- ✅ Encrypted Aircall API Token: `AIRCALL_API_TOKEN_ENCRYPTED`
- ✅ Encrypted Slack API Token: `SLACK_API_TOKEN_ENCRYPTED`
- ✅ New JWT Secret: `ECEPTfT03Pk8Qy/EUjEKiHKY1+kk7sgXEzc/2jwwx6M=`

## Step 1: Update .env.local

1. Open `.env.local` in the project root
2. Replace the placeholder values:
   - `YOUR_MASTER_ENCRYPTION_KEY_HERE` → Your actual master key
   - `YOUR_ENCRYPTED_AIRCALL_API_ID_HERE` → Your encrypted Aircall API ID
   - `YOUR_ENCRYPTED_AIRCALL_API_TOKEN_HERE` → Your encrypted Aircall API Token
   - `YOUR_ENCRYPTED_SLACK_API_TOKEN_HERE` → Your encrypted Slack API Token

## Step 2: Test Decryption

Before starting the server, verify decryption works:

```bash
node -e "const { decrypt } = require('./utils/encryption'); const master = process.env.MASTER_ENCRYPTION_KEY; const encrypted = process.env.AIRCALL_API_ID_ENCRYPTED; console.log('Decrypted:', decrypt(encrypted, master));"
```

This should output your decrypted Aircall API ID. If it fails, check:
- Master key is correct
- Encrypted values are correct (no extra quotes or spaces)

## Step 3: Start the Server

```bash
npm start
```

Or:

```bash
node index.js
```

## Step 4: Check Startup Logs

Look for these messages:

✅ **Success indicators:**
```
🔐 Encryption enabled - decrypting API keys from Heroku Config Vars
✓ AIRCALL_API_ID: configured
✓ AIRCALL_API_TOKEN: configured
✓ SLACK_API_TOKEN: configured
✓ SLACK_CHANNEL_ID: configured
✓ JWT_SECRET: configured and validated
```

❌ **Error indicators:**
- `Failed to decrypt configuration` → Check master key and encrypted values
- `Missing required environment variable` → Check all encrypted values are set
- `Master key must be at least 32 characters` → Master key is too short

## Step 5: Test API Endpoints

### 5.1 Health Check (No Auth Required)
```bash
curl http://localhost:6000/health
```

Should return:
```json
{"status":"healthy","timestamp":"...","service":"aircall-slack-agent"}
```

### 5.2 Test Connections (Requires JWT)

First, generate a JWT token:
```bash
node utils/generateJwtToken.js
```

Then test connections:
```bash
curl -X GET http://localhost:6000/test-connections \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5.3 Test Report Generation (Requires JWT)

```bash
curl -X POST http://localhost:6000/report/afternoon \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## Troubleshooting

### Issue: "Failed to decrypt configuration"

**Possible causes:**
1. Master key doesn't match the one used for encryption
2. Encrypted value has extra quotes or spaces
3. Encrypted value is corrupted

**Solution:**
- Verify master key is exactly the same as used for encryption
- Check encrypted values don't have quotes around them in .env.local
- Re-encrypt the keys if needed

### Issue: "Missing required environment variable"

**Solution:**
- Make sure all `*_ENCRYPTED` variables are set in .env.local
- Check for typos in variable names

### Issue: Server starts but can't connect to Aircall/Slack

**Solution:**
- The decryption worked, but the decrypted keys might be wrong
- Test decryption manually (Step 2) to verify the decrypted values
- Check that the original API keys are correct

## Next Steps

Once local testing passes:
1. ✅ All encrypted values decrypt correctly
2. ✅ Server starts without errors
3. ✅ Can connect to Aircall API
4. ✅ Can connect to Slack API
5. ✅ Reports generate successfully

Then you're ready to deploy to Heroku with the same encrypted values!
