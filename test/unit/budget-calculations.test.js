/**
 * Unit tests for budget calculation functions
 * Tests core business logic extracted from real app.js functions
 */

const { createCompatibleFunctions } = require('../utils/extract-functions');

// Get the real calculation functions
const realFunctions = createCompatibleFunctions();

// Create state-based wrappers that match the real app.js structure
const appModule = {
  calculateTotalExpenses: (budget) => {
    // Handle null/undefined budget
    if (!budget) return 0;
    
    // Convert budget format to state format for real functions
    const state = {
      expenses: budget.expenses || [],
      settings: budget.settings || {}
    };
    return realFunctions.getTotalExpenses(state);
  },

  calculateTotalSavings: (budget) => {
    if (!budget) return 0;
    
    const state = {
      savings: budget.savings || [],
      settings: budget.settings || {}
    };
    return realFunctions.getTotalSavings(state);
  },

  calculateBudgetBalance: (budget) => {
    // Handle null/undefined budget
    if (!budget) {
      return { income: 0, expenses: 0, savings: 0, debt: 0, surplus: 0, balanced: false };
    }
    
    const state = {
      expenses: budget.expenses || [],
      savings: budget.savings || [],
      debt: budget.debt || [],
      settings: budget.settings || {}
    };
    return realFunctions.calculateBudgetBalance(state);
  },

  // Direct access to the core function for more detailed testing
  sumIncludedItems: realFunctions.sumIncludedItems
};

