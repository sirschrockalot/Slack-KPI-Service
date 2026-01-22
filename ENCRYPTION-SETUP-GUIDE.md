# Encryption at Rest Setup Guide

## Overview

This guide shows you how to enable encryption for your API keys stored in Heroku Config Vars.

### Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  GitHub Secrets                      Heroku Config Vars     │
│  ┌──────────────────────┐           ┌──────────────────────┐│
│  │ MASTER_ENCRYPTION_KEY│           │ AIRCALL_API_ID_      ││
│  │ (Never in Heroku)    │           │   ENCRYPTED          ││
│  └──────────────────────┘           │ AIRCALL_API_TOKEN_   ││
│           │                          │   ENCRYPTED          ││
│           │ Injected during          │ SLACK_API_TOKEN_     ││
│           │ deployment via           │   ENCRYPTED          ││
│           │ GitHub Actions           │ JWT_SECRET_          ││
│           │                          │   ENCRYPTED          ││
│           ▼                          └──────────────────────┘│
│  ┌──────────────────────┐                     │              │
│  │  Heroku Dyno         │◄────────────────────┘              │
│  │  (Runtime Memory)    │                                    │
│  │  - Decrypts on start │                                    │
│  │  - Keys in memory    │                                    │
│  │  - Never persisted   │                                    │
│  └──────────────────────┘                                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Defense in Depth:
✅ Master key NOT stored in Heroku
✅ Requires breach of BOTH GitHub AND Heroku to steal keys
✅ Encrypted values useless without master key
✅ Audit trail via GitHub Actions
```

---

## Prerequisites

- [x] Node.js installed locally
- [x] Access to your Heroku app
- [x] Admin access to your GitHub repository
- [x] Current API keys (Aircall, Slack, JWT)

---

## Step 1: Generate and Encrypt Your API Keys

### 1.1 Run the Encryption Tool

```bash
node scripts/encrypt-secrets.js
```

This interactive tool will:
1. Generate a **MASTER_ENCRYPTION_KEY** (or use existing)
2. Prompt for your API keys
3. Encrypt them
4. Output encrypted values for Heroku

### 1.2 Save the Master Encryption Key

**CRITICAL:** When the tool generates the master key, copy it immediately!

```
🔑 Your new MASTER_ENCRYPTION_KEY (save this in GitHub Secrets):
════════════════════════════════════════════════════════════════
Xk7p2Qw9vN3mL8aR5tY1hE6sF4cG0zB...
════════════════════════════════════════════════════════════════
```

⚠️ **DO NOT LOSE THIS KEY** - you cannot decrypt without it!

---

## Step 2: Configure GitHub Secrets

### 2.1 Add Master Encryption Key to GitHub

1. Go to: https://github.com/sirschrockalot/Slack-KPI-Service/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `MASTER_ENCRYPTION_KEY`
4. Value: (paste the master key from Step 1.2)
5. Click **"Add secret"**

### 2.2 Add Other GitHub Secrets (if not already present)

You'll also need these secrets for GitHub Actions deployment:

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `HEROKU_API_KEY` | Your Heroku API key | https://dashboard.heroku.com/account |
| `HEROKU_APP_NAME` | Your Heroku app name | From Heroku dashboard |
| `HEROKU_EMAIL` | Your Heroku email | Your Heroku account email |

**To add each secret:**
1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Enter name and value
4. Click "Add secret"

---

## Step 3: Configure Heroku Config Vars

### 3.1 Add Encrypted Values

The encryption tool (Step 1) outputted commands like this:

```bash
heroku config:set AIRCALL_API_ID_ENCRYPTED="a1b2c3..." -a your-app-name
heroku config:set AIRCALL_API_TOKEN_ENCRYPTED="d4e5f6..." -a your-app-name
heroku config:set SLACK_API_TOKEN_ENCRYPTED="g7h8i9..." -a your-app-name
heroku config:set JWT_SECRET_ENCRYPTED="j0k1l2..." -a your-app-name
heroku config:set SLACK_CHANNEL_ID_ENCRYPTED="m3n4o5..." -a your-app-name
```

**Run these commands** (replace `your-app-name` with your actual Heroku app name)

### 3.2 Enable Encryption Flag

```bash
heroku config:set USE_ENCRYPTION=true -a your-app-name
```

### 3.3 Remove Old Plaintext Variables

⚠️ **Important:** Remove the old unencrypted variables:

```bash
heroku config:unset AIRCALL_API_ID AIRCALL_API_TOKEN SLACK_API_TOKEN JWT_SECRET -a your-app-name
```

**Keep these plaintext** (not sensitive):
- `SLACK_CHANNEL_ID` (if you prefer)
- `PORT`
- `NODE_ENV`
- `EXCLUDED_USERS`
- `DISPO_AGENTS`
- `ACQUISITION_AGENTS`
- `TZ`

### 3.4 Verify Configuration

```bash
heroku config -a your-app-name
```

You should see:
```
=== your-app-name Config Vars
AIRCALL_API_ID_ENCRYPTED:     a1b2c3d4e5f6... (long encrypted string)
AIRCALL_API_TOKEN_ENCRYPTED:  g7h8i9j0k1l2... (long encrypted string)
JWT_SECRET_ENCRYPTED:         m3n4o5p6q7r8... (long encrypted string)
SLACK_API_TOKEN_ENCRYPTED:    s9t0u1v2w3x4... (long encrypted string)
SLACK_CHANNEL_ID_ENCRYPTED:   y5z6a7b8c9d0... (long encrypted string)
USE_ENCRYPTION:               true
... (other non-sensitive vars)
```

---

## Step 4: Deploy Your Application

### Option A: Deploy via GitHub Actions (Recommended)

The master key will be automatically injected during deployment.

```bash
git add .
git commit -m "security: Enable encryption at rest for API keys"
git push origin main
```

GitHub Actions will:
1. Run tests
2. Deploy to Heroku
3. Inject `MASTER_ENCRYPTION_KEY` (from GitHub Secrets)
4. Verify deployment

Monitor deployment:
- https://github.com/sirschrockalot/Slack-KPI-Service/actions

### Option B: Deploy Manually (Not Recommended)

If deploying manually, you must inject the master key:

```bash
# Set master key temporarily (will be used during deployment)
heroku config:set MASTER_ENCRYPTION_KEY="your-master-key-here" -a your-app-name

