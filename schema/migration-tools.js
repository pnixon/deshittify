/**
 * Ansybl Protocol Migration and Upgrade Tools
 * Automated migration tools for protocol version upgrades with backward compatibility
 */

import { VersionManager, SemanticVersion } from './version-manager.js';
import { AnsyblValidator } from './validator.js';
import { CanonicalJSONSerializer } from './canonicalizer.js';

/**
 * Document migration engine for upgrading between protocol versions
 */
export class DocumentMigrator {
  constructor() {
    this.versionManager = new VersionManager();
    this.validator = new AnsyblValidator();
    this.migrationRules = this._buildMigrationRules();
  }

  /**
   * Build migration rules for different version transitions
   * @private
   */
  _buildMigrationRules() {
    return {
      '1.0_to_1.1': {
        description: 'Upgrade from 1.0 to 1.1 with enhanced discovery features',
        transformations: [
          {
            type: 'field_addition',
            field: '_discovery',
            value: { webring_enabled: false, webmention_endpoint: null },
            condition: 'optional'
          },
          {
            type: 'version_update',
            field: 'version',
            value: 'https://ansybl.org/version/1.1'
          }
        ],
        validations: [
          'validate_enhanced_discovery_fields'
        ]
      },
      '1.1_to_2.0': {
        description: 'Major upgrade from 1.x to 2.0 with breaking changes',
        transformations: [
          {
            type: 'field_addition',
            field: 'content_hash',
            value: null,
            condition: 'required',
            generator: 'generate_content_hash'
          },
          {
            type: 'signature_format_upgrade',
            field: 'signature',
            from: 'ed25519:base64',
            to: 'ed25519-v2:base64'
          },
          {
            type: 'version_update',
            field: 'version',
            value: 'https://ansybl.org/version/2.0'
          }
        ],
        validations: [
          'validate_content_hash',
          'validate_signature_format_v2'
        ],
        warnings: [
          'This is a breaking change that may not be compatible with older parsers'
        ]
      },
      '1.1_to_1.0': {
        description: 'Downgrade from 1.1 to 1.0 (backward compatibility)',
        transformations: [
          {
            type: 'field_removal',
            field: '_discovery',
            condition: 'safe_removal'
          },
          {
            type: 'version_update',
            field: 'version',
            value: 'https://ansybl.org/version/1.0'
          }
        ],
        validations: [
          'validate_backward_compatibility'
        ],
        warnings: [
          'Discovery features will be removed for backward compatibility'
        ]
      },
      '2.0_to_1.1': {
        description: 'Downgrade from 2.0 to 1.1 (backward compatibility)',
        transformations: [
          {
            type: 'field_removal',
            field: 'content_hash',
            condition: 'safe_removal'
          },
          {
            type: 'signature_format_downgrade',
            field: 'signature',
            from: 'ed25519-v2:base64',
            to: 'ed25519:base64'
          },
          {
            type: 'version_update',
            field: 'version',
            value: 'https://ansybl.org/version/1.1'
          }
        ],
        validations: [
          'validate_backward_compatibility'
        ],
        warnings: [
          'Some advanced features will be lost in the downgrade',
          'Content hashes will be removed'
        ]
      }
    };
  }

