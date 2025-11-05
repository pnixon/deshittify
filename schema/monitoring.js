/**
 * Monitoring and Analytics System for Ansybl Protocol
 * Provides logging, metrics collection, and health monitoring
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

/**
 * Central monitoring system for Ansybl operations
 */
export class AnsyblMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logLevel: options.logLevel || 'info',
      logFile: options.logFile || null,
      metricsEnabled: options.metricsEnabled !== false,
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      retentionDays: options.retentionDays || 30,
      ...options
    };
    
    this.metrics = new Map();
    this.healthChecks = new Map();
    this.logBuffer = [];
    this.startTime = Date.now();
    
    if (this.options.healthCheckInterval > 0) {
      this.startHealthChecking();
    }
    
    // Set up graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Log an event with structured data
   */
  async log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      data,
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: Date.now() - this.startTime
    };

    // Add to buffer
    this.logBuffer.push(logEntry);
    
    // Emit event for real-time processing
    this.emit('log', logEntry);
    
    // Console output
    if (this.shouldLog(level)) {
      console.log(JSON.stringify(logEntry));
    }
    
    // Write to file if configured
    if (this.options.logFile) {
      await this.writeToLogFile(logEntry);
    }
    
    // Trim buffer to prevent memory leaks
    if (this.logBuffer.length > 10000) {
      this.logBuffer = this.logBuffer.slice(-5000);
    }
  }

  /**
   * Record a metric value
   */
  recordMetric(name, value, tags = {}) {
    if (!this.options.metricsEnabled) return;
    
    const metric = {
      name,
      value,
      tags,
      timestamp: Date.now()
    };
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metricHistory = this.metrics.get(name);
    metricHistory.push(metric);
    
    // Keep only recent metrics (last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.metrics.set(name, metricHistory.filter(m => m.timestamp > oneHourAgo));
    
    this.emit('metric', metric);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name, tags = {}) {
    const current = this.getMetricValue(name, tags) || 0;
    this.recordMetric(name, current + 1, tags);
  }

  /**
   * Record timing information
   */
  recordTiming(name, duration, tags = {}) {
    this.recordMetric(`${name}.duration`, duration, tags);
    this.recordMetric(`${name}.count`, (this.getMetricValue(`${name}.count`, tags) || 0) + 1, tags);
  }

  /**
   * Time a function execution
   */
  async timeFunction(name, fn, tags = {}) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordTiming(name, duration, { ...tags, status: 'success' });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordTiming(name, duration, { ...tags, status: 'error' });
      await this.log('error', `Function ${name} failed`, { error: error.message, duration, tags });
      throw error;
    }
  }

  /**
   * Register a health check
   */
  registerHealthCheck(name, checkFunction, options = {}) {
    this.healthChecks.set(name, {
      name,
      check: checkFunction,
      interval: options.interval || this.options.healthCheckInterval,
      timeout: options.timeout || 5000,
      lastCheck: null,
      lastResult: null,
      enabled: options.enabled !== false
    });
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const results = {};
    
    for (const [name, healthCheck] of this.healthChecks) {
      if (!healthCheck.enabled) continue;
      
      try {
        const start = performance.now();
        const result = await Promise.race([
          healthCheck.check(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout)
          )
        ]);
        
        const duration = performance.now() - start;
        
        results[name] = {
          status: 'healthy',
          result,
          duration,
          timestamp: new Date().toISOString()
        };
        
        healthCheck.lastCheck = Date.now();
        healthCheck.lastResult = results[name];
        
        this.recordMetric('health_check.duration', duration, { check: name, status: 'healthy' });
        
      } catch (error) {
        const duration = performance.now() - start;
        
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          duration,
          timestamp: new Date().toISOString()
        };
        
        healthCheck.lastCheck = Date.now();
        healthCheck.lastResult = results[name];
        
        this.recordMetric('health_check.duration', duration, { check: name, status: 'unhealthy' });
        
        await this.log('warn', `Health check ${name} failed`, { error: error.message, duration });
      }
    }
    
    return results;
  }

  /**
   * Get current system health status
   */
  async getHealthStatus() {
    const healthChecks = await this.runHealthChecks();
    const overallStatus = Object.values(healthChecks).every(check => check.status === 'healthy') 
      ? 'healthy' : 'unhealthy';
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: healthChecks,
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        platform: process.platform
      }
    };
  }

  /**
   * Get metrics summary
   */
  getMetrics() {
    const summary = {};
    
    for (const [name, history] of this.metrics) {
      if (history.length === 0) continue;
      
      const values = history.map(m => m.value);
      const recent = history.filter(m => m.timestamp > Date.now() - 300000); // Last 5 minutes
      
      summary[name] = {
        current: values[values.length - 1],
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        recent_count: recent.length,
        recent_avg: recent.length > 0 ? recent.reduce((a, b) => a + b.value, 0) / recent.length : 0
      };
    }
    
    return summary;
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit = 100, level = null) {
    let logs = this.logBuffer;
    
    if (level) {
      logs = logs.filter(log => log.level === level.toUpperCase());
    }
    
    return logs.slice(-limit);
  }

  /**
   * Export monitoring data for external systems
   */
  exportData(format = 'json') {
    const data = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      metrics: this.getMetrics(),
      recent_logs: this.getRecentLogs(50),
      health_checks: Object.fromEntries(
        Array.from(this.healthChecks.entries()).map(([name, check]) => [
          name, 
          { 
            last_check: check.lastCheck, 
            last_result: check.lastResult,
            enabled: check.enabled
          }
        ])
      )
    };
    
    switch (format) {
      case 'prometheus':
        return this.formatPrometheus(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Format metrics for Prometheus
   */
  formatPrometheus(data) {
    let output = '';
    
    // Add uptime metric
    output += `# HELP ansybl_uptime_seconds Total uptime in seconds\n`;
    output += `# TYPE ansybl_uptime_seconds counter\n`;
    output += `ansybl_uptime_seconds ${Math.floor(data.uptime / 1000)}\n\n`;
    
    // Add metrics
    for (const [name, metric] of Object.entries(data.metrics)) {
      const metricName = `ansybl_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      
      output += `# HELP ${metricName} ${name} metric\n`;
      output += `# TYPE ${metricName} gauge\n`;
      output += `${metricName} ${metric.current}\n`;
      output += `${metricName}_count ${metric.count}\n`;
      output += `${metricName}_avg ${metric.avg}\n\n`;
    }
    
    // Add health check metrics
    for (const [name, check] of Object.entries(data.health_checks)) {
      if (check.last_result) {
        const metricName = `ansybl_health_check_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const status = check.last_result.status === 'healthy' ? 1 : 0;
        
        output += `# HELP ${metricName} Health check status (1=healthy, 0=unhealthy)\n`;
        output += `# TYPE ${metricName} gauge\n`;
        output += `${metricName} ${status}\n`;
        output += `${metricName}_duration_ms ${check.last_result.duration || 0}\n\n`;
      }
    }
    
    return output;
  }

  // Private methods
  
  shouldLog(level) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = levels[this.options.logLevel] || 2;
    const messageLevel = levels[level] || 2;
    return messageLevel <= currentLevel;
  }

  async writeToLogFile(logEntry) {
    try {
      const logDir = path.dirname(this.options.logFile);
      await fs.mkdir(logDir, { recursive: true });
      
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.options.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  getMetricValue(name, tags = {}) {
    const history = this.metrics.get(name);
    if (!history || history.length === 0) return null;
    
    // Find most recent metric with matching tags
    for (let i = history.length - 1; i >= 0; i--) {
      const metric = history[i];
      if (this.tagsMatch(metric.tags, tags)) {
        return metric.value;
      }
    }
    
    return null;
  }

  tagsMatch(metricTags, searchTags) {
    for (const [key, value] of Object.entries(searchTags)) {
      if (metricTags[key] !== value) return false;
    }
    return true;
  }

  startHealthChecking() {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        await this.log('error', 'Health check cycle failed', { error: error.message });
      }
    }, this.options.healthCheckInterval);
  }

  async shutdown() {
    await this.log('info', 'Shutting down monitoring system');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    // Final log flush
    if (this.options.logFile && this.logBuffer.length > 0) {
      for (const entry of this.logBuffer) {
        await this.writeToLogFile(entry);
      }
    }
    
    this.emit('shutdown');
  }
}

