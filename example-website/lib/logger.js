/**
 * Structured Logging Service
 * Provides consistent logging with correlation IDs and structured output
 */

import { randomUUID } from 'crypto';
import config from '../config/index.js';

class Logger {
  constructor() {
    this.level = config.logging.level || 'info';
    this.format = config.logging.format || 'json';
    this.includeTimestamp = config.logging.includeTimestamp !== false;
    this.includeCorrelationId = config.logging.includeCorrelationId !== false;
    
    // Log levels with numeric values for comparison
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    this.currentLevel = this.levels[this.level] || this.levels.info;
  }

  /**
   * Create a correlation ID for request tracking
   */
  createCorrelationId() {
    return randomUUID();
  }

  /**
   * Format log entry based on configuration
   */
  formatLog(level, message, meta = {}) {
    const logEntry = {
      level,
      message,
      ...meta
    };

    if (this.includeTimestamp) {
      logEntry.timestamp = new Date().toISOString();
    }

    if (this.format === 'json') {
      return JSON.stringify(logEntry);
    } else {
      // Pretty format for development
      const timestamp = logEntry.timestamp ? `[${logEntry.timestamp}] ` : '';
      const correlationId = logEntry.correlationId ? `[${logEntry.correlationId}] ` : '';
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp}${correlationId}[${level.toUpperCase()}] ${message}${metaStr}`;
    }
  }

  /**
   * Check if a log level should be output
   */
  shouldLog(level) {
    return this.levels[level] >= this.currentLevel;
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatLog('debug', message, meta));
    }
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', message, meta));
    }
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, meta));
    }
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      // Include stack trace if error object is provided
      if (meta.error && meta.error.stack) {
        meta.stack = meta.error.stack;
      }
      console.error(this.formatLog('error', message, meta));
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context = {}) {
    const childLogger = Object.create(this);
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    return childLogger;
  }

  /**
   * Log with custom context
   */
  log(level, message, meta = {}) {
    const mergedMeta = { ...this.defaultContext, ...meta };
    
    switch (level) {
      case 'debug':
        this.debug(message, mergedMeta);
        break;
      case 'info':
        this.info(message, mergedMeta);
        break;
      case 'warn':
        this.warn(message, mergedMeta);
        break;
      case 'error':
        this.error(message, mergedMeta);
        break;
      default:
        this.info(message, mergedMeta);
    }
  }
}

// Create singleton instance
const logger = new Logger();

/**
 * Express middleware for request logging with correlation IDs
 */
export function requestLogger() {
  return (req, res, next) => {
    // Generate correlation ID
    const correlationId = logger.createCorrelationId();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    // Log request
    const startTime = Date.now();
    
    logger.info('Incoming request', {
      correlationId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const level = res.statusCode >= 400 ? 'warn' : 'info';
      
      logger.log(level, 'Request completed', {
        correlationId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    });

    next();
  };
}

/**
 * Express middleware for error logging
 */
export function errorLogger() {
  return (err, req, res, next) => {
    logger.error('Request error', {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      error: err.message,
      stack: err.stack
    });
    next(err);
  };
}

export default logger;
