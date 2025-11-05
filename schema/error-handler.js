/**
 * Structured Error Handling and Reporting System for Ansybl Parser
 * Provides comprehensive error reporting with actionable feedback
 */

/**
 * Error severity levels
 */
export const ErrorSeverity = {
  CRITICAL: 'critical',
  ERROR: 'error', 
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Error categories for better organization
 */
export const ErrorCategory = {
  PARSE: 'parse',
  VALIDATION: 'validation',
  SIGNATURE: 'signature',
  NETWORK: 'network',
  COMPATIBILITY: 'compatibility',
  EXTENSION: 'extension'
};

/**
 * Comprehensive error reporting system
 */
export class AnsyblErrorReporter {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.context = {};
  }

  /**
   * Add error with full context information
   * @param {string} code - Error code
   * @param {string} message - Human-readable message
   * @param {object} options - Additional error options
   */
  addError(code, message, options = {}) {
    const error = this._createErrorObject(code, message, ErrorSeverity.ERROR, options);
    this.errors.push(error);
    return error;
  }

  /**
   * Add warning with context
   * @param {string} code - Warning code
   * @param {string} message - Human-readable message
   * @param {object} options - Additional warning options
   */
  addWarning(code, message, options = {}) {
    const warning = this._createErrorObject(code, message, ErrorSeverity.WARNING, options);
    this.warnings.push(warning);
    return warning;
  }

  /**
   * Add critical error that stops processing
   * @param {string} code - Error code
   * @param {string} message - Human-readable message
   * @param {object} options - Additional error options
   */
  addCriticalError(code, message, options = {}) {
    const error = this._createErrorObject(code, message, ErrorSeverity.CRITICAL, options);
    this.errors.push(error);
    return error;
  }

  /**
   * Set context information for error reporting
   * @param {object} context - Context data
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Check if there are any errors
   * @returns {boolean}
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Check if there are critical errors
   * @returns {boolean}
   */
  hasCriticalErrors() {
    return this.errors.some(error => error.severity === ErrorSeverity.CRITICAL);
  }

  /**
   * Get all errors and warnings
   * @returns {object} Complete error report
   */
  getReport() {
    return {
      success: !this.hasErrors(),
      errors: this.errors,
      warnings: this.warnings,
      context: this.context,
      summary: this._generateSummary()
    };
  }

  /**
   * Clear all errors and warnings
   */
  clear() {
    this.errors = [];
    this.warnings = [];
    this.context = {};
  }

  /**
   * Create structured error object
   * @private
   */
  _createErrorObject(code, message, severity, options) {
    const {
      category = ErrorCategory.VALIDATION,
      field = null,
      details = null,
      suggestions = [],
      documentUrl = null,
      lineNumber = null,
      position = null,
      recoverable = true
    } = options;

    return {
      code,
      message,
      severity,
      category,
      field,
      details,
      suggestions: Array.isArray(suggestions) ? suggestions : [suggestions].filter(Boolean),
      context: {
        document_url: documentUrl || this.context.document_url,
        line_number: lineNumber,
        position,
        field_path: field,
        timestamp: new Date().toISOString()
      },
      recoverable,
      id: this._generateErrorId()
    };
  }

  /**
   * Generate unique error ID
   * @private
   */
  _generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate error summary
   * @private
   */
  _generateSummary() {
    const criticalCount = this.errors.filter(e => e.severity === ErrorSeverity.CRITICAL).length;
    const errorCount = this.errors.filter(e => e.severity === ErrorSeverity.ERROR).length;
    const warningCount = this.warnings.length;

    return {
      total_issues: criticalCount + errorCount + warningCount,
      critical_errors: criticalCount,
      errors: errorCount,
      warnings: warningCount,
      can_proceed: criticalCount === 0,
      most_common_category: this._getMostCommonCategory()
    };
  }

  /**
   * Get most common error category
   * @private
   */
  _getMostCommonCategory() {
    const categories = {};
    [...this.errors, ...this.warnings].forEach(issue => {
      categories[issue.category] = (categories[issue.category] || 0) + 1;
    });

    return Object.keys(categories).reduce((a, b) => 
      categories[a] > categories[b] ? a : b, null
    );
  }
}

/**
 * Graceful degradation handler for non-critical failures
 */
export class GracefulDegradationHandler {
  constructor() {
    this.degradations = [];
  }

  /**
   * Handle a non-critical failure gracefully
   * @param {string} feature - Feature that failed
   * @param {Error} error - Original error
   * @param {any} fallbackValue - Fallback value to use
   * @returns {any} Fallback value
   */
  degrade(feature, error, fallbackValue = null) {
    const degradation = {
      feature,
      error: error.message,
      fallback_used: fallbackValue !== null,
      fallback_value: fallbackValue,
      timestamp: new Date().toISOString()
    };

    this.degradations.push(degradation);
    return fallbackValue;
  }

  /**
   * Get all degradations that occurred
   * @returns {Array} List of degradations
   */
  getDegradations() {
    return this.degradations;
  }

  /**
   * Check if any degradations occurred
   * @returns {boolean}
   */
  hasDegradations() {
    return this.degradations.length > 0;
  }

  /**
   * Clear degradation history
   */
  clear() {
    this.degradations = [];
  }
}

