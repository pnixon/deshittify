/**
 * Ed25519 signature utilities for Ansybl protocol
 * Implements signature generation and verification over canonical JSON content
 */

import * as ed25519 from '@noble/ed25519';
import { createHash } from 'node:crypto';
import { CanonicalJSONSerializer } from './canonicalizer.js';

// Configure the hash function for @noble/ed25519
ed25519.etc.sha512Sync = (...m) => createHash('sha512').update(Buffer.concat(m)).digest();

/**
 * Generate an ed25519 key pair
 * @returns {Promise<{privateKey: string, publicKey: string}>} Base64-encoded key pair
 */
export async function generateKeyPair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKey(privateKey);
  
  return {
    privateKey: `ed25519:${Buffer.from(privateKey).toString('base64')}`,
    publicKey: `ed25519:${Buffer.from(publicKey).toString('base64')}`
  };
}

/**
 * Sign content using ed25519 private key
 * @param {any} content - Content to sign (will be canonicalized)
 * @param {string} privateKeyString - Private key in format "ed25519:base64"
 * @returns {Promise<string>} Signature in format "ed25519:base64"
 */
export async function signContent(content, privateKeyString) {
  if (!privateKeyString || !privateKeyString.startsWith('ed25519:')) {
    throw new Error('Private key must be in format "ed25519:base64"');
  }
  
  const privateKeyBase64 = privateKeyString.slice(8); // Remove "ed25519:" prefix
  const privateKey = Buffer.from(privateKeyBase64, 'base64');
  
  if (privateKey.length !== 32) {
    throw new Error('Invalid private key length. Expected 32 bytes.');
  }
  
  // Canonicalize the content for consistent signing
  const canonicalContent = CanonicalJSONSerializer.serialize(content);
  const contentBytes = Buffer.from(canonicalContent, 'utf8');
  
  const signature = await ed25519.sign(contentBytes, privateKey);
  return `ed25519:${Buffer.from(signature).toString('base64')}`;
}

/**
 * Verify signature against content using ed25519 public key
 * @param {any} content - Content to verify (will be canonicalized)
 * @param {string} signatureString - Signature in format "ed25519:base64"
 * @param {string} publicKeyString - Public key in format "ed25519:base64"
 * @returns {Promise<boolean>} True if signature is valid
 */
export async function verifySignature(content, signatureString, publicKeyString) {
  try {
    if (!signatureString || !signatureString.startsWith('ed25519:')) {
      return false;
    }
    
    if (!publicKeyString || !publicKeyString.startsWith('ed25519:')) {
      return false;
    }
    
    const signatureBase64 = signatureString.slice(8); // Remove "ed25519:" prefix
    const publicKeyBase64 = publicKeyString.slice(8); // Remove "ed25519:" prefix
    
    const signature = Buffer.from(signatureBase64, 'base64');
    const publicKey = Buffer.from(publicKeyBase64, 'base64');
    
    if (publicKey.length !== 32) {
      return false;
    }
    
    if (signature.length !== 64) {
      return false;
    }
    
    // Canonicalize the content for consistent verification
    const canonicalContent = CanonicalJSONSerializer.serialize(content);
    const contentBytes = Buffer.from(canonicalContent, 'utf8');
    
    return await ed25519.verify(signature, contentBytes, publicKey);
  } catch (error) {
    return false;
  }
}

/**
 * Validate key format and convert between representations
 * @param {string} keyString - Key in format "ed25519:base64"
 * @param {'private'|'public'} keyType - Expected key type
 * @returns {{valid: boolean, bytes?: Uint8Array, error?: string}} Validation result
 */
export function validateKeyFormat(keyString, keyType) {
  if (!keyString || typeof keyString !== 'string') {
    return { valid: false, error: 'Key must be a non-empty string' };
  }
  
  if (!keyString.startsWith('ed25519:')) {
    return { valid: false, error: 'Key must start with "ed25519:" prefix' };
  }
  
  const keyBase64 = keyString.slice(8);
  
  try {
    const keyBytes = Buffer.from(keyBase64, 'base64');
    
    const expectedLength = keyType === 'private' ? 32 : 32;
    if (keyBytes.length !== expectedLength) {
      return { 
        valid: false, 
        error: `Invalid ${keyType} key length. Expected ${expectedLength} bytes, got ${keyBytes.length}` 
      };
    }
    
    return { valid: true, bytes: new Uint8Array(keyBytes) };
  } catch (error) {
    return { valid: false, error: 'Invalid base64 encoding' };
  }
}

/**
 * Extract public key from private key
 * @param {string} privateKeyString - Private key in format "ed25519:base64"
 * @returns {Promise<string>} Public key in format "ed25519:base64"
 */
export async function getPublicKeyFromPrivate(privateKeyString) {
  const validation = validateKeyFormat(privateKeyString, 'private');
  if (!validation.valid) {
    throw new Error(`Invalid private key: ${validation.error}`);
  }
  
  const privateKeyBase64 = privateKeyString.slice(8);
  const privateKey = Buffer.from(privateKeyBase64, 'base64');
  
  const publicKey = await ed25519.getPublicKey(privateKey);
  return `ed25519:${Buffer.from(publicKey).toString('base64')}`;
}