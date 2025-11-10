/**
 * Security middleware for input validation, sanitization, and monitoring
 * Implements comprehensive XSS protection, injection prevention, and security logging
 */

import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import validator from 'validator';
import { createHash } from 'crypto';

// Setup DOMPurify for server-side use
const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Security event logger
 */
class SecurityLogger {
  constructor() {
    this.events = [];
    this.maxEvents = 10000; // Keep last 10k events
    this.suspiciousPatterns = new Map(); // Track suspicious patterns by IP
  }

  /**
   * Log a security event
   */
  logEvent(type, severity, details, req) {
    const event = {
      id: createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').substring(0, 16),
      timestamp: new Date().toISOString(),
      type,
      severity, // 'low', 'medium', 'high', 'critical'
      ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
      userAgent: req?.get('user-agent') || 'unknown',
      path: req?.path || 'unknown',
      method: req?.method || 'unknown',
      details
    };

    this.events.push(event);

    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Track suspicious patterns
    this.trackSuspiciousActivity(event);

    // Log to console for critical events
    if (severity === 'critical' || severity === 'high') {
      console.warn(`🚨 Security Event [${severity.toUpperCase()}]:`, {
        type,
        ip: event.ip,
        path: event.path,
        details
      });
    }

    return event;
  }

  /**
   * Track suspicious activity patterns
   */
  trackSuspiciousActivity(event) {
    const key = event.ip;
    
    if (!this.suspiciousPatterns.has(key)) {
      this.suspiciousPatterns.set(key, {
        count: 0,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        events: []
      });
    }

    const pattern = this.suspiciousPatterns.get(key);
    pattern.count++;
    pattern.lastSeen = event.timestamp;
    pattern.events.push({
      type: event.type,
      severity: event.severity,
      timestamp: event.timestamp
    });

    // Keep only last 100 events per IP
    if (pattern.events.length > 100) {
      pattern.events = pattern.events.slice(-100);
    }

    // Check for intrusion patterns
    if (pattern.count > 50) {
      this.logEvent('intrusion_detected', 'critical', {
        message: 'High volume of suspicious activity detected',
        eventCount: pattern.count,
        timespan: `${pattern.firstSeen} to ${pattern.lastSeen}`
      }, { ip: key });
    }
  }

