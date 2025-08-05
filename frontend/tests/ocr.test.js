// ================================
// TESTING FRAMEWORK
// ================================

// tests/ocr.test.js
import { ocrHelpers } from '../utils/ocrHelpers';

describe('OCR Helpers', () => {
  describe('standardizeParameter', () => {
    test('should standardize oil production parameters', () => {
      expect(ocrHelpers.standardizeParameter('oil prod')).toBe('Oil Production');
      expect(ocrHelpers.standardizeParameter('crude oil')).toBe('Oil Production');
      expect(ocrHelpers.standardizeParameter('OIL PRODUCTION')).toBe('Oil Production');
    });

    test('should standardize gas production parameters', () => {
      expect(ocrHelpers.standardizeParameter('gas prod')).toBe('Gas Production');
      expect(ocrHelpers.standardizeParameter('natural gas')).toBe('Gas Production');
    });

    test('should handle unknown parameters', () => {
      expect(ocrHelpers.standardizeParameter('unknown param')).toBe('unknown param');
    });
  });

  describe('extractNumericValue', () => {
    test('should extract simple numbers', () => {
      const result = ocrHelpers.extractNumericValue('1234');
      expect(result.value).toBe(1234);
      expect(result.isValid).toBe(true);
    });

    test('should extract numbers with commas', () => {
      const result = ocrHelpers.extractNumericValue('1,234.56');
      expect(result.value).toBe(1234.56);
      expect(result.isValid).toBe(true);
    });

    test('should handle invalid numbers', () => {
      const result = ocrHelpers.extractNumericValue('not a number');
      expect(result.value).toBe(null);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateDataPoint', () => {
    test('should validate oil production values', () => {
      const result = ocrHelpers.validateDataPoint('Oil Production', 1500, 'BBL');
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should reject out-of-range values', () => {
      const result = ocrHelpers.validateDataPoint('Oil Production', 15000, 'BBL');
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should warn about non-standard units', () => {
      const result = ocrHelpers.validateDataPoint('Oil Production', 1500, 'GALLONS');
      expect(result.issues.some(issue => issue.includes('Unit'))).toBe(true);
    });
  });
});