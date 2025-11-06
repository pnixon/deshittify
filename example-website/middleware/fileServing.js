/**
 * Secure file serving middleware
 */

import { promises as fs } from 'fs';
import { join, extname } from 'path';
import mime from 'mime-types';
import { isPathSafe, verifyAccessToken } from '../utils/security.js';
import { serverConfig } from '../data/config.js';

/**
 * Secure file serving middleware with access controls
 */
export function secureFileServing(options = {}) {
  const {
    allowedDir = serverConfig.uploadsDir,
    requireAuth = false,
    maxAge = 86400, // 24 hours cache
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mp4', '.webm', '.mp3', '.ogg', '.wav', '.pdf']
  } = options;
  
  return async (req, res, next) => {
    try {
      const requestedPath = req.params[0] || req.path.substring(1);
      
      // Security checks
      if (!isPathSafe(requestedPath, allowedDir)) {
        return res.status(403).json({ error: 'Access denied: Invalid path' });
      }
      
      const fileExtension = extname(requestedPath).toLowerCase();
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(403).json({ error: 'Access denied: File type not allowed' });
      }
      
      // Check access token if required
      if (requireAuth) {
        const token = req.query.token || req.headers['x-file-token'];
        if (!token || !verifyAccessToken(token, requestedPath)) {
          return res.status(401).json({ error: 'Access denied: Invalid or missing token' });
        }
      }
      
      const fullPath = join(process.cwd(), allowedDir, requestedPath);
      
      // Check if file exists
      try {
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) {
          return res.status(404).json({ error: 'File not found' });
        }
      } catch (error) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Set proper MIME type
      const mimeType = mime.lookup(requestedPath) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      
      // Set security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
      
      // Set Content-Disposition for downloads
      if (mimeType.startsWith('application/')) {
        res.setHeader('Content-Disposition', `attachment; filename="${requestedPath}"`);
      }
      
      // Stream the file
      const fileBuffer = await fs.readFile(fullPath);
      res.setHeader('Content-Length', fileBuffer.length);
      res.send(fileBuffer);
      
    } catch (error) {
      console.error('File serving error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Rate limiting for file downloads
 */
export function fileDownloadRateLimit() {
  const downloads = new Map();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_DOWNLOADS = 100; // per IP per window
  
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Clean old entries
    for (const [ip, data] of downloads.entries()) {
      if (now - data.windowStart > WINDOW_MS) {
        downloads.delete(ip);
      }
    }
    
    // Check current IP
    const clientData = downloads.get(clientIP) || { count: 0, windowStart: now };
    
    if (now - clientData.windowStart > WINDOW_MS) {
      clientData.count = 0;
      clientData.windowStart = now;
    }
    
    if (clientData.count >= MAX_DOWNLOADS) {
      return res.status(429).json({ 
        error: 'Too many downloads',
        retryAfter: Math.ceil((WINDOW_MS - (now - clientData.windowStart)) / 1000)
      });
    }
    
    clientData.count++;
    downloads.set(clientIP, clientData);
    
    next();
  };
}