/**
 * Secure key storage implementation
 * Provides encrypted storage for cryptographic keys with rotation support
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Secure key storage with encryption
 */
export class SecureKeyStorage {
  constructor(options = {}) {
    this.storageDir = options.storageDir || join(process.cwd(), '.keys');
    this.encryptionKey = options.encryptionKey || this.deriveKey(process.env.KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production');
    this.algorithm = 'aes-256-gcm';
  }

  /**
   * Derive encryption key from password
   */
  deriveKey(password) {
    const salt = Buffer.from('ansybl-key-storage-salt'); // In production, use unique salt per installation
    return scryptSync(password, salt, 32);
  }

  /**
   * Encrypt data
   */
  encrypt(data) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt data
   */
  decrypt(encryptedData) {
    const decipher = createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Store key pair securely
   */
  async storeKeyPair(keyId, keyPair, metadata = {}) {
    try {
      // Ensure storage directory exists
      await fs.mkdir(this.storageDir, { recursive: true });

      const keyData = {
        keyId,
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          algorithm: 'ed25519'
        }
      };

      // Encrypt the key data
      const encrypted = this.encrypt(keyData);

      // Store to file
      const filename = `${keyId}.key`;
      const filepath = join(this.storageDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(encrypted, null, 2), {
        mode: 0o600 // Read/write for owner only
      });

      console.log(`✅ Key pair stored securely: ${keyId}`);
      
      return {
        success: true,
        keyId,
        filepath
      };
    } catch (error) {
      console.error(`❌ Failed to store key pair: ${error.message}`);
      throw new Error(`Key storage failed: ${error.message}`);
    }
  }

  /**
   * Load key pair from secure storage
   */
  async loadKeyPair(keyId) {
    try {
      const filename = `${keyId}.key`;
      const filepath = join(this.storageDir, filename);

      // Read encrypted data
      const encryptedData = JSON.parse(await fs.readFile(filepath, 'utf8'));

      // Decrypt
      const keyData = this.decrypt(encryptedData);

      console.log(`✅ Key pair loaded: ${keyId}`);
      
      return {
        success: true,
        keyId: keyData.keyId,
        privateKey: keyData.privateKey,
        publicKey: keyData.publicKey,
        metadata: keyData.metadata
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          error: 'Key not found'
        };
      }
      
      console.error(`❌ Failed to load key pair: ${error.message}`);
      throw new Error(`Key loading failed: ${error.message}`);
    }
  }

  /**
   * List all stored keys
   */
  async listKeys() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      
      const files = await fs.readdir(this.storageDir);
      const keyFiles = files.filter(f => f.endsWith('.key'));

      const keys = [];
      for (const file of keyFiles) {
        const keyId = file.replace('.key', '');
        try {
          const keyData = await this.loadKeyPair(keyId);
          keys.push({
            keyId,
            publicKey: keyData.publicKey,
            metadata: keyData.metadata
          });
        } catch (error) {
          console.warn(`Failed to load key ${keyId}: ${error.message}`);
        }
      }

