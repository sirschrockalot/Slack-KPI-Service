# Security Fixes Implementation Guide

This guide provides step-by-step instructions to implement the critical security fixes identified in the security audit.

## Priority 1: CRITICAL - Fix Immediately (Today)

### Fix #1: Update Vulnerable Dependencies (30 minutes)

**Issue:** 7 HIGH/CRITICAL severity vulnerabilities in dependencies

**Commands:**

```bash
# Navigate to project directory
cd /Users/jschrock/Development/cloned_repos/Slack-KPI-Service

# Update vulnerable packages
npm update axios express express-validator

# Run automated fix
npm audit fix

# If there are still vulnerabilities, force fix (test thoroughly after)
npm audit fix --force

# Verify fixes
npm audit

# Test locally
npm start
# Test all critical endpoints

# Commit and deploy
git add package.json package-lock.json
git commit -m "security: Update vulnerable dependencies

- Update axios to fix DoS vulnerability (GHSA-4hjh-wcwx-xvwj)
- Update express to fix body-parser/qs vulnerabilities
- Update express-validator to fix validation bypass
- Fix jws JWT signature verification vulnerability (CRITICAL)
- Update qs to fix DoS vulnerability
- Update js-yaml to fix prototype pollution
- Update lodash to fix prototype pollution

All HIGH/CRITICAL vulnerabilities resolved.
"
git push origin main

# Deploy to Heroku
git push heroku main

# Monitor deployment
heroku logs --tail -a your-app-name
```

**Verification:**

```bash
# Should show 0 vulnerabilities
npm audit

# Should show package versions updated
npm list axios express express-validator
```

---

### Fix #2: Add JWT_SECRET Validation (15 minutes)

**Issue:** Application starts without JWT_SECRET, making authentication ineffective

**File:** `ApiServer.js`

**Changes:**

```javascript
// FILE: ApiServer.js
// LOCATION: Lines 90-98 (validateConfiguration method)

// BEFORE:
validateConfiguration() {
  const requiredFields = ['aircallApiId', 'aircallApiToken', 'slackApiToken', 'slackChannelId'];
  const missingFields = requiredFields.filter(field => !this.config[field]);

  if (missingFields.length > 0) {
    const missingVars = missingFields.map(field => field.replace(/([A-Z])/g, '_$1').toUpperCase());
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

// AFTER:
validateConfiguration() {
  const requiredFields = ['aircallApiId', 'aircallApiToken', 'slackApiToken', 'slackChannelId'];
  const missingFields = requiredFields.filter(field => !this.config[field]);

  // Validate JWT_SECRET exists
  if (!process.env.JWT_SECRET) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }

  // Validate JWT_SECRET strength (minimum 32 characters for security)
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }

  if (missingFields.length > 0) {
    const missingVars = missingFields.map(field => field.replace(/([A-Z])/g, '_$1').toUpperCase());
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  this.logger.info('✓ JWT_SECRET: configured and validated');
}
```

**Testing:**

```bash
# Test 1: Start without JWT_SECRET (should fail)
unset JWT_SECRET
npm start
# Expected: Error: Missing required environment variable: JWT_SECRET

# Test 2: Start with weak JWT_SECRET (should fail)
export JWT_SECRET="weak"
npm start
# Expected: Error: JWT_SECRET must be at least 32 characters long

# Test 3: Start with strong JWT_SECRET (should work)
export JWT_SECRET=$(openssl rand -base64 32)
npm start
# Expected: Server starts successfully with "✓ JWT_SECRET: configured and validated"
```

**Commit:**

```bash
git add ApiServer.js
git commit -m "security: Add JWT_SECRET validation on startup

- Validate JWT_SECRET exists before server starts
- Enforce minimum 32 character length for security
- Prevent app from starting with missing/weak JWT secrets
- Add validation logging

Fixes: CRITICAL #2 - JWT_SECRET not validated on startup
"
git push origin main
git push heroku main
```

---

### Fix #3: Rotate ALL API Keys (1 hour) ⚠️ MOST CRITICAL

**Issue:** API keys may be compromised from previous incident

**Follow the detailed procedure in SECURITY-RUNBOOK.md**

**Quick Steps:**

1. **Generate New Aircall API Credentials**
   - Go to https://dashboard.aircall.io
   - Integrations > API Keys > Create new API key
   - Save API ID and Token

