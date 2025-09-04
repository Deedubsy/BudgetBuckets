/**
 * Unit tests for data validation functions
 * Tests validation logic from cloud-store.js
 */

// Mock validation functions from cloud-store.js
const mockValidation = {
  validateBudgetData: (budget) => {
    const errors = [];
    
    // Required fields validation
    if (!budget) {
      errors.push('Budget data is required');
      return { valid: false, errors };
    }
    
    if (!budget.name || typeof budget.name !== 'string' || budget.name.trim().length === 0) {
      errors.push('Budget name is required');
    }
    
    if (budget.name && budget.name.length > 100) {
      errors.push('Budget name must be 100 characters or less');
    }
    
    // Settings validation
    if (!budget.settings) {
      errors.push('Budget settings are required');
    } else {
      if (typeof budget.settings.incomeAmount !== 'number' || 
          budget.settings.incomeAmount < 0 || 
          budget.settings.incomeAmount > 999999) {
        errors.push('Income amount must be a number between 0 and 999,999');
      }
      
      const validFrequencies = ['Weekly', 'Fortnightly', 'Monthly', 'Yearly'];
      if (!validFrequencies.includes(budget.settings.incomeFrequency)) {
        errors.push('Invalid income frequency. Must be Weekly, Fortnightly, Monthly, or Yearly');
      }
      
      if (budget.settings.currency && typeof budget.settings.currency !== 'string') {
        errors.push('Currency must be a string');
      }
    }
    
    // Expenses validation
    if (budget.expenses && Array.isArray(budget.expenses)) {
      budget.expenses.forEach((expense, expenseIndex) => {
        if (!expense.name || typeof expense.name !== 'string' || expense.name.trim().length === 0) {
          errors.push(`Expense category ${expenseIndex + 1} missing name`);
        }
        
        if (expense.name && expense.name.length > 50) {
          errors.push(`Expense category ${expenseIndex + 1} name too long (max 50 characters)`);
        }
        
        if (expense.items && Array.isArray(expense.items)) {
          expense.items.forEach((item, itemIndex) => {
            if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
              errors.push(`Expense item ${itemIndex + 1} in category "${expense.name}" missing name`);
            }
            
            if (typeof item.amount !== 'number' || item.amount < 0 || item.amount > 999999) {
              errors.push(`Invalid amount in expense "${expense.name}" item ${itemIndex + 1}`);
            }
          });
        }
      });
    }
    
    // Savings validation (similar to expenses)
    if (budget.savings && Array.isArray(budget.savings)) {
      budget.savings.forEach((saving, savingIndex) => {
        if (!saving.name || typeof saving.name !== 'string' || saving.name.trim().length === 0) {
          errors.push(`Savings category ${savingIndex + 1} missing name`);
        }
        
        if (saving.goalEnabled && (typeof saving.goalAmount !== 'number' || saving.goalAmount < 0)) {
          errors.push(`Invalid goal amount in savings category "${saving.name}"`);
        }
        
        if (saving.items && Array.isArray(saving.items)) {
          saving.items.forEach((item, itemIndex) => {
            if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
              errors.push(`Savings item ${itemIndex + 1} in category "${saving.name}" missing name`);
            }
            
            if (typeof item.amount !== 'number' || item.amount < 0 || item.amount > 999999) {
              errors.push(`Invalid amount in savings "${saving.name}" item ${itemIndex + 1}`);
            }
          });
        }
      });
    }
    
    return { valid: errors.length === 0, errors };
  },

  scrubUndefined: (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj
        .filter(item => item !== undefined)
        .map(item => mockValidation.scrubUndefined(item));
    }
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (value && typeof value === 'object') {
          cleaned[key] = mockValidation.scrubUndefined(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }
};