# Deploy
git push heroku main

# IMPORTANT: Remove master key from Heroku after deployment completes
heroku config:unset MASTER_ENCRYPTION_KEY -a your-app-name
```

⚠️ **Why remove it?** The master key should NOT persist in Heroku. It should only be present during deployment.

---

## Step 5: Verify Deployment

### 5.1 Check Application Logs

```bash
heroku logs --tail -a your-app-name
```

Look for these log messages:

```
✅ GOOD - Encryption enabled:
info: 🔐 Encryption enabled - decrypting API keys from Heroku Config Vars
info: Configuration loaded from environment variables:
info: ✓ AIRCALL_API_ID: configured
info: ✓ AIRCALL_API_TOKEN: configured
info: ✓ SLACK_API_TOKEN: configured
info: ✓ JWT_SECRET: configured and validated

❌ BAD - Decryption failed:
error: Failed to decrypt configuration: ...
error: MASTER_ENCRYPTION_KEY is required when USE_ENCRYPTION=true
```

### 5.2 Test Health Endpoint

```bash
curl https://your-app-name.herokuapp.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123
}
```

### 5.3 Test API Functionality

```bash
# Test connections (requires JWT)
curl -X GET https://your-app-name.herokuapp.com/test-connections \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "connections": {
    "slack": "connected",
    "aircall": "connected"
  }
}
```

---

## Step 6: Security Verification Checklist

After deployment, verify:

```bash
# 1. Check Heroku config does NOT contain master key
heroku config -a your-app-name | grep MASTER_ENCRYPTION_KEY
# Should output nothing (or "not found")

# 2. Check Heroku config DOES contain encrypted values
heroku config -a your-app-name | grep _ENCRYPTED
# Should show all your encrypted variables

# 3. Check encryption flag is enabled
heroku config:get USE_ENCRYPTION -a your-app-name
# Should output: true

# 4. Check app is running
heroku ps -a your-app-name
# Should show: web.1: up

# 5. Check logs show decryption succeeded
heroku logs --tail -a your-app-name | grep "Encryption enabled"
# Should show: 🔐 Encryption enabled - decrypting API keys
```

✅ **All checks passed?** Your encryption is working correctly!

---

## Troubleshooting

### Problem: "MASTER_ENCRYPTION_KEY is required"

**Cause:** Master key not injected during deployment

**Solution:**
```bash
# If using GitHub Actions: Check that MASTER_ENCRYPTION_KEY secret is set in GitHub
# Go to: Settings → Secrets and variables → Actions

# If deploying manually: Set the key before deployment
heroku config:set MASTER_ENCRYPTION_KEY="your-key" -a your-app-name
git push heroku main
heroku config:unset MASTER_ENCRYPTION_KEY -a your-app-name
```

### Problem: "Failed to decrypt configuration"

**Cause:** Encrypted values don't match master key

**Solutions:**
1. **Check master key is correct** - Verify in GitHub Secrets
2. **Re-encrypt with correct key:**
   ```bash
   node scripts/encrypt-secrets.js
   # Use the SAME master key
   # Update Heroku config vars with new encrypted values
   ```

### Problem: "Invalid encrypted value format"

**Cause:** Encrypted value is malformed or incomplete

**Solution:**
```bash
# Re-encrypt that specific value
node scripts/encrypt-secrets.js
# Copy the new encrypted value
heroku config:set VARIABLE_NAME_ENCRYPTED="new-value" -a your-app-name
```

### Problem: App crashes on startup

**Debug steps:**
```bash
# 1. Check logs
heroku logs --tail -a your-app-name