2. **Generate New Slack Bot Token**
   - Go to https://api.slack.com/apps
   - Select your app > OAuth & Permissions
   - Reinstall App > Copy Bot User OAuth Token

3. **Generate New JWT Secret**
```bash
openssl rand -base64 32
```

4. **Update Heroku Config**
```bash
heroku config:set AIRCALL_API_ID="your_new_id" -a slack-kpi-service
heroku config:set AIRCALL_API_TOKEN="your_new_token" -a slack-kpi-service
heroku config:set SLACK_API_TOKEN="your_new_token" -a slack-kpi-service
heroku config:set JWT_SECRET="your_new_secret" -a slack-kpi-service

# Verify
heroku config -a slack-kpi-service
```

5. **Redeploy**
```bash
git commit --allow-empty -m "security: Trigger redeploy with new credentials"
git push heroku main

# Monitor
heroku logs --tail -a slack-kpi-service
```

6. **Test**
```bash
curl https://slack-kpi-service.herokuapp.com/health
curl https://slack-kpi-service.herokuapp.com/test-connections \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

7. **Revoke Old Credentials (after 24 hours)**
   - Aircall: Dashboard > API Keys > Revoke old key
   - Slack: App dashboard > OAuth & Permissions > Revoke old token

---

## Priority 2: HIGH - Fix This Week

### Fix #4: Remove or Protect Debug Endpoint (15 minutes)

**Issue:** `/debug/activity-data` endpoint accessible without authentication

**Option 1: Remove debug endpoint (RECOMMENDED)**

```javascript
// FILE: routes/report.js
// LOCATION: Lines 421-451

