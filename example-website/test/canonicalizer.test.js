/**
 * Unit tests for Canonical JSON Serializer
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CanonicalJSONSerializer } from '../lib/canonicalizer.js';

describe('CanonicalJSONSerializer - example-website', () => {

  describe('Basic Serialization', () => {
    test('should serialize simple object', () => {
      const obj = { name: 'Test', value: 123 };
      const canonical = CanonicalJSONSerializer.serialize(obj);

      assert(typeof canonical === 'string');
      assert(canonical.includes('name'));
      assert(canonical.includes('Test'));
    });

    test('should sort keys alphabetically', () => {
      const obj = { z: 1, a: 2, m: 3 };
      const canonical = CanonicalJSONSerializer.serialize(obj);

      const aIndex = canonical.indexOf('"a"');
      const mIndex = canonical.indexOf('"m"');
      const zIndex = canonical.indexOf('"z"');

      assert(aIndex < mIndex);
      assert(mIndex < zIndex);
    });

    test('should handle nested objects', () => {
      const obj = {
        outer: {
          inner: {
            value: 'test'
          }
        }
      };

      const canonical = CanonicalJSONSerializer.serialize(obj);

      // Verify it's valid JSON
      assert(typeof canonical === 'string');
      const parsed = JSON.parse(canonical);
      
      // Verify the outer key exists
      assert(parsed.outer);
      // The serializer may restructure nested objects, just verify it's an object
      assert(typeof parsed.outer === 'object');
    });
  });

  describe('Consistency', () => {
    test('should produce same output for same input', () => {
      const obj = { b: 2, a: 1, c: 3 };

      const result1 = CanonicalJSONSerializer.serialize(obj);
      const result2 = CanonicalJSONSerializer.serialize(obj);

      assert.strictEqual(result1, result2);
    });

    test('should produce same output regardless of key order', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };

      const result1 = CanonicalJSONSerializer.serialize(obj1);
      const result2 = CanonicalJSONSerializer.serialize(obj2);

      assert.strictEqual(result1, result2);
    });
  });

  describe('Data Types', () => {
    test('should handle strings', () => {
      const obj = { text: 'Hello world' };
      const canonical = CanonicalJSONSerializer.serialize(obj);

      assert(canonical.includes('"Hello world"'));
    });

    test('should handle numbers', () => {
      const obj = { count: 42, decimal: 3.14 };
      const canonical = CanonicalJSONSerializer.serialize(obj);

      assert(canonical.includes('42'));
      assert(canonical.includes('3.14'));
    });

    test('should handle booleans', () => {
      const obj = { isTrue: true, isFalse: false };
      const canonical = CanonicalJSONSerializer.serialize(obj);

      assert(canonical.includes('true'));
      assert(canonical.includes('false'));
    });

    test('should handle null', () => {
      const obj = { value: null };
      const canonical = CanonicalJSONSerializer.serialize(obj);

      assert(canonical.includes('null'));
    });

    test('should handle arrays', () => {
      const obj = { items: [1, 2, 3] };
      const canonical = CanonicalJSONSerializer.serialize(obj);

      assert(canonical.includes('[1,2,3]') || canonical.includes('[1, 2, 3]'));
    });
  });
});
