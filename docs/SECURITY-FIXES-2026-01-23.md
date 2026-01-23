# Security Fixes - January 23, 2026

## Summary

Fixed two critical security vulnerabilities and added comprehensive JWT token rotation strategy documentation.

---

## 1. Fixed: /metrics Endpoint Security

### Issue
The `/metrics` endpoint (Prometheus metrics) was publicly accessible without authentication, exposing internal application performance data.

### Risk
- **Severity:** HIGH
- **Impact:** Information disclosure - attackers could:
  - Monitor request patterns to identify peak load times
  - Detect error rates and types
  - Analyze response times for timing attacks
  - Understand internal architecture and endpoints

### Fix
Updated JWT authentication middleware to explicitly protect `/metrics` endpoint.

**Changes in `ApiServer.js`:**
- Line 274-296: Updated JWT middleware to clarify public vs protected endpoints
- Only `/health`, `/status`, and `/api-docs` are now public
- `/metrics` now requires valid JWT Bearer token
- Added clear logging to indicate protected vs public endpoints

**Before:**
```javascript
if (['/health', '/status'].includes(req.path)) {
  return next();
}
```

**After:**
```javascript
const publicEndpoints = ['/health', '/status', '/api-docs'];
const isPublicEndpoint = publicEndpoints.some(endpoint =>
  req.path === endpoint || req.path.startsWith(endpoint + '/')
);

if (isPublicEndpoint) {
  return next();
}
// All other endpoints (including /metrics) require JWT
```

### Testing
```bash
# Should fail (401 Unauthorized)
curl http://localhost:6000/metrics

# Should succeed with valid JWT
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:6000/metrics
```

---

## 2. Fixed: CORS Configuration for Production

### Issue
CORS was hardcoded to only allow `localhost` origins, preventing the API from being called from browser-based applications in production environments.

### Risk
- **Severity:** MEDIUM
- **Impact:**
  - Cannot deploy to production with browser clients
  - Hardcoded configuration prevents environment-specific deployments
  - All production requests from browsers would fail

### Fix
Made CORS configuration environment-based using `ALLOWED_ORIGINS` environment variable.

**Changes in `ApiServer.js`:**
- Line 203-231: Replaced hardcoded regex with environment-based configuration
- Added support for multiple origins (comma-separated)
- Maintains security: explicit allow-list (no wildcards)
- Falls back to localhost if not configured (safe default)

**Changes in `.env.example`:**
- Added `ALLOWED_ORIGINS` configuration option
- Documented production example
- Added comments explaining usage

**Before:**
```javascript
if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
  return callback(null, true);
}
```

**After:**
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost', 'http://localhost:3000', 'http://localhost:6000'];