/**
 * Predefined error templates for common issues
 */
export const ErrorTemplates = {
  // Parse errors
  INVALID_JSON: {
    code: 'INVALID_JSON',
    message: 'Document contains invalid JSON syntax',
    category: ErrorCategory.PARSE,
    suggestions: [
      'Check for missing quotes around strings',
      'Verify all brackets and braces are properly closed',
      'Remove trailing commas',
      'Validate JSON syntax using a JSON validator'
    ]
  },

  EMPTY_DOCUMENT: {
    code: 'EMPTY_DOCUMENT',
    message: 'Document is empty or contains only whitespace',
    category: ErrorCategory.PARSE,
    suggestions: [
      'Provide a valid Ansybl feed document',
      'Check if the document was properly loaded'
    ]
  },

  // Validation errors
  MISSING_REQUIRED_FIELD: {
    code: 'MISSING_REQUIRED_FIELD',
    message: 'Required field is missing',
    category: ErrorCategory.VALIDATION,
    suggestions: [
      'Add the missing required field',
      'Check the Ansybl specification for required fields'
    ]
  },

  INVALID_URL_FORMAT: {
    code: 'INVALID_URL_FORMAT',
    message: 'URL must be a valid HTTPS URL',
    category: ErrorCategory.VALIDATION,
    suggestions: [
      'Ensure URL starts with https://',
      'Check for typos in the URL',
      'Verify the URL is accessible'
    ]
  },

  INVALID_DATE_FORMAT: {
    code: 'INVALID_DATE_FORMAT',
    message: 'Date must be in ISO 8601 format',
    category: ErrorCategory.VALIDATION,
    suggestions: [
      'Use format: 2025-11-04T10:00:00Z',
      'Include timezone information',
      'Ensure date is valid'
    ]
  },

  // Signature errors
  SIGNATURE_VERIFICATION_FAILED: {
    code: 'SIGNATURE_VERIFICATION_FAILED',
    message: 'Cryptographic signature verification failed',
    category: ErrorCategory.SIGNATURE,
    suggestions: [
      'Check that the signature matches the content',
      'Verify the public key is correct',
      'Ensure content has not been modified after signing'
    ]
  },

  INVALID_PUBLIC_KEY: {
    code: 'INVALID_PUBLIC_KEY',
    message: 'Public key format is invalid',
    category: ErrorCategory.SIGNATURE,
    suggestions: [
      'Use ed25519 format: ed25519:base64data',
      'Verify the key is properly base64 encoded',
      'Check key length (should be 32 bytes when decoded)'
    ]
  },

  // Extension errors
  INVALID_EXTENSION_FIELD: {
    code: 'INVALID_EXTENSION_FIELD',
    message: 'Extension field does not follow naming convention',
    category: ErrorCategory.EXTENSION,
    suggestions: [
      'Extension fields must start with underscore (_)',
      'Use format: _extension_name',
      'Check extension field naming rules'
    ]
  },

  // Compatibility errors
  UNSUPPORTED_VERSION: {
    code: 'UNSUPPORTED_VERSION',
    message: 'Protocol version is not supported',
    category: ErrorCategory.COMPATIBILITY,
    suggestions: [
      'Update to a supported protocol version',
      'Check version compatibility matrix',
      'Consider upgrading the parser'
    ]
  }
};

/**
 * Create error from template
 * @param {string} templateName - Template name from ErrorTemplates
 * @param {object} overrides - Override template values
 * @returns {object} Error object
 */
export function createErrorFromTemplate(templateName, overrides = {}) {
  const template = ErrorTemplates[templateName];
  if (!template) {
    throw new Error(`Unknown error template: ${templateName}`);
  }

  return {
    ...template,
    ...overrides,
    suggestions: [...(template.suggestions || []), ...(overrides.suggestions || [])]
  };
}

/**
 * Format error for display
 * @param {object} error - Error object
 * @param {object} options - Formatting options
 * @returns {string} Formatted error message
 */
export function formatError(error, options = {}) {
  const { includeContext = true, includeSuggestions = true, includeId = false } = options;
  
  let formatted = `[${error.severity.toUpperCase()}] ${error.message}`;
  
  if (error.field) {
    formatted += ` (field: ${error.field})`;
  }
  
  if (includeContext && error.context) {
    const contextParts = [];
    if (error.context.document_url) contextParts.push(`URL: ${error.context.document_url}`);
    if (error.context.line_number) contextParts.push(`Line: ${error.context.line_number}`);
    if (error.context.field_path) contextParts.push(`Path: ${error.context.field_path}`);
    
    if (contextParts.length > 0) {
      formatted += `\n  Context: ${contextParts.join(', ')}`;
    }
  }
  
  if (error.details) {
    formatted += `\n  Details: ${error.details}`;
  }
  
  if (includeSuggestions && error.suggestions && error.suggestions.length > 0) {
    formatted += '\n  Suggestions:';
    error.suggestions.forEach(suggestion => {
      formatted += `\n    - ${suggestion}`;
    });
  }
  
  if (includeId && error.id) {
    formatted += `\n  Error ID: ${error.id}`;
  }
  
  return formatted;
}

export default AnsyblErrorReporter;