/**
 * Comprehensive tests for Canonical JSON Serialization
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CanonicalJSONSerializer } from '../canonicalizer.js';

describe('CanonicalJSONSerializer', () => {
  describe('Basic Canonicalization', () => {
    test('canonicalizes null', () => {
      const result = CanonicalJSONSerializer.serialize(null);
      assert.strictEqual(result, 'null');
    });

    test('canonicalizes booleans', () => {
      assert.strictEqual(CanonicalJSONSerializer.serialize(true), 'true');
      assert.strictEqual(CanonicalJSONSerializer.serialize(false), 'false');
    });

    test('canonicalizes integers', () => {
      assert.strictEqual(CanonicalJSONSerializer.serialize(42), '42');
      assert.strictEqual(CanonicalJSONSerializer.serialize(-17), '-17');
      assert.strictEqual(CanonicalJSONSerializer.serialize(0), '0');
    });

    test('canonicalizes floating point numbers', () => {
      assert.strictEqual(CanonicalJSONSerializer.serialize(3.14), '3.14');
      assert.strictEqual(CanonicalJSONSerializer.serialize(1.0), '1');
      assert.strictEqual(CanonicalJSONSerializer.serialize(0.5), '0.5');
    });

    test('canonicalizes strings with minimal escaping', () => {
      assert.strictEqual(CanonicalJSONSerializer.serialize('hello'), '"hello"');
      assert.strictEqual(CanonicalJSONSerializer.serialize('hello "world"'), '"hello \\"world\\""');
      assert.strictEqual(CanonicalJSONSerializer.serialize('line1\nline2'), '"line1\\nline2"');
      assert.strictEqual(CanonicalJSONSerializer.serialize('tab\there'), '"tab\\there"');
    });

    test('canonicalizes arrays', () => {
      assert.strictEqual(CanonicalJSONSerializer.serialize([]), '[]');
      assert.strictEqual(CanonicalJSONSerializer.serialize([1, 2, 3]), '[1,2,3]');
      assert.strictEqual(CanonicalJSONSerializer.serialize(['a', 'b']), '["a","b"]');
    });

    test('canonicalizes objects with sorted keys', () => {
      const obj = { z: 1, a: 2, m: 3 };
      const result = CanonicalJSONSerializer.serialize(obj);
      assert.strictEqual(result, '{"a":2,"m":3,"z":1}');
    });
  });

  describe('Complex Object Canonicalization', () => {
    test('handles nested objects', () => {
      const obj = {
        outer: {
          z: 'last',
          a: 'first'
        },
        first: 1
      };
      const result = CanonicalJSONSerializer.serialize(obj);
      assert.strictEqual(result, '{"first":1,"outer":{"a":"first","z":"last"}}');
    });

    test('handles mixed arrays and objects', () => {
      const obj = {
        items: [
          { id: 2, name: 'second' },
          { id: 1, name: 'first' }
        ],
        count: 2
      };
      const result = CanonicalJSONSerializer.serialize(obj);
      assert.strictEqual(result, '{"count":2,"items":[{"id":2,"name":"second"},{"id":1,"name":"first"}]}');
    });
  });

  describe('Signature Data Creation', () => {
    const sampleFeed = {
      version: "https://ansybl.org/version/1.0",
      title: "Test Feed",
      home_page_url: "https://example.com",
      feed_url: "https://example.com/feed.ansybl",
      author: {
        name: "Test Author",
        url: "https://example.com/author",
        public_key: "ed25519:testkey123"
      }
    };

    const sampleItem = {
      id: "https://example.com/post/1",
      url: "https://example.com/post/1",
      title: "Test Post",
      content_text: "Hello world!",
      content_html: "<p>Hello world!</p>",
      date_published: "2025-11-04T10:00:00Z",
      author: {
        name: "Item Author",
        public_key: "ed25519:itemkey456"
      }
    };

    test('creates feed signature data', () => {
      const signatureData = CanonicalJSONSerializer.createSignatureData(sampleFeed, 'feed');
      const parsed = JSON.parse(signatureData);
      
      // Should include required fields
      assert.ok(parsed.author);
      assert.strictEqual(parsed.author.name, "Test Author");
      assert.strictEqual(parsed.author.public_key, "ed25519:testkey123");
      assert.strictEqual(parsed.feed_url, "https://example.com/feed.ansybl");
      assert.strictEqual(parsed.title, "Test Feed");
      assert.strictEqual(parsed.version, "https://ansybl.org/version/1.0");
      assert.ok(parsed.timestamp); // Should have timestamp
      
      // Should be canonical (keys sorted)
      const keys = Object.keys(parsed);
      const sortedKeys = [...keys].sort();
      assert.deepStrictEqual(keys, sortedKeys);
    });

    test('creates item signature data', () => {
      const signatureData = CanonicalJSONSerializer.createSignatureData(sampleItem, 'item');
      const parsed = JSON.parse(signatureData);
      
      // Should include required fields
      assert.strictEqual(parsed.id, "https://example.com/post/1");
      assert.strictEqual(parsed.url, "https://example.com/post/1");
      assert.strictEqual(parsed.date_published, "2025-11-04T10:00:00Z");
      assert.strictEqual(parsed.content_text, "Hello world!");
      assert.strictEqual(parsed.content_html, "<p>Hello world!</p>");
      assert.strictEqual(parsed.title, "Test Post");
      
      // Should include item author
      assert.ok(parsed.author);
      assert.strictEqual(parsed.author.name, "Item Author");
      
      // Should be canonical
      const keys = Object.keys(parsed);
      const sortedKeys = [...keys].sort();
      assert.deepStrictEqual(keys, sortedKeys);
    });

    test('handles minimal item signature data', () => {
      const minimalItem = {
        id: "https://example.com/post/1",
        url: "https://example.com/post/1",
        content_text: "Hello!",
        date_published: "2025-11-04T10:00:00Z"
      };
      
      const signatureData = CanonicalJSONSerializer.createSignatureData(minimalItem, 'item');
      const parsed = JSON.parse(signatureData);
      
      assert.strictEqual(parsed.id, "https://example.com/post/1");
      assert.strictEqual(parsed.content_text, "Hello!");
      assert.strictEqual(parsed.date_published, "2025-11-04T10:00:00Z");
      
      // Should not include optional fields that weren't present
      assert.strictEqual(parsed.title, undefined);
      assert.strictEqual(parsed.author, undefined);
    });
  });

  describe('Canonical Equivalence', () => {
    test('detects equivalent JSON representations', () => {
      const json1 = '{"b": 2, "a": 1}';
      const json2 = '{"a": 1, "b": 2}';
      
      const areEquivalent = CanonicalJSONSerializer.areCanonicallyEquivalent(json1, json2);
      assert.strictEqual(areEquivalent, true);
    });

    test('detects non-equivalent JSON', () => {
      const json1 = '{"a": 1, "b": 2}';
      const json2 = '{"a": 1, "b": 3}';
      
      const areEquivalent = CanonicalJSONSerializer.areCanonicallyEquivalent(json1, json2);
      assert.strictEqual(areEquivalent, false);
    });

    test('handles whitespace differences', () => {
      const json1 = '{\n  "b": 2,\n  "a": 1\n}';
      const json2 = '{"a":1,"b":2}';
      
      const areEquivalent = CanonicalJSONSerializer.areCanonicallyEquivalent(json1, json2);
      assert.strictEqual(areEquivalent, true);
    });

    test('handles invalid JSON gracefully', () => {
      const json1 = '{"valid": true}';
      const json2 = '{"invalid": }';
      
      const areEquivalent = CanonicalJSONSerializer.areCanonicallyEquivalent(json1, json2);
      assert.strictEqual(areEquivalent, false);
    });
  });

  describe('Consistency Verification', () => {
    test('verifies consistent canonicalization', () => {
      const json = '{"z": 3, "a": 1, "m": 2}';
      const result = CanonicalJSONSerializer.verifyCanonicalConsistency(json);
      
      assert.strictEqual(result.consistent, true);
      assert.strictEqual(result.canonical_form, '{"a":1,"m":2,"z":3}');
      assert.ok(result.canonical_length > 0);
    });

    test('handles malformed JSON in consistency check', () => {
      const malformedJson = '{"invalid": }';
      const result = CanonicalJSONSerializer.verifyCanonicalConsistency(malformedJson);
      
      assert.strictEqual(result.consistent, false);
      assert.ok(result.error);
      assert.strictEqual(result.canonical_form, null);
    });

    test('detects inconsistencies', () => {
      // This test ensures our canonicalization is deterministic
      const obj = { z: 1, a: 2 };
      const canonical1 = CanonicalJSONSerializer.serialize(obj);
      const canonical2 = CanonicalJSONSerializer.serialize(obj);
      
      assert.strictEqual(canonical1, canonical2);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty objects and arrays', () => {
      assert.strictEqual(CanonicalJSONSerializer.serialize({}), '{}');
      assert.strictEqual(CanonicalJSONSerializer.serialize([]), '[]');
    });

    test('handles Unicode strings', () => {
      const unicode = 'Hello 世界 🌍';
      const result = CanonicalJSONSerializer.serialize(unicode);
      assert.strictEqual(result, '"Hello 世界 🌍"');
    });

    test('handles control characters', () => {
      const controlChars = 'line1\nline2\ttab\rcarriage\bbackspace\fformfeed';
      const result = CanonicalJSONSerializer.serialize(controlChars);
      assert.strictEqual(result, '"line1\\nline2\\ttab\\rcarriage\\bbackspace\\fformfeed"');
    });

    test('handles large numbers', () => {
      const largeInt = 9007199254740991; // Number.MAX_SAFE_INTEGER
      const result = CanonicalJSONSerializer.serialize(largeInt);
      assert.strictEqual(result, '9007199254740991');
    });

    test('throws on non-finite numbers', () => {
      assert.throws(() => {
        CanonicalJSONSerializer.serialize(Infinity);
      });
      
      assert.throws(() => {
        CanonicalJSONSerializer.serialize(NaN);
      });
    });
  });

  describe('RFC 8785 Compliance', () => {
    test('sorts object keys lexicographically', () => {
      const obj = {
        'Z': 1,
        'a': 2,
        'A': 3,
        'z': 4,
        '1': 5,
        '10': 6,
        '2': 7
      };
      
      const result = CanonicalJSONSerializer.serialize(obj);
      // Keys should be sorted by Unicode code point
      assert.strictEqual(result, '{"1":5,"10":6,"2":7,"A":3,"Z":1,"a":2,"z":4}');
    });

    test('removes insignificant whitespace', () => {
      const obj = { a: 1, b: [2, 3] };
      const result = CanonicalJSONSerializer.serialize(obj);
      
      // Should have no spaces around separators
      assert.strictEqual(result, '{"a":1,"b":[2,3]}');
      assert.ok(!result.includes(' '));
    });

    test('uses minimal string escaping', () => {
      const str = 'normal text with "quotes" and \\ backslash';
      const result = CanonicalJSONSerializer.serialize(str);
      
      // Should only escape necessary characters
      assert.strictEqual(result, '"normal text with \\"quotes\\" and \\\\ backslash"');
    });
  });
});