import { authHelpers } from '../auth/firebase.js';
import cloudStore from './cloud-store.js';

// Import new libraries for enhanced features
import Sortable from "https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/modular/sortable.esm.js";
import { differenceInMonths, addMonths, format } from "https://cdn.jsdelivr.net/npm/date-fns@3.6.0/+esm";
import debounce from "https://cdn.jsdelivr.net/npm/lodash.debounce@4.0.8/+esm";

(function() {
    'use strict';

    // Cloud-integrated state management
    let currentUser = null;
    let currentBudget = null;
    let currentBudgetId = null;
    let hasMigratedFromLocalStorage = false;
    let allocChart = null; // Chart.js instance
    
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

    // Migration function for existing buckets
    async function migrateBucketsIfNeeded(budgetId) {
        const buckets = [...state.expenses, ...state.savings];
        let needsSave = false;

        for (let bucket of buckets) {
            // Add missing fields
            if (typeof bucket.orderIndex === 'undefined') {
                bucket.orderIndex = buckets.indexOf(bucket);
                needsSave = true;
            }
            if (!bucket.notes) {
                bucket.notes = "";
                needsSave = true;
            }
            if (typeof bucket.overspendThresholdPct === 'undefined') {
                bucket.overspendThresholdPct = 80;
                needsSave = true;
            }
            if (typeof bucket.spentThisPeriodCents === 'undefined') {
                bucket.spentThisPeriodCents = 0;
                needsSave = true;
            }
            if (!bucket.type) {
                bucket.type = state.expenses.includes(bucket) ? 'expense' : 'saving';
                needsSave = true;
            }

            // Add type-specific fields
            if (bucket.type === 'saving' && !bucket.target) {
                bucket.target = {
                    amountCents: 0,
                    targetDate: null,
                    autoContributionEnabled: false
                };
                needsSave = true;
            }
            if (bucket.type === 'debt' && !bucket.debt) {
                bucket.debt = {
                    aprPct: 0,
                    minPaymentCents: 0
                };
                needsSave = true;
            }
        }

        if (needsSave) {
            await saveToCloud();
        }
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
            .filter(bucket => bucket.include && bucket.type !== 'debt')
            .reduce((sum, bucket) => sum + sumIncludedItems(bucket), 0);
    }

    function getTotalDebt() {
        const expenseDebt = state.expenses
            .filter(bucket => bucket.include && bucket.type === 'debt')
            .reduce((sum, bucket) => sum + sumIncludedItems(bucket), 0);
        
        const savingDebt = state.savings
            .filter(bucket => bucket.include && bucket.type === 'debt')
            .reduce((sum, bucket) => sum + sumIncludedItems(bucket), 0);
        
        return expenseDebt + savingDebt;
    }

    // New helper functions for sinking funds
    function monthsUntil(targetIso) {
        if (!targetIso) return Infinity;
        const now = new Date();
        const end = new Date(`${targetIso}T00:00:00`);
        return Math.max(0, differenceInMonths(end, now));
    }

    function monthlyNeeded(targetCents, currentCents, targetIso) {
        const m = monthsUntil(targetIso);
        if (!isFinite(m) || m <= 0) return 0;
        return Math.max(0, (targetCents - currentCents) / m);
    }

    function monthlyToBase(val, baseFreq) {
        return baseFreq === 'Weekly' ? val * 12 / 52 :
               baseFreq === 'Fortnightly' ? val * 12 / 26 :
               baseFreq === 'Monthly' ? val :
               baseFreq === 'Yearly' ? val * 12 : val;
    }

    // Debt payoff calculation
    function monthsToPayoff(balance, aprPct, paymentMonthly) {
        const r = aprPct > 0 ? (Math.pow(1 + aprPct / 100, 1 / 12) - 1) : 0;
        if (paymentMonthly <= r * balance) return Infinity;
        if (r === 0) return Math.ceil(balance / paymentMonthly);
        return Math.ceil(Math.log(paymentMonthly / (paymentMonthly - r * balance)) / Math.log(1 + r));
    }

    // Allocation donut chart
    function drawAllocRing({ incM, expM, savM, debtM }) {
        const remaining = Math.max(0, incM - expM - savM - debtM);
        const ctx = document.getElementById('allocRing')?.getContext('2d');
        if (!ctx) return;
        
        const data = [expM, savM, debtM, remaining];
        const labels = ["Expenses", "Savings", "Debt", "Remaining"];
        const colors = ["#5ea8ff", "#5eead4", "#ff6b6b", "#a7b1c2"];
        
        if (allocChart) {
            allocChart.data.datasets[0].data = data;
            allocChart.update();
        } else {
            allocChart = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels,
                    datasets: [{
                        data,
                        borderWidth: 0,
                        hoverOffset: 4,
                        backgroundColor: colors
                    }]
                },
                options: {
                    cutout: "68%",
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: true }
                    }
                }
            });
        }
        
        const pct = (v, t) => (t > 0 ? Math.round(v / t * 100) : 0) + "%";
        const legendEl = document.getElementById('allocLegend');
        if (legendEl) {
            legendEl.textContent = `Expenses ${pct(expM, incM)} • Savings ${pct(savM, incM)} • Debt ${pct(debtM, incM)} • Remaining ${pct(remaining, incM)}`;
        }
    }

    function updateDerivedValues() {
        const income = parseFloat(state.settings.incomeAmount) || 0;
        const freq = state.settings.incomeFrequency;
        
        const monthlyIncome = convertFrequency(income, freq, 'Monthly');
        const fortnightlyIncome = convertFrequency(income, freq, 'Fortnightly');
        
        document.getElementById('incomeMonthly').textContent = formatCurrency(monthlyIncome);
        document.getElementById('incomeFortnightly').textContent = formatCurrency(fortnightlyIncome);
        
        const totalExpenses = getTotalExpenses();
        const totalSavings = getTotalSavings();
        const leftover = income - totalExpenses - totalSavings;
        const savingsRate = income > 0 ? (totalSavings / income) * 100 : 0;
        
        document.getElementById('leftoverAfterSavings').textContent = formatCurrency(leftover);
        document.getElementById('savingsRate').textContent = formatPercent(savingsRate);
        
        updateTotals();
        
        // Update allocation ring
        const totalDebt = getTotalDebt();
        const expM = convertFrequency(totalExpenses, freq, 'Monthly');
        const savM = convertFrequency(totalSavings, freq, 'Monthly');
        const debtM = convertFrequency(totalDebt, freq, 'Monthly');
        drawAllocRing({ incM: monthlyIncome, expM, savM, debtM });
    }

    function updateTotals() {
        const freq = state.settings.incomeFrequency;
        const income = parseFloat(state.settings.incomeAmount) || 0;
        const expenses = getTotalExpenses();
        const savings = getTotalSavings();
        const debt = getTotalDebt();
        const remaining = income - expenses - savings - debt;
        
        document.getElementById('totalsFrequency').textContent = freq;
        document.getElementById('totalIncome').textContent = formatCurrency(income);
        document.getElementById('totalExpenses').textContent = formatCurrency(expenses);
        document.getElementById('totalSavings').textContent = formatCurrency(savings);
        document.getElementById('totalDebt').textContent = formatCurrency(debt);
        document.getElementById('totalRemaining').textContent = formatCurrency(remaining);
        
        // Update remaining color
        const remainingEl = document.getElementById('totalRemaining');
        if (remaining < 0) {
            remainingEl.style.color = 'var(--danger-color, #ff6b6b)';
        } else {
            remainingEl.style.color = 'var(--success-color, #5eead4)';
        }
    }

    function updateBucketUI(bucket, bucketEl) {
        const bucketTotal = sumIncludedItems(bucket);
        const income = parseFloat(state.settings.incomeAmount) || 0;
        const freq = state.settings.incomeFrequency;
        const monthlyIncome = convertFrequency(income, freq, 'Monthly');
        const bucketMonthly = convertFrequency(bucketTotal, freq, 'Monthly');
        
        // Update percentage of income
        const pctOfIncome = monthlyIncome > 0 ? Math.round(bucketMonthly / monthlyIncome * 100) : 0;
        bucketEl.querySelector('.pct').textContent = `${pctOfIncome}% of income`;
        
        // Update bank badge
        const bankBadge = bucketEl.querySelector('.bank-badge');
        if (bucket.bankAccount) {
            bankBadge.textContent = bucket.bankAccount;
            bankBadge.style.display = '';
        } else {
            bankBadge.style.display = 'none';
        }
        
        // Update overspend indicator
        const spentCents = bucket.spentThisPeriodCents || 0;
        const plannedCents = bucketTotal * 100;
        const ratio = plannedCents > 0 ? spentCents / plannedCents : 0;
        const pill = bucketEl.querySelector('.pill');
        
        if (ratio < 0.8) {
            pill.className = 'pill pill--ok';
            pill.textContent = 'OK';
        } else if (ratio <= 1.0) {
            pill.className = 'pill pill--warn';
            pill.textContent = 'Warning';
        } else {
            pill.className = 'pill pill--bad';
            pill.textContent = 'Over';
        }
        
        // Update progress bar
        const progressBar = bucketEl.querySelector('.progress-bar');
        const progressWidth = Math.min(100, ratio * 100);
        progressBar.style.width = `${progressWidth}%`;
        
        // Update labels and remaining amount based on bucket type
        const freq = state.settings.incomeFrequency;
        const period = freq.toLowerCase();
        const spentLabel = bucketEl.querySelector('.spent-label');
        const remainingEl = bucketEl.querySelector('.remaining-amount');
        const remaining = (plannedCents - spentCents) / 100;
        
        if (bucket.type === 'saving') {
            spentLabel.textContent = `Contributed so far (this ${period}):`;
            remainingEl.textContent = `Still to save this ${period}: ${formatCurrency(remaining)}`;
        } else {
            spentLabel.textContent = `Spent this ${period}:`;
            remainingEl.textContent = `Remaining: ${formatCurrency(remaining)}`;
        }
        
        // Update data attributes for search
        bucketEl.dataset.bucketName = bucket.name || '';
        bucketEl.dataset.bankAccount = bucket.bankAccount || '';
        bucketEl.dataset.notes = bucket.notes || '';
        
        // Update type-specific sections
        updateTypeSpecificSections(bucket, bucketEl);
    }

    function updateTypeSpecificSections(bucket, bucketEl) {
        const savingsInfo = bucketEl.querySelector('.savings-info');
        const debtInfo = bucketEl.querySelector('.debt-info');
        
        // Hide all type-specific sections first
        savingsInfo.style.display = 'none';
        debtInfo.style.display = 'none';
        
        if (bucket.type === 'saving') {
            savingsInfo.style.display = 'block';
            updateSavingsSection(bucket, bucketEl);
        } else if (bucket.type === 'debt') {
            debtInfo.style.display = 'block';
            updateDebtSection(bucket, bucketEl);
        }
    }

    function updateSavingsSection(bucket, bucketEl) {
        const target = bucket.target || {};
        const targetAmountEl = bucketEl.querySelector('.target-amount');
        const targetDateEl = bucketEl.querySelector('.target-date');
        const autoCalcEl = bucketEl.querySelector('.auto-calc');
        const neededAmountEl = bucketEl.querySelector('.needed-amount');
        
        targetAmountEl.value = target.amountCents ? (target.amountCents / 100).toFixed(2) : '';
        targetDateEl.value = target.targetDate || '';
        autoCalcEl.checked = target.autoContributionEnabled || false;
        
        // Calculate needed amount
        const currentBalance = sumIncludedItems(bucket) * 100; // in cents
        const needMonthly = monthlyNeeded(target.amountCents || 0, currentBalance, target.targetDate);
        const needPerPeriod = monthlyToBase(needMonthly, state.settings.incomeFrequency);
        neededAmountEl.textContent = formatCurrency(needPerPeriod / 100);
    }

    function updateDebtSection(bucket, bucketEl) {
        const debt = bucket.debt || {};
        const aprEl = bucketEl.querySelector('.apr-pct');
        const minPaymentEl = bucketEl.querySelector('.min-payment');
        const payoffTextEl = bucketEl.querySelector('.payoff-text');
        
        aprEl.value = debt.aprPct || '';
        minPaymentEl.value = debt.minPaymentCents ? (debt.minPaymentCents / 100).toFixed(2) : '';
        
        // Calculate payoff
        const balance = sumIncludedItems(bucket);
        const minPaymentMonthly = convertFrequency(debt.minPaymentCents / 100 || 0, state.settings.incomeFrequency, 'Monthly');
        const months = monthsToPayoff(balance, debt.aprPct || 0, minPaymentMonthly);
        
        if (months === Infinity) {
            payoffTextEl.textContent = "Unreachable (increase payment)";
        } else {
            const payoffDate = addMonths(new Date(), months);
            payoffTextEl.textContent = `${months} months (${format(payoffDate, "MMM yyyy")})`;
        }
    }

    // Search functionality
    function initializeSearch() {
        const searchEl = document.getElementById('bucket-search');
        if (!searchEl) return;
        
        searchEl.addEventListener('input', () => {
            const q = searchEl.value.trim().toLowerCase();
            document.querySelectorAll('[data-bucket-id]').forEach(card => {
                const hay = (
                    (card.dataset.bucketName || '') + ' ' +
                    (card.dataset.bankAccount || '') + ' ' +
                    (card.dataset.notes || '')
                ).toLowerCase();
                card.style.display = hay.includes(q) ? '' : 'none';
            });
        });
    }

    // Drag and drop functionality
    function wireSortable(listEl) {
        if (!listEl) return;
        
        Sortable.create(listEl, {
            handle: ".drag-handle",
            animation: 120,
            ghostClass: 'sortable-ghost',
            onEnd: async (evt) => {
                const ids = [...listEl.querySelectorAll('[data-bucket-id]')].map(el => el.dataset.bucketId);
                await saveOrderIndex(ids);
            }
        });
    }

    async function saveOrderIndex(ids) {
        const allBuckets = [...state.expenses, ...state.savings];
        ids.forEach((id, index) => {
            const bucket = allBuckets.find(b => b.id === id);
            if (bucket) {
                bucket.orderIndex = index;
            }
        });
        await saveToCloud();
    }

    function createBucketElement(bucket, section) {
        const template = document.getElementById('bucketTemplate');
        const bucketEl = template.content.cloneNode(true);
        const card = bucketEl.querySelector('.bucket-card');
        
        card.dataset.bucketId = bucket.id;
        
        // Set up basic bucket properties
        const nameInput = card.querySelector('.bucket-name');
        const bankInput = card.querySelector('.bank-account');
        const includeInput = card.querySelector('.bucket-include');
        const colorInput = card.querySelector('.bucket-color');
        const typeSelect = card.querySelector('.bucket-type');
        const notesTextarea = card.querySelector('.bucket-notes');
        const spentInput = card.querySelector('.spent-this-period');
        
        nameInput.value = bucket.name || '';
        bankInput.value = bucket.bankAccount || '';
        includeInput.checked = bucket.include !== false;
        colorInput.value = bucket.color || '#00cdd6';
        typeSelect.value = bucket.type || 'expense';
        notesTextarea.value = bucket.notes || '';
        spentInput.value = bucket.spentThisPeriodCents ? (bucket.spentThisPeriodCents / 100).toFixed(2) : '0.00';
        
        // Auto-resize notes textarea
        if (window.autosize) {
            autosize(notesTextarea);
        }
        
        // Set up event listeners
        setupBucketEventListeners(bucket, card, section);
        
        // Create initial items
        bucket.items = bucket.items || [];
        bucket.items.forEach(item => {
            addItemToUI(item, card, bucket, section);
        });
        
        updateBucketUI(bucket, card);
        updateBucketTotal(bucket, card);
        
        return card;
    }

    function setupBucketEventListeners(bucket, card, section) {
        const nameInput = card.querySelector('.bucket-name');
        const bankInput = card.querySelector('.bank-account');
        const includeInput = card.querySelector('.bucket-include');
        const colorInput = card.querySelector('.bucket-color');
        const typeSelect = card.querySelector('.bucket-type');
        const notesTextarea = card.querySelector('.bucket-notes');
        const spentInput = card.querySelector('.spent-this-period');
        const deleteBtn = card.querySelector('.delete-btn');
        const addItemBtn = card.querySelector('.add-item-btn');
        const toggleBtn = card.querySelector('.bucket-toggle');
        
        // Debounced save functions
        const debouncedSave = debounce(saveToCloud, 350);
        const debouncedUpdateNotes = debounce(async () => {
            bucket.notes = notesTextarea.value;
            card.dataset.notes = bucket.notes;
            await saveToCloud();
        }, 350);
        
        nameInput.addEventListener('input', () => {
            bucket.name = nameInput.value;
            card.dataset.bucketName = bucket.name;
            debouncedSave();
        });
        
        bankInput.addEventListener('input', () => {
            bucket.bankAccount = bankInput.value;
            card.dataset.bankAccount = bucket.bankAccount;
            updateBucketUI(bucket, card);
            debouncedSave();
        });
        
        includeInput.addEventListener('change', () => {
            bucket.include = includeInput.checked;
            updateDerivedValues();
            debouncedSave();
        });
        
        colorInput.addEventListener('change', () => {
            bucket.color = colorInput.value;
            debouncedSave();
        });
        
        typeSelect.addEventListener('change', () => {
            bucket.type = typeSelect.value;
            updateTypeSpecificSections(bucket, card);
            debouncedSave();
        });
        
        notesTextarea.addEventListener('input', debouncedUpdateNotes);
        
        spentInput.addEventListener('input', () => {
            bucket.spentThisPeriodCents = Math.round((parseFloat(spentInput.value) || 0) * 100);
            updateBucketUI(bucket, card);
            debouncedSave();
        });
        
        deleteBtn.addEventListener('click', () => {
            if (confirm('Delete this bucket and all its items?')) {
                deleteBucket(bucket.id, section);
            }
        });
        
        addItemBtn.addEventListener('click', () => {
            addNewItem(bucket, card, section);
        });
        
        // Only toggle on icon click, not the whole button
        const toggleIcon = card.querySelector('.toggle-icon');
        toggleIcon.style.cursor = 'pointer';
        toggleIcon.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            const content = card.querySelector('.bucket-content');
            const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
            
            content.style.display = isExpanded ? 'none' : 'block';
            toggleIcon.textContent = isExpanded ? '▶' : '▼';
            toggleBtn.setAttribute('aria-expanded', !isExpanded);
        });
        
        // Prevent name input from triggering toggle
        nameInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Type-specific event listeners
        setupTypeSpecificEventListeners(bucket, card);
    }

    function setupTypeSpecificEventListeners(bucket, card) {
        // Savings-specific listeners
        const targetAmountEl = card.querySelector('.target-amount');
        const targetDateEl = card.querySelector('.target-date');
        const autoCalcEl = card.querySelector('.auto-calc');
        const setAmountBtn = card.querySelector('.set-amount-btn');
        
        const debouncedSavingsUpdate = debounce(() => {
            if (!bucket.target) bucket.target = {};
            bucket.target.amountCents = Math.round((parseFloat(targetAmountEl.value) || 0) * 100);
            bucket.target.targetDate = targetDateEl.value || null;
            bucket.target.autoContributionEnabled = autoCalcEl.checked;
            
            updateSavingsSection(bucket, card);
            
            if (bucket.target.autoContributionEnabled) {
                // Auto-set the amount if enabled
                const currentBalance = sumIncludedItems(bucket) * 100;
                const needMonthly = monthlyNeeded(bucket.target.amountCents, currentBalance, bucket.target.targetDate);
                const needPerPeriod = monthlyToBase(needMonthly, state.settings.incomeFrequency);
                
                // Update bucket amount
                if (bucket.items.length > 0) {
                    bucket.items[0].amount = needPerPeriod / 100;
                    const firstItemAmountEl = card.querySelector('.item-amount');
                    if (firstItemAmountEl) {
                        firstItemAmountEl.value = (needPerPeriod / 100).toFixed(2);
                    }
                }
                updateBucketTotal(bucket, card);
                updateDerivedValues();
            }
            
            saveToCloud();
        }, 350);
        
        targetAmountEl.addEventListener('input', debouncedSavingsUpdate);
        targetDateEl.addEventListener('change', debouncedSavingsUpdate);
        autoCalcEl.addEventListener('change', debouncedSavingsUpdate);
        
        setAmountBtn.addEventListener('click', () => {
            if (bucket.items.length > 0) {
                const currentBalance = sumIncludedItems(bucket) * 100;
                const needMonthly = monthlyNeeded(bucket.target?.amountCents || 0, currentBalance, bucket.target?.targetDate);
                const needPerPeriod = monthlyToBase(needMonthly, state.settings.incomeFrequency);
                
                bucket.items[0].amount = needPerPeriod / 100;
                const firstItemAmountEl = card.querySelector('.item-amount');
                if (firstItemAmountEl) {
                    firstItemAmountEl.value = (needPerPeriod / 100).toFixed(2);
                }
                updateBucketTotal(bucket, card);
                updateDerivedValues();
                saveToCloud();
            }
        });
        
        // Debt-specific listeners
        const aprEl = card.querySelector('.apr-pct');
        const minPaymentEl = card.querySelector('.min-payment');
        
        const debouncedDebtUpdate = debounce(() => {
            if (!bucket.debt) bucket.debt = {};
            bucket.debt.aprPct = parseFloat(aprEl.value) || 0;
            bucket.debt.minPaymentCents = Math.round((parseFloat(minPaymentEl.value) || 0) * 100);
            
            updateDebtSection(bucket, card);
            saveToCloud();
        }, 350);
        
        aprEl.addEventListener('input', debouncedDebtUpdate);
        minPaymentEl.addEventListener('input', debouncedDebtUpdate);
    }

    function addNewItem(bucket, bucketEl, section) {
        const newItem = {
            id: generateId(),
            name: '',
            amount: 0,
            include: true
        };
        
        bucket.items = bucket.items || [];
        bucket.items.push(newItem);
        
        addItemToUI(newItem, bucketEl, bucket, section);
        updateBucketTotal(bucket, bucketEl);
        updateDerivedValues();
        saveToCloud();
        
        // Focus the new item's name input
        const itemRows = bucketEl.querySelectorAll('.item-row');
        const lastRow = itemRows[itemRows.length - 1];
        const nameInput = lastRow.querySelector('.item-name');
        nameInput.focus();
        nameInput.select();
    }

    function addItemToUI(item, bucketEl, bucket, section) {
        const template = document.getElementById('itemTemplate');
        const itemEl = template.content.cloneNode(true);
        const row = itemEl.querySelector('.item-row');
        
        row.dataset.itemId = item.id;
        
        const nameInput = row.querySelector('.item-name');
        const amountInput = row.querySelector('.item-amount');
        const includeInput = row.querySelector('.item-include');
        const deleteBtn = row.querySelector('.delete-btn');
        
        nameInput.value = item.name || '';
        amountInput.value = item.amount || 0;
        includeInput.checked = item.include !== false;
        
        // Event listeners
        nameInput.addEventListener('input', debounce(() => {
            item.name = nameInput.value;
            saveToCloud();
        }, 300));
        
        amountInput.addEventListener('input', debounce(() => {
            item.amount = parseFloat(amountInput.value) || 0;
            updateBucketTotal(bucket, bucketEl);
            updateBucketUI(bucket, bucketEl);
            updateDerivedValues();
            saveToCloud();
        }, 300));
        
        includeInput.addEventListener('change', () => {
            item.include = includeInput.checked;
            updateBucketTotal(bucket, bucketEl);
            updateBucketUI(bucket, bucketEl);
            updateDerivedValues();
            saveToCloud();
        });
        
        deleteBtn.addEventListener('click', () => {
            if (bucket.items.length > 1 || confirm('Delete this item?')) {
                bucket.items = bucket.items.filter(i => i.id !== item.id);
                row.remove();
                updateBucketTotal(bucket, bucketEl);
                updateBucketUI(bucket, bucketEl);
                updateDerivedValues();
                saveToCloud();
            }
        });
        
        // Add to DOM
        const tbody = bucketEl.querySelector('.items-list');
        tbody.appendChild(itemEl);
    }

    function updateBucketTotal(bucket, bucketEl) {
        const total = sumIncludedItems(bucket);
        const totalEl = bucketEl.querySelector('.bucket-total-value');
        totalEl.textContent = formatCurrency(total);
    }

    function deleteBucket(bucketId, section) {
        if (section === 'expenses') {
            state.expenses = state.expenses.filter(b => b.id !== bucketId);
        } else {
            state.savings = state.savings.filter(b => b.id !== bucketId);
        }
        
        renderBuckets();
        updateDerivedValues();
        saveToCloud();
    }

    function addNewBucket(section) {
        const newBucket = {
            id: generateId(),
            name: '',
            items: [{
                id: generateId(),
                name: '',
                amount: 0,
                include: true
            }],
            include: true,
            color: '#00cdd6',
            bankAccount: '',
            type: section === 'expenses' ? 'expense' : 'saving',
            orderIndex: 0,
            notes: '',
            overspendThresholdPct: 80,
            spentThisPeriodCents: 0
        };
        
        // Add type-specific defaults
        if (newBucket.type === 'saving') {
            newBucket.target = {
                amountCents: 0,
                targetDate: null,
                autoContributionEnabled: false
            };
        } else if (newBucket.type === 'debt') {
            newBucket.debt = {
                aprPct: 0,
                minPaymentCents: 0
            };
        }
        
        if (section === 'expenses') {
            newBucket.orderIndex = state.expenses.length;
            state.expenses.push(newBucket);
        } else {
            newBucket.orderIndex = state.savings.length;
            state.savings.push(newBucket);
        }
        
        renderBuckets();
        updateDerivedValues();
        saveToCloud();
        
        // Focus the new bucket's name input
        const bucketEl = document.querySelector(`[data-bucket-id="${newBucket.id}"]`);
        if (bucketEl) {
            const nameInput = bucketEl.querySelector('.bucket-name');
            nameInput.focus();
            nameInput.select();
        }
    }

    function renderBuckets() {
        const expensesContainer = document.getElementById('expensesList');
        const savingsContainer = document.getElementById('savingsList');
        
        if (!expensesContainer || !savingsContainer) {
            console.warn('Cannot render buckets: containers not found in DOM');
            return;
        }
        
        // Clear containers
        expensesContainer.innerHTML = '';
        savingsContainer.innerHTML = '';
        
        // Sort buckets by orderIndex
        const sortedExpenses = [...state.expenses].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        const sortedSavings = [...state.savings].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        
        // Render expenses
        if (sortedExpenses.length === 0) {
            expensesContainer.innerHTML = '<p class="empty-state">No expenses yet — add a bucket</p>';
        } else {
            sortedExpenses.forEach(bucket => {
                const bucketEl = createBucketElement(bucket, 'expenses');
                expensesContainer.appendChild(bucketEl);
            });
        }
        
        // Render savings
        if (sortedSavings.length === 0) {
            savingsContainer.innerHTML = '<p class="empty-state">No savings yet — add a bucket</p>';
        } else {
            sortedSavings.forEach(bucket => {
                const bucketEl = createBucketElement(bucket, 'savings');
                savingsContainer.appendChild(bucketEl);
            });
        }
        
        // Wire up sortable after rendering
        wireSortable(expensesContainer);
        wireSortable(savingsContainer);
    }

    // Cloud integration functions (keeping existing structure)
    async function saveToCloud() {
        if (!currentUser || !currentBudgetId) {
            console.warn('No user or budget ID available for cloud save');
            return;
        }

        try {
            await cloudStore.updateBudget(currentUser.uid, currentBudgetId, {
                settings: state.settings,
                expenses: state.expenses,
                savings: state.savings
            });
        } catch (error) {
            console.error('Failed to save to cloud:', error);
        }
    }

    async function loadFromCloud() {
        if (!currentUser) {
            console.warn('No user available for cloud load');
            return;
        }

        try {
            const budgets = await cloudStore.listBudgets(currentUser.uid);
            
            if (budgets.length > 0) {
                currentBudget = budgets[0];
                currentBudgetId = currentBudget.id;
                
                if (currentBudget.settings) {
                    state.settings = { ...state.settings, ...currentBudget.settings };
                }
                if (currentBudget.expenses) {
                    state.expenses = currentBudget.expenses;
                }
                if (currentBudget.savings) {
                    state.savings = currentBudget.savings;
                }
                
                // Run migration if needed
                await migrateBucketsIfNeeded(currentBudgetId);
                
                updateUI();
            } else {
                // Create a new budget
                const newBudget = await cloudStore.createBudget(currentUser.uid, {
                    name: 'My Budget',
                    settings: state.settings,
                    expenses: state.expenses,
                    savings: state.savings
                });
                currentBudgetId = newBudget.id;
            }
        } catch (error) {
            console.error('Failed to load from cloud:', error);
        }
    }

    function updateUI() {
        // Update settings UI
        document.getElementById('incomeAmount').value = state.settings.incomeAmount;
        document.getElementById('incomeFrequency').value = state.settings.incomeFrequency;
        document.getElementById('currency').value = state.settings.currency;
        
        renderBuckets();
        updateDerivedValues();
    }

    // Event listeners for settings
    function initializeEventListeners() {
        console.log('Initializing event listeners...');
        
        // Settings
        const incomeAmount = document.getElementById('incomeAmount');
        const incomeFrequency = document.getElementById('incomeFrequency');
        const currency = document.getElementById('currency');
        
        if (incomeAmount) {
            incomeAmount.addEventListener('input', debounce(() => {
                state.settings.incomeAmount = parseFloat(incomeAmount.value) || 0;
                updateDerivedValues();
                saveToCloud();
            }, 300));
        }
        
        if (incomeFrequency) {
            incomeFrequency.addEventListener('change', () => {
                state.settings.incomeFrequency = incomeFrequency.value;
                updateDerivedValues();
                saveToCloud();
            });
        }
        
        if (currency) {
            currency.addEventListener('change', () => {
                state.settings.currency = currency.value;
                updateDerivedValues();
                saveToCloud();
            });
        }
        
        // Add bucket buttons
        const addBucketBtns = document.querySelectorAll('.add-bucket-btn');
        console.log(`Found ${addBucketBtns.length} add bucket buttons`);
        addBucketBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                console.log('Add bucket button clicked for section:', btn.dataset.section);
                const section = btn.dataset.section;
                addNewBucket(section);
            });
        });
        
        // Search will be initialized separately in init()
        
        // Other existing event listeners (help modal, etc.)
        const helpBtn = document.getElementById('helpBtn');
        const helpModal = document.getElementById('helpModal');
        const closeModalBtn = helpModal?.querySelector('.close-modal');
        
        helpBtn?.addEventListener('click', () => {
            helpModal?.showModal();
        });
        
        closeModalBtn?.addEventListener('click', () => {
            helpModal?.close();
        });
        
        // Import/Export functionality (keeping existing)
        setupImportExport();
    }

    function setupImportExport() {
        const exportBtn = document.getElementById('exportBtn');
        const importBtn = document.getElementById('importBtn');
        const importFile = document.getElementById('importFile');
        const resetBtn = document.getElementById('resetBtn');
        const loadDemoBtn = document.getElementById('loadDemoBtn');
        
        exportBtn?.addEventListener('click', () => {
            const data = {
                settings: state.settings,
                expenses: state.expenses,
                savings: state.savings,
                exportDate: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `budget-buckets-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
        
        importBtn?.addEventListener('click', () => {
            importFile?.click();
        });
        
        importFile?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (confirm('Import this data? This will replace your current budget.')) {
                        if (data.settings) state.settings = data.settings;
                        if (data.expenses) state.expenses = data.expenses;
                        if (data.savings) state.savings = data.savings;
                        
                        updateUI();
                        saveToCloud();
                    }
                } catch (error) {
                    alert('Invalid file format');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
        
        resetBtn?.addEventListener('click', () => {
            if (confirm('Reset all data? This cannot be undone.')) {
                state.settings = {
                    incomeAmount: 0,
                    incomeFrequency: 'Fortnightly',
                    currency: 'AUD'
                };
                state.expenses = [];
                state.savings = [];
                
                updateUI();
                saveToCloud();
            }
        });
        
        loadDemoBtn?.addEventListener('click', loadDemoData);
    }

    function loadDemoData() {
        if (!confirm('Load demo data? This will replace your current budget.')) return;
        
        state.settings = {
            incomeAmount: 3200,
            incomeFrequency: 'Fortnightly',
            currency: 'AUD'
        };
        
        state.expenses = [
            {
                id: generateId(),
                name: 'Housing',
                items: [
                    { id: generateId(), name: 'Rent', amount: 900, include: true },
                    { id: generateId(), name: 'Utilities', amount: 150, include: true }
                ],
                include: true,
                color: '#ff6b6b',
                bankAccount: 'Main Account',
                type: 'expense',
                orderIndex: 0,
                notes: 'Monthly housing costs',
                overspendThresholdPct: 80,
                spentThisPeriodCents: 85000
            },
            {
                id: generateId(),
                name: 'Transport',
                items: [
                    { id: generateId(), name: 'Fuel', amount: 120, include: true },
                    { id: generateId(), name: 'Insurance', amount: 80, include: true }
                ],
                include: true,
                color: '#4ecdc4',
                bankAccount: 'Main Account',
                type: 'expense',
                orderIndex: 1,
                notes: 'Car expenses',
                overspendThresholdPct: 80,
                spentThisPeriodCents: 15000
            }
        ];
        
        state.savings = [
            {
                id: generateId(),
                name: 'Emergency Fund',
                items: [
                    { id: generateId(), name: 'Emergency savings', amount: 300, include: true }
                ],
                include: true,
                color: '#5eead4',
                bankAccount: 'Savings Account',
                type: 'saving',
                orderIndex: 0,
                notes: 'Building emergency fund',
                overspendThresholdPct: 80,
                spentThisPeriodCents: 0,
                target: {
                    amountCents: 2000000, // $20,000
                    targetDate: '2025-12-31',
                    autoContributionEnabled: false
                }
            },
            {
                id: generateId(),
                name: 'Credit Card Debt',
                items: [
                    { id: generateId(), name: 'Credit card payment', amount: 200, include: true }
                ],
                include: true,
                color: '#ff9f43',
                bankAccount: 'Credit Card',
                type: 'debt',
                orderIndex: 1,
                notes: 'Paying off credit card',
                overspendThresholdPct: 80,
                spentThisPeriodCents: 0,
                debt: {
                    aprPct: 18.9,
                    minPaymentCents: 15000 // $150
                }
            }
        ];
        
        updateUI();
        saveToCloud();
    }

    // Initialize the app
    async function init() {
        console.log('Starting app initialization...');
        
        // Check if libraries are loaded
        console.log('Sortable available:', typeof Sortable !== 'undefined');
        console.log('debounce available:', typeof debounce !== 'undefined');
        console.log('Chart available:', typeof Chart !== 'undefined');
        
        // Wait for auth to be ready
        await authHelpers.waitForAuth();
        currentUser = authHelpers.getCurrentUser();
        
        if (currentUser) {
            document.getElementById('userInfo').textContent = `Signed in as ${currentUser.email}`;
            await loadFromCloud();
        }
        
        initializeEventListeners();
        initializeSearch();
        updateDerivedValues();
        
        // Sign out functionality
        document.getElementById('signOutBtn')?.addEventListener('click', () => {
            authHelpers.signOut();
        });
    }

    // Wait for DOM to be ready before starting the app
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init().catch(console.error);
        });
    } else {
        init().catch(console.error);
    }
})();