/**
 * Analytics system for tracking feed usage and engagement
 */
export class AnsyblAnalytics extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      trackingEnabled: options.trackingEnabled !== false,
      anonymizeIPs: options.anonymizeIPs !== false,
      retentionDays: options.retentionDays || 90,
      batchSize: options.batchSize || 100,
      flushInterval: options.flushInterval || 60000, // 1 minute
      ...options
    };
    
    this.eventBuffer = [];
    this.sessionData = new Map();
    
    if (this.options.flushInterval > 0) {
      this.startBatchProcessing();
    }
  }

  /**
   * Track a feed access event
   */
  trackFeedAccess(feedUrl, request = {}) {
    if (!this.options.trackingEnabled) return;
    
    const event = {
      type: 'feed_access',
      timestamp: Date.now(),
      feed_url: feedUrl,
      ip: this.options.anonymizeIPs ? this.anonymizeIP(request.ip) : request.ip,
      user_agent: request.headers?.['user-agent'],
      referer: request.headers?.referer,
      session_id: this.getSessionId(request)
    };
    
    this.addEvent(event);
  }

  /**
   * Track feed parsing performance
   */
  trackParsingPerformance(feedUrl, duration, itemCount, success = true) {
    if (!this.options.trackingEnabled) return;
    
    const event = {
      type: 'parsing_performance',
      timestamp: Date.now(),
      feed_url: feedUrl,
      duration_ms: duration,
      item_count: itemCount,
      success
    };
    
    this.addEvent(event);
  }

  /**
   * Track signature verification results
   */
  trackSignatureVerification(feedUrl, itemId, success, duration) {
    if (!this.options.trackingEnabled) return;
    
    const event = {
      type: 'signature_verification',
      timestamp: Date.now(),
      feed_url: feedUrl,
      item_id: itemId,
      success,
      duration_ms: duration
    };
    
    this.addEvent(event);
  }

  /**
   * Track bridge service usage
   */
  trackBridgeUsage(bridgeType, sourceFormat, targetFormat, success = true) {
    if (!this.options.trackingEnabled) return;
    
    const event = {
      type: 'bridge_usage',
      timestamp: Date.now(),
      bridge_type: bridgeType,
      source_format: sourceFormat,
      target_format: targetFormat,
      success
    };
    
    this.addEvent(event);
  }

  /**
   * Track discovery service interactions
   */
  trackDiscoveryInteraction(serviceType, action, feedUrl = null) {
    if (!this.options.trackingEnabled) return;
    
    const event = {
      type: 'discovery_interaction',
      timestamp: Date.now(),
      service_type: serviceType,
      action,
      feed_url: feedUrl
    };
    
    this.addEvent(event);
  }

  /**
   * Track errors and exceptions
   */
  trackError(errorType, message, context = {}) {
    if (!this.options.trackingEnabled) return;
    
    const event = {
      type: 'error',
      timestamp: Date.now(),
      error_type: errorType,
      message,
      context
    };
    
    this.addEvent(event);
  }

  /**
   * Get analytics summary for a time period
   */
  getAnalyticsSummary(startTime, endTime = Date.now()) {
    const events = this.eventBuffer.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    );
    
    const summary = {
      period: {
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString(),
        duration_hours: (endTime - startTime) / (1000 * 60 * 60)
      },
      total_events: events.length,
      event_types: {},
      feed_access: {
        total: 0,
        unique_feeds: new Set(),
        unique_sessions: new Set()
      },
      performance: {
        parsing: {
          total_requests: 0,
          avg_duration: 0,
          success_rate: 0
        },
        signatures: {
          total_verifications: 0,
          avg_duration: 0,
          success_rate: 0
        }
      },
      bridges: {
        total_conversions: 0,
        by_type: {},
        success_rate: 0
      },
      errors: {
        total: 0,
        by_type: {}
      }
    };
    
    // Process events
    for (const event of events) {
      // Count event types
      summary.event_types[event.type] = (summary.event_types[event.type] || 0) + 1;
      
      switch (event.type) {
        case 'feed_access':
          summary.feed_access.total++;
          summary.feed_access.unique_feeds.add(event.feed_url);
          if (event.session_id) {
            summary.feed_access.unique_sessions.add(event.session_id);
          }
          break;
          
        case 'parsing_performance':
          summary.performance.parsing.total_requests++;
          summary.performance.parsing.avg_duration += event.duration_ms;
          if (event.success) {
            summary.performance.parsing.success_rate++;
          }
          break;
          
        case 'signature_verification':
          summary.performance.signatures.total_verifications++;
          summary.performance.signatures.avg_duration += event.duration_ms;
          if (event.success) {
            summary.performance.signatures.success_rate++;
          }
          break;
          
        case 'bridge_usage':
          summary.bridges.total_conversions++;
          const bridgeKey = `${event.source_format}_to_${event.target_format}`;
          summary.bridges.by_type[bridgeKey] = (summary.bridges.by_type[bridgeKey] || 0) + 1;
          if (event.success) {
            summary.bridges.success_rate++;
          }
          break;
          
        case 'error':
          summary.errors.total++;
          summary.errors.by_type[event.error_type] = (summary.errors.by_type[event.error_type] || 0) + 1;
          break;
      }
    }
    
    // Calculate averages and rates
    if (summary.performance.parsing.total_requests > 0) {
      summary.performance.parsing.avg_duration /= summary.performance.parsing.total_requests;
      summary.performance.parsing.success_rate = 
        (summary.performance.parsing.success_rate / summary.performance.parsing.total_requests) * 100;
    }
    
    if (summary.performance.signatures.total_verifications > 0) {
      summary.performance.signatures.avg_duration /= summary.performance.signatures.total_verifications;
      summary.performance.signatures.success_rate = 
        (summary.performance.signatures.success_rate / summary.performance.signatures.total_verifications) * 100;
    }
    
    if (summary.bridges.total_conversions > 0) {
      summary.bridges.success_rate = (summary.bridges.success_rate / summary.bridges.total_conversions) * 100;
    }
    
    // Convert sets to counts
    summary.feed_access.unique_feeds = summary.feed_access.unique_feeds.size;
    summary.feed_access.unique_sessions = summary.feed_access.unique_sessions.size;
    
    return summary;
  }

  /**
   * Export analytics data
   */
  exportAnalytics(format = 'json', startTime = Date.now() - (24 * 60 * 60 * 1000)) {
    const summary = this.getAnalyticsSummary(startTime);
    
    switch (format) {
      case 'csv':
        return this.formatCSV(summary);
      case 'json':
      default:
        return JSON.stringify(summary, null, 2);
    }
  }

  // Private methods
  
  addEvent(event) {
    this.eventBuffer.push(event);
    this.emit('event', event);
    
    // Trim buffer to prevent memory leaks
    if (this.eventBuffer.length > 50000) {
      this.eventBuffer = this.eventBuffer.slice(-25000);
    }
  }

  anonymizeIP(ip) {
    if (!ip) return null;
    
    // IPv4: mask last octet
    if (ip.includes('.')) {
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
    
    // IPv6: mask last 64 bits
    if (ip.includes(':')) {
      const parts = ip.split(':');
      return parts.slice(0, 4).join(':') + '::';
    }
    
    return 'unknown';
  }

  getSessionId(request) {
    // Simple session ID based on IP + User Agent hash
    if (!request.ip || !request.headers?.['user-agent']) return null;
    
    const data = request.ip + request.headers['user-agent'];
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  formatCSV(summary) {
    const lines = [
      'metric,value',
      `total_events,${summary.total_events}`,
      `feed_access_total,${summary.feed_access.total}`,
      `unique_feeds,${summary.feed_access.unique_feeds}`,
      `unique_sessions,${summary.feed_access.unique_sessions}`,
      `parsing_requests,${summary.performance.parsing.total_requests}`,
      `parsing_avg_duration,${summary.performance.parsing.avg_duration}`,
      `parsing_success_rate,${summary.performance.parsing.success_rate}`,
      `signature_verifications,${summary.performance.signatures.total_verifications}`,
      `signature_avg_duration,${summary.performance.signatures.avg_duration}`,
      `signature_success_rate,${summary.performance.signatures.success_rate}`,
      `bridge_conversions,${summary.bridges.total_conversions}`,
      `bridge_success_rate,${summary.bridges.success_rate}`,
      `total_errors,${summary.errors.total}`
    ];
    
    return lines.join('\n');
  }

  startBatchProcessing() {
    this.batchTimer = setInterval(() => {
      this.processBatch();
    }, this.options.flushInterval);
  }

  processBatch() {
    if (this.eventBuffer.length === 0) return;
    
    const batch = this.eventBuffer.splice(0, this.options.batchSize);
    this.emit('batch', batch);
  }

  shutdown() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    
    // Process remaining events
    if (this.eventBuffer.length > 0) {
      this.processBatch();
    }
    
    this.emit('shutdown');
  }
}

