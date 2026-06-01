import { translations } from './i18n.js';
import { getBankAccounts } from './storage.js';

let incomeVsExpenseChart = null;
let spendingCategoryChart = null;
let _activePreset = 'month'; // track which preset is selected

export function getCurrency() {
    return localStorage.getItem('wimm_currency') || 'IDR';
}

export function formatCurrency(amount) {
    const currencyCode = getCurrency();
    const locales = {
        'USD': 'en-US', 'IDR': 'id-ID', 'EUR': 'de-DE',
        'GBP': 'en-GB', 'JPY': 'ja-JP', 'AUD': 'en-AU',
        'CAD': 'en-CA', 'SGD': 'en-SG'
    };
    return new Intl.NumberFormat(locales[currencyCode] || 'id-ID', {
        style: 'currency', currency: currencyCode,
        minimumFractionDigits: (currencyCode === 'IDR' || currencyCode === 'JPY') ? 0 : 2,
        maximumFractionDigits: (currencyCode === 'IDR' || currencyCode === 'JPY') ? 0 : 2
    }).format(amount || 0);
}

function el(id) { return document.getElementById(id); }
function setText(id, value) { const e = el(id); if (e) e.innerText = value; }

// ── Date range state ────────────────────────────────────────────────────────
function toYMD(date) {
    return date.toISOString().split('T')[0];
}

function setPreset(preset) {
    _activePreset = preset;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start, end;
    end = today;

    switch (preset) {
        case 'today':
            start = new Date(today);
            break;
        case 'week': {
            start = new Date(today);
            start.setDate(today.getDate() - today.getDay());
            break;
        }
        case 'month':
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case 'year':
            start = new Date(today.getFullYear(), 0, 1);
            break;
        case 'all':
        default:
            start = new Date(2000, 0, 1);
            end = new Date(2099, 11, 31);
            break;
    }

    const startEl = el('dash-date-start');
    const endEl = el('dash-date-end');
    if (startEl) startEl.value = toYMD(start);
    if (endEl) endEl.value = toYMD(end);

    // Highlight active preset button
    document.querySelectorAll('.dash-preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === preset);
        btn.style.background = btn.dataset.preset === preset ? 'var(--primary)' : '';
        btn.style.color = btn.dataset.preset === preset ? '#fff' : '';
        btn.style.borderColor = btn.dataset.preset === preset ? 'var(--primary)' : '';
    });
}

// Determine bar-chart grouping from the active preset
function getChartGrouping() {
    switch (_activePreset) {
        case 'today':
        case 'week':   return 'daily';
        case 'month':  return 'weekly';
        case 'year':
        case 'all':    return 'monthly';
        default:       return 'weekly';   // custom date range
    }
}

function getDateRange() {
    const startEl = el('dash-date-start');
    const endEl = el('dash-date-end');
    const start = startEl && startEl.value ? new Date(startEl.value) : new Date(2000, 0, 1);
    const end = endEl && endEl.value ? new Date(endEl.value) : new Date(2099, 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function formatDateRange(start, end) {
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    if (start.getFullYear() === 2000 && end.getFullYear() === 2099) return 'All Time';
    return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
}

// ── Bootstrap date pickers ──────────────────────────────────────────────────
export function initDashboardDatePicker(onChangeCb) {
    // Set default to "This Month"
    setPreset('month');

    document.querySelectorAll('.dash-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setPreset(btn.dataset.preset);
            onChangeCb();
        });
    });

    ['dash-date-start', 'dash-date-end'].forEach(id => {
        const input = el(id);
        if (input) {
            input.addEventListener('change', () => {
                // Custom range – clear preset highlight, mark as 'custom'
                _activePreset = 'custom';
                document.querySelectorAll('.dash-preset-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '';
                    b.style.color = '';
                    b.style.borderColor = '';
                });
                onChangeCb();
            });
        }
    });
}

