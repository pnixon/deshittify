# Security Implementation Guide

This document describes the comprehensive security measures implemented in the Ansybl example website.

## Overview

The security implementation includes:
- **Cryptographic Security**: Ed25519 key management with rotation and secure storage
- **Input Validation**: Comprehensive validation and sanitization of all user inputs
- **XSS Protection**: Multi-layer protection against cross-site scripting attacks
- **SQL Injection Prevention**: Pattern-based detection and blocking
- **Security Monitoring**: Real-time logging and intrusion detection
- **Audit Reporting**: Detailed security event tracking and analysis

## Cryptographic Security

### Key Management

The system uses Ed25519 elliptic curve cryptography for signing content. Key management features include:

#### Key Generation
```javascript
import { generateKeyPair } from './lib/signature.js';

const keyPair = await generateKeyPair();
// Returns: { privateKey: 'ed25519:...', publicKey: 'ed25519:...' }
```

#### Key Rotation
```javascript
import { KeyManager } from './lib/signature.js';

const keyManager = new KeyManager();
const rotated = await keyManager.rotateKey('my-key-id');
// Old keys are archived, new keys become active
```

#### Secure Storage
```javascript
import { SecureKeyStorage } from './lib/keyStorage.js';

const storage = new SecureKeyStorage();

// Store key pair with encryption
await storage.storeKeyPair('my-key-id', keyPair, {
  purpose: 'content-signing',
  environment: 'production'
});

// Load key pair
const loaded = await storage.loadKeyPair('my-key-id');
```

### Key Storage Security

Keys are stored with AES-256-GCM encryption:
- **Encryption**: All private keys are encrypted at rest
- **Access Control**: File permissions set to 0600 (owner read/write only)
- **Archiving**: Old keys are archived before rotation or deletion
- **Backup**: Encrypted backup functionality for disaster recovery

### API Endpoints

#### Generate Key Pair
```bash
POST /api/security/keys/generate
Content-Type: application/json

{
  "keyId": "my-key",
  "storeSecurely": true,
  "purpose": "content-signing"
}
```

#### Rotate Key
```bash
POST /api/security/keys/:keyId/rotate
```

#### Get Key Information
```bash
GET /api/security/keys/:keyId
```

#### List All Keys
```bash
GET /api/security/keys
```

## Input Validation and Sanitization

### Middleware Stack

The security middleware is applied in the following order:

1. **Security Headers**: Sets secure HTTP headers
2. **Request Sanitization**: Removes null bytes and malicious characters
3. **Intrusion Detection**: Monitors for suspicious patterns
4. **Input Validation**: Validates request size and content type
5. **SQL Injection Protection**: Blocks SQL injection attempts
6. **XSS Protection**: Sanitizes HTML and JavaScript (route-specific)

### Input Validation

```javascript
import { inputValidation } from './middleware/security.js';

app.use('/api/', inputValidation({
  maxBodySize: 10 * 1024 * 1024, // 10MB
  maxFieldLength: 100000,
  allowedContentTypes: ['application/json']
}));
```

Features:
- Maximum body size enforcement
- Field length validation
- Content-Type validation
- Automatic logging of violations

### XSS Protection

```javascript
import { xssProtection } from './middleware/security.js';

app.use('/api/posts', xssProtection({
  sanitizeBody: true,
  sanitizeQuery: true,
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p'],
  allowedAttributes: { 'a': ['href', 'title'] }
}));
```

Features:
- HTML sanitization using DOMPurify
- Configurable allowed tags and attributes
- Recursive object sanitization
- Automatic logging of XSS attempts

### SQL Injection Protection

```javascript
import { sqlInjectionProtection } from './middleware/security.js';

app.use('/api/', sqlInjectionProtection());
```

