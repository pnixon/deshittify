/**
 * Monitoring API Endpoints
 * Provides health checks, metrics, and status information
 */

import express from 'express';
import monitor, { healthCheckHandler, readinessCheckHandler, metricsHandler } from '../lib/monitoring.js';
import logger from '../lib/logger.js';
import config from '../config/index.js';

const router = express.Router();

/**
 * GET /health
 * Health check endpoint for load balancers and monitoring systems
 */
router.get('/health', healthCheckHandler);

/**
 * GET /ready
 * Readiness check endpoint for Kubernetes and orchestration systems
 */
router.get('/ready', readinessCheckHandler);

/**
 * GET /metrics
 * Application metrics endpoint
 */
router.get('/metrics', metricsHandler);

/**
 * GET /status
 * Detailed application status
 */
router.get('/status', (req, res) => {
  try {
    const metrics = monitor.getMetrics();
    
    res.json({
      application: {
        name: 'Ansybl Example Website',
        version: '1.0.0',
        environment: config.env,
        nodeVersion: process.version
      },
      server: {
        uptime: process.uptime(),
        startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
      },
      metrics: {
        requests: metrics.requests,
        performance: {
          averageResponseTime: metrics.performance.averageResponseTime.toFixed(2) + 'ms',
          maxResponseTime: metrics.performance.maxResponseTime.toFixed(2) + 'ms',
          minResponseTime: metrics.performance.minResponseTime === Infinity ? 'N/A' : metrics.performance.minResponseTime.toFixed(2) + 'ms'
        }
      },
      system: metrics.system,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get status', { error: error.message });
    res.status(500).json({
      error: 'Failed to retrieve status'
    });
  }
});

/**
 * GET /info
 * Basic application information (public)
 */
router.get('/info', (req, res) => {
  res.json({
    name: 'Ansybl Example Website',
    version: '1.0.0',
    description: 'A demonstration of the Ansybl social syndication protocol',
    environment: config.env,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /log
 * Client-side error logging endpoint
 */
router.post('/log', express.json(), (req, res) => {
  try {
    const { level, message, meta } = req.body;
    
    if (!level || !message) {
      return res.status(400).json({
        error: 'Missing required fields: level and message'
      });
    }

    // Log client-side error with correlation ID
    logger.log(level, `[Client] ${message}`, {
      correlationId: req.correlationId,
      client: true,
      ...meta
    });

    res.json({
      success: true,
      message: 'Log recorded'
    });
  } catch (error) {
    logger.error('Failed to log client message', { error: error.message });
    res.status(500).json({
      error: 'Failed to record log'
    });
  }
});

export default router;
