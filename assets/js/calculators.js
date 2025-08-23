// Calculators page JavaScript
document.addEventListener('DOMContentLoaded', () => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  
  // Tab switching
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      $$('.tab').forEach(t => t.setAttribute('aria-selected', 'false'));
      $$('[role="tabpanel"]').forEach(p => p.hidden = true);
      this.setAttribute('aria-selected', 'true');
      const targetPanel = $(this.getAttribute('aria-controls'));
      if (targetPanel) {
        targetPanel.hidden = false;
      }
    });
  });

  // ---------- Budget Calculator ----------
  let state = JSON.parse(localStorage.getItem('budgetCalcState') || '{}');
  state = Object.assign({ freq: 'fortnightly', income: 0, curr: 'AUD', items: [] }, state);
  
  const bc = {
    income: $('#bc-income'), freq: $('#bc-freq'), curr: $('#bc-curr'), add: $('#bc-add'), clear: $('#bc-clear'),
    table: $('#bc-table tbody'), freqLabel: $('#bc-freq-label'), freqLabel2: $('#bc-freq-label-2'),
    leftoverFreq: $('#bc-leftover-freq'),
    out: {
      incW: $('#bc-inc-w'), incF: $('#bc-inc-f'), incM: $('#bc-inc-m'), incY: $('#bc-inc-y'),
      expW: $('#bc-exp-w'), expF: $('#bc-exp-f'), expM: $('#bc-exp-m'), expY: $('#bc-exp-y'),
      leftover: $('#bc-leftover'), note: $('#bc-leftover-note')
    }
  };

  // Initialize state from localStorage (with safety checks)
  if (bc.income) bc.income.value = state.income || 0;
  if (bc.freq) bc.freq.value = state.freq || 'fortnightly';
  if (bc.curr) bc.curr.value = state.curr || 'AUD';

  const FREQ = {
    weekly: { perMonth: 52/12 },
    fortnightly: { perMonth: 26/12 },
    monthly: { perMonth: 1 },
    yearly: { perMonth: 1/12 }
  };

  function saveState(s) {
    localStorage.setItem('budgetCalcState', JSON.stringify(s));
  }

  function fmt(v, c) {
    const locale = c === 'AUD' ? 'en-AU' : c === 'USD' ? 'en-US' : c === 'GBP' ? 'en-GB' : c === 'NZD' ? 'en-NZ' : 'en-AU';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: c }).format(isFinite(v) ? v : 0);
  }

  function addRow(data = {}) {
    if (!bc.table) return; // Safety check
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="table-input" placeholder="e.g. Groceries" value="${data.name || ''}" /></td>
      <td class="right"><input type="number" class="table-input number-input" min="0" step="0.01" placeholder="0.00" value="${data.amount || ''}" /></td>
      <td class="right"><button class="remove-row-btn" style="background:transparent;border:1px solid var(--border);color:var(--text);padding:2px 6px;border-radius:4px;cursor:pointer">×</button></td>
    `;
    bc.table.appendChild(tr);
    
    // Add event listeners
    tr.querySelector('input[type="text"]').addEventListener('input', () => { syncFromUI(); render(); });
    tr.querySelector('input[type="number"]').addEventListener('input', () => { syncFromUI(); render(); });
    tr.querySelector('.remove-row-btn').addEventListener('click', () => {
      tr.remove();
      syncFromUI();
      render();
    });
  }

  function syncFromUI() {
    const items = [...bc.table.querySelectorAll('tr')].map(tr => {
      const [nameEl, amtEl] = tr.querySelectorAll('input');
      if (!nameEl || !amtEl) return null; // Skip if inputs not found
      const amount = parseFloat(amtEl.value || '0');
      return { name: nameEl.value.trim(), amount: isFinite(amount) && amount > 0 ? amount : 0 };
    }).filter(item => item !== null); // Remove null items
    state = { income: parseFloat(bc.income.value || '0'), freq: bc.freq.value, curr: bc.curr.value, items };
    saveState(state);
  }

  function convertAll(baseVal, baseFreq) {
    const f = FREQ[baseFreq];
    const monthly = baseVal * f.perMonth;
    const weekly = monthly * (12/52);
    const fortnightly = monthly * (12/26);
    const yearly = monthly * 12;
    return { weekly, fortnightly, monthly, yearly };
  }

  function calcTotals() {
    const inc = parseFloat(bc.income.value || '0') || 0;
    const expBase = state.items.reduce((s, i) => s + (i.amount || 0), 0);
    const income = convertAll(inc, state.freq);
    const expenses = convertAll(expBase, state.freq);
    return { income, expenses };
  }

  function render() {
    bc.freqLabel.textContent = bc.freq.value;
    bc.freqLabel2.textContent = bc.freq.value.charAt(0).toUpperCase() + bc.freq.value.slice(1);
    const { income, expenses } = calcTotals();
    const curr = bc.curr.value;
    bc.out.incW.textContent = fmt(income.weekly, curr);
    bc.out.incF.textContent = fmt(income.fortnightly, curr);
    bc.out.incM.textContent = fmt(income.monthly, curr);
    bc.out.incY.textContent = fmt(income.yearly, curr);
    bc.out.expW.textContent = fmt(expenses.weekly, curr);
    bc.out.expF.textContent = fmt(expenses.fortnightly, curr);
    bc.out.expM.textContent = fmt(expenses.monthly, curr);
    bc.out.expY.textContent = fmt(expenses.yearly, curr);
    
    const leftover = income.monthly - expenses.monthly;
    const freqKey = state.freq;
    const leftoverByFreq = income[freqKey] - expenses[freqKey];
    bc.leftoverFreq.textContent = freqKey.charAt(0).toUpperCase() + freqKey.slice(1);
    bc.out.leftover.textContent = fmt(leftoverByFreq, curr);
    bc.out.leftover.style.color = leftoverByFreq < 0 ? '#ff6b6b' : '#5eead4';
    bc.out.note.textContent = leftoverByFreq < 0 ? 'Budget deficit' : 'Budget surplus';
    
    const savingsRate = income.monthly > 0 ? (leftover / income.monthly * 100) : 0;
    if (!$('#bc-leftover-pct')) {
      const pctDiv = document.createElement('div');
      pctDiv.id = 'bc-leftover-pct';
      pctDiv.className = 'help';
      pctDiv.style.marginTop = '4px';
      bc.out.note.parentNode.appendChild(pctDiv);
    }
    $('#bc-leftover-pct').textContent = income.monthly > 0 ? `Savings rate: ${savingsRate.toFixed(1)}%` : '';
  }

  // Preset templates
  const presets = {
    student: [
      { name: 'Rent/Accommodation', amount: 800 },
      { name: 'Groceries', amount: 150 },
      { name: 'Transport', amount: 50 },
      { name: 'Phone/Internet', amount: 40 },
      { name: 'Entertainment', amount: 50 }
    ],
    family: [
      { name: 'Mortgage/Rent', amount: 1800 },
      { name: 'Groceries', amount: 400 },
      { name: 'Utilities', amount: 150 },
      { name: 'Insurance', amount: 200 },
      { name: 'Transport', amount: 150 },
      { name: 'Childcare', amount: 500 }
    ],
    single: [
      { name: 'Rent', amount: 1200 },
      { name: 'Groceries', amount: 200 },
      { name: 'Utilities', amount: 80 },
      { name: 'Transport', amount: 100 },
      { name: 'Phone/Internet', amount: 60 },
      { name: 'Entertainment', amount: 150 }
    ]
  };

  // Initialize rows
  if (!state.items?.length) {
    addRow({ name: 'Rent', amount: 0 });
    addRow({ name: 'Groceries', amount: 0 });
  } else {
    state.items.forEach(addRow);
  }

  // Events
  bc.add.addEventListener('click', () => { addRow(); });
  bc.clear.addEventListener('click', () => {
    state = { freq: 'fortnightly', income: 0, curr: bc.curr.value, items: [] };
    bc.income.value = 0;
    bc.freq.value = 'fortnightly';
    bc.table.innerHTML = '';
    addRow();
    addRow();
    syncFromUI();
    render();
  });
  bc.income.addEventListener('input', () => { syncFromUI(); render(); });
  bc.freq.addEventListener('change', () => { syncFromUI(); render(); });
  bc.curr.addEventListener('change', () => { syncFromUI(); render(); });
  
  $('#bc-preset').addEventListener('click', () => {
    const choice = prompt('Choose a preset:\n1. Student\n2. Family\n3. Single Professional\n\nEnter 1, 2, or 3:');
    const presetMap = { '1': 'student', '2': 'family', '3': 'single' };
    const preset = presets[presetMap[choice]];
    if (preset) {
      bc.table.innerHTML = '';
      preset.forEach(item => addRow(item));
      syncFromUI();
      render();
    }
  });

  syncFromUI();
  render();

  // ---------- Savings Calculator ----------
  const sc = {
    balance: $('#sc-balance'), contrib: $('#sc-contrib'), freq: $('#sc-freq'), rate: $('#sc-rate'), target: $('#sc-target'),
    curr: $('#sc-curr'), income: $('#sc-income'), incfreq: $('#sc-incfreq'), calc: $('#sc-calc'), clear: $('#sc-clear'),
    out: { cm: $('#sc-cm'), months: $('#sc-months'), date: $('#sc-date'), ratepct: $('#sc-ratepct'), note: $('#sc-note') }
  };

  function toMonthly(amount, freq) {
    if (!isFinite(amount) || amount <= 0) return 0;
    switch (freq) {
      case 'weekly': return amount * 52/12;
      case 'fortnightly': return amount * 26/12;
      case 'monthly': return amount;
      case 'yearly': return amount / 12;
    }
    return amount;
  }

  function monthsToGoal(P0, cMonthly, annualRate, target) {
    const r = Math.pow(1 + (annualRate/100), 1/12) - 1;
    if (!isFinite(P0)) P0 = 0;
    if (!isFinite(cMonthly)) cMonthly = 0;
    if (!isFinite(target)) target = 0;
    if (target <= P0) return 0;
    if (r <= 0) {
      if (cMonthly <= 0) return Infinity;
      return Math.ceil((target - P0) / cMonthly);
    }
    const numerator = cMonthly + r*P0;
    const denom = cMonthly + r*P0 - r*target;
    if (denom <= 0) return Infinity;
    const n = Math.log(numerator/denom) / Math.log(1+r);
    return Math.ceil(Math.max(0, n));
  }

  const fmtMoney = (v, c) => {
    const locale = c === 'AUD' ? 'en-AU' : c === 'USD' ? 'en-US' : c === 'GBP' ? 'en-GB' : c === 'NZD' ? 'en-NZ' : 'en-AU';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: c }).format(isFinite(v) ? v : 0);
  };
  const fmtPct = v => isFinite(v) ? (v.toFixed(1) + '%') : '—';

  function runSavings() {
    const P0 = parseFloat(sc.balance.value || '0') || 0;
    const contrib = parseFloat(sc.contrib.value || '0') || 0;
    const cMonthly = toMonthly(contrib, sc.freq.value);
    const rate = parseFloat(sc.rate.value || '0') || 0;
    const target = parseFloat(sc.target.value || '0') || 0;
    const months = monthsToGoal(P0, cMonthly, rate, target);
    
    sc.out.cm.textContent = fmtMoney(cMonthly, sc.curr.value);
    sc.out.months.textContent = months === Infinity ? '—' : String(months);
    
    if (months === Infinity) {
      sc.out.date.textContent = 'Unreachable with current inputs';
      sc.out.note.innerHTML = 'Increase contribution or reduce target. If annual return is 0%, we use linear maths.';
    } else {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      sc.out.date.textContent = d.toLocaleDateString('en-AU', { year: 'numeric', month: 'long' });
    }
    
    // Savings rate (optional)
    const inc = parseFloat(sc.income.value || '0') || 0;
    const incMonthly = inc > 0 ? toMonthly(inc, sc.incfreq.value) : 0;
    const ratePct = incMonthly > 0 ? (cMonthly / incMonthly * 100) : NaN;
    sc.out.ratepct.textContent = isFinite(ratePct) ? fmtPct(ratePct) : '—';
  }

  // Auto-calculate on input changes
  [sc.balance, sc.contrib, sc.target, sc.rate, sc.income].forEach(input => {
    input.addEventListener('input', runSavings);
  });
  [sc.freq, sc.curr, sc.incfreq].forEach(select => {
    select.addEventListener('change', runSavings);
  });
  
  sc.calc.addEventListener('click', runSavings);
  sc.clear.addEventListener('click', () => {
    sc.balance.value = '';
    sc.contrib.value = '';
    sc.rate.value = '0';
    sc.target.value = '';
    sc.income.value = '';
    sc.freq.value = 'fortnightly';
    sc.incfreq.value = 'fortnightly';
    sc.curr.value = 'AUD';
    runSavings();
  });
  
  // Initial calculation
  runSavings();
});