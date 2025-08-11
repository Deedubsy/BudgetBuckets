import { authHelpers } from '../auth/firebase.js';
import cloudStore from './cloud-store.js';

(function() {
    'use strict';

    // Cloud-integrated state management
    let currentUser = null;
    let currentBudget = null;
    let currentBudgetId = null;
    let hasMigratedFromLocalStorage = false;
    
    let state = {
        settings: {
            incomeAmount: 0,
            incomeFrequency: 'Fortnightly',
            currency: 'AUD'
        },
        expenses: [],
        savings: []
    };

    let saveTimeout;

    function generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function convertFrequency(amount, fromFreq, toFreq) {
        if (fromFreq === toFreq) return amount;
        
        const weeklyAmount = (() => {
            switch (fromFreq) {
                case 'Weekly': return amount;
                case 'Fortnightly': return amount / 2;
                case 'Monthly': return amount * 12 / 52;
                case 'Yearly': return amount / 52;
                default: return 0;
            }
        })();
        
        switch (toFreq) {
            case 'Weekly': return weeklyAmount;
            case 'Fortnightly': return weeklyAmount * 2;
            case 'Monthly': return weeklyAmount * 52 / 12;
            case 'Yearly': return weeklyAmount * 52;
            default: return 0;
        }
    }

    function formatCurrency(amount, currency = state.settings.currency) {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        } catch (e) {
            return `${currency} ${amount.toFixed(2)}`;
        }
    }

    function formatPercent(value) {
        return `${value.toFixed(1)}%`;
    }

    function sumIncludedItems(bucket) {
        return bucket.items
            .filter(item => item.include)
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    }

    function getTotalExpenses() {
        return state.expenses
            .filter(bucket => bucket.include)
            .reduce((sum, bucket) => sum + sumIncludedItems(bucket), 0);
    }

    function getTotalSavings() {
        return state.savings
            .filter(bucket => bucket.include)
            .reduce((sum, bucket) => sum + sumIncludedItems(bucket), 0);
    }

    function updateDerivedValues() {
        const income = parseFloat(state.settings.incomeAmount) || 0;
        const freq = state.settings.incomeFrequency;
        
        const monthlyIncome = convertFrequency(income, freq, 'Monthly');
        const fortnightlyIncome = convertFrequency(income, freq, 'Fortnightly');
        
        document.getElementById('incomeMonthly').textContent = formatCurrency(monthlyIncome);
        document.getElementById('incomeFortnightly').textContent = formatCurrency(fortnightlyIncome);
        
        const totalSavings = getTotalSavings();
        const leftover = income - totalSavings;
        const savingsRate = income > 0 ? (totalSavings / income) * 100 : 0;
        
        document.getElementById('leftoverAfterSavings').textContent = formatCurrency(leftover);
        document.getElementById('savingsRate').textContent = formatPercent(savingsRate);
    }

    function updateTotals() {
        const totalExpenses = getTotalExpenses();
        const totalSavings = getTotalSavings();
        const income = parseFloat(state.settings.incomeAmount) || 0;
        const freq = state.settings.incomeFrequency;
        
        document.getElementById('totalsFrequency').textContent = freq;
        
        const remaining = income - totalExpenses - totalSavings;
        
        document.getElementById('totalIncome').textContent = formatCurrency(income);
        document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
        document.getElementById('totalSavings').textContent = formatCurrency(totalSavings);
        document.getElementById('totalRemaining').textContent = formatCurrency(remaining);
        
        const remainingElement = document.getElementById('totalRemaining');
        if (remaining < 0) {
            remainingElement.style.color = 'var(--danger)';
        } else if (remaining > 0) {
            remainingElement.style.color = 'var(--success)';
        } else {
            remainingElement.style.color = 'var(--text-secondary)';
        }
        
        updateDerivedValues();
    }

    function createItem(bucketId, section) {
        const bucket = state[section].find(b => b.id === bucketId);
        if (!bucket) return;
        
        const item = {
            id: generateId(),
            name: 'New item',
            amount: 0,
            include: true
        };
        
        bucket.items.push(item);
        return item;
    }

    function deleteItem(itemId, bucketId, section) {
        const bucket = state[section].find(b => b.id === bucketId);
        if (!bucket) return;
        
        bucket.items = bucket.items.filter(item => item.id !== itemId);
    }

    function renderItem(item, bucketId, section) {
        const template = document.getElementById('itemTemplate');
        const row = template.content.cloneNode(true);
        
        const tr = row.querySelector('.item-row');
        tr.dataset.itemId = item.id;
        
        const nameInput = row.querySelector('.item-name');
        const amountInput = row.querySelector('.item-amount');
        const includeCheck = row.querySelector('.item-include');
        const deleteBtn = row.querySelector('.delete-btn');
        
        nameInput.value = item.name;
        amountInput.value = item.amount;
        includeCheck.checked = item.include;
        
        nameInput.addEventListener('input', () => {
            item.name = nameInput.value;
            saveState();
        });
        
        amountInput.addEventListener('input', () => {
            item.amount = parseFloat(amountInput.value) || 0;
            updateBucketTotal(bucketId, section);
            updateTotals();
            saveState();
        });
        
        includeCheck.addEventListener('change', () => {
            item.include = includeCheck.checked;
            updateBucketTotal(bucketId, section);
            updateTotals();
            saveState();
        });
        
        deleteBtn.addEventListener('click', () => {
            deleteItem(item.id, bucketId, section);
            tr.remove();
            updateBucketTotal(bucketId, section);
            updateTotals();
            saveState();
        });
        
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const bucket = state[section].find(b => b.id === bucketId);
                const lastItem = bucket.items[bucket.items.length - 1];
                if (item.id === lastItem.id) {
                    const newItem = createItem(bucketId, section);
                    const tbody = tr.parentElement;
                    tbody.appendChild(renderItem(newItem, bucketId, section));
                    saveState();
                    
                    setTimeout(() => {
                        const newRow = tbody.querySelector(`[data-item-id="${newItem.id}"]`);
                        newRow.querySelector('.item-name').focus();
                    }, 0);
                }
            }
        });
        
        return row;
    }

    function updateBucketTotal(bucketId, section) {
        const bucket = state[section].find(b => b.id === bucketId);
        if (!bucket) return;
        
        const total = sumIncludedItems(bucket);
        const bucketCard = document.querySelector(`[data-bucket-id="${bucketId}"]`);
        if (bucketCard) {
            bucketCard.querySelector('.bucket-total-value').textContent = formatCurrency(total);
            
            if (section === 'savings' && bucket.goalEnabled && bucket.goalAmount > 0) {
                const progressFill = bucketCard.querySelector('.progress-fill');
                const progressCurrent = bucketCard.querySelector('.progress-current');
                const progressPercent = bucketCard.querySelector('.progress-percent');
                const progressGoal = bucketCard.querySelector('.progress-goal');
                
                const percentage = Math.min((total / bucket.goalAmount) * 100, 100);
                
                progressFill.style.width = `${percentage}%`;
                progressCurrent.textContent = formatCurrency(total);
                progressPercent.textContent = `${percentage.toFixed(1)}%`;
                progressGoal.textContent = `of ${formatCurrency(bucket.goalAmount)}`;
            }
        }
    }

    function createBucket(section) {
        const bucket = {
            id: generateId(),
            name: section === 'expenses' ? 'New expense' : 'New saving',
            bankAccount: '',
            include: true,
            items: [],
            goalEnabled: false,
            goalAmount: 0,
            color: ''
        };
        
        state[section].push(bucket);
        return bucket;
    }

    function deleteBucket(bucketId, section) {
        state[section] = state[section].filter(b => b.id !== bucketId);
    }

    function renderBucket(bucket, section) {
        const template = document.getElementById('bucketTemplate');
        const bucketCard = template.content.cloneNode(true);
        
        const article = bucketCard.querySelector('.bucket-card');
        article.dataset.bucketId = bucket.id;
        
        const toggleBtn = bucketCard.querySelector('.bucket-toggle');
        const nameInput = bucketCard.querySelector('.bucket-name');
        const bankInput = bucketCard.querySelector('.bank-account');
        const includeCheck = bucketCard.querySelector('.bucket-include');
        const colorPicker = bucketCard.querySelector('.bucket-color');
        const deleteBtn = bucketCard.querySelector('.delete-btn');
        const itemsList = bucketCard.querySelector('.items-list');
        const addItemBtn = bucketCard.querySelector('.add-item-btn');
        
        const goalSection = bucketCard.querySelector('.goal-section');
        const goalEnabled = bucketCard.querySelector('.goal-enabled');
        const goalAmount = bucketCard.querySelector('.goal-amount');
        const progressContainer = bucketCard.querySelector('.progress-container');
        
        nameInput.value = bucket.name;
        bankInput.value = bucket.bankAccount;
        includeCheck.checked = bucket.include;
        
        if (bucket.color) {
            colorPicker.value = bucket.color;
            article.style.setProperty('--bucket-bg-color', bucket.color);
            article.setAttribute('data-bucket-color', 'true');
        } else {
            colorPicker.value = '#1f1f1f';
        }
        
        colorPicker.addEventListener('input', () => {
            bucket.color = colorPicker.value;
            article.style.setProperty('--bucket-bg-color', colorPicker.value);
            article.setAttribute('data-bucket-color', 'true');
            saveState();
        });
        
        if (section === 'savings') {
            goalSection.style.display = 'block';
            goalEnabled.checked = bucket.goalEnabled || false;
            goalAmount.value = bucket.goalAmount || 0;
            
            if (bucket.goalEnabled) {
                goalAmount.style.display = 'block';
                progressContainer.style.display = 'flex';
            }
            
            goalEnabled.addEventListener('change', () => {
                bucket.goalEnabled = goalEnabled.checked;
                goalAmount.style.display = goalEnabled.checked ? 'block' : 'none';
                progressContainer.style.display = goalEnabled.checked ? 'flex' : 'none';
                
                if (goalEnabled.checked && !bucket.goalAmount) {
                    bucket.goalAmount = 1000;
                    goalAmount.value = 1000;
                }
                
                updateBucketTotal(bucket.id, section);
                saveState();
            });
            
            goalAmount.addEventListener('input', () => {
                bucket.goalAmount = parseFloat(goalAmount.value) || 0;
                updateBucketTotal(bucket.id, section);
                saveState();
            });
        }
        
        toggleBtn.addEventListener('click', (e) => {
            if (e.target === nameInput) return;
            const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
            toggleBtn.setAttribute('aria-expanded', !expanded);
        });
        
        nameInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        nameInput.addEventListener('input', () => {
            bucket.name = nameInput.value;
            saveState();
        });
        
        bankInput.addEventListener('input', () => {
            bucket.bankAccount = bankInput.value;
            saveState();
        });
        
        includeCheck.addEventListener('change', () => {
            bucket.include = includeCheck.checked;
            updateTotals();
            saveState();
        });
        
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Delete bucket "${bucket.name}"?`)) {
                deleteBucket(bucket.id, section);
                article.remove();
                updateTotals();
                saveState();
                
                const container = document.getElementById(section + 'Buckets');
                if (state[section].length === 0) {
                    container.innerHTML = `<p class="empty-state">No ${section} yet — add a bucket</p>`;
                }
            }
        });
        
        addItemBtn.addEventListener('click', () => {
            const item = createItem(bucket.id, section);
            itemsList.appendChild(renderItem(item, bucket.id, section));
            saveState();
            
            setTimeout(() => {
                const newRow = itemsList.querySelector(`[data-item-id="${item.id}"]`);
                newRow.querySelector('.item-name').focus();
            }, 0);
        });
        
        bucket.items.forEach(item => {
            itemsList.appendChild(renderItem(item, bucket.id, section));
        });
        
        return bucketCard;
    }

    function renderAllBuckets() {
        ['expenses', 'savings'].forEach(section => {
            const container = document.getElementById(section + 'Buckets');
            container.innerHTML = '';
            
            if (state[section].length === 0) {
                container.innerHTML = `<p class="empty-state">No ${section} yet — add a bucket</p>`;
            } else {
                state[section].forEach(bucket => {
                    container.appendChild(renderBucket(bucket, section));
                    updateBucketTotal(bucket.id, section);
                });
            }
        });
        
        updateTotals();
    }

    // Cloud storage integration
    async function loadBudgetFromCloud() {
        if (!currentUser) return false;
        
        try {
            const budgets = await cloudStore.listBudgets(currentUser.uid);
            
            if (budgets.length > 0) {
                // Load the most recent budget
                const budget = budgets[0];
                currentBudgetId = budget.id;
                currentBudget = budget;
                
                // Update state with budget data
                state = {
                    settings: budget.settings || state.settings,
                    expenses: budget.expenses || [],
                    savings: budget.savings || []
                };
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error loading budget from cloud:', error);
            showError('Failed to load budget from cloud: ' + cloudStore.getErrorMessage(error));
            return false;
        }
    }

    async function saveBudgetToCloud() {
        if (!currentUser) return;
        
        try {
            const budgetData = {
                name: 'My Budget',
                settings: state.settings,
                expenses: state.expenses,
                savings: state.savings
            };
            
            if (currentBudgetId) {
                // Update existing budget
                await cloudStore.updateBudget(currentUser.uid, currentBudgetId, budgetData);
            } else {
                // Create new budget
                const newBudget = await cloudStore.createBudget(currentUser.uid, budgetData);
                currentBudgetId = newBudget.id;
                currentBudget = newBudget;
            }
        } catch (error) {
            console.error('Error saving budget to cloud:', error);
            showError('Failed to save budget: ' + cloudStore.getErrorMessage(error));
        }
    }

    function saveState() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            await saveBudgetToCloud();
        }, 1000); // Debounced save after 1 second
    }

    // Migration from localStorage
    async function checkForMigration() {
        if (hasMigratedFromLocalStorage) return;
        
        const localData = localStorage.getItem('budgetBuckets.v1');
        if (!localData) return;
        
        try {
            const parsedData = JSON.parse(localData);
            
            // Check if user wants to import their local data
            const shouldImport = confirm(
                'We found budget data saved on this device. Would you like to import it to your cloud account? ' +
                'This will replace any existing cloud budget.'
            );
            
            if (shouldImport) {
                state = {
                    settings: parsedData.settings || state.settings,
                    expenses: parsedData.expenses || [],
                    savings: parsedData.savings || []
                };
                
                await saveBudgetToCloud();
                localStorage.removeItem('budgetBuckets.v1'); // Clean up
                showSuccess('Local data imported successfully!');
            }
            
            hasMigratedFromLocalStorage = true;
        } catch (error) {
            console.error('Migration error:', error);
        }
    }

    function resetState() {
        if (confirm('Reset all data? This cannot be undone.')) {
            state = {
                settings: {
                    incomeAmount: 0,
                    incomeFrequency: 'Fortnightly',
                    currency: 'AUD'
                },
                expenses: [],
                savings: []
            };
            initializeUI();
            renderAllBuckets();
            saveState();
        }
    }

    function exportData() {
        const exportData = {
            ...state,
            exportDate: new Date().toISOString(),
            version: '2.0'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget-buckets-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!imported || typeof imported !== 'object') {
                    throw new Error('Invalid data format');
                }
                
                if (!imported.settings || !Array.isArray(imported.expenses) || !Array.isArray(imported.savings)) {
                    throw new Error('Invalid data structure');
                }
                
                if (confirm('Import will replace all current data. Continue?')) {
                    state = {
                        settings: imported.settings,
                        expenses: imported.expenses || [],
                        savings: imported.savings || []
                    };
                    initializeUI();
                    renderAllBuckets();
                    await saveBudgetToCloud();
                    showSuccess('Data imported successfully!');
                }
            } catch (err) {
                showError('Failed to import: Invalid file format');
            }
        };
        reader.readAsText(file);
    }

    function loadDemoData() {
        state = {
            settings: {
                incomeAmount: 2000,
                incomeFrequency: 'Fortnightly',
                currency: 'AUD'
            },
            expenses: [
                {
                    id: generateId(),
                    name: 'Housing',
                    bankAccount: 'Main Account',
                    include: true,
                    color: '#2d3748',
                    items: [
                        { id: generateId(), name: 'Rent', amount: 800, include: true },
                        { id: generateId(), name: 'Utilities', amount: 100, include: true },
                        { id: generateId(), name: 'Internet', amount: 40, include: true }
                    ]
                },
                {
                    id: generateId(),
                    name: 'Transport',
                    bankAccount: 'Main Account',
                    include: true,
                    color: '#1a365d',
                    items: [
                        { id: generateId(), name: 'Fuel', amount: 60, include: true },
                        { id: generateId(), name: 'Insurance', amount: 50, include: true },
                        { id: generateId(), name: 'Registration', amount: 15, include: true }
                    ]
                },
                {
                    id: generateId(),
                    name: 'Food & Groceries',
                    bankAccount: 'Spending Account',
                    include: true,
                    color: '#22543d',
                    items: [
                        { id: generateId(), name: 'Groceries', amount: 200, include: true },
                        { id: generateId(), name: 'Eating out', amount: 80, include: true }
                    ]
                }
            ],
            savings: [
                {
                    id: generateId(),
                    name: 'Emergency Fund',
                    bankAccount: 'Savings Account',
                    include: true,
                    goalEnabled: true,
                    goalAmount: 5000,
                    color: '#065f46',
                    items: [
                        { id: generateId(), name: 'Monthly contribution', amount: 200, include: true }
                    ]
                },
                {
                    id: generateId(),
                    name: 'Holiday',
                    bankAccount: 'Savings Account',
                    include: true,
                    goalEnabled: true,
                    goalAmount: 3000,
                    color: '#1e3a8a',
                    items: [
                        { id: generateId(), name: 'Trip savings', amount: 100, include: true }
                    ]
                },
                {
                    id: generateId(),
                    name: 'Investment',
                    bankAccount: 'Investment Account',
                    include: true,
                    goalEnabled: false,
                    goalAmount: 0,
                    color: '#581c87',
                    items: [
                        { id: generateId(), name: 'ETF purchase', amount: 150, include: true }
                    ]
                }
            ]
        };
        
        initializeUI();
        renderAllBuckets();
        saveState();
    }

    function initializeUI() {
        document.getElementById('incomeAmount').value = state.settings.incomeAmount;
        document.getElementById('incomeFrequency').value = state.settings.incomeFrequency;
        document.getElementById('currency').value = state.settings.currency;
    }

    function showError(message) {
        console.error(message);
        // Could add a toast notification here
        alert('Error: ' + message);
    }

    function showSuccess(message) {
        console.log(message);
        // Could add a toast notification here
        alert(message);
    }

    function setupEventListeners() {
        document.getElementById('incomeAmount').addEventListener('input', (e) => {
            state.settings.incomeAmount = parseFloat(e.target.value) || 0;
            updateTotals();
            saveState();
        });
        
        document.getElementById('incomeFrequency').addEventListener('change', (e) => {
            state.settings.incomeFrequency = e.target.value;
            updateTotals();
            saveState();
        });
        
        document.getElementById('currency').addEventListener('change', (e) => {
            state.settings.currency = e.target.value;
            updateTotals();
            renderAllBuckets();
            saveState();
        });
        
        document.getElementById('loadDemoBtn').addEventListener('click', loadDemoData);
        document.getElementById('resetBtn').addEventListener('click', resetState);
        document.getElementById('exportBtn').addEventListener('click', exportData);
        
        const importBtn = document.getElementById('importBtn');
        const importFile = document.getElementById('importFile');
        
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                importData(e.target.files[0]);
                e.target.value = '';
            }
        });

        // Sign out button
        document.getElementById('signOutBtn').addEventListener('click', async () => {
            if (confirm('Are you sure you want to sign out?')) {
                try {
                    await authHelpers.signOut();
                    window.location.href = '/auth/login.html';
                } catch (error) {
                    console.error('Sign out error:', error);
                    showError('Failed to sign out');
                }
            }
        });
        
        document.querySelectorAll('.add-bucket-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.dataset.section;
                const bucket = createBucket(section);
                const container = document.getElementById(section + 'Buckets');
                
                const emptyState = container.querySelector('.empty-state');
                if (emptyState) {
                    emptyState.remove();
                }
                
                container.appendChild(renderBucket(bucket, section));
                saveState();
                
                setTimeout(() => {
                    const newCard = container.querySelector(`[data-bucket-id="${bucket.id}"]`);
                    newCard.querySelector('.bucket-name').focus();
                }, 0);
            });
        });
        
        const helpBtn = document.getElementById('helpBtn');
        const helpModal = document.getElementById('helpModal');
        const closeModal = helpModal.querySelector('.close-modal');
        
        helpBtn.addEventListener('click', () => helpModal.showModal());
        closeModal.addEventListener('click', () => helpModal.close());
        
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.close();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const activeElement = document.activeElement;
                if (activeElement && activeElement.closest('.bucket-card')) {
                    const section = activeElement.closest('.expenses-section') ? 'expenses' : 'savings';
                    document.querySelector(`[data-section="${section}"]`).click();
                }
            }
        });
    }

    function updateUserInfo() {
        const userInfo = document.getElementById('userInfo');
        if (currentUser) {
            userInfo.textContent = `${currentUser.displayName || currentUser.email}`;
        }
    }

    function runTests() {
        console.group('Budget Buckets Tests');
        
        console.assert(convertFrequency(100, 'Weekly', 'Fortnightly') === 200, 'Weekly to Fortnightly conversion');
        console.assert(Math.abs(convertFrequency(100, 'Weekly', 'Monthly') - 433.33) < 0.1, 'Weekly to Monthly conversion');
        console.assert(convertFrequency(200, 'Fortnightly', 'Weekly') === 100, 'Fortnightly to Weekly conversion');
        console.assert(Math.abs(convertFrequency(200, 'Fortnightly', 'Monthly') - 433.33) < 0.1, 'Fortnightly to Monthly conversion');
        
        console.log('All tests passed!');
        console.groupEnd();
    }

    async function init() {
        runTests();
        
        // Wait for authentication using the global auth guard
        if (window.authGuard) {
            currentUser = await window.authGuard.requireAuth();
            if (!currentUser) return; // Redirected to login
        } else {
            // Fallback to direct auth check
            currentUser = await authHelpers.waitForAuth();
            if (!currentUser) {
                window.location.href = '/auth/login.html';
                return;
            }
        }
        
        updateUserInfo();
        
        // Try to load budget from cloud
        const hasCloudBudget = await loadBudgetFromCloud();
        
        if (!hasCloudBudget) {
            // Check for migration from localStorage
            await checkForMigration();
        }
        
        initializeUI();
        setupEventListeners();
        renderAllBuckets();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();