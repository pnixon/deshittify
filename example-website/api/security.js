/**
 * Security API endpoints
 * Provides security monitoring, audit reports, and key management
 */

import express from 'express';
import { getSecurityAuditReport, getSecurityEvents, securityLogger } from '../middleware/security.js';
import { KeyManager, generateKeyPair } from '../lib/signature.js';
import { SecureKeyStorage } from '../lib/keyStorage.js';

const router = express.Router();

// Initialize key manager and storage
const keyManager = new KeyManager();
const keyStorage = new SecureKeyStorage();

/**
 * Get security audit report
 */
router.get('/audit', (req, res) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 3600000; // Default 1 hour
    const report = getSecurityAuditReport(timeRange);

    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate audit report',
      message: error.message
    });
  }
});

/**
 * Get security events with filtering
 */
router.get('/events', (req, res) => {
  try {
    const filters = {
      severity: req.query.severity,
      type: req.query.type,
      ip: req.query.ip,
      since: req.query.since
    };

    const events = getSecurityEvents(filters);
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const paginatedEvents = events.slice(offset, offset + limit);

    res.json({
      success: true,
      events: paginatedEvents,
      total: events.length,
      offset,
      limit,
      hasMore: offset + limit < events.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security events',
      message: error.message
    });
  }
});

/**
 * Get security statistics
 */
router.get('/stats', (req, res) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 3600000;
    const report = getSecurityAuditReport(timeRange);

    const stats = {
      timeRange: report.timeRange,
      totalEvents: report.totalEvents,
      criticalEvents: report.bySeverity.critical,
      highSeverityEvents: report.bySeverity.high,
      suspiciousIPCount: report.suspiciousIPs.length,
      topEventTypes: Object.entries(report.byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([type, count]) => ({ type, count })),
      topIPs: Object.entries(report.topIPs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }))
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security statistics',
      message: error.message
    });
  }
});

/**
 * Generate new key pair
 */
router.post('/keys/generate', async (req, res) => {
  try {
    const { keyId, storeSecurely = true } = req.body;

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: 'keyId is required'
      });
    }

    // Generate key pair
    const keyPair = await generateKeyPair();

    // Store in key manager
    await keyManager.generateKeyPair(keyId);

    // Optionally store securely
    if (storeSecurely) {
      await keyStorage.storeKeyPair(keyId, keyPair, {
        generatedBy: 'api',
        purpose: req.body.purpose || 'general'
      });
    }

    securityLogger.logEvent('key_generated', 'low', {
      keyId,
      storeSecurely
    }, req);

    res.json({
      success: true,
      keyId,
      publicKey: keyPair.publicKey,
      message: 'Key pair generated successfully'
    });
  } catch (error) {
    securityLogger.logEvent('key_generation_failed', 'high', {
      error: error.message
    }, req);

    res.status(500).json({
      success: false,
      error: 'Failed to generate key pair',
      message: error.message
    });
  }
});

/**
 * Rotate key pair
 */
router.post('/keys/:keyId/rotate', async (req, res) => {
  try {
    const { keyId } = req.params;

    // Rotate in key manager
    const rotated = await keyManager.rotateKey(keyId);

    // Rotate in secure storage
    const newKeyPair = {
      privateKey: rotated.privateKey,
      publicKey: rotated.publicKey
    };
    
    await keyStorage.rotateKeyPair(keyId, newKeyPair);

    securityLogger.logEvent('key_rotated', 'medium', {
      keyId,
      previousPublicKey: rotated.previousPublicKey
    }, req);

    res.json({
      success: true,
      keyId,
      newPublicKey: rotated.publicKey,
      previousPublicKey: rotated.previousPublicKey,
      message: 'Key pair rotated successfully'
    });
  } catch (error) {
    securityLogger.logEvent('key_rotation_failed', 'high', {
      keyId: req.params.keyId,
      error: error.message
    }, req);

    res.status(500).json({
      success: false,
      error: 'Failed to rotate key pair',
      message: error.message
    });
  }
});

/**
 * Get key information
 */
router.get('/keys/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;

    // Get from key manager
    const keyData = keyManager.getActiveKey(keyId);

    if (!keyData) {
      return res.status(404).json({
        success: false,
        error: 'Key not found'
      });
    }

    // Verify integrity
    const integrity = await keyStorage.verifyKeyIntegrity(keyId);

    res.json({
      success: true,
      keyId,
      publicKey: keyData.publicKey,
      createdAt: keyData.createdAt,
      rotationCount: keyData.rotationCount,
      isActive: keyData.isActive,
      integrity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve key information',
      message: error.message
    });
  }
});

/**
 * List all keys
 */
router.get('/keys', async (req, res) => {
  try {
    const keys = await keyStorage.listKeys();

    res.json({
      success: true,
      keys: keys.map(key => ({
        keyId: key.keyId,
        publicKey: key.publicKey,
        createdAt: key.metadata.createdAt,
        rotationCount: key.metadata.rotationCount || 0
      })),
      count: keys.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list keys',
      message: error.message
    });
  }
});

/**
 * Get key history
 */
router.get('/keys/:keyId/history', (req, res) => {
  try {
    const { keyId } = req.params;
    const history = keyManager.getKeyHistory(keyId);

    res.json({
      success: true,
      keyId,
      history: history.map(key => ({
        publicKey: key.publicKey,
        createdAt: key.createdAt,
        rotationCount: key.rotationCount,
        isActive: key.isActive,
        rotatedAt: key.rotatedAt,
        deletedAt: key.deletedAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve key history',
      message: error.message
    });
  }
});

/**
 * Verify key integrity
 */
router.post('/keys/:keyId/verify', async (req, res) => {
  try {
    const { keyId } = req.params;
    const integrity = await keyStorage.verifyKeyIntegrity(keyId);

    res.json({
      success: true,
      keyId,
      integrity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to verify key integrity',
      message: error.message
    });
  }
});

/**
 * Backup keys
 */
router.post('/keys/backup', async (req, res) => {
  try {
    const backupPath = req.body.backupPath || `./backups/keys-${Date.now()}.backup`;
    const result = await keyStorage.backupKeys(backupPath);

    securityLogger.logEvent('keys_backed_up', 'low', {
      backupPath,
      keyCount: result.keyCount
    }, req);

    res.json({
      success: true,
      ...result,
      message: 'Keys backed up successfully'
    });
  } catch (error) {
    securityLogger.logEvent('key_backup_failed', 'high', {
      error: error.message
    }, req);

    res.status(500).json({
      success: false,
      error: 'Failed to backup keys',
      message: error.message
    });
  }
});

/**
 * Export public key
 */
router.get('/keys/:keyId/public', async (req, res) => {
  try {
    const { keyId } = req.params;
    const publicKeyData = await keyStorage.exportPublicKey(keyId);

    res.json({
      success: true,
      ...publicKeyData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to export public key',
      message: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    securityFeatures: {
      inputValidation: true,
      xssProtection: true,
      sqlInjectionProtection: true,
      intrusionDetection: true,
      securityLogging: true,
      keyManagement: true
    }
  });
});

export default router;