describe('Budget Calculations', () => {
  describe('sumIncludedItems', () => {
    test('sums regular expense items correctly', () => {
      const bucket = {
        type: 'expense',
        items: [
          { name: 'Rent', amount: 1500, include: true },
          { name: 'Utilities', amount: 200, include: true },
          { name: 'Optional', amount: 100, include: false }
        ]
      };
      
      const total = appModule.sumIncludedItems(bucket);
      expect(total).toBe(1700); // Only included items
    });

    test('handles savings buckets with goals', () => {
      const savingsBucket = {
        type: 'saving',
        goal: {
          contributionPerPeriodCents: 50000 // $500.00 in cents
        },
        items: [] // Should be ignored for savings with goals
      };
      
      const total = appModule.sumIncludedItems(savingsBucket);
      expect(total).toBe(500); // $500 from goal contribution
    });

    test('falls back to items for savings buckets without goals', () => {
      const savingsBucket = {
        type: 'saving',
        // No goal property
        items: [
          { name: 'Emergency Fund', amount: 300, include: true },
          { name: 'Vacation', amount: 200, include: true }
        ]
      };
      
      const total = appModule.sumIncludedItems(savingsBucket);
      expect(total).toBe(500);
    });

    test('handles buckets without items array', () => {
      const emptyBucket = { type: 'expense' };
      expect(appModule.sumIncludedItems(emptyBucket)).toBe(0);
      
      const nullItemsBucket = { type: 'expense', items: null };
      expect(appModule.sumIncludedItems(nullItemsBucket)).toBe(0);
    });

    test('filters out invalid amounts', () => {
      const bucket = {
        type: 'expense',
        items: [
          { name: 'Valid', amount: 100, include: true },
          { name: 'Negative', amount: -50, include: true }, // Should be filtered
          { name: 'String', amount: 'invalid', include: true }, // Should be 0
          { name: 'Null', amount: null, include: true } // Should be 0
        ]
      };
      
      const total = appModule.sumIncludedItems(bucket);
      expect(total).toBe(100); // Only valid positive amount
    });
  });

  describe('calculateTotalExpenses', () => {
    test('calculates total expenses correctly for valid data', () => {
      const budget = {
        expenses: [
          {
            include: true,
            items: [
              { amount: 1500, include: true },
              { amount: 300, include: true },
              { amount: 100, include: false } // Should be excluded
            ]
          },
          {
            include: true,
            items: [
              { amount: 500, include: true }
            ]
          }
        ]
      };
      
      const total = appModule.calculateTotalExpenses(budget);
      expect(total).toBe(2300); // 1500 + 300 + 500
    });

    test('excludes categories with include: false', () => {
      const budget = {
        expenses: [
          {
            include: false, // Entire category excluded
            items: [
              { amount: 1000, include: true }
            ]
          },
          {
            include: true,
            items: [
              { amount: 500, include: true }
            ]
          }
        ]
      };
      
      const total = appModule.calculateTotalExpenses(budget);
      expect(total).toBe(500);
    });

    test('handles invalid amounts gracefully', () => {
      const budget = {
        expenses: [
          {
            include: true,
            items: [
              { amount: 'invalid', include: true }, // Invalid string
              { amount: null, include: true },      // Null value
              { amount: -100, include: true },      // Negative value
              { amount: 500, include: true }        // Valid value
            ]
          }
        ]
      };
      
      const total = appModule.calculateTotalExpenses(budget);
      expect(total).toBe(500);
    });

    test('returns 0 for empty budget', () => {
      expect(appModule.calculateTotalExpenses(null)).toBe(0);
      expect(appModule.calculateTotalExpenses({})).toBe(0);
      expect(appModule.calculateTotalExpenses({ expenses: [] })).toBe(0);
    });

    test('handles categories without items array', () => {
      const budget = {
        expenses: [
          { include: true }, // No items array
          {
            include: true,
            items: [
              { amount: 200, include: true }
            ]
          }
        ]
      };
      
      const total = appModule.calculateTotalExpenses(budget);
      expect(total).toBe(200);
    });
  });

  describe('calculateTotalSavings', () => {
    test('calculates total savings correctly', () => {
      const budget = {
        savings: [
          {
            include: true,
            items: [
              { amount: 1000, include: true },
              { amount: 200, include: true }
            ]
          },
          {
            include: true,
            items: [
              { amount: 300, include: true }
            ]
          }
        ]
      };
      
      const total = appModule.calculateTotalSavings(budget);
      expect(total).toBe(1500);
    });

    test('follows same validation rules as expenses', () => {
      const budget = {
        savings: [
          {
            include: true,
            items: [
              { amount: 'invalid', include: true },
              { amount: -50, include: true },
              { amount: 1000, include: true }
            ]
          }
        ]
      };
      
      const total = appModule.calculateTotalSavings(budget);
      expect(total).toBe(1000);
    });
  });

  describe('calculateBudgetBalance', () => {
    test('calculates budget surplus correctly with debt', () => {
      const budget = {
        settings: { incomeAmount: 5000 },
        expenses: [
          {
            include: true,
            items: [{ amount: 3000, include: true }]
          }
        ],
        savings: [
          {
            include: true,
            type: 'saving',
            goal: { contributionPerPeriodCents: 100000 }, // $1000
            items: []
          }
        ],
        debt: [
          {
            include: true,
            items: [{ amount: 300, include: true }]
          }
        ]
      };
      
      const result = appModule.calculateBudgetBalance(budget);
      expect(result.income).toBe(5000);
      expect(result.expenses).toBe(3000);
      expect(result.savings).toBe(1000);
      expect(result.debt).toBe(300);
      expect(result.surplus).toBe(700); // 5000 - 3000 - 1000 - 300
      expect(result.balanced).toBe(false);
    });

    test('identifies balanced budget', () => {
      const budget = {
        settings: { incomeAmount: 5000 },
        expenses: [
          {
            include: true,
            items: [{ amount: 3000, include: true }]
          }
        ],
        savings: [
          {
            include: true,
            items: [{ amount: 2000, include: true }]
          }
        ]
      };
      
      const result = appModule.calculateBudgetBalance(budget);
      expect(result.surplus).toBe(0);
      expect(result.balanced).toBe(true);
    });

    test('handles budget deficit', () => {
      const budget = {
        settings: { incomeAmount: 4000 },
        expenses: [
          {
            include: true,
            items: [{ amount: 3000, include: true }]
          }
        ],
        savings: [
          {
            include: true,
            items: [{ amount: 2000, include: true }]
          }
        ]
      };
      
      const result = appModule.calculateBudgetBalance(budget);
      expect(result.surplus).toBe(-1000);
      expect(result.balanced).toBe(false);
    });

    test('handles invalid budget gracefully', () => {
      expect(appModule.calculateBudgetBalance(null)).toEqual({
        income: 0,
        expenses: 0,
        savings: 0,
        debt: 0,
        surplus: 0,
        balanced: false
      });
      
      expect(appModule.calculateBudgetBalance({})).toEqual({
        income: 0,
        expenses: 0,
        savings: 0,
        debt: 0,
        surplus: 0,
        balanced: true // 0 surplus should be considered balanced
      });
    });

    test('considers amounts within 1 cent as balanced', () => {
      const budget = {
        settings: { incomeAmount: 5000.00 },
        expenses: [
          {
            include: true,
            items: [{ amount: 3000.005, include: true }] // Rounding might create tiny difference
          }
        ],
        savings: [
          {
            include: true,
            items: [{ amount: 1999.995, include: true }]
          }
        ]
      };
      
      const result = appModule.calculateBudgetBalance(budget);
      expect(Math.abs(result.surplus)).toBeLessThan(0.01);
      expect(result.balanced).toBe(true);
    });
  });
});