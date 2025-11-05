/**
 * Version Compatibility Test Suite
 * Tests parsing of documents from different protocol versions, migration accuracy, and compatibility edge cases
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { 
  VersionManager, 
  SemanticVersion, 
  CompatibilityMatrix, 
  FeatureDetector 
} from '../version-manager.js';
import { 
  DocumentMigrator, 
  BackwardCompatibilityShim, 
  MigrationValidator 
} from '../migration-tools.js';

describe('Version Management System', () => {
  describe('SemanticVersion', () => {
    test('should parse Ansybl URL version format', () => {
      const version = new SemanticVersion('https://ansybl.org/version/1.0');
      assert.strictEqual(version.parsed.major, 1);
      assert.strictEqual(version.parsed.minor, 0);
      assert.strictEqual(version.parsed.patch, 0);
      assert.strictEqual(version.parsed.format, 'url');
    });

    test('should parse standard semantic version format', () => {
      const version = new SemanticVersion('1.2.3');
      assert.strictEqual(version.parsed.major, 1);
      assert.strictEqual(version.parsed.minor, 2);
      assert.strictEqual(version.parsed.patch, 3);
      assert.strictEqual(version.parsed.format, 'semver');
    });

    test('should parse short version format', () => {
      const version = new SemanticVersion('2.1');
      assert.strictEqual(version.parsed.major, 2);
      assert.strictEqual(version.parsed.minor, 1);
      assert.strictEqual(version.parsed.patch, 0);
      assert.strictEqual(version.parsed.format, 'short');
    });

    test('should handle prerelease versions', () => {
      const version = new SemanticVersion('1.0.0-beta.1');
      assert.strictEqual(version.parsed.major, 1);
      assert.strictEqual(version.parsed.minor, 0);
      assert.strictEqual(version.parsed.patch, 0);
      assert.strictEqual(version.parsed.prerelease, 'beta.1');
    });

    test('should throw error for invalid version format', () => {
      assert.throws(() => {
        new SemanticVersion('invalid.version');
      }, /Invalid version format/);
    });

    test('should compare versions correctly', () => {
      const v1_0 = new SemanticVersion('1.0.0');
      const v1_1 = new SemanticVersion('1.1.0');
      const v2_0 = new SemanticVersion('2.0.0');

      assert.strictEqual(v1_0.compare(v1_1), -1);
      assert.strictEqual(v1_1.compare(v1_0), 1);
      assert.strictEqual(v1_0.compare(v1_0), 0);
      assert.strictEqual(v1_1.compare(v2_0), -1);
    });

    test('should check compatibility correctly', () => {
      const v1_0 = new SemanticVersion('1.0.0');
      const v1_1 = new SemanticVersion('1.1.0');
      const v2_0 = new SemanticVersion('2.0.0');

      assert.strictEqual(v1_0.isCompatibleWith(v1_1), true);
      assert.strictEqual(v1_1.isCompatibleWith(v1_0), true);
      assert.strictEqual(v1_0.isCompatibleWith(v2_0), false);
    });

    test('should convert to URL format', () => {
      const version = new SemanticVersion('1.2.3');
      assert.strictEqual(version.toURL(), 'https://ansybl.org/version/1.2');
    });

    test('should convert to semantic version format', () => {
      const version = new SemanticVersion('https://ansybl.org/version/1.0');
      assert.strictEqual(version.toSemVer(), '1.0.0');
    });
  });

  describe('CompatibilityMatrix', () => {
    let matrix;

    test('should initialize compatibility matrix', () => {
      matrix = new CompatibilityMatrix();
      assert.ok(matrix.matrix);
      assert.ok(matrix.matrix['1.0']);
    });

    test('should check feature support correctly', () => {
      matrix = new CompatibilityMatrix();
      
      assert.strictEqual(matrix.supportsFeature('1.0', 'basic_feed_structure'), true);
      assert.strictEqual(matrix.supportsFeature('1.0', 'enhanced_discovery'), false);
      assert.strictEqual(matrix.supportsFeature('1.1', 'enhanced_discovery'), true);
    });

    test('should check version compatibility', () => {
      matrix = new CompatibilityMatrix();
      
      const compat1_0_1_1 = matrix.checkCompatibility('1.0', '1.1');
      assert.strictEqual(compat1_0_1_1.compatible, true);
      assert.strictEqual(compat1_0_1_1.reason, 'Forward compatible');

      const compat1_0_2_0 = matrix.checkCompatibility('1.0', '2.0');
      assert.strictEqual(compat1_0_2_0.compatible, false);
      assert.strictEqual(compat1_0_2_0.reason, 'Incompatible versions');
    });

    test('should return supported features for version', () => {
      matrix = new CompatibilityMatrix();
      
      const features1_0 = matrix.getSupportedFeatures('1.0');
      assert.ok(features1_0.includes('basic_feed_structure'));
      assert.ok(features1_0.includes('ed25519_signatures'));
      assert.ok(!features1_0.includes('enhanced_discovery'));

      const features1_1 = matrix.getSupportedFeatures('1.1');
      assert.ok(features1_1.includes('enhanced_discovery'));
    });

    test('should return required fields for version', () => {
      matrix = new CompatibilityMatrix();
      
      const required1_0 = matrix.getRequiredFields('1.0');
      assert.ok(required1_0.includes('version'));
      assert.ok(required1_0.includes('title'));
      assert.ok(required1_0.includes('author'));

      const required2_0 = matrix.getRequiredFields('2.0');
      assert.ok(required2_0.includes('content_hash'));
    });
  });

  describe('FeatureDetector', () => {
    let detector;

    test('should initialize feature detector', () => {
      detector = new FeatureDetector();
      assert.ok(detector.compatibilityMatrix);
    });

    test('should detect basic features in document', () => {
      detector = new FeatureDetector();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: [
          {
            id: 'https://example.com/1',
            content_text: 'Test content',
            signature: 'ed25519:testsig'
          }
        ],
        signature: 'ed25519:feedsig'
      };

      const features = detector.detectFeatures(document);
      assert.ok(features.detectedFeatures.includes('basic_feed_structure'));
      assert.ok(features.detectedFeatures.includes('ed25519_signatures'));
    });

    test('should detect media attachment features', () => {
      detector = new FeatureDetector();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: [
          {
            id: 'https://example.com/1',
            content_text: 'Test content',
            attachments: [
              {
                url: 'https://example.com/image.jpg',
                mime_type: 'image/jpeg'
              }
            ],
            signature: 'ed25519:testsig'
          }
        ]
      };

      const features = detector.detectFeatures(document);
      assert.ok(features.detectedFeatures.includes('media_attachments'));
    });

    test('should detect social interaction features', () => {
      detector = new FeatureDetector();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: [
          {
            id: 'https://example.com/1',
            content_text: 'Test content',
            interactions: {
              replies_count: 5,
              likes_count: 10,
              shares_count: 2
            },
            signature: 'ed25519:testsig'
          }
        ]
      };

      const features = detector.detectFeatures(document);
      assert.ok(features.detectedFeatures.includes('social_interactions'));
    });

    test('should detect reply threading features', () => {
      detector = new FeatureDetector();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: [
          {
            id: 'https://example.com/1',
            content_text: 'Test content',
            in_reply_to: 'https://other.example.com/post',
            signature: 'ed25519:testsig'
          }
        ]
      };

      const features = detector.detectFeatures(document);
      assert.ok(features.detectedFeatures.includes('reply_threading'));
    });

    test('should detect extension fields', () => {
      detector = new FeatureDetector();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        _custom_field: 'custom value',
        items: [
          {
            id: 'https://example.com/1',
            content_text: 'Test content',
            _item_extension: 'item custom',
            signature: 'ed25519:testsig'
          }
        ]
      };

      const features = detector.detectFeatures(document);
      assert.ok(features.detectedFeatures.includes('extension_fields'));
      assert.strictEqual(features.extensionFields.length, 2);
      assert.ok(features.extensionFields.some(ext => ext.field === '_custom_field'));
      assert.ok(features.extensionFields.some(ext => ext.field === 'items[0]._item_extension'));
    });

    test('should suggest upgrades for documents', () => {
      detector = new FeatureDetector();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: [
          {
            id: 'https://example.com/1',
            content_text: 'Test content'
            // No signature
          }
        ]
        // No feed signature
      };

      const suggestions = detector.suggestUpgrades(document);
      assert.ok(suggestions.some(s => s.includes('cryptographic signatures')));
      assert.ok(suggestions.some(s => s.includes('interaction tracking')));
    });
  });
});

describe('Document Migration System', () => {
  describe('DocumentMigrator', () => {
    let migrator;

    test('should initialize document migrator', () => {
      migrator = new DocumentMigrator();
      assert.ok(migrator.versionManager);
      assert.ok(migrator.validator);
      assert.ok(migrator.migrationRules);
    });

    test('should detect when no migration is needed', async () => {
      migrator = new DocumentMigrator();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: []
      };

      const result = await migrator.migrate(document, 'https://ansybl.org/version/1.0');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.migrated, false);
      assert.ok(result.message.includes('No migration needed'));
    });

    test('should migrate from 1.0 to 1.1', async () => {
      migrator = new DocumentMigrator();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: []
      };

      const result = await migrator.migrate(document, 'https://ansybl.org/version/1.1');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.migrated, true);
      assert.strictEqual(result.document.version, 'https://ansybl.org/version/1.1');
      assert.ok(result.document._discovery);
    });

    test('should handle migration with validation', async () => {
      migrator = new DocumentMigrator();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: []
      };

      const result = await migrator.migrate(document, 'https://ansybl.org/version/1.1', {
        validateResult: true
      });
      
      assert.strictEqual(result.success, true);
      assert.ok(result.validation);
    });

    test('should handle dry run migration', async () => {
      migrator = new DocumentMigrator();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: []
      };

      const result = await migrator.migrate(document, 'https://ansybl.org/version/1.1', {
        dryRun: true
      });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.document.version, 'https://ansybl.org/version/1.0'); // Original unchanged
      assert.ok(result.appliedTransformations.length > 0);
    });

    test('should fail migration for unsupported version transition', async () => {
      migrator = new DocumentMigrator();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: []
      };

      const result = await migrator.migrate(document, 'https://ansybl.org/version/3.0');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.code, 'MIGRATION_PATH_NOT_FOUND');
    });

    test('should preserve extensions during migration', async () => {
      migrator = new DocumentMigrator();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        _custom_extension: 'custom value',
        items: [
          {
            id: 'https://example.com/1',
            url: 'https://example.com/1',
            content_text: 'Test',
            date_published: '2025-11-04T10:00:00Z',
            signature: 'ed25519:test',
            _item_custom: 'item custom'
          }
        ]
      };

      const result = await migrator.migrate(document, 'https://ansybl.org/version/1.1', {
        preserveExtensions: true
      });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.document._custom_extension, 'custom value');
      assert.strictEqual(result.document.items[0]._item_custom, 'item custom');
    });
  });

  describe('BackwardCompatibilityShim', () => {
    let shim;

    test('should create compatibility shim', () => {
      shim = new BackwardCompatibilityShim();
      const shimFunctions = shim.createShim('https://ansybl.org/version/1.0');
      
      assert.ok(shimFunctions.parseWithCompatibility);
      assert.ok(shimFunctions.validateWithCompatibility);
      assert.ok(shimFunctions.getSupportedFeatures);
    });

    test('should parse compatible document directly', async () => {
      shim = new BackwardCompatibilityShim();
      const shimFunctions = shim.createShim('https://ansybl.org/version/1.0');
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: []
      };

      const result = await shimFunctions.parseWithCompatibility(document);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.compatibility.migrated, false);
      assert.strictEqual(result.compatibility.directParse, true);
    });

    test('should parse with migration when needed', async () => {
      shim = new BackwardCompatibilityShim();
      const shimFunctions = shim.createShim('https://ansybl.org/version/1.1');
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: []
      };

      const result = await shimFunctions.parseWithCompatibility(document);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.compatibility.migrated, true);
      assert.strictEqual(result.compatibility.targetVersion, 'https://ansybl.org/version/1.1');
    });

    test('should get supported features for target version', () => {
      shim = new BackwardCompatibilityShim();
      const shimFunctions = shim.createShim('https://ansybl.org/version/1.1');
      
      const features = shimFunctions.getSupportedFeatures();
      assert.ok(features.includes('basic_feed_structure'));
      assert.ok(features.includes('enhanced_discovery'));
    });
  });

  describe('MigrationValidator', () => {
    let validator;

    test('should initialize migration validator', () => {
      validator = new MigrationValidator();
      assert.ok(validator.migrator);
    });

    test('should validate migration accuracy', () => {
      validator = new MigrationValidator();
      
      const sourceDocument = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: [
          { id: '1', content_text: 'Content 1' },
          { id: '2', content_text: 'Content 2' }
        ]
      };

      const migratedDocument = {
        version: 'https://ansybl.org/version/1.1',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        discovery: { webring_enabled: false },
        items: [
          { id: '1', content_text: 'Content 1' },
          { id: '2', content_text: 'Content 2' }
        ]
      };

      const result = validator.validateMigrationAccuracy(
        sourceDocument, 
        migratedDocument, 
        'https://ansybl.org/version/1.1'
      );

      assert.strictEqual(result.accurate, true);
      assert.strictEqual(result.dataPreserved, true);
      assert.ok(result.warnings.some(w => w.includes('Fields added')));
    });

    test('should detect data loss during migration', () => {
      validator = new MigrationValidator();
      
      const sourceDocument = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: [
          { id: '1', content_text: 'Content 1' },
          { id: '2', content_text: 'Content 2' }
        ]
      };

      const migratedDocument = {
        version: 'https://ansybl.org/version/1.1',
        title: 'Test Feed',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: [
          { id: '1', content_text: 'Content 1' }
          // Missing second item
        ]
      };

      const result = validator.validateMigrationAccuracy(
        sourceDocument, 
        migratedDocument, 
        'https://ansybl.org/version/1.1'
      );

      assert.strictEqual(result.dataPreserved, false);
      assert.ok(result.issues.some(issue => issue.includes('Number of items changed')));
    });

    test('should test round-trip migration accuracy', async () => {
      validator = new MigrationValidator();
      
      const document = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: { name: 'Test Author', public_key: 'ed25519:test' },
        items: [
          {
            id: 'https://example.com/1',
            url: 'https://example.com/1',
            content_text: 'Test content',
            date_published: '2025-11-04T10:00:00Z',
            signature: 'ed25519:test'
          }
        ]
      };

      const result = await validator.testRoundTripMigration(
        document, 
        'https://ansybl.org/version/1.1'
      );

      assert.strictEqual(result.success, true);
      assert.ok(result.originalDocument);
      assert.ok(result.intermediateDocument);
      assert.ok(result.finalDocument);
    });
  });
});

describe('Version Compatibility Edge Cases', () => {
  test('should handle malformed version strings gracefully', () => {
    const versionManager = new VersionManager();
    
    assert.throws(() => {
      versionManager.parseVersion('not-a-version');
    }, /Invalid version format/);
  });

  test('should handle documents with missing version field', () => {
    const detector = new FeatureDetector();
    
    const document = {
      title: 'Test Feed',
      author: { name: 'Test Author' },
      items: []
    };

    const features = detector.detectFeatures(document);
    assert.strictEqual(features.version, 'unknown');
    assert.ok(features.error);
  });

  test('should handle empty documents gracefully', async () => {
    const migrator = new DocumentMigrator();
    
    const result = await migrator.migrate({}, 'https://ansybl.org/version/1.0');
    assert.strictEqual(result.success, false);
  });

  test('should handle circular references in documents', () => {
    const detector = new FeatureDetector();
    
    const document = {
      version: 'https://ansybl.org/version/1.0',
      title: 'Test Feed',
      author: { name: 'Test Author' },
      items: []
    };
    
    // Create circular reference
    document.self = document;
    
    // Should not crash
    const features = detector.detectFeatures(document);
    assert.ok(features);
  });

  test('should handle very large documents efficiently', () => {
    const detector = new FeatureDetector();
    
    const document = {
      version: 'https://ansybl.org/version/1.0',
      title: 'Large Feed',
      author: { name: 'Test Author', public_key: 'ed25519:test' },
      items: []
    };

    // Create large number of items
    for (let i = 0; i < 1000; i++) {
      document.items.push({
        id: `https://example.com/${i}`,
        content_text: `Content ${i}`,
        signature: 'ed25519:test'
      });
    }

    const startTime = Date.now();
    const features = detector.detectFeatures(document);
    const endTime = Date.now();

    assert.ok(features.detectedFeatures.includes('basic_feed_structure'));
    assert.ok(endTime - startTime < 1000); // Should complete within 1 second
  });

  test('should preserve unknown extension fields during migration', async () => {
    const migrator = new DocumentMigrator();
    
    const document = {
      version: 'https://ansybl.org/version/1.0',
      title: 'Test Feed',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl',
      author: { 
        name: 'Test Author', 
        public_key: 'ed25519:test',
        _custom_author_field: 'custom value'
      },
      _unknown_extension: {
        nested: {
          _deep_extension: 'deep value'
        }
      },
      items: []
    };

    const result = await migrator.migrate(document, 'https://ansybl.org/version/1.1');
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.document.author._custom_author_field, 'custom value');
    assert.strictEqual(result.document._unknown_extension.nested._deep_extension, 'deep value');
  });

  test('should handle migration between incompatible versions gracefully', async () => {
    const migrator = new DocumentMigrator();
    
    const document = {
      version: 'https://ansybl.org/version/1.0',
      title: 'Test Feed',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl',
      author: { name: 'Test Author', public_key: 'ed25519:test' },
      items: []
    };

    const result = await migrator.migrate(document, 'https://ansybl.org/version/99.0');
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.code, 'MIGRATION_PATH_NOT_FOUND');
    assert.ok(result.error.message.includes('No migration path'));
  });
});

describe('Forward and Backward Compatibility', () => {
  test('should parse newer version documents with forward compatibility', async () => {
    const shim = new BackwardCompatibilityShim();
    const shimFunctions = shim.createShim('https://ansybl.org/version/1.0');
    
    const newerDocument = {
      version: 'https://ansybl.org/version/1.1',
      title: 'Test Feed',
      author: { name: 'Test Author', public_key: 'ed25519:test' },
      _discovery: { webring_enabled: true }, // New field in 1.1
      items: []
    };

    const result = await shimFunctions.parseWithCompatibility(newerDocument);
    
    // Should succeed with compatibility warnings
    assert.strictEqual(result.success, true);
    assert.ok(result.compatibility);
  });

  test('should maintain data integrity across version boundaries', async () => {
    const validator = new MigrationValidator();
    
    const originalDocument = {
      version: 'https://ansybl.org/version/1.0',
      title: 'Critical Data Feed',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl',
      author: { 
        name: 'Important Author', 
        public_key: 'ed25519:criticalkey',
        url: 'https://author.example.com'
      },
      items: [
        {
          id: 'https://example.com/critical-post',
          url: 'https://example.com/critical-post',
          title: 'Critical Information',
          content_text: 'This content must be preserved exactly',
          date_published: '2025-11-04T10:00:00Z',
          signature: 'ed25519:criticalsig',
          tags: ['important', 'critical']
        }
      ]
    };

    const roundTripResult = await validator.testRoundTripMigration(
      originalDocument,
      'https://ansybl.org/version/1.1'
    );

    assert.strictEqual(roundTripResult.success, true);
    assert.strictEqual(roundTripResult.dataPreserved, true);
    
    // Verify critical data is preserved
    const finalDoc = roundTripResult.finalDocument;
    assert.strictEqual(finalDoc.title, originalDocument.title);
    assert.strictEqual(finalDoc.author.name, originalDocument.author.name);
    assert.strictEqual(finalDoc.items[0].content_text, originalDocument.items[0].content_text);
    assert.deepStrictEqual(finalDoc.items[0].tags, originalDocument.items[0].tags);
  });
});