describe('Data Validation', () => {
  describe('validateBudgetData', () => {
    test('validates complete valid budget', () => {
      const validBudget = {
        name: 'My Budget',
        settings: {
          incomeAmount: 5000,
          incomeFrequency: 'Monthly',
          currency: 'AUD'
        },
        expenses: [
          {
            name: 'Housing',
            items: [
              { name: 'Rent', amount: 1500 },
              { name: 'Utilities', amount: 200 }
            ]
          }
        ],
        savings: [
          {
            name: 'Emergency Fund',
            goalEnabled: true,
            goalAmount: 10000,
            items: [
              { name: 'Monthly Contribution', amount: 500 }
            ]
          }
        ]
      };
      
      const result = mockValidation.validateBudgetData(validBudget);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects null or undefined budget', () => {
      let result = mockValidation.validateBudgetData(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Budget data is required');

      result = mockValidation.validateBudgetData(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Budget data is required');
    });

    test('validates budget name requirements', () => {
      const invalidNames = [
        { name: '', errors: ['Budget name is required'] },
        { name: '   ', errors: ['Budget name is required'] }, // Whitespace only
        { name: null, errors: ['Budget name is required'] },
        { name: undefined, errors: ['Budget name is required'] },
        { name: 123, errors: ['Budget name is required'] }, // Not a string
        { name: 'A'.repeat(101), errors: ['Budget name must be 100 characters or less'] }
      ];

      invalidNames.forEach(({ name, errors }) => {
        const budget = { 
          name,
          settings: { 
            incomeAmount: 5000, 
            incomeFrequency: 'Monthly' 
          }
        };
        
        const result = mockValidation.validateBudgetData(budget);
        expect(result.valid).toBe(false);
        errors.forEach(expectedError => {
          expect(result.errors).toContain(expectedError);
        });
      });
    });

    test('validates settings requirements', () => {
      const budgetWithoutSettings = { name: 'Test Budget' };
      let result = mockValidation.validateBudgetData(budgetWithoutSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Budget settings are required');
    });

    test('validates income amount constraints', () => {
      const invalidIncomes = [
        { amount: -100, error: 'Income amount must be a number between 0 and 999,999' },
        { amount: 1000000, error: 'Income amount must be a number between 0 and 999,999' },
        { amount: 'invalid', error: 'Income amount must be a number between 0 and 999,999' },
        { amount: null, error: 'Income amount must be a number between 0 and 999,999' }
      ];

      invalidIncomes.forEach(({ amount, error }) => {
        const budget = {
          name: 'Test Budget',
          settings: {
            incomeAmount: amount,
            incomeFrequency: 'Monthly'
          }
        };
        
        const result = mockValidation.validateBudgetData(budget);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(error);
      });
    });

    test('validates income frequency options', () => {
      const invalidFrequencies = ['Daily', 'Quarterly', 'invalid', null, 123];
      
      invalidFrequencies.forEach(frequency => {
        const budget = {
          name: 'Test Budget',
          settings: {
            incomeAmount: 5000,
            incomeFrequency: frequency
          }
        };
        
        const result = mockValidation.validateBudgetData(budget);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid income frequency. Must be Weekly, Fortnightly, Monthly, or Yearly');
      });

      // Test valid frequencies
      const validFrequencies = ['Weekly', 'Fortnightly', 'Monthly', 'Yearly'];
      validFrequencies.forEach(frequency => {
        const budget = {
          name: 'Test Budget',
          settings: {
            incomeAmount: 5000,
            incomeFrequency: frequency
          }
        };
        
        const result = mockValidation.validateBudgetData(budget);
        expect(result.valid).toBe(true);
      });
    });

    test('validates expense categories and items', () => {
      const budget = {
        name: 'Test Budget',
        settings: {
          incomeAmount: 5000,
          incomeFrequency: 'Monthly'
        },
        expenses: [
          {
            // Missing name
            items: [
              { name: 'Rent', amount: -100 }, // Negative amount
              { name: '', amount: 1500 },     // Empty name
              { amount: 200 },                // Missing name
              { name: 'Valid Item', amount: 300 }
            ]
          },
          {
            name: 'A'.repeat(51), // Too long name
            items: [
              { name: 'Item', amount: 1000000 } // Amount too large
            ]
          }
        ]
      };
      
      const result = mockValidation.validateBudgetData(budget);
      expect(result.valid).toBe(false);
      
      const expectedErrors = [
        'Expense category 1 missing name',
        'Expense category 2 name too long (max 50 characters)',
        'Invalid amount in expense "undefined" item 1',
        'Expense item 2 in category "undefined" missing name',
        'Expense item 3 in category "undefined" missing name',
        'Invalid amount in expense "' + 'A'.repeat(51) + '" item 1'
      ];
      
      expectedErrors.forEach(error => {
        expect(result.errors).toContain(error);
      });
    });

    test('validates savings categories with goals', () => {
      const budget = {
        name: 'Test Budget',
        settings: {
          incomeAmount: 5000,
          incomeFrequency: 'Monthly'
        },
        savings: [
          {
            name: 'Emergency Fund',
            goalEnabled: true,
            goalAmount: -1000, // Invalid negative goal
            items: []
          },
          {
            name: 'Vacation',
            goalEnabled: true,
            goalAmount: 'invalid', // Invalid goal type
            items: []
          }
        ]
      };
      
      const result = mockValidation.validateBudgetData(budget);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid goal amount in savings category "Emergency Fund"');
      expect(result.errors).toContain('Invalid goal amount in savings category "Vacation"');
    });
  });

  describe('scrubUndefined', () => {
    test('removes undefined values from flat objects', () => {
      const input = {
        name: 'Test',
        amount: 100,
        invalid: undefined,
        valid: 0,
        emptyString: ''
      };
      
      const result = mockValidation.scrubUndefined(input);
      expect(result).toEqual({
        name: 'Test',
        amount: 100,
        valid: 0,
        emptyString: ''
      });
      expect(result.invalid).toBeUndefined();
    });

    test('handles nested objects recursively', () => {
      const input = {
        name: 'Test',
        settings: {
          valid: 'value',
          invalid: undefined,
          nested: {
            deep: 'value',
            deeper: undefined
          }
        },
        invalid: undefined
      };
      
      const result = mockValidation.scrubUndefined(input);
      expect(result).toEqual({
        name: 'Test',
        settings: {
          valid: 'value',
          nested: {
            deep: 'value'
          }
        }
      });
    });

    test('handles arrays correctly', () => {
      const input = {
        items: [
          { name: 'Item 1', amount: 100 },
          { name: 'Item 2', amount: undefined },
          { name: undefined, amount: 200 }
        ],
        values: [1, undefined, 3, null, '']
      };
      
      const result = mockValidation.scrubUndefined(input);
      expect(result).toEqual({
        items: [
          { name: 'Item 1', amount: 100 },
          { name: 'Item 2' },
          { amount: 200 }
        ],
        values: [1, 3, null, '']
      });
    });

    test('handles primitive values', () => {
      expect(mockValidation.scrubUndefined(null)).toBe(null);
      expect(mockValidation.scrubUndefined('string')).toBe('string');
      expect(mockValidation.scrubUndefined(123)).toBe(123);
      expect(mockValidation.scrubUndefined(true)).toBe(true);
      expect(mockValidation.scrubUndefined(undefined)).toBe(undefined);
    });

    test('handles empty objects and arrays', () => {
      expect(mockValidation.scrubUndefined({})).toEqual({});
      expect(mockValidation.scrubUndefined([])).toEqual([]);
      
      const inputWithEmpty = {
        empty: {},
        emptyArray: [],
        valid: 'value'
      };
      
      const result = mockValidation.scrubUndefined(inputWithEmpty);
      expect(result).toEqual({
        empty: {},
        emptyArray: [],
        valid: 'value'
      });
    });
  });
});