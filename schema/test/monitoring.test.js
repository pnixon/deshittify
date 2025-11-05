/**
 * Tests for Ansybl monitoring and analytics systems
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblMonitor, AnsyblAnalytics, AnsyblHealthMonitor } from '../monitoring.js';
import { AnsyblDashboard, PrometheusExporter } from '../dashboard.js';

describe('AnsyblMonitor', () => {
  let monitor;

  test('setup', () => {
    monitor = new AnsyblMonitor({
      logLevel: 'debug',
      metricsEnabled: true,
      healthCheckInterval: 0 // Disable automatic health checks for tests
    });
  });

  describe('Logging', () => {
    test('should log messages with structured data', async () => {
      await monitor.log('info', 'Test message', { test: true });
      
      const logs = monitor.getRecentLogs(1);
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].level, 'INFO');
      assert.strictEqual(logs[0].message, 'Test message');
      assert.strictEqual(logs[0].data.test, true);
    });

    test('should filter logs by level', async () => {
      await monitor.log('error', 'Error message');
      await monitor.log('info', 'Info message');
      await monitor.log('debug', 'Debug message');
      
      const errorLogs = monitor.getRecentLogs(10, 'error');
      assert.strictEqual(errorLogs.length, 1);
      assert.strictEqual(errorLogs[0].level, 'ERROR');
    });
  });

  describe('Metrics', () => {
    test('should record and retrieve metrics', () => {
      monitor.recordMetric('test_metric', 42, { tag: 'value' });
      
      const metrics = monitor.getMetrics();
      assert(metrics.test_metric);
      assert.strictEqual(metrics.test_metric.current, 42);
      assert.strictEqual(metrics.test_metric.count, 1);
    });

    test('should increment counters', () => {
      monitor.incrementCounter('test_counter');
      monitor.incrementCounter('test_counter');
      
      const metrics = monitor.getMetrics();
      assert.strictEqual(metrics.test_counter.current, 2);
    });

    test('should record timing information', () => {
      monitor.recordTiming('test_operation', 150);
      
      const metrics = monitor.getMetrics();
      assert(metrics['test_operation.duration']);
      assert(metrics['test_operation.count']);
      assert.strictEqual(metrics['test_operation.duration'].current, 150);
      assert.strictEqual(metrics['test_operation.count'].current, 1);
    });

    test('should time function execution', async () => {
      const result = await monitor.timeFunction('async_test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });
      
      assert.strictEqual(result, 'success');
      
      const metrics = monitor.getMetrics();
      assert(metrics['async_test.duration']);
      assert(metrics['async_test.count']);
      assert(metrics['async_test.duration'].current > 0);
    });

    test('should handle function execution errors', async () => {
      try {
        await monitor.timeFunction('error_test', async () => {
          throw new Error('Test error');
        });
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.strictEqual(error.message, 'Test error');
      }
      
      const metrics = monitor.getMetrics();
      assert(metrics['error_test.duration']);
      assert(metrics['error_test.count']);
    });
  });

  describe('Health Checks', () => {
    test('should register and run health checks', async () => {
      monitor.registerHealthCheck('test_check', async () => {
        return { status: 'ok' };
      });
      
      const results = await monitor.runHealthChecks();
      assert(results.test_check);
      assert.strictEqual(results.test_check.status, 'healthy');
      assert.deepStrictEqual(results.test_check.result, { status: 'ok' });
    });

    test('should handle health check failures', async () => {
      monitor.registerHealthCheck('failing_check', async () => {
        throw new Error('Health check failed');
      });
      
      const results = await monitor.runHealthChecks();
      assert(results.failing_check);
      assert.strictEqual(results.failing_check.status, 'unhealthy');
      assert.strictEqual(results.failing_check.error, 'Health check failed');
    });

    test('should timeout long-running health checks', async () => {
      monitor.registerHealthCheck('slow_check', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { status: 'ok' };
      }, { timeout: 50 });
      
      const results = await monitor.runHealthChecks();
      assert(results.slow_check);
      assert.strictEqual(results.slow_check.status, 'unhealthy');
      assert(results.slow_check.error.includes('timeout'));
    });

    test('should get overall health status', async () => {
      monitor.registerHealthCheck('healthy_check', async () => ({ status: 'ok' }));
      
      const health = await monitor.getHealthStatus();
      assert(health.status);
      assert(health.timestamp);
      assert(health.uptime >= 0);
      assert(health.checks);
      assert(health.system);
    });
  });

  describe('Data Export', () => {
    test('should export data as JSON', () => {
      monitor.recordMetric('export_test', 123);
      
      const exported = monitor.exportData('json');
      const data = JSON.parse(exported);
      
      assert(data.timestamp);
      assert(data.uptime >= 0);
      assert(data.metrics);
      assert(data.metrics.export_test);
    });

    test('should export data in Prometheus format', () => {
      monitor.recordMetric('prometheus_test', 456);
      
      const exported = monitor.exportData('prometheus');
      
      assert(typeof exported === 'string');
      assert(exported.includes('ansybl_uptime_seconds'));
      assert(exported.includes('ansybl_prometheus_test'));
    });
  });
});

describe('AnsyblAnalytics', () => {
  let analytics;

  test('setup', () => {
    analytics = new AnsyblAnalytics({
      trackingEnabled: true,
      flushInterval: 0 // Disable automatic flushing for tests
    });
  });

  describe('Event Tracking', () => {
    test('should track feed access events', () => {
      analytics.trackFeedAccess('https://example.com/feed.ansybl', {
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Test Agent' }
      });
      
      const summary = analytics.getAnalyticsSummary(Date.now() - 1000);
      assert.strictEqual(summary.feed_access.total, 1);
      assert.strictEqual(summary.feed_access.unique_feeds, 1);
    });

    test('should track parsing performance', () => {
      analytics.trackParsingPerformance('https://example.com/feed.ansybl', 150, 10, true);
      
      const summary = analytics.getAnalyticsSummary(Date.now() - 1000);
      assert.strictEqual(summary.performance.parsing.total_requests, 1);
      assert.strictEqual(summary.performance.parsing.success_rate, 100);
    });

    test('should track signature verification', () => {
      analytics.trackSignatureVerification(
        'https://example.com/feed.ansybl',
        'https://example.com/post/1',
        true,
        25
      );
      
      const summary = analytics.getAnalyticsSummary(Date.now() - 1000);
      assert.strictEqual(summary.performance.signatures.total_verifications, 1);
      assert.strictEqual(summary.performance.signatures.success_rate, 100);
    });

    test('should track bridge usage', () => {
      analytics.trackBridgeUsage('activitypub', 'ansybl', 'activitypub', true);
      
      const summary = analytics.getAnalyticsSummary(Date.now() - 1000);
      assert.strictEqual(summary.bridges.total_conversions, 1);
      assert.strictEqual(summary.bridges.success_rate, 100);
    });

    test('should track errors', () => {
      analytics.trackError('parsing_error', 'Invalid JSON', { feed: 'test.ansybl' });
      
      const summary = analytics.getAnalyticsSummary(Date.now() - 1000);
      assert.strictEqual(summary.errors.total, 1);
      assert.strictEqual(summary.errors.by_type.parsing_error, 1);
    });
  });

  describe('Analytics Summary', () => {
    test('should generate comprehensive analytics summary', () => {
      const startTime = Date.now() - 1000;
      
      // Add various events
      analytics.trackFeedAccess('https://feed1.com/feed.ansybl');
      analytics.trackFeedAccess('https://feed2.com/feed.ansybl');
      analytics.trackParsingPerformance('https://feed1.com/feed.ansybl', 100, 5, true);
      analytics.trackParsingPerformance('https://feed2.com/feed.ansybl', 200, 3, false);
      analytics.trackBridgeUsage('rss', 'ansybl', 'rss', true);
      
      const summary = analytics.getAnalyticsSummary(startTime);
      
      assert(summary.period);
      assert(summary.total_events > 0);
      assert.strictEqual(summary.feed_access.total, 2);
      assert.strictEqual(summary.feed_access.unique_feeds, 2);
      assert.strictEqual(summary.performance.parsing.total_requests, 2);
      assert.strictEqual(summary.performance.parsing.success_rate, 50);
      assert.strictEqual(summary.bridges.total_conversions, 1);
    });
  });

  describe('Data Export', () => {
    test('should export analytics as JSON', () => {
      analytics.trackFeedAccess('https://export-test.com/feed.ansybl');
      
      const exported = analytics.exportAnalytics('json');
      const data = JSON.parse(exported);
      
      assert(data.period);
      assert(data.total_events > 0);
      assert(data.feed_access);
    });

    test('should export analytics as CSV', () => {
      analytics.trackFeedAccess('https://csv-test.com/feed.ansybl');
      
      const exported = analytics.exportAnalytics('csv');
      
      assert(typeof exported === 'string');
      assert(exported.includes('metric,value'));
      assert(exported.includes('total_events,'));
    });
  });
});

describe('AnsyblHealthMonitor', () => {
  let monitor;
  let healthMonitor;

  test('setup', () => {
    monitor = new AnsyblMonitor({ healthCheckInterval: 0 });
    healthMonitor = new AnsyblHealthMonitor(monitor);
  });

  test('should set up default health checks', () => {
    assert(monitor.healthChecks.has('memory_usage'));
    assert(monitor.healthChecks.has('event_loop_lag'));
    assert(monitor.healthChecks.has('filesystem'));
  });

  test('should add service health check', () => {
    healthMonitor.addServiceHealthCheck('test_service', 'http://localhost:3000/health');
    
    assert(monitor.healthChecks.has('service_test_service'));
  });

  test('should add database health check', () => {
    const mockConnectionTest = async () => ({ connected: true });
    healthMonitor.addDatabaseHealthCheck('test_db', mockConnectionTest);
    
    assert(monitor.healthChecks.has('database_test_db'));
  });
});

describe('AnsyblDashboard', () => {
  let dashboard;
  let monitor;
  let analytics;

  test('setup', () => {
    monitor = new AnsyblMonitor({ healthCheckInterval: 0 });
    analytics = new AnsyblAnalytics({ flushInterval: 0 });
    dashboard = new AnsyblDashboard({
      port: 0, // Use random port for testing
      monitor,
      analytics
    });
  });

  test('should create dashboard with routes', () => {
    assert(dashboard.app);
    assert(dashboard.monitor);
    assert(dashboard.analytics);
  });

  test('should generate dashboard HTML', () => {
    const html = dashboard.generateDashboardHTML();
    
    assert(typeof html === 'string');
    assert(html.includes('<!DOCTYPE html>'));
    assert(html.includes('Ansybl Protocol Dashboard'));
    assert(html.includes('System Health'));
  });
});

describe('PrometheusExporter', () => {
  let exporter;
  let monitor;

  test('setup', () => {
    monitor = new AnsyblMonitor({ healthCheckInterval: 0 });
    exporter = new PrometheusExporter(monitor, { port: 0 });
  });

  test('should create Prometheus exporter', () => {
    assert(exporter.app);
    assert(exporter.monitor);
    assert.strictEqual(exporter.options.path, '/metrics');
  });
});

describe('Integration Tests', () => {
  test('should integrate monitoring with analytics', async () => {
    const monitor = new AnsyblMonitor({ healthCheckInterval: 0 });
    const analytics = new AnsyblAnalytics({ flushInterval: 0 });
    
    // Simulate some activity
    monitor.recordMetric('integration_test', 100);
    analytics.trackFeedAccess('https://integration.com/feed.ansybl');
    
    await monitor.log('info', 'Integration test');
    
    // Verify data is recorded
    const metrics = monitor.getMetrics();
    const logs = monitor.getRecentLogs(1);
    const analyticsSummary = analytics.getAnalyticsSummary(Date.now() - 1000);
    
    assert(metrics.integration_test);
    assert.strictEqual(logs[0].message, 'Integration test');
    assert.strictEqual(analyticsSummary.feed_access.total, 1);
  });

  test('should handle monitoring system shutdown gracefully', async () => {
    const monitor = new AnsyblMonitor({ healthCheckInterval: 0 });
    
    let shutdownEmitted = false;
    monitor.on('shutdown', () => {
      shutdownEmitted = true;
    });
    
    await monitor.shutdown();
    assert(shutdownEmitted);
  });
});