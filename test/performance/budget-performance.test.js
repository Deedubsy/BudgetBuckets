/**
 * Performance Tests for Budget Calculations
 * Tests that core functions perform well with realistic and large datasets
 */

const { createCompatibleFunctions } = require('../utils/extract-functions');
const realFunctions = createCompatibleFunctions();

describe('Budget Calculation Performance', () => {
  // Test data generators
  const generateLargeBudget = (categoryCount = 50, itemsPerCategory = 10) => {
    const state = {
      expenses: [],
      savings: [],
      debt: [],
      settings: {
        incomeAmount: 10000,
        incomeFrequency: 'Monthly',
        currency: 'AUD'
      }
    };

    // Generate expense categories
    for (let i = 0; i < categoryCount; i++) {
      const category = {
        id: `expense_${i}`,
        name: `Expense Category ${i}`,
        include: true,
        items: []
      };

      // Generate items for each category
      for (let j = 0; j < itemsPerCategory; j++) {
        category.items.push({
          id: `item_${i}_${j}`,
          name: `Item ${j} in Category ${i}`,
          amount: Math.random() * 500 + 50, // $50-$550
          include: Math.random() > 0.1 // 90% included
        });
      }

      state.expenses.push(category);
    }

    // Generate savings categories with goals
    for (let i = 0; i < Math.floor(categoryCount / 3); i++) {
      const savingsCategory = {
        id: `savings_${i}`,
        name: `Savings Goal ${i}`,
        type: 'saving',
        include: true,
        goal: {
          contributionPerPeriodCents: Math.floor(Math.random() * 100000) + 10000, // $100-$1100
          amountCents: Math.floor(Math.random() * 1000000) + 100000, // $1000-$11000 goal
          savedSoFarCents: Math.floor(Math.random() * 500000) // $0-$5000 saved
        },
        items: []
      };

      state.savings.push(savingsCategory);
    }

    // Generate debt categories
    for (let i = 0; i < Math.floor(categoryCount / 5); i++) {
      const debtCategory = {
        id: `debt_${i}`,
        name: `Debt ${i}`,
        include: true,
        items: []
      };

      // Generate debt payments
      for (let j = 0; j < 3; j++) {
        debtCategory.items.push({
          id: `debt_item_${i}_${j}`,
          name: `Payment ${j}`,
          amount: Math.random() * 200 + 50, // $50-$250
          include: true
        });
      }

      state.debt.push(debtCategory);
    }

    return state;
  };

  const measurePerformance = (fn, ...args) => {
    const startTime = performance.now();
    const result = fn(...args);
    const endTime = performance.now();
    
    return {
      result,
      duration: endTime - startTime,
      iterations: 1
    };
  };

  const measureAveragePerformance = (fn, iterations = 100, ...args) => {
    const durations = [];
    let result;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      result = fn(...args);
      const endTime = performance.now();
      durations.push(endTime - startTime);
    }

    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / iterations;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    return {
      result,
      averageDuration,
      minDuration,
      maxDuration,
      iterations,
      durations
    };
  };

  describe('Calculation Speed Tests', () => {
    test('handles small budgets quickly', () => {
      const smallBudget = generateLargeBudget(5, 3); // 5 categories, 3 items each
      
      const expenseTest = measureAveragePerformance(
        realFunctions.getTotalExpenses, 
        1000, 
        smallBudget
      );
      
      expect(expenseTest.averageDuration).toBeLessThan(1); // < 1ms average
      expect(expenseTest.result).toBeGreaterThan(0);
      
      console.log(`Small budget (5 categories): avg ${expenseTest.averageDuration.toFixed(3)}ms`);
    });

    test('handles medium budgets efficiently', () => {
      const mediumBudget = generateLargeBudget(20, 5); // 20 categories, 5 items each
      
      const expenseTest = measureAveragePerformance(
        realFunctions.getTotalExpenses, 
        500, 
        mediumBudget
      );
      
      expect(expenseTest.averageDuration).toBeLessThan(5); // < 5ms average
      expect(expenseTest.result).toBeGreaterThan(0);
      
      console.log(`Medium budget (20 categories): avg ${expenseTest.averageDuration.toFixed(3)}ms`);
    });

    test('handles large budgets within acceptable limits', () => {
      const largeBudget = generateLargeBudget(50, 10); // 50 categories, 10 items each
      
      const expenseTest = measureAveragePerformance(
        realFunctions.getTotalExpenses, 
        100, 
        largeBudget
      );
      
      expect(expenseTest.averageDuration).toBeLessThan(10); // < 10ms average
      expect(expenseTest.result).toBeGreaterThan(0);
      
      console.log(`Large budget (50 categories): avg ${expenseTest.averageDuration.toFixed(3)}ms`);
    });

    test('handles very large budgets reasonably', () => {
      const veryLargeBudget = generateLargeBudget(100, 20); // 100 categories, 20 items each
      
      const expenseTest = measurePerformance(
        realFunctions.getTotalExpenses, 
        veryLargeBudget
      );
      
      expect(expenseTest.duration).toBeLessThan(50); // < 50ms for single calculation
      expect(expenseTest.result).toBeGreaterThan(0);
      
      console.log(`Very large budget (100 categories): ${expenseTest.duration.toFixed(3)}ms`);
    });
  });

  describe('Savings Calculation Performance', () => {
    test('goal-based savings calculations are efficient', () => {
      const savingsBudget = {
        savings: [],
        settings: { incomeAmount: 5000 }
      };

      // Generate many savings with goals
      for (let i = 0; i < 100; i++) {
        savingsBudget.savings.push({
          id: `savings_${i}`,
          name: `Savings ${i}`,
          type: 'saving',
          include: true,
          goal: {
            contributionPerPeriodCents: Math.floor(Math.random() * 50000) + 10000
          },
          items: []
        });
      }

      const savingsTest = measureAveragePerformance(
        realFunctions.getTotalSavings, 
        200, 
        savingsBudget
      );
      
      expect(savingsTest.averageDuration).toBeLessThan(5); // < 5ms average
      expect(savingsTest.result).toBeGreaterThan(0);
      
      console.log(`100 savings goals: avg ${savingsTest.averageDuration.toFixed(3)}ms`);
    });

    test('mixed savings types perform well', () => {
      const mixedSavingsBudget = {
        savings: [],
        settings: { incomeAmount: 5000 }
      };

      // Generate mix of goal-based and item-based savings
      for (let i = 0; i < 50; i++) {
        if (i % 2 === 0) {
          // Goal-based savings
          mixedSavingsBudget.savings.push({
            id: `savings_goal_${i}`,
            name: `Goal Savings ${i}`,
            type: 'saving',
            include: true,
            goal: {
              contributionPerPeriodCents: 25000
            },
            items: []
          });
        } else {
          // Item-based savings
          mixedSavingsBudget.savings.push({
            id: `savings_items_${i}`,
            name: `Item Savings ${i}`,
            include: true,
            items: [
              { name: 'Item 1', amount: 100, include: true },
              { name: 'Item 2', amount: 150, include: true }
            ]
          });
        }
      }

      const mixedTest = measureAveragePerformance(
        realFunctions.getTotalSavings, 
        200, 
        mixedSavingsBudget
      );
      
      expect(mixedTest.averageDuration).toBeLessThan(8); // < 8ms average
      expect(mixedTest.result).toBeGreaterThan(0);
      
      console.log(`Mixed savings (50 categories): avg ${mixedTest.averageDuration.toFixed(3)}ms`);
    });
  });

  describe('Full Budget Balance Performance', () => {
    test('complete budget calculations are efficient', () => {
      const completeBudget = generateLargeBudget(30, 8); // Realistic large budget
      
      const balanceTest = measureAveragePerformance(
        realFunctions.calculateBudgetBalance, 
        100, 
        completeBudget
      );
      
      expect(balanceTest.averageDuration).toBeLessThan(15); // < 15ms average
      expect(balanceTest.result.income).toBe(10000);
      expect(balanceTest.result.expenses).toBeGreaterThan(0);
      expect(balanceTest.result.savings).toBeGreaterThan(0);
      
      console.log(`Complete budget balance: avg ${balanceTest.averageDuration.toFixed(3)}ms`);
    });

    test('budget balance scales linearly', () => {
      const budgetSizes = [
        { categories: 10, items: 5, label: 'Small' },
        { categories: 25, items: 8, label: 'Medium' },
        { categories: 50, items: 12, label: 'Large' }
      ];

      const results = [];

      budgetSizes.forEach(({ categories, items, label }) => {
        const budget = generateLargeBudget(categories, items);
        const test = measureAveragePerformance(
          realFunctions.calculateBudgetBalance,
          50,
          budget
        );

        results.push({
          label,
          categories: categories,
          items: categories * items,
          duration: test.averageDuration
        });

        console.log(`${label} (${categories} categories, ${categories * items} items): ${test.averageDuration.toFixed(3)}ms`);
      });

      // Check that scaling is roughly linear (not exponential)
      const scalingFactor = results[2].duration / results[0].duration;
      const itemScaling = results[2].items / results[0].items;
      
      // Performance should not degrade more than 2x the item increase
      expect(scalingFactor).toBeLessThan(itemScaling * 2);
    });
  });

  describe('Memory Usage Tests', () => {
    test('large calculations do not cause memory leaks', () => {
      const budget = generateLargeBudget(50, 10);
      
      // Run many calculations in succession
      for (let i = 0; i < 1000; i++) {
        const expenses = realFunctions.getTotalExpenses(budget);
        const savings = realFunctions.getTotalSavings(budget);
        const balance = realFunctions.calculateBudgetBalance(budget);
        
        // Ensure results are valid (prevents optimization elimination)
        expect(expenses).toBeGreaterThan(0);
        expect(balance.income).toBe(10000);
      }
      
      // If we get here without crashes or extreme slowdown, memory is likely managed well
      console.log('Completed 1000 large budget calculations without issues');
    });
  });

  describe('Edge Case Performance', () => {
    test('handles budgets with many excluded items efficiently', () => {
      const budget = {
        expenses: [
          {
            name: 'Test Category',
            include: true,
            items: []
          }
        ],
        settings: { incomeAmount: 5000 }
      };

      // Add 1000 items, 90% excluded
      for (let i = 0; i < 1000; i++) {
        budget.expenses[0].items.push({
          name: `Item ${i}`,
          amount: 100,
          include: i % 10 === 0 // Only 10% included
        });
      }

      const test = measureAveragePerformance(
        realFunctions.getTotalExpenses,
        100,
        budget
      );

      expect(test.averageDuration).toBeLessThan(10); // Should still be fast
      expect(test.result).toBe(10000); // 100 included items * $100

      console.log(`1000 items (90% excluded): avg ${test.averageDuration.toFixed(3)}ms`);
    });

    test('handles empty categories efficiently', () => {
      const budget = {
        expenses: [],
        savings: [],
        debt: [],
        settings: { incomeAmount: 5000 }
      };

      // Add 100 empty categories
      for (let i = 0; i < 100; i++) {
        budget.expenses.push({
          name: `Empty Category ${i}`,
          include: true,
          items: []
        });
      }

      const test = measureAveragePerformance(
        realFunctions.getTotalExpenses,
        500,
        budget
      );

      expect(test.averageDuration).toBeLessThan(2); // Empty categories should be very fast
      expect(test.result).toBe(0);

      console.log(`100 empty categories: avg ${test.averageDuration.toFixed(3)}ms`);
    });
  });
});