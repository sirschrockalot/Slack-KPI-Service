# JWT Token Rotation Strategies

## Overview

This document outlines modern approaches to JWT token management that prevent API downtime while maintaining security. These strategies address the common problem where manual token rotation causes service interruptions.

---

## Problem with Manual Token Rotation

**Traditional Approach:**
```
1. Generate new JWT_SECRET
2. Update environment variable
3. Restart service
4. All existing tokens immediately invalid
5. Users experience 401 errors until they get new tokens
```

**Issues:**
- Service disruption during transition
- No warning to clients
- Requires coordinated deployment
- Can cause minutes to days of downtime for distributed systems

---

## Recommended Solutions

### Option 1: Short-Lived Access + Long-Lived Refresh Tokens (Industry Standard)

**Best for:** Production applications, user-facing services, mobile apps

**How it works:**
```
Access Token:  15 min - 1 hour expiration
Refresh Token: 7-30 days expiration
```

**Flow:**
1. Client authenticates → receives both tokens
2. Client uses access token for API calls
3. When access token expires (or close to expiry):
   - Client sends refresh token to `/auth/refresh`
   - Server validates refresh token
   - Server issues new access token (and optionally new refresh token)
4. Client updates access token and continues

**Advantages:**
- ✅ Zero downtime
- ✅ Limits exposure window (short-lived access tokens)
- ✅ Can revoke refresh tokens (store in database/Redis)
- ✅ Industry best practice (OAuth 2.0 standard)

**Implementation Complexity:** Medium

**Implementation Example:**

```javascript
// New endpoint: POST /auth/login
router.post('/auth/login', async (req, res) => {
  const { apiKey } = req.body;

  // Validate API key (your existing auth logic)
  if (!validateApiKey(apiKey)) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  // Generate tokens
  const accessToken = jwt.sign(
    { sub: apiKey, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { sub: apiKey, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,  // Different secret!
    { expiresIn: '30d' }
  );

  // Store refresh token (Redis, database, or in-memory)
  await storeRefreshToken(apiKey, refreshToken);

  res.json({
    success: true,
    accessToken,
    refreshToken,
    expiresIn: 3600 // seconds
  });
});

// New endpoint: POST /auth/refresh
router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check if token exists in storage (not revoked)
    const isValid = await validateRefreshToken(decoded.sub, refreshToken);
    if (!isValid) {
      return res.status(403).json({ success: false, error: 'Refresh token revoked' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { sub: decoded.sub, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      accessToken: newAccessToken,
      expiresIn: 3600
    });
  } catch (err) {
    res.status(403).json({ success: false, error: 'Invalid refresh token' });
  }
});

// Update JWT middleware to check token type and expiration
this.app.use((req, res, next) => {
  if (isPublicEndpoint(req.path)) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing token' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Check if token expired
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'  // Client knows to refresh
        });
      }
      return res.status(403).json({ success: false, error: 'Invalid token' });
    }

    // Verify it's an access token (not refresh token)
    if (user.type !== 'access') {
      return res.status(403).json({ success: false, error: 'Invalid token type' });
    }

    req.user = user;
    next();
  });
});
```

**Client-Side Implementation:**
```javascript
// Client stores both tokens
let accessToken = 'eyJ...';
let refreshToken = 'eyJ...';

async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    // Check if token expired
    if (response.status === 401) {
      const data = await response.json();
      if (data.code === 'TOKEN_EXPIRED') {
        // Refresh token
        const newToken = await refreshAccessToken();
        accessToken = newToken;

        // Retry original request
        return apiCall(endpoint, options);
      }
    }

    return response;
  } catch (err) {
    console.error('API call failed:', err);
    throw err;
  }
}

async function refreshAccessToken() {
  const response = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    // Refresh token invalid/expired - need to re-authenticate
    throw new Error('Please log in again');
  }

  const data = await response.json();
  return data.accessToken;
}
```

---

### Option 2: Rolling Tokens with Grace Period

**Best for:** Internal services, service-to-service communication, simpler deployments

**How it works:**
```
Token lifetime: 1 hour
Grace period: 5 minutes
New token issued: at 50% lifetime (30 minutes)
```

**Flow:**
1. Client receives token with 1-hour expiration
2. At 30-minute mark, server includes new token in response header
3. For next 5 minutes, server accepts BOTH old and new tokens
4. Client updates to new token
5. After grace period, old token is invalid

**Advantages:**
- ✅ Zero downtime during rotation
- ✅ Simpler than refresh tokens (no separate endpoint)
- ✅ Automatic rotation without client action
- ✅ Works well for service-to-service auth

**Implementation Complexity:** Medium

**Implementation Example:**