/**
 * Health monitoring for Ansybl services
 */
export class AnsyblHealthMonitor {
  constructor(monitor) {
    this.monitor = monitor;
    this.setupDefaultHealthChecks();
  }

  setupDefaultHealthChecks() {
    // Memory usage check
    this.monitor.registerHealthCheck('memory_usage', async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      
      if (heapUsedMB > 512) { // 512MB threshold
        throw new Error(`High memory usage: ${heapUsedMB}MB used of ${heapTotalMB}MB total`);
      }
      
      return { heap_used_mb: heapUsedMB, heap_total_mb: heapTotalMB };
    });

    // Event loop lag check
    this.monitor.registerHealthCheck('event_loop_lag', async () => {
      const start = process.hrtime.bigint();
      await new Promise(resolve => setImmediate(resolve));
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      
      if (lag > 100) { // 100ms threshold
        throw new Error(`High event loop lag: ${lag.toFixed(2)}ms`);
      }
      
      return { lag_ms: lag };
    });

    // File system check
    this.monitor.registerHealthCheck('filesystem', async () => {
      try {
        const testFile = '/tmp/ansybl-health-check';
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        return { status: 'writable' };
      } catch (error) {
        throw new Error(`Filesystem not writable: ${error.message}`);
      }
    });
  }

  /**
   * Add health check for external service
   */
  addServiceHealthCheck(name, url, options = {}) {
    this.monitor.registerHealthCheck(`service_${name}`, async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeout || 5000);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: options.headers || {}
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          throw new Error(`Service ${name} returned ${response.status}`);
        }
        
        return { 
          status: response.status, 
          response_time: response.headers.get('x-response-time') 
        };
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    }, options);
  }

  /**
   * Add health check for database connection
   */
  addDatabaseHealthCheck(name, connectionTest, options = {}) {
    this.monitor.registerHealthCheck(`database_${name}`, async () => {
      try {
        const result = await connectionTest();
        return result;
      } catch (error) {
        throw new Error(`Database ${name} connection failed: ${error.message}`);
      }
    }, options);
  }
}

// Export default monitor instance
export const defaultMonitor = new AnsyblMonitor();
export const defaultAnalytics = new AnsyblAnalytics();
export const defaultHealthMonitor = new AnsyblHealthMonitor(defaultMonitor);