/**
 * Ansybl Protocol Version Management System
 * Handles semantic versioning, compatibility checking, and feature detection
 */

/**
 * Semantic version parsing and comparison utilities
 */
export class SemanticVersion {
  constructor(versionString) {
    this.original = versionString;
    this.parsed = this._parseVersion(versionString);
  }

  /**
   * Parse version string into components
   * @private
   */
  _parseVersion(versionString) {
    // Handle Ansybl version URL format: https://ansybl.org/version/1.0
    const urlMatch = versionString.match(/https:\/\/ansybl\.org\/version\/(\d+)\.(\d+)(?:\.(\d+))?(?:-(.+))?/);
    if (urlMatch) {
      return {
        major: parseInt(urlMatch[1], 10),
        minor: parseInt(urlMatch[2], 10),
        patch: parseInt(urlMatch[3] || '0', 10),
        prerelease: urlMatch[4] || null,
        format: 'url'
      };
    }

    // Handle standard semantic version format: 1.0.0
    const semverMatch = versionString.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (semverMatch) {
      return {
        major: parseInt(semverMatch[1], 10),
        minor: parseInt(semverMatch[2], 10),
        patch: parseInt(semverMatch[3], 10),
        prerelease: semverMatch[4] || null,
        format: 'semver'
      };
    }

    // Handle short version format: 1.0
    const shortMatch = versionString.match(/^(\d+)\.(\d+)$/);
    if (shortMatch) {
      return {
        major: parseInt(shortMatch[1], 10),
        minor: parseInt(shortMatch[2], 10),
        patch: 0,
        prerelease: null,
        format: 'short'
      };
    }

    throw new Error(`Invalid version format: ${versionString}`);
  }

  /**
   * Compare this version with another version
   * @param {SemanticVersion} other - Version to compare with
   * @returns {number} -1 if this < other, 0 if equal, 1 if this > other
   */
  compare(other) {
    if (!(other instanceof SemanticVersion)) {
      other = new SemanticVersion(other);
    }

    // Compare major version
    if (this.parsed.major !== other.parsed.major) {
      return this.parsed.major > other.parsed.major ? 1 : -1;
    }

    // Compare minor version
    if (this.parsed.minor !== other.parsed.minor) {
      return this.parsed.minor > other.parsed.minor ? 1 : -1;
    }

    // Compare patch version
    if (this.parsed.patch !== other.parsed.patch) {
      return this.parsed.patch > other.parsed.patch ? 1 : -1;
    }

    // Compare prerelease versions
    if (this.parsed.prerelease && !other.parsed.prerelease) return -1;
    if (!this.parsed.prerelease && other.parsed.prerelease) return 1;
    if (this.parsed.prerelease && other.parsed.prerelease) {
      return this.parsed.prerelease.localeCompare(other.parsed.prerelease);
    }

    return 0;
  }

  /**
   * Check if this version is compatible with another version
   * @param {SemanticVersion} other - Version to check compatibility with
   * @returns {boolean} True if compatible
   */
  isCompatibleWith(other) {
    if (!(other instanceof SemanticVersion)) {
      other = new SemanticVersion(other);
    }

    // Same major version is compatible
    if (this.parsed.major === other.parsed.major) {
      return true;
    }

    // Check for known compatibility exceptions
    return this._checkCompatibilityExceptions(other);
  }

  /**
   * Check for specific compatibility exceptions
   * @private
   */
  _checkCompatibilityExceptions(other) {
    // Future: Add specific compatibility rules here
    // For now, different major versions are incompatible
    return false;
  }

  /**
   * Get version as URL format
   */
  toURL() {
    return `https://ansybl.org/version/${this.parsed.major}.${this.parsed.minor}`;
  }

  /**
   * Get version as semantic version string
   */
  toSemVer() {
    let version = `${this.parsed.major}.${this.parsed.minor}.${this.parsed.patch}`;
    if (this.parsed.prerelease) {
      version += `-${this.parsed.prerelease}`;
    }
    return version;
  }

  toString() {
    return this.original;
  }
}

/**
 * Protocol compatibility matrix and checking
 */
export class CompatibilityMatrix {
  constructor() {
    this.matrix = this._buildCompatibilityMatrix();
  }

  /**
   * Build the compatibility matrix for different protocol versions
   * @private
   */
  _buildCompatibilityMatrix() {
    return {
      '1.0': {
        supportedFeatures: [
          'basic_feed_structure',
          'ed25519_signatures',
          'media_attachments',
          'social_interactions',
          'reply_threading',
          'extension_fields'
        ],
        backwardCompatible: [],
        forwardCompatible: ['1.1', '1.2'],
        deprecatedFeatures: [],
        requiredFields: [
          'version', 'title', 'home_page_url', 'feed_url', 'author', 'items'
        ]
      },
      '1.1': {
        supportedFeatures: [
          'basic_feed_structure',
          'ed25519_signatures',
          'media_attachments',
          'social_interactions',
          'reply_threading',
          'extension_fields',
          'enhanced_discovery',
          'webmention_support'
        ],
        backwardCompatible: ['1.0'],
        forwardCompatible: ['1.2'],
        deprecatedFeatures: [],
        requiredFields: [
          'version', 'title', 'home_page_url', 'feed_url', 'author', 'items'
        ]
      },
      '2.0': {
        supportedFeatures: [
          'basic_feed_structure',
          'ed25519_signatures',
          'media_attachments',
          'social_interactions',
          'reply_threading',
          'extension_fields',
          'enhanced_discovery',
          'webmention_support',
          'advanced_cryptography',
          'content_addressing'
        ],
        backwardCompatible: [],
        forwardCompatible: [],
        deprecatedFeatures: ['legacy_signature_format'],
        requiredFields: [
          'version', 'title', 'home_page_url', 'feed_url', 'author', 'items', 'content_hash'
        ]
      }
    };
  }