  /**
   * Get security events with filtering
   */
  getEvents(filters = {}) {
    let filtered = [...this.events];

    if (filters.severity) {
      filtered = filtered.filter(e => e.severity === filters.severity);
    }

    if (filters.type) {
      filtered = filtered.filter(e => e.type === filters.type);
    }

    if (filters.ip) {
      filtered = filtered.filter(e => e.ip === filters.ip);
    }

    if (filters.since) {
      const sinceDate = new Date(filters.since);
      filtered = filtered.filter(e => new Date(e.timestamp) >= sinceDate);
    }

    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Get security audit report
   */
  getAuditReport(timeRange = 3600000) { // Default 1 hour
    const since = new Date(Date.now() - timeRange);
    const recentEvents = this.events.filter(e => new Date(e.timestamp) >= since);

    const report = {
      timeRange: `${since.toISOString()} to ${new Date().toISOString()}`,
      totalEvents: recentEvents.length,
      bySeverity: {
        critical: recentEvents.filter(e => e.severity === 'critical').length,
        high: recentEvents.filter(e => e.severity === 'high').length,
        medium: recentEvents.filter(e => e.severity === 'medium').length,
        low: recentEvents.filter(e => e.severity === 'low').length
      },
      byType: {},
      topIPs: {},
      suspiciousIPs: []
    };

    // Count by type
    recentEvents.forEach(event => {
      report.byType[event.type] = (report.byType[event.type] || 0) + 1;
      report.topIPs[event.ip] = (report.topIPs[event.ip] || 0) + 1;
    });

    // Find suspicious IPs
    for (const [ip, pattern] of this.suspiciousPatterns.entries()) {
      if (pattern.count > 20) {
        report.suspiciousIPs.push({
          ip,
          eventCount: pattern.count,
          firstSeen: pattern.firstSeen,
          lastSeen: pattern.lastSeen,
          recentEvents: pattern.events.slice(-10)
        });
      }
    }

    return report;
  }

  /**
   * Clear old events
   */
  clearOldEvents(olderThan = 86400000) { // Default 24 hours
    const cutoff = new Date(Date.now() - olderThan);
    this.events = this.events.filter(e => new Date(e.timestamp) >= cutoff);
  }
}

// Global security logger instance
export const securityLogger = new SecurityLogger();

/**
 * Input validation middleware
 */
export function inputValidation(options = {}) {
  const {
    maxBodySize = 10 * 1024 * 1024, // 10MB
    maxFieldLength = 100000,
    allowedContentTypes = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data']
  } = options;

  return (req, res, next) => {
    try {
      // Check content type
      const contentType = req.get('content-type');
      if (contentType && !allowedContentTypes.some(type => contentType.includes(type))) {
        securityLogger.logEvent('invalid_content_type', 'medium', {
          contentType,
          allowed: allowedContentTypes
        }, req);
        
        return res.status(415).json({
          error: 'Unsupported Media Type',
          message: 'Content-Type not allowed'
        });
      }

      // Validate body size
      const contentLength = parseInt(req.get('content-length') || '0');
      if (contentLength > maxBodySize) {
        securityLogger.logEvent('body_size_exceeded', 'medium', {
          size: contentLength,
          maxSize: maxBodySize
        }, req);
        
        return res.status(413).json({
          error: 'Payload Too Large',
          message: `Request body exceeds maximum size of ${maxBodySize} bytes`
        });
      }

      // Validate JSON body fields
      if (req.body && typeof req.body === 'object') {
        for (const [key, value] of Object.entries(req.body)) {
          if (typeof value === 'string' && value.length > maxFieldLength) {
            securityLogger.logEvent('field_length_exceeded', 'low', {
              field: key,
              length: value.length,
              maxLength: maxFieldLength
            }, req);
            
            return res.status(400).json({
              error: 'Field Too Large',
              message: `Field "${key}" exceeds maximum length of ${maxFieldLength} characters`
            });
          }
        }
      }

      next();
    } catch (error) {
      securityLogger.logEvent('validation_error', 'high', {
        error: error.message
      }, req);
      
      res.status(500).json({
        error: 'Validation Error',
        message: 'Failed to validate request'
      });
    }
  };
}

/**
 * XSS protection middleware
 */
export function xssProtection(options = {}) {
  const {
    sanitizeBody = true,
    sanitizeQuery = true,
    sanitizeParams = true,
    allowedTags = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    allowedAttributes = { 'a': ['href', 'title'] }
  } = options;

  return (req, res, next) => {
    try {
      // Configure DOMPurify
      const purifyConfig = {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: Object.values(allowedAttributes).flat(),
        KEEP_CONTENT: true
      };

      // Sanitize body
      if (sanitizeBody && req.body) {
        req.body = sanitizeObject(req.body, purifyConfig, req);
      }

      // Sanitize query parameters
      if (sanitizeQuery && req.query) {
        req.query = sanitizeObject(req.query, purifyConfig, req);
      }

      // Sanitize URL parameters
      if (sanitizeParams && req.params) {
        req.params = sanitizeObject(req.params, purifyConfig, req);
      }

      next();
    } catch (error) {
      securityLogger.logEvent('xss_protection_error', 'high', {
        error: error.message
      }, req);
      
      res.status(500).json({
        error: 'Security Error',
        message: 'Failed to sanitize request'
      });
    }
  };
}

/**
 * Sanitize an object recursively
 */
function sanitizeObject(obj, config, req) {
  if (typeof obj === 'string') {
    const sanitized = purify.sanitize(obj, config);
    
    // Check if sanitization changed the content (potential XSS attempt)
    if (sanitized !== obj) {
      securityLogger.logEvent('xss_attempt_blocked', 'high', {
        original: obj.substring(0, 200),
        sanitized: sanitized.substring(0, 200)
      }, req);
    }
    
    return sanitized;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, config, req));
  }

  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value, config, req);
    }
    return sanitized;
  }

  return obj;
}

/**
 * SQL injection prevention middleware
 */