// DELETE these lines:
router.get('/debug/activity-data', async (req, res) => {
  try {
    logger.info('Debug activity data endpoint called');
    const data = await generateReport('afternoon');
    const organized = organizeUsersByCategory(data.users || []);

    res.json({
      success: true,
      data: {
        period: data.period,
        startTime: data.startTime,
        endTime: data.endTime,
        summary: {
          totalUsers: organized.totalUsers,
          dispoCount: organized.dispoCount,
          acquisitionCount: organized.acquisitionCount,
          otherCount: organized.otherCount
        },
        dispoAgents: organized.dispoAgents.map(formatUserData),
        acquisitionAgents: organized.acquisitionAgents.map(formatUserData),
        otherUsers: organized.otherUsers.map(formatUserData),
        users: data.users ? data.users.map(formatUserData) : []
      }
    });
  } catch (error) {
    logger.error('Error getting debug activity data:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Option 2: Only enable in development**

```javascript
// FILE: routes/report.js
// LOCATION: Lines 421

// REPLACE with:
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/activity-data', async (req, res) => {
    // ... existing code ...
  });
}
```

**Also remove from auth bypass:**

```javascript
// FILE: ApiServer.js
// LOCATION: Line 170

// BEFORE:
if (['/health', '/status'].includes(req.path) ||
    req.path.startsWith('/debug/')) {
  return next();
}

// AFTER:
if (['/health', '/status'].includes(req.path)) {
  return next();
}
```

**Commit:**

```bash
git add routes/report.js ApiServer.js
git commit -m "security: Remove unauthenticated debug endpoint

- Remove /debug/activity-data endpoint that exposed sensitive data
- Remove /debug/ path from authentication bypass
- All endpoints now require proper JWT authentication

Fixes: HIGH #4 - Debug endpoint accessible without authentication
"
git push origin main
git push heroku main
```

---

### Fix #5: Sanitize Error Messages (1 hour)

**Issue:** Error messages may leak internal information

**File:** Create new error handler utility

**Step 1: Create error handler utility**

```javascript
// FILE: utils/errorHandler.js (NEW FILE)

const crypto = require('crypto');

/**
 * Sanitize error messages for production
 * Logs full error internally, returns safe message to client
 */
function sanitizeError(error, logger, options = {}) {
  const { includeDetails = false, errorId = generateErrorId() } = options;

  // Log full error internally with error ID for tracking
  logger.error('Error occurred:', {
    errorId,
    message: error.message,
    stack: error.stack,
    code: error.code,
    timestamp: new Date().toISOString()
  });

  // In production, return generic message unless explicitly allowed
  if (process.env.NODE_ENV === 'production' && !includeDetails) {
    return {
      success: false,
      error: 'An internal server error occurred. Please try again later.',
      errorId, // For support tracking
      support: 'If this persists, contact support with the error ID'
    };
  }

  // In development, include more details for debugging
  return {
    success: false,
    error: error.message,
    errorId
  };
}

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = {
  sanitizeError,
  generateErrorId
};
```

**Step 2: Update route handlers**

```javascript
// FILE: routes/report.js
// ADD at top:
const { sanitizeError } = require('../utils/errorHandler');

// LOCATION: Line 118-121 (and similar patterns throughout)

// BEFORE:
} catch (error) {
  logger.error('Error running afternoon report:', error.message);
  res.status(500).json({ success: false, error: error.message });
}

// AFTER:
} catch (error) {
  const sanitized = sanitizeError(error, logger);
  res.status(500).json(sanitized);
}
```

**Step 3: Update all error handlers**

Apply the same pattern to:
- `routes/report.js`: Lines 120, 194, 416, 450
- `routes/testConnections.js`: Line 19
- `ApiServer.js`: Lines 190-194 (global error handler)

**Step 4: Create utils directory**

```bash
mkdir -p utils
# Create the errorHandler.js file with content above
```

**Commit:**

```bash
git add utils/errorHandler.js routes/report.js routes/testConnections.js ApiServer.js
git commit -m "security: Sanitize error messages to prevent info disclosure

- Create centralized error handler utility
- Generate unique error IDs for tracking
- Return generic errors in production
- Keep detailed errors in development
- Log all errors internally with full details
- Update all route handlers to use sanitized errors

Fixes: HIGH #5 - Error messages may leak internal information
"
git push origin main
git push heroku main
```

---

### Fix #6: Enhanced Rate Limiting (30 minutes)

**Issue:** Single rate limit for all endpoints, could be more granular

**File:** `ApiServer.js`

**Changes:**

```javascript
// FILE: ApiServer.js
// LOCATION: Lines 144-151 (setupMiddleware method)

// BEFORE:
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
this.app.use(limiter);

// AFTER:
// General rate limiter for all endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' }
});

// Stricter limiter for report generation (expensive operations)
const reportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Reports are expensive
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { success: false, error: 'Report generation rate limit exceeded. Please wait before requesting another report.' }
});

// Apply general limiter globally
this.app.use(generalLimiter);

// ... later in setupRoutes() method, BEFORE mounting report router:
// Apply stricter rate limit to report endpoints
this.app.use('/report', reportLimiter);
```

**Commit:**

```bash
git add ApiServer.js
git commit -m "security: Implement granular rate limiting

- Add stricter rate limiting for expensive report operations
- 20 requests per 5 minutes for /report/* endpoints
- 100 requests per 15 minutes for general endpoints
- Add descriptive error messages
- Prevent API abuse and DoS attacks

Improves: MEDIUM #7 - Rate limiting configuration
"
git push origin main
git push heroku main
```

---

## Priority 3: MEDIUM - Fix This Month

### Fix #7: Enhanced Helmet Configuration (30 minutes)

**File:** `ApiServer.js`

**Changes:**

```javascript
// FILE: ApiServer.js
// LOCATION: Line 142

// BEFORE:
this.app.use(helmet());

// AFTER:
this.app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny' // Prevent clickjacking
  },
  noSniff: true, // Prevent MIME type sniffing
  xssFilter: true, // Enable XSS filter
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
}));
```

**Commit:**

```bash
git add ApiServer.js
git commit -m "security: Enhanced security headers configuration

- Configure Content Security Policy (CSP)
- Set HSTS with 1 year max-age and preload
- Prevent clickjacking with frameguard
- Enable MIME type sniffing prevention
- Configure strict referrer policy
- Maintain Swagger UI compatibility

Implements: MEDIUM #8 - Missing security headers recommendations
"
git push origin main
git push heroku main
```

---

### Fix #8: Remove CORS Origin Logging (5 minutes)

**File:** `ApiServer.js`

**Changes:**

```javascript
// FILE: ApiServer.js
// LOCATION: Line 131

// BEFORE:
origin: function (origin, callback) {
  console.log('CORS request from origin:', origin);
  if (!origin) return callback(null, true);
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
},

// AFTER:
origin: function (origin, callback) {
  // Remove console.log to prevent log injection
  if (!origin) return callback(null, true);
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
},
```

**Commit:**

```bash
git add ApiServer.js
git commit -m "security: Remove CORS origin logging

- Remove console.log from CORS handler
- Prevent potential log injection
- Reduce unnecessary log noise

Fixes: MEDIUM #6 - CORS origin logging may expose information
"
git push origin main
git push heroku main
```

---

## Testing All Fixes

After implementing all fixes, run this comprehensive test suite:

### 1. Dependency Vulnerabilities

```bash
npm audit
# Expected: 0 vulnerabilities
```

### 2. JWT_SECRET Validation

```bash
# Test missing JWT_SECRET
unset JWT_SECRET
npm start
# Expected: Error: Missing required environment variable: JWT_SECRET

# Test weak JWT_SECRET
export JWT_SECRET="weak"
npm start
# Expected: Error: JWT_SECRET must be at least 32 characters long

# Test valid JWT_SECRET
export JWT_SECRET=$(openssl rand -base64 32)
npm start
# Expected: Server starts with "✓ JWT_SECRET: configured and validated"
```

### 3. Authentication

```bash
# Test unauthenticated request
curl -X POST http://localhost:6000/report/afternoon
# Expected: {"success":false,"error":"Missing token"}

# Test debug endpoint removed/protected
curl http://localhost:6000/debug/activity-data
# Expected: 401 or 404
```

### 4. Rate Limiting

```bash
# Test general rate limiting (100 requests in 15 minutes)
for i in {1..101}; do curl http://localhost:6000/health; echo "Request $i"; done
# Expected: Request 101 should be rate limited

# Test report rate limiting (20 requests in 5 minutes)
# (Requires valid JWT token)
for i in {1..21}; do
  curl -X GET http://localhost:6000/report/today \
    -H "Authorization: Bearer YOUR_JWT_TOKEN"
  echo "Report request $i"
done
# Expected: Request 21 should be rate limited
```

### 5. Error Message Sanitization

```bash
# In production mode, trigger an error
NODE_ENV=production npm start

# Make a request that causes an error
# Error response should include errorId but not stack trace
```

### 6. Security Headers

```bash
# Test security headers
curl -I http://localhost:6000/health

# Should see:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: (various directives)
```

---

## Deployment Checklist

Before deploying to production:

```markdown
- [ ] All tests pass
- [ ] npm audit shows 0 vulnerabilities
- [ ] No .env files committed
- [ ] JWT_SECRET validated on startup
- [ ] All API keys rotated
- [ ] Debug endpoints removed/protected
- [ ] Error messages sanitized
- [ ] Rate limiting enhanced
- [ ] Security headers configured
- [ ] CORS logging removed
- [ ] README updated with security notes
- [ ] SECURITY-AUDIT-REPORT.md reviewed
- [ ] SECURITY-RUNBOOK.md reviewed
```

---

## Rollback Plan

If something goes wrong after deployment:

```bash
# 1. Check Heroku logs
heroku logs --tail -a slack-kpi-service

# 2. Check recent releases
heroku releases -a slack-kpi-service

# 3. Rollback to previous version
heroku rollback -a slack-kpi-service

# 4. If config issue, restore old config
heroku config:set VARIABLE=old_value -a slack-kpi-service

# 5. Monitor logs
heroku logs --tail -a slack-kpi-service
```

---

## Post-Implementation

After all fixes are deployed:

1. **Update security log:**
```bash
echo "$(date): Security fixes implemented - all critical issues resolved" >> security-log.txt
git add security-log.txt
git commit -m "docs: Log security fixes implementation"
git push origin main
```

2. **Schedule next security review:**
   - Set calendar reminder for 3 months
   - Follow SECURITY-RUNBOOK.md for regular maintenance

3. **Set up monitoring:**
   - Configure Heroku alerts (see SECURITY-RUNBOOK.md)
   - Set up daily/weekly review schedule

4. **Document for team:**
   - Share SECURITY-AUDIT-REPORT.md
   - Share SECURITY-RUNBOOK.md
   - Train team on security procedures

---

**Implementation Guide Version:** 1.0
**Last Updated:** 2026-01-22
**Next Review:** 2026-04-22
