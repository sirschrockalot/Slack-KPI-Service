# Security Runbook - Slack-KPI-Service

## Table of Contents
1. [API Key Rotation](#api-key-rotation)
2. [Incident Response](#incident-response)
3. [Security Monitoring](#security-monitoring)
4. [Emergency Procedures](#emergency-procedures)
5. [Regular Maintenance](#regular-maintenance)

---

## API Key Rotation

### Monthly Rotation Schedule (Recommended)

**Frequency:** First Monday of each month
**Duration:** ~30 minutes
**Required Access:** Aircall Admin, Slack Admin, Heroku CLI

#### Step 1: Generate New Credentials

**Aircall API Credentials:**
1. Log in to Aircall dashboard: https://dashboard.aircall.io
2. Navigate to Integrations > API Keys
3. Click "Create new API key"
4. Name it: `slack-kpi-service-YYYY-MM`
5. Save the API ID and Token (you won't see the token again!)

**Slack Bot Token:**
1. Log in to Slack App dashboard: https://api.slack.com/apps
2. Select your Slack app
3. Navigate to OAuth & Permissions
4. Click "Reinstall App" (or "Install to Workspace" if new)
5. Copy the Bot User OAuth Token (starts with `xoxb-`)

**JWT Secret:**
```bash
# Generate a strong random secret (32+ characters)
openssl rand -base64 32
```

#### Step 2: Update Heroku Config Vars

```bash
# Set new credentials
heroku config:set AIRCALL_API_ID="new_api_id_here" -a your-app-name
heroku config:set AIRCALL_API_TOKEN="new_api_token_here" -a your-app-name
heroku config:set SLACK_API_TOKEN="new_slack_token_here" -a your-app-name
heroku config:set JWT_SECRET="new_jwt_secret_here" -a your-app-name

# Verify config was updated
heroku config -a your-app-name

# Check that values are set (they'll be hidden)
```

#### Step 3: Redeploy Application

```bash
# Trigger a redeploy (even without code changes)
git commit --allow-empty -m "security: Rotate API credentials"
git push heroku main

# OR manually restart dynos
heroku restart -a your-app-name

# Watch logs for successful startup
heroku logs --tail -a your-app-name
```

#### Step 4: Verify Functionality

```bash
# Test health endpoint
curl https://your-app.herokuapp.com/health

# Test connections endpoint (requires JWT)
curl -X GET https://your-app.herokuapp.com/test-connections \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check for any errors in logs
heroku logs --tail -a your-app-name | grep -i error
```

#### Step 5: Revoke Old Credentials

**⚠️ Wait 24 hours before revoking** to ensure new credentials work properly

**Revoke Aircall API Key:**
1. Log in to Aircall dashboard
2. Navigate to Integrations > API Keys
3. Find the OLD key (from last month)
4. Click "Revoke"

**Revoke Slack Token:**
1. Log in to Slack App dashboard
2. Select your app
3. Navigate to OAuth & Permissions
4. Click "Revoke" on old token (if visible)

#### Step 6: Document Rotation

```bash
# Add to security log
echo "$(date): API keys rotated - Aircall, Slack, JWT" >> security-log.txt
git add security-log.txt
git commit -m "docs: Log API key rotation"
git push origin main
```

---

## Incident Response

### API Key Compromise Response

**Indicators of Compromise:**
- Unusual API usage patterns (off-hours, high volume)
- Unexpected Slack messages
- Aircall API rate limit errors
- Failed authentication attempts
- Reports you didn't trigger

#### Phase 1: IMMEDIATE (0-15 minutes)

**Objective:** Stop the bleeding

1. **Revoke Compromised Credentials IMMEDIATELY**

```bash
# Aircall: Log in to dashboard and revoke API key immediately
# Slack: Log in and revoke bot token immediately
# This stops the attacker from making further API calls
```

2. **Generate New Credentials**

```bash
# Follow "Generate New Credentials" steps from rotation section
# DO NOT DELAY - every second counts
```

3. **Update Heroku Config**

```bash
heroku config:set AIRCALL_API_ID="new_id" -a your-app
heroku config:set AIRCALL_API_TOKEN="new_token" -a your-app
heroku config:set SLACK_API_TOKEN="new_token" -a your-app
heroku config:set JWT_SECRET=$(openssl rand -base64 32) -a your-app

# Force immediate restart
heroku restart -a your-app
```

4. **Verify Service Recovery**

```bash
# Check health
curl https://your-app.herokuapp.com/health

# Monitor logs
heroku logs --tail -a your-app
```

#### Phase 2: SHORT TERM (15-60 minutes)

**Objective:** Assess damage and secure environment

5. **Audit Access Logs**

```bash
# Check Heroku logs for suspicious activity
heroku logs --num 1500 -a your-app > incident-logs.txt

# Look for:
# - Unusual IP addresses
# - High volume of requests
# - Failed authentication attempts
# - Requests to unexpected endpoints
grep -i "error\|unauthorized\|forbidden\|suspicious" incident-logs.txt

# Check Aircall API usage in dashboard
# Check Slack workspace audit logs
```

6. **Review Git History**

```bash
# Search for accidentally committed secrets
git log -p | grep -i "aircall_api\|slack_api\|xoxb-\|api_token\|api_id"

# If secrets found in git history, you MUST clean it
# Use git-filter-repo or BFG Repo-Cleaner
```

7. **Check GitHub Settings**

```bash
# Verify GitHub secrets are still secure
# Go to: Repository > Settings > Secrets and variables > Actions
# Ensure no unauthorized access to repository
# Check commit history for unauthorized commits
```

8. **Review Heroku Access**

```bash
# Check who has access to Heroku app
heroku access -a your-app

# Check recent activity
heroku releases -a your-app
```

#### Phase 3: FOLLOW UP (1-24 hours)

**Objective:** Prevent recurrence

9. **Document Incident**

```markdown
# Create incident report
Date: YYYY-MM-DD
Time Detected: HH:MM
Time Resolved: HH:MM
Duration: X hours

## What Happened
[Describe how credentials were compromised]

## Impact
[Describe what data was accessed, API calls made, etc.]

## Root Cause
[Why did this happen?]

## Actions Taken
1. Revoked compromised credentials
2. Generated new credentials
3. Updated Heroku config
4. Redeployed application

## Prevention
[What can we do to prevent this?]
- Implement key rotation schedule
- Add security monitoring
- Review access controls
- Update security training
```

10. **Implement Additional Security**

- Enable 2FA on all accounts (Aircall, Slack, Heroku, GitHub)
- Review and restrict Heroku app access
- Set up security monitoring alerts
- Implement the recommendations from SECURITY-AUDIT-REPORT.md

11. **Notification (if required)**

If customer data was accessed:
- Document exactly what was accessed
- Notify affected parties as required by law
- Prepare incident summary for stakeholders

---

## Security Monitoring

### Daily Monitoring Tasks

**Automated Alerts to Set Up:**

```yaml
# Heroku Alerts (set up in dashboard)
alerts:
  - name: High Error Rate
    metric: errors
    threshold: > 5% of requests
    notification: email + slack

  - name: Unusual Traffic
    metric: requests_per_minute
    threshold: > 50
    notification: email

  - name: High Memory Usage
    metric: memory_usage
    threshold: > 80%
    notification: email

  - name: Failed Authentication
    metric: http_401_responses
    threshold: > 10 in 5 minutes
    notification: slack
```

**Manual Checks (Once per day):**

```bash
# Check for errors in last 24 hours
heroku logs --tail -a your-app | grep -i "error" | tail -50

# Check authentication failures
heroku logs --tail -a your-app | grep "401\|403" | tail -20

# Check unusual activity
heroku logs --tail -a your-app | grep -i "unusual\|suspicious" | tail -20

# Monitor Aircall API usage in dashboard
# - Look for spikes in usage
# - Verify all calls are legitimate

# Monitor Slack for unexpected messages
# - Review all bot messages sent
# - Verify recipients are correct
```

### Weekly Security Review

**Every Monday morning:**

1. Review access logs for the week
2. Check for any dependency vulnerabilities: `npm audit`
3. Verify all security alerts were addressed
4. Review Heroku access list
5. Check git commit history for suspicious changes

### Monthly Security Tasks

**First Monday of each month:**

1. **Rotate API Keys** (follow rotation procedure above)
2. **Security Scan:**
```bash
npm audit
npm outdated
```
3. **Review and update:**
   - .gitignore still excludes .env files
   - No secrets in git history
   - All dependencies up to date
   - Security headers still configured
   - Rate limiting still active

---

## Emergency Procedures

### Service Down

**If the service is completely down:**

```bash
# 1. Check Heroku status
heroku status

# 2. Check app status
heroku ps -a your-app

# 3. Check recent deployments
heroku releases -a your-app

# 4. Check logs for errors
heroku logs --tail -a your-app | grep -i "error\|fatal\|crash"

# 5. Restart dynos
heroku restart -a your-app

# 6. If still down, rollback to last working release
heroku rollback -a your-app

# 7. Check configuration
heroku config -a your-app
# Verify all required vars are set
```

### Suspected Data Breach

**If you suspect data has been accessed:**

1. **Immediately rotate all credentials** (follow API Key Compromise procedure)
2. **Capture evidence:**
```bash
# Save current logs
heroku logs --num 1500 -a your-app > breach-evidence-$(date +%Y%m%d).txt

# Save current config (REDACT before sharing)
heroku config -a your-app > config-snapshot.txt
```
3. **Contact your security team or advisor**
4. **Do NOT destroy evidence**
5. **Document everything**

### Dependency Vulnerability Discovered

**If npm audit shows HIGH/CRITICAL vulnerabilities:**

```bash
# 1. See details
npm audit

# 2. Try automatic fix
npm audit fix

# 3. If that doesn't work, force fix (may break things)
npm audit fix --force

# 4. Test locally
npm test
npm start
# Test all critical endpoints

# 5. If tests pass, deploy
git add package*.json
git commit -m "security: Fix dependency vulnerabilities"
git push heroku main

# 6. Monitor for errors
heroku logs --tail -a your-app
```

---

## Regular Maintenance

### Weekly Checklist

```markdown
- [ ] Review error logs
- [ ] Check authentication failures
- [ ] Verify monitoring alerts working
- [ ] Run `npm audit`
- [ ] Review access logs for anomalies
```

### Monthly Checklist

```markdown
- [ ] Rotate API keys (first Monday)
- [ ] Update dependencies (`npm update`)
- [ ] Run full security audit
- [ ] Review and update access controls
- [ ] Test incident response procedures
- [ ] Review and update this runbook
```

### Quarterly Checklist

```markdown
- [ ] Full security audit (like the one in SECURITY-AUDIT-REPORT.md)
- [ ] Penetration testing (if budget allows)
- [ ] Review and update security policies
- [ ] Security training for team
- [ ] Test disaster recovery procedures
- [ ] Review monitoring and alerting thresholds
```

---

## Contact Information

**Emergency Contacts:**

```markdown
Heroku Support: https://help.heroku.com
Aircall Support: support@aircall.io
Slack Support: https://slack.com/help

Security Incidents:
- Internal: [Your team's contact]
- External: [Security advisor contact]

After-Hours Emergency:
- [On-call contact information]
```

---

## Appendix: Security Checklist

### Pre-Deployment Security Checklist

```markdown
- [ ] npm audit shows 0 vulnerabilities
- [ ] No hardcoded secrets in code
- [ ] .env not committed to git
- [ ] GitHub secrets configured correctly
- [ ] Heroku config vars set
- [ ] JWT_SECRET is strong (32+ chars)
- [ ] NODE_ENV=production
- [ ] Rate limiting active
- [ ] Authentication required on all sensitive endpoints
- [ ] Error messages don't leak info
- [ ] Security headers configured
- [ ] CORS properly restricted
- [ ] Logging doesn't expose secrets
- [ ] All tests pass
```

### Post-Deployment Verification

```bash
# 1. Health check
curl https://your-app.herokuapp.com/health

# 2. Verify authentication required
curl https://your-app.herokuapp.com/report/afternoon
# Should return: 401 Unauthorized

# 3. Check security headers
curl -I https://your-app.herokuapp.com/health | grep -i "x-\|strict-transport"

# 4. Monitor logs for errors
heroku logs --tail -a your-app

# 5. Test critical functionality
# [Your specific tests here]
```

---

**Last Updated:** 2026-01-22
**Next Review:** 2026-04-22
**Owner:** [Your name/team]