```javascript
// JWT middleware with rolling tokens and grace period
this.app.use((req, res, next) => {
  if (isPublicEndpoint(req.path)) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing token' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // If token expired, check grace period by trying to decode without verify
      if (err.name === 'TokenExpiredError') {
        const decoded = jwt.decode(token);
        const expiredAt = decoded.exp * 1000;
        const gracePeriod = 5 * 60 * 1000; // 5 minutes
        const now = Date.now();

        // If within grace period, allow but warn
        if (now - expiredAt < gracePeriod) {
          req.user = decoded;
          req.tokenNearExpiry = true;
          req.tokenExpired = true;
          return next();
        }
      }
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }

    // Check if token is past 50% of its lifetime
    const issued = user.iat * 1000;
    const expires = user.exp * 1000;
    const lifetime = expires - issued;
    const elapsed = Date.now() - issued;

    if (elapsed > lifetime * 0.5) {
      req.tokenNearExpiry = true;
    }

    req.user = user;
    next();
  });
});

// Middleware to add new token header if needed
this.app.use((req, res, next) => {
  const originalSend = res.send;

  res.send = function(data) {
    // If token is near expiry, issue new token
    if (req.tokenNearExpiry && req.user) {
      const newToken = jwt.sign(
        { sub: req.user.sub },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      res.set('X-New-Token', newToken);
      res.set('X-Token-Expires-In', '3600');
    }

    originalSend.call(this, data);
  };

  next();
});
```

**Client-Side Implementation:**
```javascript
async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${currentToken}`
    }
  });

  // Check for new token in response header
  const newToken = response.headers.get('X-New-Token');
  if (newToken) {
    console.log('Token rotated - updating to new token');
    currentToken = newToken;
    // Persist to storage
    localStorage.setItem('authToken', newToken);
  }

  return response;
}
```

---

### Option 3: Multiple Active Keys (API Key Versioning)

**Best for:** Service-to-service authentication, manual control, legacy systems

**How it works:**
```
Multiple JWT_SECRET values can be active simultaneously
Keys are versioned (v1, v2, v3, etc.)
Deprecation period: 30 days
```

**Flow:**
1. Generate new JWT_SECRET_V2
2. Server validates tokens against both V1 and V2
3. New tokens are signed with V2
4. After 30 days, deprecate V1
5. Clients have 30 days to migrate

**Advantages:**
- ✅ Zero downtime
- ✅ Manual control over rotation
- ✅ Long migration window (30+ days)
- ✅ Simple client implementation
- ✅ Can be used with non-expiring tokens

**Implementation Complexity:** Low

**Implementation Example:**

```javascript
// .env configuration
JWT_SECRET_V1=old_secret_here_min_32_chars_long
JWT_SECRET_V2=new_secret_here_min_32_chars_long
JWT_ACTIVE_VERSION=v2        # Version to use for NEW tokens
JWT_DEPRECATED_DATE_V1=2026-02-28  # When to stop accepting V1

// JWT middleware with multiple key support
this.app.use((req, res, next) => {
  if (isPublicEndpoint(req.path)) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing token' });
  }

  // Try to verify with each active secret
  const secrets = {
    v2: process.env.JWT_SECRET_V2,
    v1: process.env.JWT_SECRET_V1
  };

  let verified = false;
  let user = null;
  let tokenVersion = null;

  for (const [version, secret] of Object.entries(secrets)) {
    if (!secret) continue;

    // Check if this version is deprecated
    const deprecatedDate = process.env[`JWT_DEPRECATED_DATE_${version.toUpperCase()}`];
    if (deprecatedDate && new Date(deprecatedDate) < new Date()) {
      continue; // Skip deprecated versions
    }

    try {
      user = jwt.verify(token, secret);
      verified = true;
      tokenVersion = version;
      break;
    } catch (err) {
      // Try next secret
      continue;
    }
  }

  if (!verified) {
    return res.status(403).json({ success: false, error: 'Invalid token' });
  }

  // Warn if using old version
  if (tokenVersion === 'v1') {
    res.set('X-Token-Version', 'v1');
    res.set('X-Token-Deprecated', 'true');
    res.set('X-Token-Migration-Deadline', process.env.JWT_DEPRECATED_DATE_V1 || 'unknown');
    this.logger.warn(`Client using deprecated token version v1 from ${req.ip}`);
  }

  req.user = user;
  req.tokenVersion = tokenVersion;
  next();
});

// Optional: Endpoint to generate new token with latest version
router.post('/auth/rotate-token', authenticateJWT, (req, res) => {
  const activeVersion = process.env.JWT_ACTIVE_VERSION || 'v2';
  const secret = process.env[`JWT_SECRET_${activeVersion.toUpperCase()}`];

  const newToken = jwt.sign(
    { sub: req.user.sub, version: activeVersion },
    secret,
    { expiresIn: '30d' } // Or no expiration
  );

  res.json({
    success: true,
    token: newToken,
    version: activeVersion,
    message: `Token generated with ${activeVersion}`
  });
});
```

**Migration Process:**
```bash
# Week 0: Generate new secret
JWT_SECRET_V2=$(openssl rand -base64 32)

