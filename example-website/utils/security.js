/**
 * Security utilities for file handling
 */

import { createHash } from 'crypto';
import mime from 'mime-types';
import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';

/**
 * Generate secure content-based filename
 */
export function generateSecureFilename(buffer, originalName) {
  const hash = createHash('sha256').update(buffer).digest('hex');
  const ext = extname(originalName).toLowerCase();
  const timestamp = Date.now();
  
  // Use first 16 chars of hash + timestamp for uniqueness
  return `${hash.substring(0, 16)}_${timestamp}${ext}`;
}

/**
 * Validate file type against MIME type and magic bytes
 */
export function validateFileType(buffer, declaredMimeType, filename) {
  const errors = [];
  
  // Check file extension matches declared MIME type
  const expectedMimeFromExt = mime.lookup(filename);
  if (expectedMimeFromExt && expectedMimeFromExt !== declaredMimeType) {
    errors.push(`MIME type mismatch: extension suggests ${expectedMimeFromExt}, declared as ${declaredMimeType}`);
  }
  
  // Check magic bytes for common file types
  const magicBytes = buffer.slice(0, 16);
  const detectedType = detectFileTypeFromMagicBytes(magicBytes);
  
  if (detectedType && !declaredMimeType.startsWith(detectedType.category)) {
    errors.push(`Magic bytes suggest ${detectedType.mime}, declared as ${declaredMimeType}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    detectedType: detectedType?.mime || 'unknown'
  };
}

/**
 * Detect file type from magic bytes
 */
function detectFileTypeFromMagicBytes(buffer) {
  const signatures = [
    // Images
    { bytes: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg', category: 'image' },
    { bytes: [0x89, 0x50, 0x4E, 0x47], mime: 'image/png', category: 'image' },
    { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif', category: 'image' },
    { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp', category: 'image' }, // RIFF header for WebP
    
    // Videos
    { bytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], mime: 'video/mp4', category: 'video' },
    { bytes: [0x1A, 0x45, 0xDF, 0xA3], mime: 'video/webm', category: 'video' },
    
    // Audio
    { bytes: [0xFF, 0xFB], mime: 'audio/mpeg', category: 'audio' }, // MP3
    { bytes: [0x4F, 0x67, 0x67, 0x53], mime: 'audio/ogg', category: 'audio' },
    { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'audio/wav', category: 'audio' }, // WAV (also RIFF)
    
    // Documents
    { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf', category: 'application' }
  ];
  
  for (const sig of signatures) {
    if (sig.bytes.every((byte, index) => buffer[index] === byte)) {
      return sig;
    }
  }
  
  return null;
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename) {
  // Remove path separators and dangerous characters
  return basename(filename)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255); // Limit length
}

/**
 * Check if file path is within allowed directory
 */
export function isPathSafe(filePath, allowedDir) {
  const resolvedPath = join(allowedDir, filePath);
  const normalizedAllowed = join(allowedDir, '/');
  const normalizedPath = join(resolvedPath, '/');
  
  return normalizedPath.startsWith(normalizedAllowed);
}

/**
 * Generate file access token for secure serving
 */
export function generateAccessToken(filePath, expiresIn = 3600000) { // 1 hour default
  const payload = {
    path: filePath,
    expires: Date.now() + expiresIn
  };
  
  const token = createHash('sha256')
    .update(JSON.stringify(payload) + process.env.FILE_SECRET || 'default-secret')
    .digest('hex');
    
  return { token, expires: payload.expires };
}

/**
 * Verify file access token
 */
export function verifyAccessToken(token, filePath) {
  try {
    // In production, use proper JWT or similar
    // This is a simplified version for demonstration
    const expectedToken = generateAccessToken(filePath, 3600000).token;
    return token === expectedToken;
  } catch (error) {
    return false;
  }
}