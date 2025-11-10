/**
 * Application Performance Monitoring
 * Tracks metrics, performance, and health status
 */

import { performance } from 'perf_hooks';
import os from 'os';
import config from '../config/index.js';
import logger from './logger.js';

class Monitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byMethod: {},
        byPath: {},
        byStatusCode: {}
      },
      performance: {
        responseTime: [],
        maxResponseTime: 0,
        minResponseTime: Infinity
      },
      system: {
        startTime: Date.now(),
        uptime: 0
      },
      custom: {}
    };

    this.healthChecks = new Map();
    this.isShuttingDown = false;

    // Start periodic metrics collection
    if (config.monitoring.enabled) {
      this.startMetricsCollection();
    }
  }

  /**
   * Start collecting system metrics periodically
   */
  startMetricsCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // Every minute
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    this.metrics.system = {
      ...this.metrics.system,
      uptime: Date.now() - this.metrics.system.startTime,
      memory: {
        used: process.memoryUsage(),
        total: os.totalmem(),
        free: os.freemem(),
        usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
      },
      cpu: {
        load: os.loadavg(),
        cores: os.cpus().length
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version
      }
    };
  }

  /**
   * Record a request
   */
  recordRequest(method, path, statusCode, duration) {
    this.metrics.requests.total++;

    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.success++;
    } else if (statusCode >= 400) {
      this.metrics.requests.errors++;
    }

    // Track by method
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;

    // Track by path (simplified)
    const simplePath = path.split('?')[0];
    this.metrics.requests.byPath[simplePath] = (this.metrics.requests.byPath[simplePath] || 0) + 1;

    // Track by status code
    this.metrics.requests.byStatusCode[statusCode] = (this.metrics.requests.byStatusCode[statusCode] || 0) + 1;

    // Track response time
    this.metrics.performance.responseTime.push(duration);
    if (this.metrics.performance.responseTime.length > 1000) {
      this.metrics.performance.responseTime.shift(); // Keep last 1000
    }

    if (duration > this.metrics.performance.maxResponseTime) {
      this.metrics.performance.maxResponseTime = duration;
    }

    if (duration < this.metrics.performance.minResponseTime) {
      this.metrics.performance.minResponseTime = duration;
    }
  }

  /**
   * Get average response time
   */
  getAverageResponseTime() {
    const times = this.metrics.performance.responseTime;
    if (times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  /**
   * Get metrics summary
   */
  getMetrics() {
    return {
      ...this.metrics,
      performance: {
        ...this.metrics.performance,
        averageResponseTime: this.getAverageResponseTime()
      }
    };
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(name, value, tags = {}) {
    if (!this.metrics.custom[name]) {
      this.metrics.custom[name] = {
        count: 0,
        values: [],
        tags: {}
      };
    }

    this.metrics.custom[name].count++;
    this.metrics.custom[name].values.push(value);
    
    // Keep last 100 values
    if (this.metrics.custom[name].values.length > 100) {
      this.metrics.custom[name].values.shift();
    }

    // Merge tags
    Object.assign(this.metrics.custom[name].tags, tags);
  }

  /**
   * Register a health check
   */
  registerHealthCheck(name, checkFn) {
    this.healthChecks.set(name, checkFn);
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const results = {
      status: 'healthy',
      checks: {},
      timestamp: new Date().toISOString()
    };

    for (const [name, checkFn] of this.healthChecks) {
      try {
        const result = await checkFn();
        results.checks[name] = {
          status: result ? 'healthy' : 'unhealthy',
          ...result
        };

        if (!result || result.status === 'unhealthy') {
          results.status = 'unhealthy';
        }
      } catch (error) {
        results.checks[name] = {
          status: 'unhealthy',
          error: error.message
        };
        results.status = 'unhealthy';
      }
    }

    return results;
  }

  /**
   * Check if application is ready to serve traffic
   */
  async isReady() {
    if (this.isShuttingDown) {
      return false;
    }

    // Check if critical dependencies are available
    const healthChecks = await this.runHealthChecks();
    return healthChecks.status === 'healthy';
  }

  /**
   * Mark application as shutting down
   */
  shutdown() {
    this.isShuttingDown = true;
    logger.info('Application marked as shutting down');
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byMethod: {},
        byPath: {},
        byStatusCode: {}
      },
      performance: {
        responseTime: [],
        maxResponseTime: 0,
        minResponseTime: Infinity
      },
      system: {
        startTime: Date.now(),
        uptime: 0
      },
      custom: {}
    };
  }
}

// Create singleton instance
const monitor = new Monitor();

/**
 * Express middleware for monitoring requests
 */
export function monitoringMiddleware() {
  return (req, res, next) => {
    const startTime = performance.now();

    res.on('finish', () => {
      const duration = performance.now() - startTime;
      monitor.recordRequest(req.method, req.path, res.statusCode, duration);

      // Log slow requests
      if (duration > 1000) {
        logger.warn('Slow request detected', {
          correlationId: req.correlationId,
          method: req.method,
          path: req.path,
          duration: `${duration.toFixed(2)}ms`
        });
      }
    });

    next();
  };
}

/**
 * Health check endpoint handler
 */
export async function healthCheckHandler(req, res) {
  try {
    const health = await monitor.runHealthChecks();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      status: health.status,
      uptime: process.uptime(),
      timestamp: health.timestamp,
      checks: health.checks
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
}

/**
 * Readiness check endpoint handler
 */
export async function readinessCheckHandler(req, res) {
  try {
    const ready = await monitor.isReady();
    
    if (ready) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not ready',
      error: error.message
    });
  }
}

/**
 * Metrics endpoint handler
 */
export function metricsHandler(req, res) {
  try {
    const metrics = monitor.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics', { error: error.message });
    res.status(500).json({
      error: 'Failed to retrieve metrics'
    });
  }
}

// Register default health checks
monitor.registerHealthCheck('memory', () => {
  const usage = process.memoryUsage();
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
  
  return {
    status: heapUsedPercent < 90 ? 'healthy' : 'unhealthy',
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    heapUsedPercent: heapUsedPercent.toFixed(2)
  };
});

monitor.registerHealthCheck('uptime', () => {
  const uptime = process.uptime();
  return {
    status: 'healthy',
    uptime: uptime,
    uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
  };
});

export default monitor;
