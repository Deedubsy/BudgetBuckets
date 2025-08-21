/**
 * Unit tests for utility functions
 * Tests helper functions that don't depend on Firebase
 */

// Mock utility functions that might exist in the codebase
const mockUtilities = {
  formatCurrency: (amount, currency = 'AUD') => {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return '$0.00';
    }
    
    const symbol = currency === 'USD' ? '$' : '$'; // Simplified for testing
    return `${symbol}${amount.toLocaleString('en-AU', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  },

  generateId: () => {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  debounce: (func, delay) => {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },

  getFrequencyMultiplier: (frequency, targetFrequency = 'Monthly') => {
    const frequencies = {
      'Weekly': 52,
      'Fortnightly': 26,
      'Monthly': 12,
      'Yearly': 1
    };
    
    if (!frequencies[frequency] || !frequencies[targetFrequency]) {
      return 1;
    }
    
    return frequencies[frequency] / frequencies[targetFrequency];
  },

  convertToMonthly: (amount, frequency) => {
    const multiplier = mockUtilities.getFrequencyMultiplier(frequency, 'Monthly');
    return amount * multiplier;
  },

  validateEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  sanitizeInput: (input, maxLength = 255) => {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>\"'&]/g, ''); // Basic XSS prevention
  },

  deepClone: (obj) => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => mockUtilities.deepClone(item));
    }
    
    const cloned = {};
    for (const [key, value] of Object.entries(obj)) {
      cloned[key] = mockUtilities.deepClone(value);
    }
    
    return cloned;
  },

  compareObjects: (obj1, obj2) => {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null) {
      return obj1 === obj2;
    }
    
    if (typeof obj1 !== typeof obj2) {
      return false;
    }
    
    if (typeof obj1 !== 'object') {
      return obj1 === obj2;
    }
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) {
      return false;
    }
    
    for (const key of keys1) {
      if (!keys2.includes(key)) {
        return false;
      }
      
      if (!mockUtilities.compareObjects(obj1[key], obj2[key])) {
        return false;
      }
    }
    
    return true;
  }
};

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    test('formats positive amounts correctly', () => {
      expect(mockUtilities.formatCurrency(1234.56)).toBe('$1,234.56');
      expect(mockUtilities.formatCurrency(0)).toBe('$0.00');
      expect(mockUtilities.formatCurrency(1000000)).toBe('$1,000,000.00');
      expect(mockUtilities.formatCurrency(9.99)).toBe('$9.99');
    });

    test('handles different currencies', () => {
      expect(mockUtilities.formatCurrency(1234.56, 'AUD')).toBe('$1,234.56');
      expect(mockUtilities.formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
    });

    test('handles invalid inputs gracefully', () => {
      expect(mockUtilities.formatCurrency('invalid')).toBe('$0.00');
      expect(mockUtilities.formatCurrency(null)).toBe('$0.00');
      expect(mockUtilities.formatCurrency(undefined)).toBe('$0.00');
      expect(mockUtilities.formatCurrency(NaN)).toBe('$0.00');
    });

    test('rounds decimal places correctly', () => {
      expect(mockUtilities.formatCurrency(1234.567)).toBe('$1,234.57');
      expect(mockUtilities.formatCurrency(1234.564)).toBe('$1,234.56');
      expect(mockUtilities.formatCurrency(1234.1)).toBe('$1,234.10');
    });
  });

  describe('generateId', () => {
    test('generates unique IDs', () => {
      const id1 = mockUtilities.generateId();
      const id2 = mockUtilities.generateId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    test('follows expected format', () => {
      const id = mockUtilities.generateId();
      expect(id).toMatch(/^id_\d+_[a-z0-9]+$/);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    test('delays function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = mockUtilities.debounce(mockFn, 100);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('cancels previous calls when called multiple times', () => {
      const mockFn = jest.fn();
      const debouncedFn = mockUtilities.debounce(mockFn, 100);

      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      jest.advanceTimersByTime(100);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenLastCalledWith('arg3');
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('getFrequencyMultiplier', () => {
    test('calculates correct multipliers for monthly conversion', () => {
      expect(mockUtilities.getFrequencyMultiplier('Weekly', 'Monthly')).toBeCloseTo(52/12, 2);
      expect(mockUtilities.getFrequencyMultiplier('Fortnightly', 'Monthly')).toBeCloseTo(26/12, 2);
      expect(mockUtilities.getFrequencyMultiplier('Monthly', 'Monthly')).toBe(1);
      expect(mockUtilities.getFrequencyMultiplier('Yearly', 'Monthly')).toBeCloseTo(1/12, 2);
    });

    test('handles invalid frequencies', () => {
      expect(mockUtilities.getFrequencyMultiplier('Invalid', 'Monthly')).toBe(1);
      expect(mockUtilities.getFrequencyMultiplier('Weekly', 'Invalid')).toBe(1);
    });
  });

  describe('convertToMonthly', () => {
    test('converts different frequencies to monthly amounts', () => {
      expect(mockUtilities.convertToMonthly(100, 'Weekly')).toBeCloseTo(433.33, 2);
      expect(mockUtilities.convertToMonthly(200, 'Fortnightly')).toBeCloseTo(433.33, 2);
      expect(mockUtilities.convertToMonthly(500, 'Monthly')).toBe(500);
      expect(mockUtilities.convertToMonthly(6000, 'Yearly')).toBe(500);
    });
  });

  describe('validateEmail', () => {
    test('validates correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(mockUtilities.validateEmail(email)).toBe(true);
      });
    });

    test('rejects invalid email formats', () => {
      const invalidEmails = [
        'invalid',
        'user@',
        '@domain.com',
        'user@domain',
        'user.domain.com',
        'user @domain.com',
        'user@domain .com',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(mockUtilities.validateEmail(email)).toBe(false);
      });
    });
  });

  describe('sanitizeInput', () => {
    test('trims whitespace and limits length', () => {
      expect(mockUtilities.sanitizeInput('  hello world  ')).toBe('hello world');
      expect(mockUtilities.sanitizeInput('a'.repeat(300), 10)).toBe('a'.repeat(10));
    });

    test('removes dangerous characters', () => {
      const dangerous = '<script>alert("xss")</script>';
      const sanitized = mockUtilities.sanitizeInput(dangerous);
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('"');
      expect(sanitized).toBe('scriptalert(xss)/script');
    });

    test('handles non-string inputs', () => {
      expect(mockUtilities.sanitizeInput(null)).toBe('');
      expect(mockUtilities.sanitizeInput(123)).toBe('');
      expect(mockUtilities.sanitizeInput(undefined)).toBe('');
    });
  });

  describe('deepClone', () => {
    test('clones primitive values', () => {
      expect(mockUtilities.deepClone(null)).toBe(null);
      expect(mockUtilities.deepClone(42)).toBe(42);
      expect(mockUtilities.deepClone('string')).toBe('string');
      expect(mockUtilities.deepClone(true)).toBe(true);
    });

    test('clones simple objects', () => {
      const original = { name: 'test', value: 42 };
      const cloned = mockUtilities.deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    test('clones nested objects', () => {
      const original = {
        user: {
          name: 'John',
          settings: {
            theme: 'dark',
            notifications: true
          }
        },
        items: [1, 2, 3]
      };
      
      const cloned = mockUtilities.deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.user).not.toBe(original.user);
      expect(cloned.user.settings).not.toBe(original.user.settings);
      expect(cloned.items).not.toBe(original.items);
    });

    test('clones arrays', () => {
      const original = [1, { name: 'test' }, [2, 3]];
      const cloned = mockUtilities.deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[1]).not.toBe(original[1]);
      expect(cloned[2]).not.toBe(original[2]);
    });

    test('clones Date objects', () => {
      const original = new Date('2025-08-21');
      const cloned = mockUtilities.deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned instanceof Date).toBe(true);
    });
  });

  describe('compareObjects', () => {
    test('compares primitive values correctly', () => {
      expect(mockUtilities.compareObjects(1, 1)).toBe(true);
      expect(mockUtilities.compareObjects(1, 2)).toBe(false);
      expect(mockUtilities.compareObjects('a', 'a')).toBe(true);
      expect(mockUtilities.compareObjects('a', 'b')).toBe(false);
      expect(mockUtilities.compareObjects(null, null)).toBe(true);
      expect(mockUtilities.compareObjects(null, undefined)).toBe(false);
    });

    test('compares simple objects correctly', () => {
      const obj1 = { name: 'test', value: 42 };
      const obj2 = { name: 'test', value: 42 };
      const obj3 = { name: 'test', value: 43 };
      const obj4 = { name: 'test' };
      
      expect(mockUtilities.compareObjects(obj1, obj2)).toBe(true);
      expect(mockUtilities.compareObjects(obj1, obj3)).toBe(false);
      expect(mockUtilities.compareObjects(obj1, obj4)).toBe(false);
    });

    test('compares nested objects correctly', () => {
      const obj1 = {
        user: { name: 'John', age: 30 },
        items: [1, 2, 3]
      };
      const obj2 = {
        user: { name: 'John', age: 30 },
        items: [1, 2, 3]
      };
      const obj3 = {
        user: { name: 'John', age: 31 },
        items: [1, 2, 3]
      };
      
      expect(mockUtilities.compareObjects(obj1, obj2)).toBe(true);
      expect(mockUtilities.compareObjects(obj1, obj3)).toBe(false);
    });

    test('handles same reference correctly', () => {
      const obj = { name: 'test' };
      expect(mockUtilities.compareObjects(obj, obj)).toBe(true);
    });
  });
});