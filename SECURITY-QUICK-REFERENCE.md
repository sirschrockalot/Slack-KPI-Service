# Security Quick Reference Card

## 🚨 CRITICAL - Do This NOW

### 1. Update Vulnerable Dependencies (30 min)
```bash
npm update axios express express-validator
npm audit fix --force
npm audit  # Should show 0 vulnerabilities
git add package*.json
git commit -m "security: Update vulnerable dependencies"
git push origin main && git push heroku main
```

### 2. Add JWT_SECRET Validation (15 min)
Edit `ApiServer.js` line 90, add to `validateConfiguration()`:
```javascript
if (!process.env.JWT_SECRET) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}
```

### 3. Rotate ALL API Keys (1 hour)
```bash
# Generate new keys in Aircall/Slack dashboards
# Then update Heroku:
heroku config:set AIRCALL_API_ID="new_id" -a your-app
heroku config:set AIRCALL_API_TOKEN="new_token" -a your-app
heroku config:set SLACK_API_TOKEN="new_token" -a your-app
heroku config:set JWT_SECRET=$(openssl rand -base64 32) -a your-app
heroku restart -a your-app
```

---

## ⚠️ HIGH - Do This Week

### 4. Remove Debug Endpoint (15 min)
In `routes/report.js`, DELETE lines 421-451 (`/debug/activity-data` endpoint)
In `ApiServer.js` line 170, remove `|| req.path.startsWith('/debug/')`

### 5. Sanitize Errors (1 hour)
Create `utils/errorHandler.js` and update all `catch` blocks to use `sanitizeError()`
See SECURITY-FIXES-IMPLEMENTATION.md for full code.

---

## 📋 MEDIUM - Do This Month

### 6. Enhanced Rate Limiting (30 min)
Different limits for different endpoints (see implementation guide)

### 7. Enhanced Helmet Config (30 min)
Configure CSP, HSTS, and other security headers (see implementation guide)

### 8. Remove CORS Logging (5 min)
Delete `console.log` from CORS handler in `ApiServer.js` line 131

---

## 📊 Current Status

**Vulnerabilities Found:**
- 🚨 7 HIGH/CRITICAL dependency vulnerabilities
- 🚨 JWT_SECRET not validated
- ⚠️ Debug endpoint unauthenticated
- ⚠️ Error messages may leak info

**Risk Level:** MODERATE (HIGH before fixes)

---

## 🧪 Quick Tests

```bash
# Test 1: No vulnerabilities
npm audit  # Should show 0

# Test 2: JWT required
curl http://localhost:6000/report/afternoon  # Should 401

# Test 3: Rate limiting works
for i in {1..101}; do curl http://localhost:6000/health; done
# Request 101 should be rate limited

# Test 4: Security headers present
curl -I http://localhost:6000/health | grep -i "x-\|strict"
```

---

## 📱 Emergency Contacts

**If API Keys Compromised:**
1. Immediately revoke in Aircall/Slack dashboards
2. Generate new keys
3. Update Heroku config
4. Restart dynos
5. See SECURITY-RUNBOOK.md for full procedure

**If Service Down:**
```bash
heroku logs --tail -a your-app
heroku restart -a your-app
heroku rollback -a your-app  # If needed
```

---

## 📚 Full Documentation

- **SECURITY-AUDIT-REPORT.md** - Detailed findings and recommendations
- **SECURITY-FIXES-IMPLEMENTATION.md** - Step-by-step implementation
- **SECURITY-RUNBOOK.md** - Procedures, checklists, incident response

---

## ✅ Pre-Deployment Checklist

```markdown
- [ ] npm audit shows 0 vulnerabilities
- [ ] JWT_SECRET validated on startup
- [ ] All API keys rotated
- [ ] Debug endpoint removed
- [ ] Error messages sanitized
- [ ] Rate limiting enhanced
- [ ] Security headers configured
- [ ] All tests pass
- [ ] Deployed and verified
```

---

**Last Updated:** 2026-01-22
**Estimated Time to Fix Critical Issues:** ~2 hours
**Next Security Review:** 2026-04-22