// ── Main render ─────────────────────────────────────────────────────────────
export function renderDashboard(allTransactions) {
    const { start, end } = getDateRange();

    // Filter transactions to the selected date range
    const transactions = allTransactions.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
    });

    const rangeLabel = formatDateRange(start, end);

    // Update labels
    setText('subtext-income', rangeLabel);
    setText('subtext-outcome', rangeLabel);
    setText('subtext-count', rangeLabel.toLowerCase());

    // ── Compute timeframe totals ─────────────────────────────────────────
    let income = 0, outcome = 0;
    let largestExpenseAmt = 0, largestExpenseName = 'None';
    const usageData = {};

    transactions.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') {
            income += amt;
        } else if (t.type === 'expense') {
            outcome += amt;
            usageData[t.category] = (usageData[t.category] || 0) + amt;
            if (amt > largestExpenseAmt) {
                largestExpenseAmt = amt;
                largestExpenseName = t.description || t.category;
            }
        }
    });

    // ── Daily avg spend: expense in selected range ÷ days in range ──────
    const msPerDay = 1000 * 60 * 60 * 24;
    const today = new Date();
    // Cap end to today so future ranges don't inflate the denominator
    const effectiveEnd = end > today ? today : end;
    const daysInRange = Math.max(1, Math.round((effectiveEnd - start) / msPerDay) + 1);
    const avgSpend = outcome / daysInRange;

    // ── Net Balance = ALL TIME income − ALL TIME expense ─
    let totalAllTimeIncome = 0, totalAllTimeOutcome = 0;
    allTransactions.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') totalAllTimeIncome += amt;
        else if (t.type === 'expense') totalAllTimeOutcome += amt;
    });
    const netBalance = totalAllTimeIncome - totalAllTimeOutcome;

    // ── Update stat cards ────────────────────────────────────────────────
    setText('val-income', formatCurrency(income));
    setText('val-outcome', formatCurrency(outcome));
    setText('val-netbalance', formatCurrency(netBalance));

    const savingsRate = income > 0 ? Math.max(0, Math.round(((income - outcome) / income) * 100)) : 0;
    setText('val-savings', `${savingsRate}%`);

    setText('val-largest-exp', largestExpenseName !== 'None'
        ? `${largestExpenseName} — ${formatCurrency(largestExpenseAmt)}`
        : 'None');

    // Daily avg: expense ÷ days in selected range
    setText('val-avg-spend', formatCurrency(avgSpend));
    setText('subtext-avg', `avg/day over ${daysInRange} day${daysInRange !== 1 ? 's' : ''}`);
    setText('val-count', transactions.length);

    // ── Recent transactions mini-ledger ──────────────────────────────────
    const ledgerBody = el('ledger-body');
    if (ledgerBody) {
        ledgerBody.innerHTML = '';
        const recent = [...allTransactions]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (recent.length === 0) {
            ledgerBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text-muted)">No transactions yet</td></tr>`;
        } else {
            recent.forEach(t => {
                const tr = document.createElement('tr');
                const amtClass = t.type === 'income' ? 'text-success' : 'text-danger';
                const sign = t.type === 'income' ? '+' : '-';
                tr.innerHTML = `
                    <td>${t.date}</td>
                    <td>${t.description || '-'}</td>
                    <td><span style="background:var(--neutral-light);padding:4px 8px;border-radius:4px;font-size:.75rem">${t.category || '-'}</span></td>
                    <td class="${amtClass}" style="font-weight:600">${sign}${formatCurrency(t.amount)}</td>
                `;
                ledgerBody.appendChild(tr);
            });
        }
    }

    // ── Charts ───────────────────────────────────────────
    if (typeof Chart !== 'undefined') {
        renderCharts(transactions, usageData, rangeLabel, start, end);
    }

    return { income, outcome, netBalance };
}

function renderCharts(transactions, usageData, rangeLabel, start, end) {
    // Update period labels on both chart cards
    setText('chart-bar-period', rangeLabel);
    setText('chart-donut-period', rangeLabel);

    // ── Bar chart: group by day / week / month based on active preset ────────
    const ctxBar = el('incomeVsExpenseChart');
    if (incomeVsExpenseChart) { incomeVsExpenseChart.destroy(); incomeVsExpenseChart = null; }

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const grouping = getChartGrouping();

    // Helper: get ISO week number (Mon-based)
    function getWeekNum(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    }

    // Get the Monday of a week
    function weekStart(d) {
        const day = new Date(d);
        const dow = day.getDay() || 7;          // Sun=7
        day.setDate(day.getDate() - (dow - 1)); // back to Monday
        return day;
    }

    const buckets = {};

    transactions.forEach(t => {
        const d = new Date(t.date);
        let key, label;

        if (grouping === 'daily') {
            key = toYMD(d);
            label = `${d.getDate()} ${monthNames[d.getMonth()]}`;
        } else if (grouping === 'weekly') {
            const ws = weekStart(d);
            key = toYMD(ws);
            label = `W${getWeekNum(d)} (${ws.getDate()} ${monthNames[ws.getMonth()]})`;
        } else {
            // monthly
            key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
            label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        }

        if (!buckets[key]) buckets[key] = { label, income: 0, expense: 0 };
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') buckets[key].income += amt;
        else if (t.type === 'expense') buckets[key].expense += amt;
    });

    // If no transactions, show a single empty bucket for today
    if (Object.keys(buckets).length === 0) {
        const now = new Date();
        const key = toYMD(now);
        buckets[key] = { label: `${now.getDate()} ${monthNames[now.getMonth()]}`, income: 0, expense: 0 };
    }

    const sortedKeys = Object.keys(buckets).sort();
    const groupLabel = grouping === 'daily' ? 'Daily' : grouping === 'weekly' ? 'Weekly' : 'Monthly';
    setText('chart-bar-period', `${rangeLabel} · ${groupLabel}`);

    if (ctxBar) {
        incomeVsExpenseChart = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: sortedKeys.map(k => buckets[k].label),
                datasets: [
                    { label: 'Income',  data: sortedKeys.map(k => buckets[k].income),  backgroundColor: 'rgba(16,185,129,0.85)', borderRadius: 6, barPercentage: 0.6 },
                    { label: 'Expense', data: sortedKeys.map(k => buckets[k].expense), backgroundColor: 'rgba(239,68,68,0.85)',  borderRadius: 6, barPercentage: 0.6 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6, font: { family: 'Inter', size: 12 } } },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { callback: v => formatCurrency(v) } },
                    x: { grid: { display: false }, border: { display: false } }
                }
            }
        });
    }

    // ── Donut: Spending by category ──────────────────────────────────
    const ctxDonut = el('spendingCategoryChart');
    if (spendingCategoryChart) { spendingCategoryChart.destroy(); spendingCategoryChart = null; }

    const uLabels = Object.keys(usageData).sort((a, b) => usageData[b] - usageData[a]);
    const uValues = uLabels.map(k => usageData[k]);
    const palette = ['#6366F1','#EC4899','#10B981','#F59E0B','#3B82F6','#8B5CF6','#F97316','#06B6D4','#84CC16','#EF4444'];

    if (ctxDonut) {
        spendingCategoryChart = new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels: uLabels.length ? uLabels : ['No expenses'],
                datasets: [{
                    data: uValues.length ? uValues : [1],
                    backgroundColor: uValues.length ? uLabels.map((_, i) => palette[i % palette.length]) : ['#e5e7eb'],
                    borderWidth: 2, borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 11 } } },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatCurrency(ctx.parsed)}` } }
                }
            }
        });
    }
}