const isAllowed = allowedOrigins.some(allowedOrigin => {
  if (origin === allowedOrigin) return true;
  // Allow localhost with any port
  if (allowedOrigin === 'http://localhost' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
});
```

### Configuration

**Development (default):**
```bash
# No configuration needed - defaults to localhost
```

**Production:**
```bash
# .env
ALLOWED_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
```

**Multiple environments:**
```bash
# Staging
ALLOWED_ORIGINS=https://staging.yourdomain.com,http://localhost:3000

# Production
ALLOWED_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
```

### Testing
```bash
# Check CORS in logs on startup
npm start
# Should show: "✓ CORS allowed origins: http://localhost, http://localhost:3000, http://localhost:6000"

# Test with browser
# Open browser console and run:
fetch('http://localhost:6000/health', {
  mode: 'cors',
  credentials: 'include'
})
.then(r => r.json())
.then(console.log)
```

---

## 3. Added: JWT Token Rotation Strategy Documentation

### Added Documentation
Created comprehensive guide: `docs/JWT-ROTATION-STRATEGIES.md`

### Contents
- **4 Modern JWT Rotation Strategies:**
  1. Short-Lived Access + Long-Lived Refresh Tokens (OAuth 2.0 standard)
  2. Rolling Tokens with Grace Period
  3. Multiple Active Keys (API Key Versioning) - **Recommended for immediate implementation**
  4. JWT with Expiration + Warning Headers

- **Implementation Examples:**
  - Complete code samples for each strategy
  - Client-side implementation patterns
  - Error handling and edge cases

- **Comparison Matrix:**
  - Security level
  - Implementation complexity
  - Zero-downtime capability
  - Migration windows

- **Recommendations:**
  - **Immediate:** Implement Multiple Active Keys (Option 3)
    - Simple, manual control, 30-day migration window
    - Prevents API downtime during token rotation
  - **Long-term:** Migrate to Refresh Tokens (Option 1)
    - Industry standard, best security posture
    - Token revocation capability

### Updated `.env.example`
Added JWT configuration documentation:
```bash
# JWT Authentication Configuration
# IMPORTANT: Must be at least 32 characters for security
# Generate with: openssl rand -base64 32
JWT_SECRET=your_generated_secret_here

# JWT Token Expiration (optional, in seconds or string format like '1h', '7d', '30d')
# If not set, tokens never expire (not recommended for production)
# Recommended: 1h for access tokens, implement refresh token mechanism
# JWT_EXPIRATION=1h
```

---

## Deployment Checklist

### Before Deploying These Changes

- [x] Code changes validated (syntax check passed)
- [ ] Update `.env` with `ALLOWED_ORIGINS` for production
- [ ] Test `/metrics` endpoint requires JWT
- [ ] Test CORS with production domain
- [ ] Review JWT rotation strategy documentation
- [ ] Plan JWT secret rotation using recommended strategy

### Production Environment Variables to Add

```bash
# Required for CORS (production domains)
ALLOWED_ORIGINS=https://your-production-domain.com,https://your-admin-domain.com

# Optional: Enable JWT expiration (recommended)
JWT_EXPIRATION=1h

# Future: For multiple active keys strategy
JWT_SECRET_V1=<current_secret>
JWT_SECRET_V2=<new_secret>
JWT_ACTIVE_VERSION=v2
JWT_DEPRECATED_DATE_V1=2026-02-28
```

### Testing Commands

```bash
# 1. Check server starts successfully
npm start

# 2. Verify /metrics is protected (should return 401)
curl http://localhost:6000/metrics

# 3. Verify /metrics works with JWT (should return metrics)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:6000/metrics

# 4. Verify CORS allows configured origins
curl -H "Origin: http://localhost:3000" http://localhost:6000/health -v
# Should see: Access-Control-Allow-Origin: http://localhost:3000

# 5. Verify CORS blocks unknown origins (if not localhost)
curl -H "Origin: https://evil.com" http://localhost:6000/health -v
# Should NOT see Access-Control-Allow-Origin header
```

---

## Security Improvements Summary

| Issue | Before | After | Risk Reduction |
|-------|--------|-------|----------------|
| /metrics exposed | Public | JWT required | HIGH → LOW |
| CORS hardcoded | localhost only | Configurable | MEDIUM → LOW |
| JWT rotation | Manual, causes downtime | Documented strategies with zero downtime | HIGH → MEDIUM* |

\* Still requires implementation of recommended strategy

---

## Next Steps

### Immediate (This Week)
1. ✅ Deploy CORS and /metrics fixes
2. ⚠️ **CRITICAL:** Rotate API keys (mentioned in previous breach)
3. ⚠️ Add `ALLOWED_ORIGINS` to production environment
4. Test endpoints with production domain

### Short-Term (This Month)
5. Implement JWT multiple active keys strategy (Option 3)
6. Add JWT expiration (`JWT_EXPIRATION=1h`)
7. Remove PII from log files (sanitize user data)
8. Add per-user rate limiting (currently per-IP)

### Long-Term (This Quarter)
9. Implement refresh token strategy (Option 1)
10. Add role-based access control (RBAC)
11. Set up centralized logging with encryption
12. Implement token revocation capability

---

## References

- JWT Rotation Strategies: `docs/JWT-ROTATION-STRATEGIES.md`
- Security Audit: `docs/SECURITY-AUDIT.md`
- Previous Security Implementation: `docs/SECURITY-IMPLEMENTATION-COMPLETE.md`
- OWASP Top 10: https://owasp.org/www-project-top-ten/

---

## Questions?

For JWT rotation implementation questions, see `docs/JWT-ROTATION-STRATEGIES.md` which includes:
- Detailed implementation examples
- Client-side code samples
- Migration procedures
- Security best practices