# Week 0: Deploy with both secrets
JWT_SECRET_V1=<old_secret>
JWT_SECRET_V2=<new_secret>
JWT_ACTIVE_VERSION=v2
JWT_DEPRECATED_DATE_V1=2026-02-28

# Week 0-4: Monitor logs for V1 usage
# Client teams have 4 weeks to migrate

# Week 4: Remove V1 from config
JWT_SECRET_V2=<current_secret>
JWT_ACTIVE_VERSION=v2
# JWT_SECRET_V1 removed
```

---

### Option 4: JWT with Expiration + Warning Headers (Simple)

**Best for:** Small deployments, prototypes, low-security requirements

**How it works:**
```
Token lifetime: 24 hours
Warning threshold: 2 hours before expiry
Server sends warning header when < 2 hours remaining
```

**Flow:**
1. Client receives token (24-hour expiration)
2. When token has < 2 hours remaining, server adds warning header
3. Client proactively requests new token
4. Client updates token before expiration

**Advantages:**
- ✅ Very simple implementation
- ✅ Built-in expiration
- ✅ Clients get advance warning

**Disadvantages:**
- ⚠️ Clients must check headers
- ⚠️ Brief downtime if client doesn't refresh in time
- ⚠️ No grace period

**Implementation Complexity:** Low

**Implementation Example:**

```javascript
// JWT middleware with expiration warnings
this.app.use((req, res, next) => {
  if (isPublicEndpoint(req.path)) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing token' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }

    // Check time until expiration
    const expiresAt = user.exp * 1000;
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const twoHours = 2 * 60 * 60 * 1000;

    if (timeUntilExpiry < twoHours) {
      // Add warning headers
      res.set('X-Token-Expires-Soon', 'true');
      res.set('X-Token-Expires-At', new Date(expiresAt).toISOString());
      res.set('X-Token-Expires-In', Math.floor(timeUntilExpiry / 1000)); // seconds
    }

    req.user = user;
    next();
  });
});

// Endpoint to request new token
router.post('/auth/renew-token', authenticateJWT, (req, res) => {
  const newToken = jwt.sign(
    { sub: req.user.sub },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token: newToken,
    expiresIn: 86400 // 24 hours in seconds
  });
});
```

---

## Comparison Matrix

| Feature | Refresh Tokens | Rolling Tokens | Multi-Key | Warning Headers |
|---------|---------------|----------------|-----------|-----------------|
| **Zero Downtime** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Depends on client |
| **Security Level** | 🔒 High | 🔒 High | 🔒 Medium | 🔒 Medium |
| **Implementation** | Medium | Medium | Low | Low |
| **Client Complexity** | Medium | Low | Low | Low |
| **Token Revocation** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Manual Control** | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Migration Window** | N/A | 5 min | 30 days | 2 hours |
| **Best For** | Production | Internal | Legacy | Prototypes |

---

## Recommendation for Your Service

Based on your Slack KPI Service architecture:

### Immediate (Current Need): **Option 3 - Multiple Active Keys**

**Why:**
- Simple implementation (just update JWT middleware)
- Manual control over rotation schedule
- 30-day migration window prevents downtime
- Minimal client changes required
- Works with your existing token-based auth

**Implementation Time:** 1-2 hours

---

### Long-Term (Future Enhancement): **Option 1 - Refresh Tokens**

**Why:**
- Industry standard for production systems
- Best security posture (short-lived access tokens)
- Enables token revocation
- Scales well for multiple clients

**Implementation Time:** 4-8 hours (requires new endpoints, storage layer)

---

## Next Steps

1. **Immediate (Today):**
   - Implement Option 3 (Multiple Active Keys)
   - Add JWT_SECRET_V2 to environment
   - Test with both V1 and V2 tokens
   - Set deprecation date for V1

2. **Short-Term (This Month):**
   - Monitor token version usage
   - Add logging for deprecated tokens
   - Notify clients about migration deadline

3. **Long-Term (This Quarter):**
   - Evaluate need for refresh tokens
   - Implement token storage (Redis/database)
   - Add token revocation capability
   - Migrate to refresh token pattern if needed

---

## Security Best Practices

Regardless of which strategy you choose:

1. **Always use HTTPS in production** - JWT tokens must be transmitted securely
2. **Store tokens securely on client** - Use HttpOnly cookies or secure storage
3. **Validate token claims** - Check `exp`, `iat`, `iss`, `aud` fields
4. **Use strong secrets** - Minimum 32 characters, cryptographically random
5. **Rotate secrets regularly** - Every 90 days minimum
6. **Monitor for anomalies** - Track token usage patterns, invalid attempts
7. **Log token events** - Creation, refresh, expiration (not the token itself!)
8. **Never log tokens** - They're credentials, treat them like passwords

---

## References

- [RFC 6749: OAuth 2.0 Authorization Framework](https://tools.ietf.org/html/rfc6749)
- [RFC 7519: JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Auth0: Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