  /**
   * Migrate document from one version to another
   * @param {object} document - Source document to migrate
   * @param {string} targetVersion - Target version to migrate to
   * @param {object} options - Migration options
   * @returns {Promise<MigrationResult>} Migration result
   */
  async migrate(document, targetVersion, options = {}) {
    const {
      preserveExtensions = true,
      validateResult = true,
      dryRun = false
    } = options;

    try {
      // Determine source version
      const sourceVersion = document.version || 'unknown';
      const sourceSemVer = new SemanticVersion(sourceVersion);
      const targetSemVer = new SemanticVersion(targetVersion);

      // Check if migration is needed
      if (sourceSemVer.compare(targetSemVer) === 0) {
        return {
          success: true,
          migrated: false,
          document: document,
          sourceVersion,
          targetVersion,
          message: 'No migration needed - versions are identical'
        };
      }

      // Find migration path
      const migrationPath = this._findMigrationPath(sourceSemVer, targetSemVer);
      if (!migrationPath.possible) {
        return {
          success: false,
          error: {
            code: 'MIGRATION_PATH_NOT_FOUND',
            message: `No migration path found from ${sourceVersion} to ${targetVersion}`,
            details: migrationPath.reason
          }
        };
      }

      // Execute migration steps
      let migratedDocument = JSON.parse(JSON.stringify(document)); // Deep clone
      const appliedTransformations = [];
      const warnings = [];

      for (const step of migrationPath.steps) {
        const stepResult = await this._executeMigrationStep(
          migratedDocument, 
          step, 
          { preserveExtensions, dryRun }
        );

        if (!stepResult.success) {
          return {
            success: false,
            error: {
              code: 'MIGRATION_STEP_FAILED',
              message: `Migration step failed: ${step.description}`,
              details: stepResult.error
            }
          };
        }

        migratedDocument = stepResult.document;
        appliedTransformations.push(...stepResult.transformations);
        warnings.push(...stepResult.warnings);
      }

      // Validate migrated document if requested
      let validationResult = null;
      if (validateResult && !dryRun) {
        validationResult = this.validator.validateDocument(migratedDocument);
        if (!validationResult.valid) {
          return {
            success: false,
            error: {
              code: 'MIGRATION_VALIDATION_FAILED',
              message: 'Migrated document failed validation',
              details: validationResult.errors
            }
          };
        }
      }

      return {
        success: true,
        migrated: true,
        document: dryRun ? document : migratedDocument,
        sourceVersion,
        targetVersion,
        migrationPath: migrationPath.steps.map(step => step.description),
        appliedTransformations,
        warnings,
        validation: validationResult
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MIGRATION_ERROR',
          message: 'Migration failed with unexpected error',
          details: error.message
        }
      };
    }
  }

  /**
   * Find migration path between two versions
   * @private
   */
  _findMigrationPath(sourceVersion, targetVersion) {
    const sourceKey = `${sourceVersion.parsed.major}.${sourceVersion.parsed.minor}`;
    const targetKey = `${targetVersion.parsed.major}.${targetVersion.parsed.minor}`;

    // Direct migration rule exists
    const directRule = `${sourceKey}_to_${targetKey}`;
    if (this.migrationRules[directRule]) {
      return {
        possible: true,
        steps: [{
          rule: directRule,
          description: this.migrationRules[directRule].description,
          transformations: this.migrationRules[directRule].transformations,
          validations: this.migrationRules[directRule].validations,
          warnings: this.migrationRules[directRule].warnings || []
        }]
      };
    }

    // Multi-step migration (for future complex migrations)
    const multiStepPath = this._findMultiStepPath(sourceKey, targetKey);
    if (multiStepPath.length > 0) {
      return {
        possible: true,
        steps: multiStepPath
      };
    }

    return {
      possible: false,
      reason: `No migration path available from ${sourceKey} to ${targetKey}`
    };
  }

  /**
   * Find multi-step migration path (for complex version transitions)
   * @private
   */
  _findMultiStepPath(sourceKey, targetKey) {
    // For now, return empty array - can be extended for complex migrations
    // Future: Implement graph traversal for multi-step migrations
    return [];
  }

  /**
   * Execute a single migration step
   * @private
   */
  async _executeMigrationStep(document, step, options) {
    const { preserveExtensions, dryRun } = options;
    let migratedDocument = JSON.parse(JSON.stringify(document));
    const appliedTransformations = [];
    const warnings = [...(step.warnings || [])];

    try {
      // Apply transformations
      for (const transformation of step.transformations) {
        const transformResult = await this._applyTransformation(
          migratedDocument, 
          transformation, 
          { preserveExtensions, dryRun }
        );

        if (!transformResult.success) {
          return {
            success: false,
            error: transformResult.error
          };
        }

        migratedDocument = transformResult.document;
        appliedTransformations.push(transformation);
        
        if (transformResult.warnings) {
          warnings.push(...transformResult.warnings);
        }
      }

      // Run validations
      for (const validationName of step.validations) {
        const validationResult = await this._runMigrationValidation(
          migratedDocument, 
          validationName
        );

        if (!validationResult.success) {
          return {
            success: false,
            error: {
              code: 'MIGRATION_VALIDATION_FAILED',
              message: `Migration validation '${validationName}' failed`,
              details: validationResult.error
            }
          };
        }

        if (validationResult.warnings) {
          warnings.push(...validationResult.warnings);
        }
      }

      return {
        success: true,
        document: migratedDocument,
        transformations: appliedTransformations,
        warnings
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TRANSFORMATION_ERROR',
          message: 'Failed to apply transformation',
          details: error.message
        }
      };
    }
  }

  /**
   * Apply a single transformation to the document
   * @private
   */
  async _applyTransformation(document, transformation, options) {
    const { dryRun } = options;
    let modifiedDocument = JSON.parse(JSON.stringify(document));
    const warnings = [];

    try {
      switch (transformation.type) {
        case 'version_update':
          modifiedDocument[transformation.field] = transformation.value;
          break;

        case 'field_addition':
          if (transformation.condition === 'required' || transformation.condition === 'optional') {
            if (transformation.generator) {
              const generatedValue = await this._generateFieldValue(
                modifiedDocument, 
                transformation.generator
              );
              modifiedDocument[transformation.field] = generatedValue;
            } else {
              modifiedDocument[transformation.field] = transformation.value;
            }
          }
          break;

        case 'field_removal':
          if (transformation.condition === 'safe_removal') {
            delete modifiedDocument[transformation.field];
          }
          break;

        case 'signature_format_upgrade':
          modifiedDocument = await this._upgradeSignatureFormat(
            modifiedDocument, 
            transformation
          );
          break;

        case 'signature_format_downgrade':
          modifiedDocument = await this._downgradeSignatureFormat(
            modifiedDocument, 
            transformation
          );
          break;

        default:
          throw new Error(`Unknown transformation type: ${transformation.type}`);
      }

      return {
        success: true,
        document: modifiedDocument,
        warnings
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate field values for transformations
   * @private
   */
  async _generateFieldValue(document, generator) {
    switch (generator) {
      case 'generate_content_hash':
        // Generate SHA-256 hash of canonical content
        const canonicalContent = CanonicalJSONSerializer.serialize(document);
        const encoder = new TextEncoder();
        const data = encoder.encode(canonicalContent);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      default:
        throw new Error(`Unknown field generator: ${generator}`);
    }
  }

  /**
   * Upgrade signature format
   * @private
   */
  async _upgradeSignatureFormat(document, transformation) {
    const modifiedDocument = JSON.parse(JSON.stringify(document));

    // Upgrade feed signature
    if (modifiedDocument.signature && modifiedDocument.signature.startsWith(transformation.from)) {
      const signatureData = modifiedDocument.signature.replace(transformation.from + ':', '');
      modifiedDocument.signature = `${transformation.to}:${signatureData}`;
    }

    // Upgrade item signatures
    if (modifiedDocument.items) {
      for (const item of modifiedDocument.items) {
        if (item.signature && item.signature.startsWith(transformation.from)) {
          const signatureData = item.signature.replace(transformation.from + ':', '');
          item.signature = `${transformation.to}:${signatureData}`;
        }
      }
    }

    return modifiedDocument;
  }

  /**
   * Downgrade signature format
   * @private
   */
  async _downgradeSignatureFormat(document, transformation) {
    const modifiedDocument = JSON.parse(JSON.stringify(document));

    // Downgrade feed signature
    if (modifiedDocument.signature && modifiedDocument.signature.startsWith(transformation.from)) {
      const signatureData = modifiedDocument.signature.replace(transformation.from + ':', '');
      modifiedDocument.signature = `${transformation.to}:${signatureData}`;
    }

    // Downgrade item signatures
    if (modifiedDocument.items) {
      for (const item of modifiedDocument.items) {
        if (item.signature && item.signature.startsWith(transformation.from)) {
          const signatureData = item.signature.replace(transformation.from + ':', '');
          item.signature = `${transformation.to}:${signatureData}`;
        }
      }
    }

    return modifiedDocument;
  }

  /**
   * Run migration-specific validations
   * @private
   */
  async _runMigrationValidation(document, validationName) {
    try {
      switch (validationName) {
        case 'validate_enhanced_discovery_fields':
          return this._validateEnhancedDiscoveryFields(document);

        case 'validate_content_hash':
          return this._validateContentHash(document);

        case 'validate_signature_format_v2':
          return this._validateSignatureFormatV2(document);

        case 'validate_backward_compatibility':
          return this._validateBackwardCompatibility(document);

        default:
          return {
            success: true,
            warnings: [`Unknown validation: ${validationName}`]
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate enhanced discovery fields
   * @private
   */
  _validateEnhancedDiscoveryFields(document) {
    const warnings = [];

    if (document._discovery) {
      if (typeof document._discovery.webring_enabled !== 'boolean') {
        warnings.push('_discovery.webring_enabled should be a boolean');
      }
      
      if (document._discovery.webmention_endpoint && 
          !document._discovery.webmention_endpoint.startsWith('https://')) {
        warnings.push('_discovery.webmention_endpoint should be an HTTPS URL');
      }
    }

    return {
      success: true,
      warnings
    };
  }

  /**
   * Validate content hash
   * @private
   */
  _validateContentHash(document) {
    if (!document.content_hash) {
      return {
        success: false,
        error: 'content_hash is required for version 2.0'
      };
    }

    if (!/^[a-f0-9]{64}$/.test(document.content_hash)) {
      return {
        success: false,
        error: 'content_hash must be a valid SHA-256 hash (64 hex characters)'
      };
    }

    return { success: true };
  }

  /**
   * Validate signature format v2
   * @private
   */
  _validateSignatureFormatV2(document) {
    const errors = [];

    if (document.signature && !document.signature.startsWith('ed25519-v2:')) {
      errors.push('Feed signature must use ed25519-v2 format for version 2.0');
    }

    if (document.items) {
      document.items.forEach((item, index) => {
        if (item.signature && !item.signature.startsWith('ed25519-v2:')) {
          errors.push(`Item ${index} signature must use ed25519-v2 format for version 2.0`);
        }
      });
    }

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : null
    };
  }

  /**
   * Validate backward compatibility
   * @private
   */
  _validateBackwardCompatibility(document) {
    const warnings = [];

    // Check for fields that might not be supported in older versions
    if (document.content_hash) {
      warnings.push('content_hash field will be removed for backward compatibility');
    }

    if (document.signature && document.signature.startsWith('ed25519-v2:')) {
      warnings.push('Signature format will be downgraded for backward compatibility');
    }

    return {
      success: true,
      warnings
    };
  }
}

/**
 * Backward compatibility layer for older Ansybl versions
 */
export class BackwardCompatibilityShim {
  constructor() {
    this.versionManager = new VersionManager();
    this.migrator = new DocumentMigrator();
  }

  /**
   * Create compatibility shim for parsing older documents
   * @param {string} targetVersion - Version to provide compatibility for
   * @returns {object} Compatibility shim functions
   */
  createShim(targetVersion) {
    const targetSemVer = new SemanticVersion(targetVersion);
    
    return {
      /**
       * Parse document with backward compatibility
       */
      parseWithCompatibility: async (document, options = {}) => {
        try {
          // Try parsing as-is first
          const directParseResult = await this._tryDirectParse(document, { ...options, targetVersion });
          if (directParseResult.success) {
            return directParseResult;
          }

          // Attempt migration to target version
          const migrationResult = await this.migrator.migrate(
            document, 
            targetVersion, 
            { ...options, validateResult: false }
          );

          if (migrationResult.success) {
            return {
              success: true,
              document: migrationResult.document,
              compatibility: {
                migrated: true,
                sourceVersion: migrationResult.sourceVersion,
                targetVersion: migrationResult.targetVersion,
                warnings: migrationResult.warnings
              }
            };
          }

          return {
            success: false,
            error: migrationResult.error,
            compatibility: {
              migrated: false,
              attempted: true
            }
          };

        } catch (error) {
          return {
            success: false,
            error: {
              code: 'COMPATIBILITY_ERROR',
              message: 'Backward compatibility parsing failed',
              details: error.message
            }
          };
        }
      },

      /**
       * Validate document with version-specific rules
       */
      validateWithCompatibility: (document) => {
        return this.versionManager.validateAgainstVersion(document, targetVersion);
      },

      /**
       * Get supported features for target version
       */
      getSupportedFeatures: () => {
        return this.versionManager.compatibilityMatrix.getSupportedFeatures(targetVersion);
      }
    };
  }

  /**
   * Try direct parsing without migration
   * @private
   */
  async _tryDirectParse(document, options) {
    try {
      // Basic validation check
      if (typeof document === 'string') {
        document = JSON.parse(document);
      }

      if (!document.version || !document.title || !document.author) {
        return { success: false };
      }

      // Check if the document version matches the target version exactly
      // If not, we should attempt migration
      const targetVersion = options.targetVersion || this.targetVersion;
      if (document.version !== targetVersion) {
        return { success: false, reason: 'version_mismatch' };
      }

      return {
        success: true,
        document,
        compatibility: {
          migrated: false,
          directParse: true
        }
      };

    } catch (error) {
      return { success: false };
    }
  }
}

/**
 * Migration validation and data preservation utilities
 */
export class MigrationValidator {
  constructor() {
    this.migrator = new DocumentMigrator();
  }

  /**
   * Validate migration accuracy by comparing source and target documents
   * @param {object} sourceDocument - Original document
   * @param {object} migratedDocument - Migrated document
   * @param {string} targetVersion - Target version
   * @returns {ValidationResult} Validation results
   */
  validateMigrationAccuracy(sourceDocument, migratedDocument, targetVersion) {
    const results = {
      accurate: true,
      dataPreserved: true,
      issues: [],
      warnings: []
    };

    try {
      // Check core data preservation
      const coreFields = ['title', 'author.name', 'items'];
      for (const field of coreFields) {
        if (!this._compareFieldValues(sourceDocument, migratedDocument, field)) {
          results.accurate = false;
          results.dataPreserved = false;
          results.issues.push(`Core field '${field}' was not preserved correctly`);
        }
      }

      // Check content preservation in items
      if (sourceDocument.items && migratedDocument.items) {
        if (sourceDocument.items.length !== migratedDocument.items.length) {
          results.issues.push('Number of items changed during migration');
          results.dataPreserved = false;
        } else {
          for (let i = 0; i < sourceDocument.items.length; i++) {
            const sourceItem = sourceDocument.items[i];
            const migratedItem = migratedDocument.items[i];
            
            if (sourceItem.content_text !== migratedItem.content_text ||
                sourceItem.content_html !== migratedItem.content_html) {
              results.warnings.push(`Content may have been modified in item ${i}`);
            }
          }
        }
      }

      // Check version update
      if (migratedDocument.version !== targetVersion) {
        results.accurate = false;
        results.issues.push(`Version was not updated to target version ${targetVersion}`);
      }

      // Check for unexpected field additions/removals
      const sourceFields = this._getAllFields(sourceDocument);
      const migratedFields = this._getAllFields(migratedDocument);
      
      const addedFields = migratedFields.filter(field => !sourceFields.includes(field));
      const removedFields = sourceFields.filter(field => !migratedFields.includes(field));

      if (addedFields.length > 0) {
        results.warnings.push(`Fields added during migration: ${addedFields.join(', ')}`);
      }

      if (removedFields.length > 0) {
        results.warnings.push(`Fields removed during migration: ${removedFields.join(', ')}`);
      }

    } catch (error) {
      results.accurate = false;
      results.issues.push(`Migration validation failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Compare field values between documents
   * @private
   */
  _compareFieldValues(doc1, doc2, fieldPath) {
    const getValue = (obj, path) => {
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
      }
      return current;
    };

    const value1 = getValue(doc1, fieldPath);
    const value2 = getValue(doc2, fieldPath);

    return JSON.stringify(value1) === JSON.stringify(value2);
  }

  /**
   * Get all field paths in a document
   * @private
   */
  _getAllFields(obj, prefix = '') {
    const fields = [];
    
    if (typeof obj !== 'object' || obj === null) {
      return fields;
    }

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      fields.push(fieldPath);
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        fields.push(...this._getAllFields(value, fieldPath));
      }
    }

    return fields;
  }

  /**
   * Test migration round-trip accuracy
   * @param {object} document - Document to test
   * @param {string} intermediateVersion - Version to migrate to and back from
   * @returns {Promise<RoundTripResult>} Round-trip test results
   */
  async testRoundTripMigration(document, intermediateVersion) {
    try {
      const originalVersion = document.version;

      // Migrate to intermediate version
      const forwardResult = await this.migrator.migrate(document, intermediateVersion);
      if (!forwardResult.success) {
        return {
          success: false,
          error: `Forward migration failed: ${forwardResult.error.message}`
        };
      }

      // Migrate back to original version
      const backwardResult = await this.migrator.migrate(
        forwardResult.document, 
        originalVersion
      );
      if (!backwardResult.success) {
        return {
          success: false,
          error: `Backward migration failed: ${backwardResult.error.message}`
        };
      }

      // Compare original and round-trip result
      const accuracy = this.validateMigrationAccuracy(
        document, 
        backwardResult.document, 
        originalVersion
      );

      return {
        success: true,
        accurate: accuracy.accurate,
        dataPreserved: accuracy.dataPreserved,
        originalDocument: document,
        intermediateDocument: forwardResult.document,
        finalDocument: backwardResult.document,
        issues: accuracy.issues,
        warnings: accuracy.warnings
      };

    } catch (error) {
      return {
        success: false,
        error: `Round-trip test failed: ${error.message}`
      };
    }
  }
}

export default DocumentMigrator;