Detects and blocks:
- SQL keywords (SELECT, INSERT, UPDATE, DELETE, etc.)
- UNION SELECT attacks
- SQL comments (-- , #, /* */)
- Boolean-based injection (OR 1=1, AND 1=1)
- Command separators (; | &&)

### URL Validation

```javascript
import { urlValidation } from './middleware/security.js';

app.post('/api/posts', urlValidation(['author.url', 'home_page_url']), handler);
```

Features:
- HTTPS-only enforcement
- URL format validation
- Private network blocking (localhost, 192.168.x.x, 10.x.x.x)
- Automatic logging of invalid URLs

## Security Monitoring

### Security Logger

The security logger tracks all security-relevant events:

```javascript
import { securityLogger } from './middleware/security.js';

securityLogger.logEvent('custom_event', 'medium', {
  message: 'Custom security event',
  details: { ... }
}, req);
```

Event Severities:
- **low**: Informational events
- **medium**: Potential security issues
- **high**: Confirmed security violations
- **critical**: Severe security incidents

### Intrusion Detection

Automatic detection of:
- Directory traversal attempts (../)
- Script injection (<script> tags)
- JavaScript protocol usage (javascript:)
- Event handler injection (onclick=, onerror=)
- Eval usage
- Base64 encoding (potential obfuscation)

### Suspicious Activity Tracking

The system automatically tracks:
- Event count per IP address
- Time range of activity
- Pattern of security violations
- Automatic flagging of high-volume attackers

## Security Audit Reports

### Get Audit Report

```bash
GET /api/security/audit?timeRange=3600000
```

Returns:
- Total events in time range
- Events by severity level
- Events by type
- Top IP addresses
- Suspicious IPs with details

### Get Security Events

```bash
GET /api/security/events?severity=high&limit=100&offset=0
```

Query Parameters:
- `severity`: Filter by severity (low, medium, high, critical)
- `type`: Filter by event type
- `ip`: Filter by IP address
- `since`: Filter by timestamp (ISO 8601)
- `limit`: Number of results (default: 100)
- `offset`: Pagination offset

### Get Security Statistics

```bash
GET /api/security/stats?timeRange=3600000
```

Returns:
- Total events
- Critical and high severity counts
- Suspicious IP count
- Top event types
- Top IP addresses

## Security Best Practices

### Production Deployment

1. **Environment Variables**
   ```bash
   KEY_ENCRYPTION_SECRET=your-strong-secret-here
   NODE_ENV=production
   ```

2. **Key Storage**
   - Store keys outside the web root
   - Use proper file permissions (0600)
   - Regular key rotation schedule
   - Encrypted backups

3. **Monitoring**
   - Review security audit reports daily
   - Set up alerts for critical events
   - Monitor suspicious IP patterns
   - Regular security event analysis

4. **Rate Limiting**
   - Already configured for API endpoints
   - Adjust limits based on traffic patterns
   - Consider IP-based blocking for repeat offenders

5. **HTTPS**
   - Always use HTTPS in production
   - Enforce HTTPS redirects
   - Use HSTS headers
   - Valid SSL certificates

### Security Headers

The following security headers are automatically set:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: (configured via Helmet)
```

### Input Sanitization

All user inputs are sanitized:
- HTML content is sanitized with DOMPurify
- URLs are validated and restricted to HTTPS
- File uploads are validated by type and size
- SQL injection patterns are blocked
- Null bytes are removed

## Incident Response

### Detecting Attacks

1. Monitor `/api/security/audit` for unusual patterns
2. Check `/api/security/events` for high/critical events
3. Review suspicious IPs in audit reports
4. Analyze event types for attack patterns

### Responding to Incidents

1. **Immediate Actions**
   - Block attacking IP addresses
   - Review affected resources
   - Check for data breaches
   - Rotate compromised keys

2. **Investigation**
   - Export security events for analysis
   - Review application logs
   - Check for unauthorized access
   - Assess damage scope

3. **Recovery**
   - Restore from backups if needed
   - Update security measures
   - Patch vulnerabilities
   - Document incident

### Key Compromise

If a private key is compromised:

1. Immediately rotate the key:
   ```bash
   POST /api/security/keys/:keyId/rotate
   ```

2. Review all content signed with the old key
3. Re-sign critical content with new key
4. Update public key distribution
5. Notify users if necessary

## Testing Security

### Manual Testing

Test XSS protection:
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"<script>alert(1)</script>","content":"test"}'
```

Test SQL injection protection:
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"test","content":"test OR 1=1"}'
```

Test URL validation:
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"test","author":{"url":"http://localhost"}}'
```

### Automated Testing

Run security tests:
```bash
npm test
```

### Security Audit

Review security events:
```bash
curl http://localhost:3000/api/security/audit
```

Check for suspicious activity:
```bash
curl http://localhost:3000/api/security/events?severity=high
```

## Maintenance

### Regular Tasks

1. **Daily**
   - Review security audit reports
   - Check for critical events
   - Monitor suspicious IPs

2. **Weekly**
   - Analyze security trends
   - Update security rules if needed
   - Review key rotation schedule

3. **Monthly**
   - Rotate keys (if policy requires)
   - Backup keys securely
   - Security dependency updates
   - Penetration testing

4. **Quarterly**
   - Full security audit
   - Review and update security policies
   - Test incident response procedures
   - Security training

### Backup and Recovery

Backup keys regularly:
```bash
POST /api/security/keys/backup
{
  "backupPath": "./backups/keys-backup.enc"
}
```

Store backups:
- Encrypted at rest
- Off-site storage
- Access controlled
- Regular testing

## Support and Resources

### Documentation
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

### Security Tools
- Helmet.js (HTTP headers)
- DOMPurify (XSS protection)
- express-rate-limit (Rate limiting)
- validator (Input validation)

### Monitoring
- Security event logs
- Audit reports
- Intrusion detection alerts
- Key management logs

## Conclusion

This security implementation provides comprehensive protection against common web vulnerabilities while maintaining usability and performance. Regular monitoring, maintenance, and updates are essential for maintaining security posture.

For questions or security concerns, please review the security audit reports and event logs regularly.