  /**
   * Check if a version supports a specific feature
   * @param {string} version - Version to check
   * @param {string} feature - Feature to check for
   * @returns {boolean} True if feature is supported
   */
  supportsFeature(version, feature) {
    const versionData = this.matrix[this._normalizeVersion(version)];
    return versionData ? versionData.supportedFeatures.includes(feature) : false;
  }

  /**
   * Check if two versions are compatible
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @returns {CompatibilityResult} Compatibility information
   */
  checkCompatibility(version1, version2) {
    const v1 = this._normalizeVersion(version1);
    const v2 = this._normalizeVersion(version2);
    
    const v1Data = this.matrix[v1];
    const v2Data = this.matrix[v2];

    if (!v1Data || !v2Data) {
      return {
        compatible: false,
        reason: 'Unknown version',
        recommendations: ['Update to a supported version']
      };
    }

    // Check if versions are the same
    if (v1 === v2) {
      return {
        compatible: true,
        reason: 'Same version',
        recommendations: []
      };
    }

    // Check backward compatibility
    if (v1Data.backwardCompatible.includes(v2) || v2Data.forwardCompatible.includes(v1)) {
      return {
        compatible: true,
        reason: 'Backward compatible',
        recommendations: ['Consider upgrading to the latest version']
      };
    }

    // Check forward compatibility
    if (v1Data.forwardCompatible.includes(v2) || v2Data.backwardCompatible.includes(v1)) {
      return {
        compatible: true,
        reason: 'Forward compatible',
        recommendations: ['Some features may not be available in older version']
      };
    }

    return {
      compatible: false,
      reason: 'Incompatible versions',
      recommendations: [
        'Upgrade both implementations to compatible versions',
        'Use migration tools to convert between versions'
      ]
    };
  }

  /**
   * Get supported features for a version
   * @param {string} version - Version to check
   * @returns {Array<string>} List of supported features
   */
  getSupportedFeatures(version) {
    const versionData = this.matrix[this._normalizeVersion(version)];
    return versionData ? [...versionData.supportedFeatures] : [];
  }

  /**
   * Get deprecated features for a version
   * @param {string} version - Version to check
   * @returns {Array<string>} List of deprecated features
   */
  getDeprecatedFeatures(version) {
    const versionData = this.matrix[this._normalizeVersion(version)];
    return versionData ? [...versionData.deprecatedFeatures] : [];
  }

  /**
   * Get required fields for a version
   * @param {string} version - Version to check
   * @returns {Array<string>} List of required fields
   */
  getRequiredFields(version) {
    const versionData = this.matrix[this._normalizeVersion(version)];
    return versionData ? [...versionData.requiredFields] : [];
  }

  /**
   * Normalize version string to matrix key format
   * @private
   */
  _normalizeVersion(version) {
    try {
      const semver = new SemanticVersion(version);
      return `${semver.parsed.major}.${semver.parsed.minor}`;
    } catch (error) {
      return version;
    }
  }
}

/**
 * Version-specific feature detection and handling
 */
export class FeatureDetector {
  constructor() {
    this.compatibilityMatrix = new CompatibilityMatrix();
  }

  /**
   * Detect available features in a document
   * @param {object} document - Parsed Ansybl document
   * @returns {FeatureDetectionResult} Detected features and version info
   */
  detectFeatures(document) {
    const result = {
      version: document.version || 'unknown',
      detectedFeatures: [],
      missingFeatures: [],
      deprecatedFeatures: [],
      extensionFields: []
    };

    try {
      const version = new SemanticVersion(document.version);
      const supportedFeatures = this.compatibilityMatrix.getSupportedFeatures(version.toSemVer());
      const deprecatedFeatures = this.compatibilityMatrix.getDeprecatedFeatures(version.toSemVer());

      // Detect basic features
      if (document.title && document.author && document.items) {
        result.detectedFeatures.push('basic_feed_structure');
      }

      // Detect signature features
      if (document.signature || (document.items && document.items.some(item => item.signature))) {
        result.detectedFeatures.push('ed25519_signatures');
      }

      // Detect media attachment features
      if (document.items && document.items.some(item => item.attachments && item.attachments.length > 0)) {
        result.detectedFeatures.push('media_attachments');
      }

      // Detect social interaction features
      if (document.items && document.items.some(item => item.interactions)) {
        result.detectedFeatures.push('social_interactions');
      }

      // Detect reply threading
      if (document.items && document.items.some(item => item.in_reply_to)) {
        result.detectedFeatures.push('reply_threading');
      }

      // Detect extension fields
      const extensions = this._findExtensionFields(document);
      if (extensions.length > 0) {
        result.detectedFeatures.push('extension_fields');
        result.extensionFields = extensions;
      }

      // Check for missing supported features
      result.missingFeatures = supportedFeatures.filter(
        feature => !result.detectedFeatures.includes(feature)
      );

      // Check for deprecated features
      result.deprecatedFeatures = deprecatedFeatures.filter(
        feature => result.detectedFeatures.includes(feature)
      );

    } catch (error) {
      result.error = `Feature detection failed: ${error.message}`;
    }

    return result;
  }