export function sqlInjectionProtection() {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(UNION\s+SELECT)/gi,
    /(--|\#|\/\*|\*\/)/g,
    /(\bOR\b\s+\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s+\d+\s*=\s*\d+)/gi,
    /(;|\||&&)/g
  ];

  return (req, res, next) => {
    try {
      // Check all string inputs for SQL injection patterns
      const inputs = [
        ...Object.values(req.body || {}),
        ...Object.values(req.query || {}),
        ...Object.values(req.params || {})
      ];

      for (const input of inputs) {
        if (typeof input === 'string') {
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(input)) {
              securityLogger.logEvent('sql_injection_attempt', 'critical', {
                input: input.substring(0, 200),
                pattern: pattern.toString()
              }, req);
              
              return res.status(400).json({
                error: 'Invalid Input',
                message: 'Request contains potentially malicious content'
              });
            }
          }
        }
      }

      next();
    } catch (error) {
      securityLogger.logEvent('sql_protection_error', 'high', {
        error: error.message
      }, req);
      
      res.status(500).json({
        error: 'Security Error',
        message: 'Failed to validate request'
      });
    }
  };
}

/**
 * URL validation middleware
 */
export function urlValidation(fields = []) {
  return (req, res, next) => {
    try {
      for (const field of fields) {
        const value = getNestedValue(req.body, field);
        
        if (value && typeof value === 'string') {
          // Validate URL format
          if (!validator.isURL(value, { protocols: ['https'], require_protocol: true })) {
            securityLogger.logEvent('invalid_url', 'medium', {
              field,
              value: value.substring(0, 200)
            }, req);
            
            return res.status(400).json({
              error: 'Invalid URL',
              message: `Field "${field}" must be a valid HTTPS URL`
            });
          }

          // Additional security checks
          const url = new URL(value);
          
          // Block localhost and private IPs
          if (url.hostname === 'localhost' || 
              url.hostname === '127.0.0.1' ||
              url.hostname.startsWith('192.168.') ||
              url.hostname.startsWith('10.') ||
              url.hostname.startsWith('172.')) {
            
            securityLogger.logEvent('private_url_blocked', 'high', {
              field,
              url: value
            }, req);
            
            return res.status(400).json({
              error: 'Invalid URL',
              message: 'URLs pointing to private networks are not allowed'
            });
          }
        }
      }

      next();
    } catch (error) {
      securityLogger.logEvent('url_validation_error', 'medium', {
        error: error.message
      }, req);
      
      res.status(400).json({
        error: 'URL Validation Error',
        message: error.message
      });
    }
  };
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Request sanitization middleware
 */
export function sanitizeRequest() {
  return (req, res, next) => {
    // Remove null bytes
    if (req.body) {
      req.body = removeNullBytes(req.body);
    }
    if (req.query) {
      req.query = removeNullBytes(req.query);
    }
    if (req.params) {
      req.params = removeNullBytes(req.params);
    }

    next();
  };
}

/**
 * Remove null bytes from strings
 */
function removeNullBytes(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/\0/g, '');
  }

  if (Array.isArray(obj)) {
    return obj.map(removeNullBytes);
  }

  if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = removeNullBytes(value);
    }
    return cleaned;
  }

  return obj;
}

/**
 * Security headers middleware
 */
export function securityHeaders() {
  return (req, res, next) => {
    // Additional security headers beyond helmet
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
  };
}

/**
 * Intrusion detection middleware
 */
export function intrusionDetection() {
  const suspiciousPatterns = [
    { pattern: /\.\.\//g, name: 'directory_traversal' },
    { pattern: /<script[^>]*>.*?<\/script>/gi, name: 'script_injection' },
    { pattern: /javascript:/gi, name: 'javascript_protocol' },
    { pattern: /on\w+\s*=/gi, name: 'event_handler_injection' },
    { pattern: /eval\s*\(/gi, name: 'eval_usage' },
    { pattern: /base64/gi, name: 'base64_encoding' }
  ];

  return (req, res, next) => {
    try {
      const allInputs = JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params
      });

      for (const { pattern, name } of suspiciousPatterns) {
        if (pattern.test(allInputs)) {
          securityLogger.logEvent('intrusion_attempt', 'high', {
            pattern: name,
            path: req.path,
            method: req.method
          }, req);
          
          // Log but don't block - let other middleware handle it
          break;
        }
      }

      next();
    } catch (error) {
      next();
    }
  };
}

/**
 * Get security audit report
 */
export function getSecurityAuditReport(timeRange) {
  return securityLogger.getAuditReport(timeRange);
}

/**
 * Get security events
 */
export function getSecurityEvents(filters) {
  return securityLogger.getEvents(filters);
}