# 2. Check which config vars are set
heroku config -a your-app-name

# 3. Try disabling encryption temporarily
heroku config:set USE_ENCRYPTION=false -a your-app-name
heroku restart -a your-app-name

# 4. If it works with encryption disabled, the problem is with your encrypted values
```

---

## Key Rotation

You should rotate your API keys regularly. Here's how:

### 1. Generate New API Keys

- Aircall: https://dashboard.aircall.io → Integrations → API Keys
- Slack: https://api.slack.com/apps → Your App → OAuth & Permissions

### 2. Re-encrypt with Same Master Key

```bash
node scripts/encrypt-secrets.js
# Enter the SAME master key when prompted
# Enter your NEW API keys
```

### 3. Update Heroku Config Vars

```bash
heroku config:set AIRCALL_API_ID_ENCRYPTED="new-value" -a your-app-name
heroku config:set AIRCALL_API_TOKEN_ENCRYPTED="new-value" -a your-app-name
# etc...
```

### 4. Restart App

```bash
heroku restart -a your-app-name
```

### 5. Revoke Old API Keys

Wait 24 hours, then revoke old keys in Aircall/Slack dashboards.

---

## Rotating the Master Encryption Key

⚠️ **Advanced:** Only do this if master key is compromised

### Steps:

1. **Generate new master key:**
   ```bash
   node scripts/encrypt-secrets.js
   # Select "no" when asked if you have a key
   # Save the NEW master key
   ```

2. **Update GitHub Secret:**
   - Go to GitHub → Settings → Secrets → Actions
   - Edit `MASTER_ENCRYPTION_KEY`
   - Paste new key

3. **Re-encrypt all API keys** with the new master key (Step 1)

4. **Update Heroku config vars** with newly encrypted values (Step 3)

5. **Deploy** (Step 4)

---

## Security Best Practices

### ✅ DO:
- ✅ Store master key in GitHub Secrets only
- ✅ Rotate API keys monthly
- ✅ Review GitHub Actions logs for failed deployments
- ✅ Use GitHub Actions for deployment (auto-injects master key)
- ✅ Monitor Heroku logs for decryption errors
- ✅ Keep backup of master key in secure password manager

### ❌ DON'T:
- ❌ Store master key in Heroku Config Vars
- ❌ Commit master key to git
- ❌ Share master key via Slack/email
- ❌ Use weak master keys (< 32 characters)
- ❌ Reuse master key across different apps
- ❌ Log decrypted values

---

## Disabling Encryption (Rollback)

If you need to disable encryption:

### 1. Set plaintext values in Heroku

```bash
heroku config:set AIRCALL_API_ID="your-plaintext-value" -a your-app-name
heroku config:set AIRCALL_API_TOKEN="your-plaintext-value" -a your-app-name
# etc...
```

### 2. Disable encryption flag

```bash
heroku config:set USE_ENCRYPTION=false -a your-app-name
```

### 3. Remove encrypted values (optional)

```bash
heroku config:unset AIRCALL_API_ID_ENCRYPTED AIRCALL_API_TOKEN_ENCRYPTED -a your-app-name
```

### 4. Restart

```bash
heroku restart -a your-app-name
```

---

## FAQ

### Q: Where is the master key stored?

A: The master key is stored **only in GitHub Secrets**. It is injected into the Heroku dyno during deployment via GitHub Actions, used to decrypt the config vars, then discarded. It is NOT persisted in Heroku.

### Q: What if GitHub is breached?

A: An attacker would get the master key but NOT the encrypted API keys (those are in Heroku). They would need to breach BOTH GitHub AND Heroku to steal your API keys.

### Q: What if Heroku is breached?

A: An attacker would get the encrypted API keys but NOT the master key (that's in GitHub). The encrypted values are useless without the master key.

### Q: Can I use this with GKS (Google Kubernetes Service)?

A: Yes! The same approach works with Kubernetes Secrets. Store encrypted values in Kubernetes Secrets, and inject the master key via CI/CD pipeline.

### Q: Is this as secure as Google Cloud KMS?

A: No. Cloud KMS is more secure because the key never leaves Google's infrastructure. However, this approach provides good security and costs $0 vs ~$1/month for KMS.

### Q: Should I still rotate API keys?

A: YES! Encryption at rest doesn't replace key rotation. Rotate monthly as per SECURITY-RUNBOOK.md.

---

## Support

**Documentation:**
- Security Audit: `SECURITY-AUDIT-REPORT.md`
- Security Runbook: `SECURITY-RUNBOOK.md`
- Encryption Analysis: `ENCRYPTION-SECURITY-ANALYSIS.md`

**Troubleshooting:**
- Check Heroku logs: `heroku logs --tail -a your-app-name`
- Test encryption locally: `node utils/encryption.js`
- GitHub Actions logs: https://github.com/sirschrockalot/Slack-KPI-Service/actions

---

**Last Updated:** 2026-01-22
**Version:** 1.0
**Security Model:** GitHub Secrets + Basic Encryption (Option B)