      return keys;
    } catch (error) {
      console.error(`❌ Failed to list keys: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete key pair
   */
  async deleteKeyPair(keyId) {
    try {
      const filename = `${keyId}.key`;
      const filepath = join(this.storageDir, filename);

      // Archive before deletion
      await this.archiveKey(keyId);

      // Delete the key file
      await fs.unlink(filepath);

      console.log(`✅ Key pair deleted: ${keyId}`);
      
      return {
        success: true,
        keyId
      };
    } catch (error) {
      console.error(`❌ Failed to delete key pair: ${error.message}`);
      throw new Error(`Key deletion failed: ${error.message}`);
    }
  }

  /**
   * Archive key before deletion
   */
  async archiveKey(keyId) {
    try {
      const archiveDir = join(this.storageDir, 'archive');
      await fs.mkdir(archiveDir, { recursive: true });

      const filename = `${keyId}.key`;
      const sourcePath = join(this.storageDir, filename);
      const archivePath = join(archiveDir, `${keyId}_${Date.now()}.key`);

      // Copy to archive
      await fs.copyFile(sourcePath, archivePath);

      console.log(`✅ Key archived: ${keyId}`);
    } catch (error) {
      console.warn(`⚠️ Failed to archive key: ${error.message}`);
    }
  }

  /**
   * Rotate key pair
   */
  async rotateKeyPair(keyId, newKeyPair) {
    try {
      // Load existing key
      const existingKey = await this.loadKeyPair(keyId);
      
      if (!existingKey.success) {
        throw new Error('Existing key not found');
      }

      // Archive old key
      await this.archiveKey(keyId);

      // Store new key with rotation metadata
      const metadata = {
        ...existingKey.metadata,
        rotatedAt: new Date().toISOString(),
        rotationCount: (existingKey.metadata.rotationCount || 0) + 1,
        previousPublicKey: existingKey.publicKey
      };

      await this.storeKeyPair(keyId, newKeyPair, metadata);

      console.log(`✅ Key pair rotated: ${keyId}`);
      
      return {
        success: true,
        keyId,
        newPublicKey: newKeyPair.publicKey,
        previousPublicKey: existingKey.publicKey
      };
    } catch (error) {
      console.error(`❌ Failed to rotate key pair: ${error.message}`);
      throw new Error(`Key rotation failed: ${error.message}`);
    }
  }

  /**
   * Export public key only
   */
  async exportPublicKey(keyId) {
    try {
      const keyData = await this.loadKeyPair(keyId);
      
      if (!keyData.success) {
        throw new Error('Key not found');
      }

      return {
        keyId,
        publicKey: keyData.publicKey,
        metadata: keyData.metadata
      };
    } catch (error) {
      console.error(`❌ Failed to export public key: ${error.message}`);
      throw new Error(`Public key export failed: ${error.message}`);
    }
  }

  /**
   * Verify key integrity
   */
  async verifyKeyIntegrity(keyId) {
    try {
      const keyData = await this.loadKeyPair(keyId);
      
      if (!keyData.success) {
        return {
          valid: false,
          error: 'Key not found'
        };
      }

      // Verify key format
      if (!keyData.privateKey.startsWith('ed25519:') || !keyData.publicKey.startsWith('ed25519:')) {
        return {
          valid: false,
          error: 'Invalid key format'
        };
      }

      // Verify key lengths
      const privateKeyBytes = Buffer.from(keyData.privateKey.slice(8), 'base64');
      const publicKeyBytes = Buffer.from(keyData.publicKey.slice(8), 'base64');

      if (privateKeyBytes.length !== 32 || publicKeyBytes.length !== 32) {
        return {
          valid: false,
          error: 'Invalid key length'
        };
      }

      return {
        valid: true,
        keyId,
        metadata: keyData.metadata
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Backup all keys
   */
  async backupKeys(backupPath) {
    try {
      const keys = await this.listKeys();
      
      const backup = {
        timestamp: new Date().toISOString(),
        keys: []
      };

      for (const key of keys) {
        const keyData = await this.loadKeyPair(key.keyId);
        backup.keys.push(keyData);
      }

      // Encrypt backup
      const encrypted = this.encrypt(backup);

      await fs.writeFile(backupPath, JSON.stringify(encrypted, null, 2), {
        mode: 0o600
      });

      console.log(`✅ Keys backed up to: ${backupPath}`);
      
      return {
        success: true,
        backupPath,
        keyCount: backup.keys.length
      };
    } catch (error) {
      console.error(`❌ Failed to backup keys: ${error.message}`);
      throw new Error(`Key backup failed: ${error.message}`);
    }
  }

  /**
   * Restore keys from backup
   */
  async restoreKeys(backupPath) {
    try {
      const encryptedBackup = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      const backup = this.decrypt(encryptedBackup);

      let restored = 0;
      for (const keyData of backup.keys) {
        try {
          await this.storeKeyPair(keyData.keyId, {
            privateKey: keyData.privateKey,
            publicKey: keyData.publicKey
          }, keyData.metadata);
          restored++;
        } catch (error) {
          console.warn(`Failed to restore key ${keyData.keyId}: ${error.message}`);
        }
      }

      console.log(`✅ Restored ${restored} keys from backup`);
      
      return {
        success: true,
        restored,
        total: backup.keys.length
      };
    } catch (error) {
      console.error(`❌ Failed to restore keys: ${error.message}`);
      throw new Error(`Key restoration failed: ${error.message}`);
    }
  }
}

/**
 * In-memory key cache for performance
 */
export class KeyCache {
  constructor(ttl = 3600000) { // 1 hour default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  /**
   * Get key from cache
   */
  get(keyId) {
    const cached = this.cache.get(keyId);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(keyId);
      return null;
    }

    return cached.data;
  }

  /**
   * Set key in cache
   */
  set(keyId, data) {
    this.cache.set(keyId, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Remove specific key from cache
   */
  remove(keyId) {
    this.cache.delete(keyId);
  }
}
