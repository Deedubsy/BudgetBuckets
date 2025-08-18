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
        savings: [],
        debt: []
    };

    let saveTimeout;

    function generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Migration function for existing buckets
    async function migrateBucketsIfNeeded(budgetId) {
        const buckets = [...state.expenses, ...state.savings, ...(state.debt || [])];
        let needsSave = false;
        
        // Move debt buckets from expenses/savings to debt section
        const debtBuckets = buckets.filter(b => b.type === 'debt');
        if (debtBuckets.length > 0) {
            state.debt = state.debt || [];
            debtBuckets.forEach(debtBucket => {
                // Remove from expenses/savings
                state.expenses = state.expenses.filter(b => b.id !== debtBucket.id);
                state.savings = state.savings.filter(b => b.id !== debtBucket.id);
                
                // Add to debt if not already there
                if (!state.debt.find(b => b.id === debtBucket.id)) {
                    state.debt.push(debtBucket);
                    needsSave = true;
                }
            });
        }

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

            // Migrate old savings buckets to new goal structure
            if (bucket.type === 'saving') {
                if (!bucket.goal && bucket.items && bucket.items.length > 0) {
                    // Convert old savings bucket with items to new goal structure
                    const totalAmount = sumIncludedItems(bucket);
                    bucket.goal = {
                        amountCents: Math.round(totalAmount * 100 * 50), // Assume 50 periods to goal
                        targetDate: null,
                        savedSoFarCents: 0,
                        contributionPerPeriodCents: Math.round(totalAmount * 100)
                    };
                    // Clear out old items structure for savings buckets
                    bucket.items = [];
                    needsSave = true;
                } else if (!bucket.goal) {
                    bucket.goal = {
                        amountCents: 0,
                        targetDate: null,
                        savedSoFarCents: 0,
                        contributionPerPeriodCents: 0,
                        autoCalc: false
                    };
                    needsSave = true;
                }
                
                // Ensure savings buckets have empty items array
                if (!bucket.items) {
                    bucket.items = [];
                    needsSave = true;
                }
                
                // Remove old target structure if it exists
                if (bucket.target) {
                    delete bucket.target;
                    needsSave = true;
                }
            }

            // Add type-specific fields for debt
            if (bucket.type === 'debt' && !bucket.debt) {
                bucket.debt = {
                    aprPct: 0,
                    minPaymentCents: 0
                };
                needsSave = true;
            }
            
            // Ensure all buckets have items array
            if (!bucket.items) {
                bucket.items = [];
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
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(amount);
        } catch (e) {
            return `${currency} ${Math.round(amount)}`;
        }
    }

    function formatPercent(value) {
        return `${value.toFixed(1)}%`;
    }

    function sumIncludedItems(bucket) {
        // For savings buckets, use the contribution amount instead of items
        if (bucket.type === 'saving' && bucket.goal) {
            return bucket.goal.contributionPerPeriodCents / 100 || 0;
        }
        
        // For other bucket types, sum the items
        if (!bucket.items || !Array.isArray(bucket.items)) {
            return 0;
        }
        
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
            .reduce((sum, bucket) => {
                // For savings buckets, use contribution amount instead of items
                if (bucket.type === 'saving' && bucket.goal) {
                    return sum + (bucket.goal.contributionPerPeriodCents / 100);
                }
                return sum + sumIncludedItems(bucket);
            }, 0);
    }

    function getTotalDebt() {
        return (state.debt || [])
            .filter(bucket => bucket.include)
            .reduce((sum, bucket) => sum + sumIncludedItems(bucket), 0);
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
        
        // Calculate percentages
        const expensesPct = income > 0 ? Math.round((expenses / income) * 100) : 0;
        const savingsPct = income > 0 ? Math.round((savings / income) * 100) : 0;
        const debtPct = income > 0 ? Math.round((debt / income) * 100) : 0;
        const remainingPct = income > 0 ? Math.round((remaining / income) * 100) : 0;
        
        document.getElementById('totalIncome').textContent = formatCurrency(income) + ' (100%)';
        document.getElementById('totalExpenses').textContent = formatCurrency(expenses) + ` (${expensesPct}%)`;
        document.getElementById('totalSavings').textContent = formatCurrency(savings) + ` (${savingsPct}%)`;
        document.getElementById('totalDebt').textContent = formatCurrency(debt) + ` (${debtPct}%)`;
        document.getElementById('totalRemaining').textContent = formatCurrency(remaining) + ` (${remainingPct}%)`;
        
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
        
        
        // Update progress bar
        const spentCents = bucket.spentThisPeriodCents || 0;
        const plannedCents = bucketTotal * 100;
        const ratio = plannedCents > 0 ? spentCents / plannedCents : 0;
        const progressBar = bucketEl.querySelector('.progress-bar');
        const progressWidth = Math.min(100, ratio * 100);
        progressBar.style.width = `${progressWidth}%`;
        
        // Update labels and remaining amount based on bucket type
        const period = freq.toLowerCase();
        const spentLabel = bucketEl.querySelector('.spent-label');
        const remainingEl = bucketEl.querySelector('.remaining-amount');
        
        if (bucket.type === 'saving') {
            // For savings buckets, use contribution amount instead of items
            const contributionAmount = bucket.goal?.contributionPerPeriodCents / 100 || 0;
            const remaining = Math.max(0, contributionAmount - (spentCents / 100));
            spentLabel.textContent = `Contributed so far (this ${period}):`;
            remainingEl.textContent = `Still to contribute this ${period}: ${formatCurrency(remaining)}`;
        } else if (bucket.type === 'debt') {
            const remaining = (plannedCents - spentCents) / 100;
            spentLabel.textContent = `Paid this ${period}:`;
            remainingEl.textContent = `Still to pay this ${period}: ${formatCurrency(remaining)}`;
        } else {
            const remaining = (plannedCents - spentCents) / 100;
            spentLabel.textContent = `Spent this ${period}:`;
            remainingEl.textContent = `Remaining: ${formatCurrency(remaining)}`;
        }
        
        
        // Update type-specific sections
        updateTypeSpecificSections(bucket, bucketEl);
    }

    function updateBucketColor(bucket, bucketEl) {
        if (bucket.color) {
            bucketEl.dataset.bucketColor = bucket.color;
            bucketEl.style.setProperty('--bucket-bg-color', bucket.color);
            
            // Calculate and apply auto-contrast text color
            const contrastColor = getContrastColor(bucket.color);
            bucketEl.style.setProperty('--bucket-text-color', contrastColor);
            
        } else {
            bucketEl.removeAttribute('data-bucket-color');
            bucketEl.style.removeProperty('--bucket-bg-color');
            bucketEl.style.removeProperty('--bucket-text-color');
        }
    }

    function getContrastColor(backgroundColor) {
        if (!window.tinycolor) {
            console.warn('tinycolor2 not loaded, using default colors');
            return '#ffffff';
        }
        
        const color = tinycolor(backgroundColor);
        const luminance = color.getLuminance();
        
        // Use white text for dark backgrounds, dark text for light backgrounds
        // Threshold of 0.5 works well for most cases
        return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
    }

    function getContrastRatio(color1, color2) {
        if (!window.tinycolor) {
            return 1;
        }
        
        const tc1 = tinycolor(color1);
        const tc2 = tinycolor(color2);
        
        const l1 = tc1.getLuminance();
        const l2 = tc2.getLuminance();
        
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        
        return (lighter + 0.05) / (darker + 0.05);
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
        const goal = bucket.goal || {};
        const goalAmountEl = bucketEl.querySelector('.goal-amount');
        const goalDateEl = bucketEl.querySelector('.goal-date');
        const savedSoFarEl = bucketEl.querySelector('.saved-so-far');
        const contributionEl = bucketEl.querySelector('.contribution-amount');
        const autoCalcEl = bucketEl.querySelector('.auto-calc-checkbox');
        const contribFreqEls = bucketEl.querySelectorAll('.contrib-freq');
        const trackFreqEl = bucketEl.querySelector('.track-freq');
        const trackAmountEl = bucketEl.querySelector('.track-amount');
        const stayOnTrackEl = bucketEl.querySelector('.stay-on-track');
        const manualContribEl = bucketEl.querySelector('.manual-contribution');
        
        // Update field values
        goalAmountEl.value = goal.amountCents ? Math.round(goal.amountCents / 100) : '';
        goalDateEl.value = goal.targetDate || '';
        savedSoFarEl.value = goal.savedSoFarCents ? Math.round(goal.savedSoFarCents / 100) : '';
        contributionEl.value = goal.contributionPerPeriodCents ? Math.round(goal.contributionPerPeriodCents / 100) : '';
        
        // Update frequency labels throughout
        const freq = state.settings.incomeFrequency.toLowerCase();
        contribFreqEls.forEach(el => el.textContent = freq);
        if (trackFreqEl) trackFreqEl.textContent = freq;
        
        // Handle auto-calc functionality
        const isAutoCalc = goal.autoCalc || false;
        autoCalcEl.checked = isAutoCalc;
        
        // Show/hide manual contribution input based on auto-calc state
        if (manualContribEl) {
            manualContribEl.style.display = isAutoCalc ? 'none' : 'block';
        }
        
        // Calculate "to stay on track" amount
        const goalAmount = goal.amountCents / 100 || 0;
        const savedAmount = goal.savedSoFarCents / 100 || 0;
        const remaining = Math.max(0, goalAmount - savedAmount);
        
        let neededPerPeriod = 0;
        let showStayOnTrack = false;
        
        if (goal.targetDate && goalAmount > 0 && remaining > 0) {
            const targetDate = new Date(goal.targetDate);
            const now = new Date();
            const msPerDay = 24 * 60 * 60 * 1000;
            const daysRemaining = Math.max(1, Math.ceil((targetDate - now) / msPerDay));
            
            // Calculate periods remaining based on frequency
            let periodsRemaining;
            switch (freq) {
                case 'weekly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 7)); break;
                case 'fortnightly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 14)); break;
                case 'monthly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 30)); break;
                case 'yearly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 365)); break;
                default: periodsRemaining = 1;
            }
            
            neededPerPeriod = remaining / periodsRemaining;
            showStayOnTrack = true;
        }
        
        if (stayOnTrackEl) {
            stayOnTrackEl.style.display = showStayOnTrack ? 'block' : 'none';
            if (showStayOnTrack && trackAmountEl) {
                const currency = state.settings.currency;
                trackAmountEl.innerHTML = `${currency}$${Math.round(neededPerPeriod)} / <span class="track-freq">${freq}</span>`;
            }
        }
        
        // Update progress bar
        const percentage = goalAmount > 0 ? Math.min((savedAmount / goalAmount) * 100, 100) : 0;
        
        const progressCurrent = bucketEl.querySelector('.progress-current');
        const progressPercentage = bucketEl.querySelector('.progress-percentage');
        const progressTarget = bucketEl.querySelector('.progress-target');
        const progressBarFill = bucketEl.querySelector('.progress-bar-fill');
        
        if (progressCurrent) progressCurrent.textContent = formatCurrency(savedAmount);
        if (progressPercentage) progressPercentage.textContent = `${Math.round(percentage)}%`;
        if (progressTarget) progressTarget.textContent = `of ${formatCurrency(goalAmount)}`;
        if (progressBarFill) progressBarFill.style.width = `${percentage}%`;
        
        // Calculate time to goal - use the same logic as "Stay On Track"
        const timeEstimateEl = bucketEl.querySelector('.time-estimate');
        
        if (remaining <= 0) {
            if (timeEstimateEl) timeEstimateEl.innerHTML = `<span style="color: #5eead4">Goal achieved! 🎉</span>`;
        } else if (goal.targetDate && goalAmount > 0) {
            // If target date is set, use the same calculation as "Stay On Track"
            const targetDate = new Date(goal.targetDate);
            const now = new Date();
            const msPerDay = 24 * 60 * 60 * 1000;
            const daysRemaining = Math.max(1, Math.ceil((targetDate - now) / msPerDay));
            
            // Calculate periods remaining based on frequency
            let periodsRemaining;
            switch (freq) {
                case 'weekly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 7)); break;
                case 'fortnightly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 14)); break;
                case 'monthly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 30)); break;
                case 'yearly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 365)); break;
                default: periodsRemaining = 1;
            }
            
            const neededPerPeriod = remaining / periodsRemaining;
            const currentContribution = goal.contributionPerPeriodCents / 100;
            
            let timeText = `${periodsRemaining} ${freq}`;
            if (periodsRemaining === 1) {
                timeText = timeText.slice(0, -1); // Remove 's' for singular
            }
            
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const estDateText = `${monthNames[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
            
            // Compare current contribution to needed amount (within $2 tolerance)
            const onTrack = currentContribution >= (neededPerPeriod - 2);
            let displayText = `Time to goal: ${timeText} • Target: ${estDateText}`;
            displayText += ` <span style="color: ${onTrack ? '#5eead4' : '#ff6b6b'}">(${onTrack ? 'on track' : 'behind'})</span>`;
            
            if (timeEstimateEl) timeEstimateEl.innerHTML = displayText;
        } else {
            // No target date set, use current contribution rate
            const contribution = goal.contributionPerPeriodCents / 100;
            if (contribution > 0) {
                const periodsNeeded = Math.ceil(remaining / contribution);
                let timeText = `${periodsNeeded} ${freq}`;
                if (periodsNeeded === 1) {
                    timeText = timeText.slice(0, -1); // Remove 's' for singular
                }
                
                if (timeEstimateEl) timeEstimateEl.textContent = `Time to goal: ${timeText}`;
            } else {
                if (timeEstimateEl) timeEstimateEl.textContent = 'Time to goal: Set contribution amount';
            }
        }
    }

    function updateDebtSection(bucket, bucketEl) {
        const debt = bucket.debt || {};
        const aprEl = bucketEl.querySelector('.apr-pct');
        const minPaymentEl = bucketEl.querySelector('.min-payment');
        const payoffTextEl = bucketEl.querySelector('.payoff-text');
        
        aprEl.value = debt.aprPct || '';
        minPaymentEl.value = debt.minPaymentCents ? Math.round(debt.minPaymentCents / 100) : '';
        
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
        const notesTextarea = card.querySelector('.bucket-notes');
        const spentInput = card.querySelector('.spent-this-period');
        
        nameInput.value = bucket.name || '';
        bankInput.value = bucket.bankAccount || '';
        includeInput.checked = bucket.include !== false;
        colorInput.value = bucket.color || '#00cdd6';
        notesTextarea.value = bucket.notes || '';
        spentInput.value = bucket.spentThisPeriodCents ? Math.round(bucket.spentThisPeriodCents / 100) : '0';
        
        // Auto-resize notes textarea
        if (window.autosize) {
            autosize(notesTextarea);
        }
        
        // Set up event listeners
        setupBucketEventListeners(bucket, card, section);
        
        // Handle different bucket types
        if (bucket.type === 'saving') {
            // Hide items table and add button for savings buckets
            const itemsTable = card.querySelector('.items-table');
            const addItemBtn = card.querySelector('.add-item-btn');
            const bucketTotal = card.querySelector('.bucket-total');
            
            itemsTable.style.display = 'none';
            addItemBtn.style.display = 'none';
            bucketTotal.style.display = 'none';
            
            // Initialize goal data if missing
            if (!bucket.goal) {
                bucket.goal = {
                    amountCents: 0,
                    targetDate: null,
                    savedSoFarCents: 0,
                    contributionPerPeriodCents: 0
                };
            }
        } else {
            // Create initial items for non-savings buckets
            bucket.items = bucket.items || [];
            bucket.items.forEach(item => {
                addItemToUI(item, card, bucket, section);
            });
        }
        
        updateBucketUI(bucket, card);
        updateBucketTotal(bucket, card);
        updateBucketColor(bucket, card);
        
        
        return card;
    }

    function setupBucketEventListeners(bucket, card, section) {
        const nameInput = card.querySelector('.bucket-name');
        const bankInput = card.querySelector('.bank-account');
        const includeInput = card.querySelector('.bucket-include');
        const colorInput = card.querySelector('.bucket-color');
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
            updateBucketColor(bucket, card);
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
            const headerTotal = card.querySelector('.bucket-header-total');
            const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
            
            content.style.display = isExpanded ? 'none' : 'block';
            toggleIcon.textContent = isExpanded ? '▶' : '▼';
            toggleBtn.setAttribute('aria-expanded', !isExpanded);
            
            // Show/hide header total
            if (headerTotal) {
                headerTotal.style.display = isExpanded ? 'inline' : 'none';
            }
        });
        
        // Prevent name input from triggering toggle
        nameInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Type-specific event listeners
        setupTypeSpecificEventListeners(bucket, card);
    }

    function setupTypeSpecificEventListeners(bucket, card) {
        // Savings-specific listeners (new structure)
        const goalAmountEl = card.querySelector('.goal-amount');
        const goalDateEl = card.querySelector('.goal-date');
        const savedSoFarEl = card.querySelector('.saved-so-far');
        const contributionEl = card.querySelector('.contribution-amount');
        const autoCalcEl = card.querySelector('.auto-calc-checkbox');
        const useAmountBtn = card.querySelector('.use-amount-btn');
        
        const debouncedSavingsUpdate = debounce(() => {
            if (!bucket.goal) bucket.goal = {};
            bucket.goal.amountCents = Math.round((parseFloat(goalAmountEl.value) || 0) * 100);
            bucket.goal.targetDate = goalDateEl.value || null;
            bucket.goal.savedSoFarCents = Math.round((parseFloat(savedSoFarEl.value) || 0) * 100);
            
            // Only update contribution if not in auto-calc mode
            if (!bucket.goal.autoCalc) {
                bucket.goal.contributionPerPeriodCents = Math.round((parseFloat(contributionEl.value) || 0) * 100);
            }
            
            updateSavingsSection(bucket, card);
            updateBucketTotal(bucket, card);
            updateDerivedValues();
            saveToCloud();
        }, 350);
        
        if (goalAmountEl) goalAmountEl.addEventListener('input', debouncedSavingsUpdate);
        if (goalDateEl) goalDateEl.addEventListener('change', debouncedSavingsUpdate);
        if (savedSoFarEl) savedSoFarEl.addEventListener('input', debouncedSavingsUpdate);
        if (contributionEl) contributionEl.addEventListener('input', debouncedSavingsUpdate);
        
        // Date chips functionality
        const dateChips = card.querySelectorAll('.date-chip');
        dateChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const months = parseInt(chip.dataset.months);
                const newDate = new Date();
                newDate.setMonth(newDate.getMonth() + months);
                goalDateEl.value = newDate.toISOString().split('T')[0];
                debouncedSavingsUpdate();
            });
        });
        
        // Auto-calc checkbox
        if (autoCalcEl) {
            autoCalcEl.addEventListener('change', () => {
                if (!bucket.goal) bucket.goal = {};
                bucket.goal.autoCalc = autoCalcEl.checked;
                
                if (bucket.goal.autoCalc) {
                    // Calculate the needed amount based on goal date
                    const goalAmount = bucket.goal.amountCents / 100 || 0;
                    const savedAmount = bucket.goal.savedSoFarCents / 100 || 0;
                    const remaining = Math.max(0, goalAmount - savedAmount);
                    
                    if (bucket.goal.targetDate && remaining > 0) {
                        const targetDate = new Date(bucket.goal.targetDate);
                        const now = new Date();
                        const msPerDay = 24 * 60 * 60 * 1000;
                        const daysRemaining = Math.max(1, Math.ceil((targetDate - now) / msPerDay));
                        
                        const freq = state.settings.incomeFrequency.toLowerCase();
                        let periodsRemaining;
                        switch (freq) {
                            case 'weekly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 7)); break;
                            case 'fortnightly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 14)); break;
                            case 'monthly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 30)); break;
                            case 'yearly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 365)); break;
                            default: periodsRemaining = 1;
                        }
                        
                        const neededPerPeriod = remaining / periodsRemaining;
                        bucket.goal.contributionPerPeriodCents = Math.round(neededPerPeriod * 100);
                    }
                }
                
                updateSavingsSection(bucket, card);
                updateBucketTotal(bucket, card);
                updateDerivedValues();
                saveToCloud();
            });
        }
        
        // Use amount button
        if (useAmountBtn) {
            useAmountBtn.addEventListener('click', () => {
                if (!bucket.goal) bucket.goal = {};
                
                const goalAmount = bucket.goal.amountCents / 100 || 0;
                const savedAmount = bucket.goal.savedSoFarCents / 100 || 0;
                const remaining = Math.max(0, goalAmount - savedAmount);
                
                if (bucket.goal.targetDate && remaining > 0) {
                    const targetDate = new Date(bucket.goal.targetDate);
                    const now = new Date();
                    const msPerDay = 24 * 60 * 60 * 1000;
                    const daysRemaining = Math.max(1, Math.ceil((targetDate - now) / msPerDay));
                    
                    const freq = state.settings.incomeFrequency.toLowerCase();
                    let periodsRemaining;
                    switch (freq) {
                        case 'weekly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 7)); break;
                        case 'fortnightly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 14)); break;
                        case 'monthly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 30)); break;
                        case 'yearly': periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 365)); break;
                        default: periodsRemaining = 1;
                    }
                    
                    const neededPerPeriod = remaining / periodsRemaining;
                    bucket.goal.contributionPerPeriodCents = Math.round(neededPerPeriod * 100);
                    contributionEl.value = Math.round(neededPerPeriod);
                    
                    updateSavingsSection(bucket, card);
                    updateBucketTotal(bucket, card);
                    updateDerivedValues();
                    saveToCloud();
                }
            });
        }
        
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
        let total;
        
        // For savings buckets, use contribution amount instead of items
        if (bucket.type === 'saving' && bucket.goal) {
            total = bucket.goal.contributionPerPeriodCents / 100;
        } else {
            total = sumIncludedItems(bucket);
        }
        
        const totalEl = bucketEl.querySelector('.bucket-total-value');
        if (totalEl) {
            totalEl.textContent = formatCurrency(total);
        }
        
        // Update header total (shown when collapsed)
        const headerTotal = bucketEl.querySelector('.bucket-header-total');
        if (headerTotal) {
            const freq = state.settings.incomeFrequency.toLowerCase();
            headerTotal.textContent = `${formatCurrency(total)} ${freq}`;
            
            // Show it if bucket is collapsed (default state)
            const isExpanded = bucketEl.querySelector('.bucket-toggle').getAttribute('aria-expanded') === 'true';
            headerTotal.style.display = isExpanded ? 'none' : 'inline';
        }
    }

    function deleteBucket(bucketId, section) {
        if (section === 'expenses') {
            state.expenses = state.expenses.filter(b => b.id !== bucketId);
        } else if (section === 'savings') {
            state.savings = state.savings.filter(b => b.id !== bucketId);
        } else if (section === 'debt') {
            state.debt = state.debt.filter(b => b.id !== bucketId);
        }
        
        renderBuckets();
        updateDerivedValues();
        saveToCloud();
    }

    function addNewBucket(section) {
        const newBucket = {
            id: generateId(),
            name: '',
            include: true,
            color: '#00cdd6',
            bankAccount: '',
            type: section === 'expenses' ? 'expense' : section === 'savings' ? 'saving' : 'debt',
            orderIndex: 0,
            notes: '',
            overspendThresholdPct: 80,
            spentThisPeriodCents: 0
        };
        
        // Add type-specific defaults
        if (newBucket.type === 'saving') {
            newBucket.goal = {
                amountCents: 0,
                targetDate: null,
                savedSoFarCents: 0,
                contributionPerPeriodCents: 0,
                autoCalc: false
            };
            // Initialize empty items array for savings buckets
            newBucket.items = [];
        } else {
            // Add items for expense and debt buckets
            newBucket.items = [{
                id: generateId(),
                name: '',
                amount: 0,
                include: true
            }];
            
            if (newBucket.type === 'debt') {
                newBucket.debt = {
                    aprPct: 0,
                    minPaymentCents: 0
                };
            }
        }
        
        if (section === 'expenses') {
            newBucket.orderIndex = state.expenses.length;
            state.expenses.push(newBucket);
        } else if (section === 'savings') {
            newBucket.orderIndex = state.savings.length;
            state.savings.push(newBucket);
        } else if (section === 'debt') {
            newBucket.orderIndex = (state.debt || []).length;
            state.debt = state.debt || [];
            state.debt.push(newBucket);
        }
        
        renderBuckets();
        updateDerivedValues();
        saveToCloud();
        
        // Focus the new bucket's name input and ensure it's expanded
        setTimeout(() => {
            const bucketEl = document.querySelector(`[data-bucket-id="${newBucket.id}"]`);
            if (bucketEl) {
                // Expand the new bucket
                const toggleBtn = bucketEl.querySelector('.bucket-toggle');
                const content = bucketEl.querySelector('.bucket-content');
                const toggleIcon = bucketEl.querySelector('.toggle-icon');
                const headerTotal = bucketEl.querySelector('.bucket-header-total');
                
                if (toggleBtn && content) {
                    content.style.display = 'block';
                    if (toggleIcon) toggleIcon.textContent = '▼';
                    toggleBtn.setAttribute('aria-expanded', 'true');
                    if (headerTotal) headerTotal.style.display = 'none';
                }
                
                // Focus the name input
                const nameInput = bucketEl.querySelector('.bucket-name');
                nameInput.focus();
                nameInput.select();
            }
        }, 0);
    }

    function renderBuckets() {
        const expensesContainer = document.getElementById('expensesList');
        const savingsContainer = document.getElementById('savingsList');
        const debtContainer = document.getElementById('debtList');
        
        if (!expensesContainer || !savingsContainer || !debtContainer) {
            console.warn('Cannot render buckets: containers not found in DOM');
            return;
        }
        
        // Store expanded state of existing buckets
        const expandedStates = {};
        document.querySelectorAll('.bucket-card[data-bucket-id]').forEach(card => {
            const bucketId = card.dataset.bucketId;
            const toggleBtn = card.querySelector('.bucket-toggle');
            if (toggleBtn) {
                expandedStates[bucketId] = toggleBtn.getAttribute('aria-expanded') === 'true';
            }
        });
        
        // Clear containers
        expensesContainer.innerHTML = '';
        savingsContainer.innerHTML = '';
        debtContainer.innerHTML = '';
        
        // Sort buckets by orderIndex
        const sortedExpenses = [...state.expenses].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        const sortedSavings = [...state.savings].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        const sortedDebt = [...(state.debt || [])].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        
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
        
        // Render debt
        if (sortedDebt.length === 0) {
            debtContainer.innerHTML = '<p class="empty-state">No debt — that\'s great!</p>';
        } else {
            sortedDebt.forEach(bucket => {
                const bucketEl = createBucketElement(bucket, 'debt');
                debtContainer.appendChild(bucketEl);
            });
        }
        
        // Wire up sortable after rendering
        wireSortable(expensesContainer);
        wireSortable(savingsContainer);
        wireSortable(debtContainer);
        
        // Restore expanded states
        Object.keys(expandedStates).forEach(bucketId => {
            const card = document.querySelector(`[data-bucket-id="${bucketId}"]`);
            if (card && expandedStates[bucketId]) {
                const toggleBtn = card.querySelector('.bucket-toggle');
                const content = card.querySelector('.bucket-content');
                const toggleIcon = card.querySelector('.toggle-icon');
                const headerTotal = card.querySelector('.bucket-header-total');
                
                if (toggleBtn && content) {
                    content.style.display = 'block';
                    if (toggleIcon) toggleIcon.textContent = '▼';
                    toggleBtn.setAttribute('aria-expanded', 'true');
                    if (headerTotal) headerTotal.style.display = 'none';
                }
            }
        });
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
                savings: state.savings,
                debt: state.debt
            });
        } catch (error) {
            console.error('Failed to save to cloud:', error);
        }
    }

    function loadTemplatesForNewUser() {
        // Pre-made templates for common expenses
        state.expenses = [
            {
                id: generateId(),
                name: 'Housing',
                items: [
                    { id: generateId(), name: 'Rent/Mortgage', amount: 0, include: true },
                    { id: generateId(), name: 'Utilities', amount: 0, include: true },
                    { id: generateId(), name: 'Internet', amount: 0, include: true }
                ],
                include: true,
                color: '#00cdd6',
                bankAccount: '',
                type: 'expense',
                orderIndex: 0,
                notes: '',
                overspendThresholdPct: 80,
                spentThisPeriodCents: 0
            },
            {
                id: generateId(),
                name: 'Transport',
                items: [
                    { id: generateId(), name: 'Fuel/Public Transport', amount: 0, include: true },
                    { id: generateId(), name: 'Car Insurance', amount: 0, include: true },
                    { id: generateId(), name: 'Registration', amount: 0, include: true }
                ],
                include: true,
                color: '#00cdd6',
                bankAccount: '',
                type: 'expense',
                orderIndex: 1,
                notes: '',
                overspendThresholdPct: 80,
                spentThisPeriodCents: 0
            },
            {
                id: generateId(),
                name: 'Groceries',
                items: [
                    { id: generateId(), name: 'Weekly Shop', amount: 0, include: true }
                ],
                include: true,
                color: '#00cdd6',
                bankAccount: '',
                type: 'expense',
                orderIndex: 2,
                notes: '',
                overspendThresholdPct: 80,
                spentThisPeriodCents: 0
            },
            {
                id: generateId(),
                name: 'Personal',
                items: [
                    { id: generateId(), name: 'Phone', amount: 0, include: true },
                    { id: generateId(), name: 'Subscriptions', amount: 0, include: true },
                    { id: generateId(), name: 'Entertainment', amount: 0, include: true }
                ],
                include: true,
                color: '#00cdd6',
                bankAccount: '',
                type: 'expense',
                orderIndex: 3,
                notes: '',
                overspendThresholdPct: 80,
                spentThisPeriodCents: 0
            }
        ];
        
        state.savings = [
            {
                id: generateId(),
                name: 'Emergency Fund',
                include: true,
                color: '#00cdd6',
                bankAccount: '',
                type: 'saving',
                orderIndex: 0,
                notes: 'Aim for 3-6 months of expenses',
                overspendThresholdPct: 80,
                spentThisPeriodCents: 0,
                goal: {
                    amountCents: 1000000, // $10,000
                    targetDate: null,
                    savedSoFarCents: 0,
                    contributionPerPeriodCents: 20000, // $200
                    autoCalc: false
                }
            }
        ];
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
                if (currentBudget.debt) {
                    state.debt = currentBudget.debt;
                }
                
                // Run migration if needed
                await migrateBucketsIfNeeded(currentBudgetId);
                
                updateUI();
            } else {
                // New user - load templates
                loadTemplatesForNewUser();
                
                // Create a new budget
                const newBudget = await cloudStore.createBudget(currentUser.uid, {
                    name: 'My Budget',
                    settings: state.settings,
                    expenses: state.expenses,
                    savings: state.savings,
                    debt: state.debt
                });
                currentBudgetId = newBudget.id;
                
                updateUI();
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

    // Theme management
    function setTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    // Event listeners for settings
    function initializeEventListeners() {
        console.log('Initializing event listeners...');
        
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            // Load saved theme or default to dark
            const savedTheme = localStorage.getItem('theme') || 'dark';
            setTheme(savedTheme);
            
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                setTheme(newTheme);
                localStorage.setItem('theme', newTheme);
            });
        }
        
        // Settings accordion
        const settingsToggle = document.querySelector('.settings-toggle');
        if (settingsToggle) {
            settingsToggle.addEventListener('click', () => {
                const content = document.querySelector('.settings-content');
                const isExpanded = settingsToggle.getAttribute('aria-expanded') === 'true';
                
                content.style.display = isExpanded ? 'none' : 'block';
                settingsToggle.setAttribute('aria-expanded', !isExpanded);
            });
        }
        
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
                state.debt = [];
                
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
                include: true,
                color: '#5eead4',
                bankAccount: 'Savings Account',
                type: 'saving',
                orderIndex: 0,
                notes: 'Building emergency fund',
                overspendThresholdPct: 80,
                spentThisPeriodCents: 0,
                goal: {
                    amountCents: 2000000, // $20,000
                    targetDate: '2025-12-31',
                    savedSoFarCents: 500000, // $5,000 already saved
                    contributionPerPeriodCents: 30000, // $300 per period
                    autoCalc: false
                }
            }
        ];
        
        state.debt = [
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
                orderIndex: 0,
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

    // Update button visibility based on authentication state
    function updateButtonVisibility() {
        const isLoggedIn = !!currentUser;
        
        // Buttons to hide when logged in
        const buttonsToHide = [
            'loadDemoBtn',
            'importBtn', 
            'exportBtn',
            'themeToggle'
        ];
        
        buttonsToHide.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.style.display = isLoggedIn ? 'none' : '';
            }
        });
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
            // Show loading message for bucket data
            if (window.authGuard) {
                window.authGuard.showAuthLoading('Loading your budget data...');
            }
            
            document.getElementById('userInfo').textContent = `Signed in as ${currentUser.email}`;
            await loadFromCloud();
            
            // Hide loading overlay after buckets are loaded
            if (window.authGuard) {
                window.authGuard.hideAuthLoading();
            }
        }
        
        // Update button visibility based on auth state
        updateButtonVisibility();
        
        initializeEventListeners();
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