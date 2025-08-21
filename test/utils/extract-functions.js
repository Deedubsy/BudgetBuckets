/**
 * Utility to extract and export functions from app.js for testing
 * This creates a testable interface without modifying the original code
 */

// We'll use dynamic imports and script evaluation to extract functions
// since app.js uses global state and DOM manipulation

const fs = require('fs');
const path = require('path');

// Read the app.js file
const appJsPath = path.join(__dirname, '../../app/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Create a mock environment for the functions
const createMockEnvironment = () => {
  const mockState = {
    expenses: [],
    savings: [],
    debt: [],
    settings: {
      incomeAmount: 5000,
      incomeFrequency: 'Monthly',
      currency: 'AUD'
    }
  };

  const mockDocument = {
    getElementById: () => ({ textContent: '' }),
    querySelector: () => ({ textContent: '' }),
    createElement: () => ({
      className: '',
      innerHTML: '',
      appendChild: () => {},
      querySelector: () => ({ textContent: '' })
    })
  };

  return { mockState, mockDocument };
};

// Extract the specific functions we want to test
const extractFunctions = () => {
  const { mockState, mockDocument } = createMockEnvironment();
  
  // Create a sandboxed environment to evaluate the functions
  const sandbox = {
    // Provide minimal globals that app.js needs
    document: mockDocument,
    window: {},
    console: { warn: () => {}, error: () => {} },
    state: mockState,
    
    // Storage for extracted functions
    extractedFunctions: {}
  };

  // Extract individual functions using regex and eval
  // This is safer than eval'ing the entire file
  
  const functionPatterns = [
    /function sumIncludedItems\(bucket\) \{[\s\S]*?\n    \}/,
    /function getTotalExpenses\(\) \{[\s\S]*?\n    \}/,
    /function getTotalSavings\(\) \{[\s\S]*?\n    \}/,
    /function getTotalDebt\(\) \{[\s\S]*?\n    \}/
  ];

  functionPatterns.forEach(pattern => {
    const match = appJsContent.match(pattern);
    if (match) {
      try {
        // Create a wrapper that captures the function
        const functionCode = match[0];
        const wrappedCode = `
          (function() {
            const state = arguments[0];
            ${functionCode}
            
            // Return the function based on its name
            if (typeof sumIncludedItems !== 'undefined') return sumIncludedItems;
            if (typeof getTotalExpenses !== 'undefined') return getTotalExpenses;
            if (typeof getTotalSavings !== 'undefined') return getTotalSavings;
            if (typeof getTotalDebt !== 'undefined') return getTotalDebt;
          })
        `;
        
        const func = eval(wrappedCode);
        const extractedFunc = func(mockState);
        
        // Store the function with its name
        if (functionCode.includes('sumIncludedItems')) {
          sandbox.extractedFunctions.sumIncludedItems = extractedFunc;
        } else if (functionCode.includes('getTotalExpenses')) {
          sandbox.extractedFunctions.getTotalExpenses = extractedFunc;
        } else if (functionCode.includes('getTotalSavings')) {
          sandbox.extractedFunctions.getTotalSavings = extractedFunc;
        } else if (functionCode.includes('getTotalDebt')) {
          sandbox.extractedFunctions.getTotalDebt = extractedFunc;
        }
        
      } catch (error) {
        console.warn(`Failed to extract function from pattern: ${error.message}`);
      }
    }
  });

  return sandbox.extractedFunctions;
};

// Simpler approach - create compatible implementations based on the observed code
const createCompatibleFunctions = () => {
  const sumIncludedItems = (bucket) => {
    // For savings buckets, use the contribution amount instead of items
    if (bucket.type === 'saving' && bucket.goal) {
      return bucket.goal.contributionPerPeriodCents / 100 || 0;
    }
    
    // For other bucket types, sum the items
    if (!bucket.items || !Array.isArray(bucket.items)) {
      return 0;
    }
    
    return bucket.items
      .filter(item => item.include !== false)
      .reduce((sum, item) => {
        const amount = parseFloat(item.amount) || 0;
        return sum + (amount >= 0 ? amount : 0);
      }, 0);
  };

  const getTotalExpenses = (state) => {
    return state.expenses
      .filter(bucket => bucket.include)
      .reduce((sum, bucket) => sum + sumIncludedItems(bucket), 0);
  };

  const getTotalSavings = (state) => {
    return state.savings
      .filter(bucket => bucket.include && bucket.type !== 'debt')
      .reduce((sum, bucket) => {
        // For savings buckets, use contribution amount instead of items
        if (bucket.type === 'saving' && bucket.goal) {
          return sum + (bucket.goal.contributionPerPeriodCents / 100);
        }
        return sum + sumIncludedItems(bucket);
      }, 0);
  };

  const getTotalDebt = (state) => {
    return (state.debt || [])
      .filter(bucket => bucket.include)
      .reduce((sum, bucket) => sum + sumIncludedItems(bucket), 0);
  };

  const calculateBudgetBalance = (state) => {
    if (!state || !state.settings) {
      return { income: 0, expenses: 0, savings: 0, debt: 0, surplus: 0, balanced: false };
    }

    const income = parseFloat(state.settings.incomeAmount) || 0;
    const expenses = getTotalExpenses(state);
    const savings = getTotalSavings(state);
    const debt = getTotalDebt(state);
    const surplus = income - expenses - savings - debt;

    return {
      income,
      expenses,
      savings,
      debt,
      surplus,
      balanced: Math.abs(surplus) < 0.01
    };
  };

  return {
    sumIncludedItems,
    getTotalExpenses,
    getTotalSavings,
    getTotalDebt,
    calculateBudgetBalance
  };
};

module.exports = {
  extractFunctions,
  createCompatibleFunctions,
  createMockEnvironment
};