  /**
   * Find extension fields in document
   * @private
   */
  _findExtensionFields(obj, path = '') {
    const extensions = [];
    
    if (typeof obj !== 'object' || obj === null) {
      return extensions;
    }

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (key.startsWith('_')) {
        extensions.push({
          field: currentPath,
          value: typeof value
        });
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        extensions.push(...this._findExtensionFields(value, currentPath));
      } else if (Array.isArray(value)) {
        // Handle arrays - check each item
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            extensions.push(...this._findExtensionFields(item, `${currentPath}[${index}]`));
          }
        });
      }
    }

    return extensions;
  }

  /**
   * Check if document uses deprecated features
   * @param {object} document - Parsed Ansybl document
   * @returns {Array<string>} List of deprecated features in use
   */
  checkDeprecatedFeatures(document) {
    const features = this.detectFeatures(document);
    return features.deprecatedFeatures;
  }

  /**
   * Suggest feature upgrades for a document
   * @param {object} document - Parsed Ansybl document
   * @returns {Array<string>} List of upgrade suggestions
   */
  suggestUpgrades(document) {
    const suggestions = [];
    const features = this.detectFeatures(document);

    if (features.deprecatedFeatures.length > 0) {
      suggestions.push(`Remove deprecated features: ${features.deprecatedFeatures.join(', ')}`);
    }

    if (!features.detectedFeatures.includes('ed25519_signatures')) {
      suggestions.push('Add cryptographic signatures for content verification');
    }

    if (!features.detectedFeatures.includes('social_interactions')) {
      suggestions.push('Add interaction tracking for better social features');
    }

    return suggestions;
  }
}

/**
 * Main version management system
 */
export class VersionManager {
  constructor() {
    this.compatibilityMatrix = new CompatibilityMatrix();
    this.featureDetector = new FeatureDetector();
  }

  /**
   * Parse and validate version information
   * @param {string} versionString - Version to parse
   * @returns {SemanticVersion} Parsed version object
   */
  parseVersion(versionString) {
    return new SemanticVersion(versionString);
  }

  /**
   * Check compatibility between versions
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @returns {CompatibilityResult} Compatibility information
   */
  checkCompatibility(version1, version2) {
    return this.compatibilityMatrix.checkCompatibility(version1, version2);
  }

  /**
   * Detect features in a document
   * @param {object} document - Parsed Ansybl document
   * @returns {FeatureDetectionResult} Feature detection results
   */
  detectFeatures(document) {
    return this.featureDetector.detectFeatures(document);
  }

  /**
   * Get version-specific validation requirements
   * @param {string} version - Version to get requirements for
   * @returns {object} Validation requirements
   */
  getValidationRequirements(version) {
    const requiredFields = this.compatibilityMatrix.getRequiredFields(version);
    const supportedFeatures = this.compatibilityMatrix.getSupportedFeatures(version);
    const deprecatedFeatures = this.compatibilityMatrix.getDeprecatedFeatures(version);

    return {
      requiredFields,
      supportedFeatures,
      deprecatedFeatures,
      version: this.parseVersion(version)
    };
  }

  /**
   * Validate document against version requirements
   * @param {object} document - Document to validate
   * @param {string} targetVersion - Version to validate against
   * @returns {ValidationResult} Validation results
   */
  validateAgainstVersion(document, targetVersion) {
    const requirements = this.getValidationRequirements(targetVersion);
    const features = this.detectFeatures(document);
    const errors = [];
    const warnings = [];

    // Check required fields
    for (const field of requirements.requiredFields) {
      if (!this._hasField(document, field)) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${field}' is missing for version ${targetVersion}`,
          field
        });
      }
    }

    // Check for deprecated features
    for (const feature of features.deprecatedFeatures) {
      warnings.push({
        code: 'DEPRECATED_FEATURE',
        message: `Feature '${feature}' is deprecated in version ${targetVersion}`,
        feature
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      version: targetVersion,
      detectedFeatures: features.detectedFeatures
    };
  }

  /**
   * Check if document has a specific field
   * @private
   */
  _hasField(obj, fieldPath) {
    const parts = fieldPath.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined || !(part in current)) {
        return false;
      }
      current = current[part];
    }

    return current !== null && current !== undefined;
  }
}

export default VersionManager;