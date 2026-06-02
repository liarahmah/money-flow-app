import { 
    setStorageMode, getCategories, saveCategories, addCategories, addTransaction, addMultipleTransactions, listenToTransactions, 
    editTransaction, deleteTransaction, bulkDeleteTransactions, bulkEditTransactions, getBankAccounts, saveBankAccounts, addBankAccounts,
    getSubscriptions, addSubscription, deleteSubscription,
    getDebts, addDebt, updateDebt, deleteDebt, initialLoadFromBackend
} from './storage.js';
import { loginGoogle, logoutGoogle, isGoogleLoggedIn } from './gdrive.js';
import { getQuoteForState, updateQuoteUI } from './quotes.js';
import { applyLanguage, translations } from './i18n.js';
import { renderDashboard, formatCurrency, initDashboardDatePicker } from './dashboard.js';

// DOM Elements
const appContainer = document.getElementById('app-container');

const transactionModal = document.getElementById('transaction-modal');
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLoginOffline = document.getElementById('btn-login-offline');
const btnCloseTrans = document.getElementById('btn-close-transaction');
const bulkEditModal = document.getElementById('bulk-edit-modal');
const btnCloseBulkEdit = document.getElementById('btn-close-bulk-edit');
const btnCancelBulkEdit = document.getElementById('btn-cancel-bulk-edit');
const formBulkEdit = document.getElementById('form-bulk-edit');
const bulkEditCategory = document.getElementById('bulk-edit-category');
const bulkEditAccount = document.getElementById('bulk-edit-account');
const btnSettings = document.querySelector('.nav-item[data-target="view-settings"]');
const btnLogout = document.getElementById('btn-logout');

// Sidebar Elements
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('main-content');
const btnHideSidebar = document.getElementById('btn-hide-sidebar');
const btnShowSidebar = document.getElementById('btn-show-sidebar');

// Theme Elements
const selectTheme = document.getElementById('select-theme');
const themeSubtitle = document.getElementById('theme-subtitle');

// Localization Elements
const selectCurrency = document.getElementById('select-currency');

// Navigation Elements
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');
const dashboardTimeframe = document.getElementById('dashboard-timeframe');

// Categories & Accounts Elements
const categoriesListUl = document.getElementById('categories-list-ul');
const inputNewCategory = document.getElementById('input-new-category');
const btnAddCategory = document.getElementById('btn-add-category');
const datalistCategories = document.getElementById('categories-list');
const datalistAccounts = document.getElementById('accounts-list');

// Import Elements
const inputCsvFile = document.getElementById('input-csv-file');
const btnImportCsvIcon = document.getElementById('btn-import-csv-icon');

// Transactions Ledger Elements
const filterSearch = document.getElementById('filter-search');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const catFilterMonth = document.getElementById('cat-filter-month');
const filterMonth = document.getElementById('filter-month');
const fullLedgerBody = document.getElementById('full-ledger-body');
const btnPrevPage = document.getElementById('btn-prev-page');
const btnNextPage = document.getElementById('btn-next-page');
const paginationInfo = document.getElementById('pagination-info');
const paginationPageDisplay = document.getElementById('pagination-page-display');
const selectItemsPerPage = document.getElementById('select-items-per-page');
const checkAllTx = document.getElementById('check-all-tx');
const btnBulkDelete = document.getElementById('btn-bulk-delete');
const btnBulkEdit = document.getElementById('btn-bulk-edit');

// Bank Accounts Elements
const bankCardsContainer = document.getElementById('bank-cards-container');
const inputNewBank = document.getElementById('input-new-bank');
const btnAddBank = document.getElementById('btn-add-bank');
const filterBankDateRange = document.getElementById('filter-bank-daterange');

// Calendar Elements
const btnPrevMonth = document.getElementById('btn-prev-month');
const btnNextMonth = document.getElementById('btn-next-month');
const selectCalendarMonth = document.getElementById('select-calendar-month');
const selectCalendarYear = document.getElementById('select-calendar-year');
const calendarGrid = document.getElementById('calendar-grid');
const panelDailyTitle = document.getElementById('panel-daily-title');
const panelDailySubtitle = document.getElementById('panel-daily-subtitle');
const panelDailySummary = document.getElementById('panel-daily-summary');
const panelDailyIncome = document.getElementById('panel-daily-income');
const panelDailyExpense = document.getElementById('panel-daily-expense');
const dailyDetailsTable = document.getElementById('daily-details-table');
const dailyDetailsTbody = document.getElementById('daily-details-tbody');
const dailyDetailsEmpty = document.getElementById('daily-details-empty');
const btnToday = document.getElementById('btn-today');

// Transaction Form Elements
const formTransaction = document.getElementById('form-transaction');

// State
let transactionsList = [];
let dataListener = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Hide main app container initially if not logged in
    // However, google api loads asynchronously.
});

window.addEventListener('google_api_ready', async () => {
    // API is loaded, check if we need to show login
    if (!isGoogleLoggedIn()) {
        document.getElementById('login-overlay').classList.remove('hidden');
    } else {
        document.getElementById('login-overlay').classList.add('hidden');
        startApp('google');
        await initialLoadFromBackend();
    }
});

const btnGoogleLogin = document.getElementById('btn-google-login');
if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', async () => {
        try {
            document.getElementById('login-error-msg').style.display = 'none';
            await loginGoogle();
            document.getElementById('login-overlay').classList.add('hidden');
            startApp('google');
            await initialLoadFromBackend();
        } catch (err) {
            console.error(err);
            document.getElementById('login-error-msg').innerText = "Login 
                failed: " + (err.message || JSON.stringify(err));
            document.getElementById('login-error-msg').style.display = 
                'block';
        }
    });
}

// Ledger State
let ledgerCurrentPage = 1;
let ledgerItemsPerPage = 25;
let ledgerSelectedIds = new Set();

// Subscriptions Elements
const subscriptionsList = document.getElementById('subscriptions-list');
const modalAddSubscription = document.getElementById('modal-add-subscription');
const formSubscription = document.getElementById('form-subscription');
const formDebt = document.getElementById('form-debt');
const debtsList = document.getElementById('debts-list');
const btnAddSubscriptionModal = document.getElementById('btn-add-subscription-modal');
const valSubscriptionsMo = document.getElementById('val-subscriptions');

// Budgets Elements
const budgetFilterMonth = document.getElementById('budget-filter-month');
const budgetsContainer = document.getElementById('budgets-container');
const budgetsSummaryContainer = document.getElementById('budgets-summary-container');

// Calendar State
let calendarDate = new Date();
let selectedCalendarDate = null; // store day (1-31)

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCalendarSelectors();
    startApp('offline');
});

function initCalendarSelectors() {
    if (selectCalendarMonth) {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        months.forEach((m, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = m;
            selectCalendarMonth.appendChild(opt);
        });
    }
    
    if (selectCalendarYear) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 5; y <= currentYear + 5; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            selectCalendarYear.appendChild(opt);
        }
    }
}

// App flow
function startApp(mode, userId = null) {
    setStorageMode(mode, userId);

    appContainer.classList.remove('hidden');
    
    if (mode === 'offline') {
        localStorage.setItem('wimm_offline_mode', 'true');
    } else {
        localStorage.removeItem('wimm_offline_mode');
    }

    if (dataListener) dataListener(); 
    
    dataListener = listenToTransactions((data) => {
        transactionsList = data;
        
        // Update Dashboard
        const { income, outcome, netBalance } = renderDashboard(transactionsList);
        updateQuoteUI(netBalance, income, outcome);
        // Update Calendar summary if present
        const calIncomeEl = document.getElementById('val-income-calendar');
        const calOutcomeEl = document.getElementById('val-outcome-calendar');
        const calNetEl = document.getElementById('val-netbalance-calendar');
        if (calIncomeEl && calOutcomeEl && calNetEl) {
            calIncomeEl.innerText = formatCurrency(income);
            calOutcomeEl.innerText = formatCurrency(outcome);
            calNetEl.innerText = formatCurrency(netBalance);
        }
        
        // Update Transactions Ledger
        updateLedgerFilters();
        renderFullLedger();
        
        // Update Bank Accounts
        renderBankAccountsUI();
        
        // Update Calendar
        renderCalendarGrid();
    });

    renderCategoriesUI();
    renderBanksDropdown();
    renderSubscriptionsUI();
    renderDebtsUI();
    renderBudgetsUI();
    
    window.addEventListener('categories_updated', () => {
        renderCategoriesUI();
        renderBudgetsUI();
    });
    window.addEventListener('banks_updated', renderBankAccountsUI);
    window.addEventListener('transactions_updated', () => {
        updateDashboard();
        renderFullLedger();
        renderBankAccountsUI();
        renderCalendarGrid();
        renderBudgetsUI();
    });
    window.addEventListener('subscriptions_updated', renderSubscriptionsUI);
    window.addEventListener('debts_updated', renderDebtsUI);
}

// --- THEMING LOGIC ---
function initTheme() {
    const savedTheme = localStorage.getItem('wimm_theme') || 'theme-emerald-gold';
    applyTheme(savedTheme);
    if (selectTheme) selectTheme.value = savedTheme;
}

function applyTheme(themeClass) {
    document.body.classList.remove('theme-emerald-gold', 'theme-black-white', 'theme-pink-purple', 'theme-navy-orange');
    document.body.classList.add(themeClass);
    localStorage.setItem('wimm_theme', themeClass);

    if (themeSubtitle) {
        const themeMap = {
            'theme-emerald-gold': 'Emerald Gold',
            'theme-black-white': 'Black & White',
            'theme-pink-purple': 'Soft Pink',
            'theme-navy-orange': 'Midnight Navy'
        };
        themeSubtitle.innerText = themeMap[themeClass] || 'Emerald Gold';
    }
}

if (selectTheme) {
    selectTheme.addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });
}

if (selectCurrency) {
    selectCurrency.value = localStorage.getItem('wimm_currency') || 'USD';
    selectCurrency.addEventListener('change', (e) => {
        localStorage.setItem('wimm_currency', e.target.value);
        if (transactionsList.length > 0) {
            const { income, outcome, netBalance } = renderDashboard(transactionsList);
            // Update Calendar summary if present
            const calIncomeEl = document.getElementById('val-income-calendar');
            const calOutcomeEl = document.getElementById('val-outcome-calendar');
            const calNetEl = document.getElementById('val-netbalance-calendar');
            if (calIncomeEl && calOutcomeEl && calNetEl) {
                calIncomeEl.innerText = formatCurrency(income);
                calOutcomeEl.innerText = formatCurrency(outcome);
                calNetEl.innerText = formatCurrency(netBalance);
            }
            renderFullLedger();
            renderBankAccountsUI();
            renderCalendarGrid();
            renderSubscriptionsUI();
        }
    });
}

const selectLanguage = document.getElementById('select-language');
if (selectLanguage) {
    const savedLang = localStorage.getItem('wimm_language') || 'en';
    selectLanguage.value = savedLang;
    applyLanguage(savedLang);
    
    selectLanguage.addEventListener('change', (e) => {
        const newLang = e.target.value;
        localStorage.setItem('wimm_language', newLang);
        applyLanguage(newLang);
        
        // Update dashboard charts and dynamic text
        if (transactionsList.length > 0) {
            renderDashboard(transactionsList);
            renderFullLedger();
            renderCalendarGrid();
        }
    });
}

// --- SIDEBAR LOGIC ---
if (btnHideSidebar && btnShowSidebar && sidebar && mainContent) {
    btnHideSidebar.addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
        btnShowSidebar.classList.add('visible');
    });

    btnShowSidebar.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        mainContent.classList.remove('expanded');
        btnShowSidebar.classList.remove('visible');
    });
}

// --- NAVIGATION LOGIC ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        viewSections.forEach(section => section.classList.add('hidden'));

        const targetId = item.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.remove('hidden');
            if (targetId === 'view-placeholder') {
                document.getElementById('placeholder-title').innerText = item.innerText.trim();
            }
        }
    });
});

// Settings (Logout / Reset)
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        const confirmLogout = confirm("Do you want to sign out? You will need to enter the access code and sign in with Google again next time.");
        if (confirmLogout) {
            localStorage.removeItem('wimm_vip_unlocked');
            logoutGoogle();
        }
    });
}

window.addEventListener('google_logged_out', () => {
    document.getElementById('login-overlay').classList.remove('hidden');
    // Clear data from memory
    location.reload();
});

// --- CATEGORIES LOGIC ---
function renderCategoriesUI() {
    const categories = getCategories();
    
    if (datalistCategories) {
        datalistCategories.innerHTML = '';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            datalistCategories.appendChild(opt);
        });
    }
    
    if (filterCategory) {
        const currentVal = filterCategory.value;
        filterCategory.innerHTML = '<option value="All">All Categories</option>';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.innerText = c.name;
            filterCategory.appendChild(opt);
        });
        filterCategory.value = currentVal;
    }

    const tbody = document.getElementById('categories-list-tbody');
    if (tbody) {
        // Populate cat-filter-month dropdown
        if (catFilterMonth && catFilterMonth.options.length === 0) {
            const months = new Set();
            transactionsList.forEach(t => {
                if (t.date) {
                    const d = new Date(t.date);
                    if (!isNaN(d)) {
                        months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`);
                    }
                }
            });
            const now = new Date();
            const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`;
            months.add(currentMonthStr);
            
            Array.from(months).sort().reverse().forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                const [yy, mm] = m.split('-');
                const d = new Date(yy, parseInt(mm)-1, 1);
                opt.innerText = d.toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase().replace(' ', '-');
                catFilterMonth.appendChild(opt);
            });
            catFilterMonth.value = currentMonthStr;
        }

        const selectedMonth = catFilterMonth ? catFilterMonth.value : null;

        tbody.innerHTML = '';

        categories.forEach(c => {
            const budget = (c.budgets && selectedMonth && c.budgets[selectedMonth]) ? Number(c.budgets[selectedMonth]) : 0;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 500;">${c.name}</td>
                <td>
                    <input type="number" class="input-field cat-budget-input" data-name="${c.name}" value="${budget}" style="width: 120px; padding: 4px; font-size: 0.9em; height: 32px;" min="0" step="0.01">
                </td>
                <td>
                    <button class="icon-btn text-danger btn-delete-cat" data-name="${c.name}" style="font-size: 1rem;" title="Delete"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.cat-budget-input').forEach(input => {
            input.addEventListener('change', (e) => {
                if (!selectedMonth) return;
                const name = e.currentTarget.getAttribute('data-name');
                const newBudget = parseFloat(e.currentTarget.value) || 0;
                import('./storage.js').then(module => {
                    module.updateCategoryBudget(name, selectedMonth, newBudget);
                });
            });
        });

        document.querySelectorAll('.btn-delete-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.currentTarget.getAttribute('data-name');
                const updated = categories.filter(cat => cat.name !== name);
                saveCategories(updated);
            });
        });
    }
}

// --- BUDGETS LOGIC ---
function renderBudgetsUI() {
    if (!budgetsContainer || !budgetFilterMonth) return;

    // Populate months dropdown if it only has "All Months"
    if (budgetFilterMonth.options.length <= 1) {
        const currentVal = budgetFilterMonth.value;
        budgetFilterMonth.innerHTML = '<option value="All">All Months</option>';
        
        const months = new Set();
        transactionsList.forEach(t => {
            if (t.date) {
                const d = new Date(t.date);
                if (!isNaN(d)) {
                    months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`);
                }
            }
        });
        
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`;
        months.add(currentMonthStr); // ensure current month is always available

        Array.from(months).sort().reverse().forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            const [yy, mm] = m.split('-');
            const d = new Date(yy, parseInt(mm)-1, 1);
            opt.innerText = d.toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase().replace(' ', '-');
            budgetFilterMonth.appendChild(opt);
        });
        
        budgetFilterMonth.value = currentVal === 'All' ? currentMonthStr : currentVal;
    }

    let startDate, endDate;
    const selectedMonth = budgetFilterMonth.value;
    
    if (selectedMonth === 'All') {
        startDate = new Date(2000, 0, 1);
        endDate = new Date(2100, 0, 1);
    } else {
        const [yy, mm] = selectedMonth.split('-');
        startDate = new Date(yy, parseInt(mm)-1, 1);
        endDate = new Date(yy, parseInt(mm), 0);
        endDate.setHours(23, 59, 59, 999);
    }

    const categories = getCategories();
    const budgetCategories = categories.filter(c => {
        const amt = (c.budgets && c.budgets[selectedMonth]) ? Number(c.budgets[selectedMonth]) : 0;
        return amt > 0;
    });

    if (budgetCategories.length === 0) {
        if (budgetsSummaryContainer) budgetsSummaryContainer.innerHTML = '';
        budgetsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px; background: var(--bg-card); border-radius: var(--radius-md);">
            <i class="ph ph-chart-pie-slice" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
            <p>No budgets have been set up for ${selectedMonth}.</p>
            <p style="font-size: 0.85rem; margin-top: 8px;">Go to the <strong style="color: var(--primary);">Categories</strong> menu to set a Monthly Budget.</p>
        </div>`;
        return;
    }

    const spentMap = {};
    transactionsList.forEach(tx => {
        if (tx.type === 'expense' && tx.category) {
            const txDate = new Date(tx.date);
            if (txDate >= startDate && txDate <= endDate) {
                const catName = tx.category.toLowerCase();
                spentMap[catName] = (spentMap[catName] || 0) + tx.amount;
            }
        }
    });

    let totalBudget = 0;
    let totalSpent = 0;

    budgetsContainer.innerHTML = budgetCategories.map(c => {
        const spent = spentMap[c.name.toLowerCase()] || 0;
        const budget = Number(c.budgets[selectedMonth]) || 0;
        
        totalBudget += budget;
        totalSpent += spent;

        const percentage = Math.min((spent / budget) * 100, 100).toFixed(1);
        
        let progressColor = 'var(--success)';
        if (percentage >= 100) progressColor = 'var(--danger)';
        else if (percentage >= 80) progressColor = '#f59e0b'; // warning orange
        
        const remaining = Math.max(budget - spent, 0);
        const overspent = Math.max(spent - budget, 0);

        return `
        <div class="card" style="display: flex; flex-direction: column; gap: 12px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-weight: 600; font-size: 1.1rem; margin: 0;">${c.name}</h3>
                <span style="font-size: 0.85rem; font-weight: 600; color: ${progressColor}; background: ${progressColor}20; padding: 4px 8px; border-radius: 12px;">
                    ${percentage}%
                </span>
            </div>
            
            <div style="font-size: 1.2rem; font-weight: 700;">
                ${formatCurrency(spent)} <span style="font-size: 0.85rem; font-weight: normal; color: var(--text-muted);">/ ${formatCurrency(budget)}</span>
            </div>
            
            <div style="width: 100%; height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden; margin-top: 4px;">
                <div style="height: 100%; width: ${percentage}%; background: ${progressColor}; transition: width 0.3s ease;"></div>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 4px;">
                ${overspent > 0 
                    ? `<span class="text-danger"><i class="ph-fill ph-warning-circle"></i> Overspent by ${formatCurrency(overspent)}</span>`
                    : `<span style="color: var(--text-muted);">${formatCurrency(remaining)} remaining</span>`
                }
            </div>
        </div>
        `;
    }).join('');

    if (budgetsSummaryContainer) {
        const totalPercentage = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100).toFixed(1) : 0;
        let progressColor = 'var(--success)';
        if (totalPercentage >= 100) progressColor = 'var(--danger)';
        else if (totalPercentage >= 80) progressColor = '#f59e0b';
        
        const totalRemaining = Math.max(totalBudget - totalSpent, 0);
        const totalOverspent = Math.max(totalSpent - totalBudget, 0);

        budgetsSummaryContainer.innerHTML = `
            <div class="card" style="background: var(--bg-card); color: var(--text-color); padding: 32px; display: flex; flex-direction: column; gap: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-radius: var(--radius-lg); position: relative; overflow: hidden; border: 1px solid var(--primary);">
                <!-- Decorative background element -->
                <i class="ph ph-chart-pie-slice" style="position: absolute; right: -20px; top: -20px; font-size: 150px; opacity: 0.05; transform: rotate(15deg); color: var(--primary);"></i>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; position: relative; z-index: 1;">
                    <div>
                        <h3 style="font-size: 1.3rem; font-weight: 600; opacity: 0.95; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            <i class="ph ph-wallet" style="color: var(--primary);"></i> Total Budget Overview
                        </h3>
                        <div style="font-size: 2.5rem; font-weight: 800; letter-spacing: -0.5px;">
                            ${formatCurrency(totalSpent)} <span style="font-size: 1.2rem; font-weight: 500; opacity: 0.6;">/ ${formatCurrency(totalBudget)}</span>
                        </div>
                    </div>
                    <div style="text-align: right; background: var(--bg-body); padding: 12px 20px; border-radius: 16px; border: 1px solid var(--border-color);">
                        <div style="font-size: 2rem; font-weight: 800; color: ${progressColor};">${totalPercentage}%</div>
                        <div style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Consumed</div>
                    </div>
                </div>
                
                <div style="width: 100%; height: 16px; background: var(--bg-body); border-radius: 8px; overflow: hidden; position: relative; z-index: 1; border: 1px solid var(--border-color);">
                    <div style="height: 100%; width: ${totalPercentage}%; background: ${progressColor}; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                </div>
                
                <div style="font-size: 1.1rem; position: relative; z-index: 1; display: flex; align-items: center; gap: 8px;">
                    ${totalOverspent > 0 
                        ? `<span class="text-danger" style="background: rgba(239, 68, 68, 0.1); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);"><strong><i class="ph-fill ph-warning-circle"></i> Overspent by ${formatCurrency(totalOverspent)}</strong></span>`
                        : `<span class="text-success" style="background: rgba(34, 197, 94, 0.1); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3);"><strong><i class="ph ph-check-circle"></i> ${formatCurrency(totalRemaining)} remaining</strong> for the rest of the month</span>`
                    }
                </div>
            </div>
        `;
    }
}

if (budgetFilterMonth) budgetFilterMonth.addEventListener('change', renderBudgetsUI);
if (catFilterMonth) catFilterMonth.addEventListener('change', renderCategoriesUI);

window.addEventListener('categories_updated', renderCategoriesUI);

if (btnAddCategory) {
    btnAddCategory.addEventListener('click', () => {
        const val = inputNewCategory.value.trim();
        if (val) {
            addCategories([val]);
            inputNewCategory.value = '';
        }
    });
}

function renderBanksDropdown() {
    const banks = getBankAccounts();
    if (datalistAccounts) {
        datalistAccounts.innerHTML = '';
        banks.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.name;
            datalistAccounts.appendChild(opt);
        });
    }
}
window.addEventListener('banks_updated', () => {
    renderBanksDropdown();
    renderBankAccountsUI();
});

// ─── Subscriptions Logic ──────────────────────────────────────────────────────
function renderSubscriptionsUI() {
    if (!subscriptionsList) return;
    const subs = getSubscriptions();
    
    // Calculate total monthly
    let monthlyTotal = 0;
    subs.forEach(s => {
        const amt = Number(s.amount) || 0;
        if (s.timeline === 'weekly') monthlyTotal += amt * 4.33;
        else if (s.timeline === 'yearly') monthlyTotal += amt / 12;
        else monthlyTotal += amt; // monthly
    });
    
    if (valSubscriptionsMo) {
        valSubscriptionsMo.innerText = formatCurrency(monthlyTotal);
    }
    
    const tableTotal = document.getElementById('subscriptions-table-total');
    if (tableTotal) {
        tableTotal.innerText = formatCurrency(monthlyTotal);
    }
    
    if (subs.length === 0) {
        subscriptionsList.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No active subscriptions.</td></tr>`;
        return;
    }
    
    subscriptionsList.innerHTML = subs.sort((a, b) => new Date(a.date) - new Date(b.date)).map(s => `
        <tr>
            <td style="font-weight: 500;">${s.name}</td>
            <td style="color: var(--text-muted);">${s.date}</td>
            <td class="text-danger" style="font-weight: 600;">${formatCurrency(s.amount)}</td>
            <td style="text-transform: capitalize;">${s.timeline}</td>
            <td>
                <button class="icon-btn text-danger btn-delete-sub" data-id="${s.id}" title="Delete"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
    
    document.querySelectorAll('.btn-delete-sub').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm('Delete this subscription?')) {
                await deleteSubscription(id);
            }
        });
    });
}

if (formSubscription) {
    formSubscription.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('sub-name').value.trim(),
            date: document.getElementById('sub-date').value,
            amount: parseFloat(document.getElementById('sub-amount').value),
            timeline: document.getElementById('sub-timeline').value
        };
        await addSubscription(data);
        formSubscription.reset();
    });
}

function renderDebtsUI() {
    if (!debtsList) return;
    const debts = getDebts();
    
    if (debts.length === 0) {
        debtsList.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No debt records found.</td></tr>`;
        return;
    }
    
    debtsList.innerHTML = debts.sort((a, b) => new Date(b.date) - new Date(a.date)).map(d => `
        <tr>
            <td style="color: var(--text-muted);">${d.date}</td>
            <td style="font-weight: 500;">${d.debtTo}</td>
            <td class="text-${d.role === 'debitor' ? 'danger' : 'success'}" style="font-weight: 600;">${formatCurrency(d.amount)}</td>
            <td style="text-transform: capitalize;">${d.role}</td>
            <td>
                <select class="input-field debt-status-select" data-id="${d.id}" style="padding: 4px; font-size: 0.85em; height: auto;">
                    <option value="in_progress" ${d.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="paid_off" ${d.status === 'paid_off' ? 'selected' : ''}>Paid Off</option>
                </select>
            </td>
            <td>
                <button class="icon-btn text-danger btn-delete-debt" data-id="${d.id}" title="Delete"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
    
    document.querySelectorAll('.debt-status-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const id = e.currentTarget.dataset.id;
            const newStatus = e.currentTarget.value;
            await updateDebt(id, { status: newStatus });
        });
    });
    
    document.querySelectorAll('.btn-delete-debt').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm('Delete this debt record?')) {
                await deleteDebt(id);
            }
        });
    });
}

if (formDebt) {
    formDebt.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            date: document.getElementById('debt-date').value,
            amount: parseFloat(document.getElementById('debt-amount').value),
            debtTo: document.getElementById('debt-to').value.trim(),
            role: document.getElementById('debt-role').value,
            status: document.getElementById('debt-status').value
        };
        await addDebt(data);
        formDebt.reset();
    });
}

// --- TRANSACTIONS LEDGER LOGIC ---
function updateLedgerFilters() {
    if (!filterMonth) return;
    const currentVal = filterMonth.value;
    filterMonth.innerHTML = '<option value="All">All Months</option>';
    
    const months = new Set();
    transactionsList.forEach(t => {
        if (t.date) {
            const d = new Date(t.date);
            if (!isNaN(d)) {
                const mStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
                months.add(mStr);
            }
        }
    });

    Array.from(months).sort().reverse().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        const [yy, mm] = m.split('-');
        const d = new Date(yy, parseInt(mm)-1, 1);
        opt.innerText = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        filterMonth.appendChild(opt);
    });

    if (Array.from(months).includes(currentVal)) {
        filterMonth.value = currentVal;
    }
}

function renderFullLedger() {
    if (!fullLedgerBody) return;

    // 1. Filter
    const searchStr = filterSearch ? filterSearch.value.toLowerCase() : '';
    const typeStr = filterType ? filterType.value : 'All';
    const catStr = filterCategory ? filterCategory.value : 'All';
    const monthStr = filterMonth ? filterMonth.value : 'All';

    let filtered = transactionsList.filter(t => {
        if (searchStr && !(t.description || '').toLowerCase().includes(searchStr) && !(t.category || '').toLowerCase().includes(searchStr)) return false;
        if (typeStr !== 'All' && t.type !== typeStr) return false;
        if (catStr !== 'All' && t.category !== catStr) return false;
        if (monthStr !== 'All' && t.date) {
            const d = new Date(t.date);
            if (!isNaN(d)) {
                const mStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
                if (mStr !== monthStr) return false;
            } else {
                if (!t.date.startsWith(monthStr)) return false;
            }
        }
        return true;
    });

    // 2. Sort
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 3. Paginate
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / ledgerItemsPerPage) || 1;
    
    if (ledgerCurrentPage > totalPages) ledgerCurrentPage = totalPages;
    if (ledgerCurrentPage < 1) ledgerCurrentPage = 1;

    const startIndex = (ledgerCurrentPage - 1) * ledgerItemsPerPage;
    const paginated = filtered.slice(startIndex, startIndex + ledgerItemsPerPage);

    // 4. Render
    fullLedgerBody.innerHTML = '';
    
    if (paginated.length === 0) {
        fullLedgerBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">No transactions found.</td></tr>`;
    } else {
        paginated.forEach(t => {
            const tr = document.createElement('tr');
            const amtClass = t.type === 'income' ? 'text-success' : 'text-danger';
            const sign = t.type === 'income' ? '+' : '-';
            const typeLabel = t.type === 'income' 
                ? `<span style="background: var(--success-light); color: var(--success); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; text-transform: uppercase;">Income</span>` 
                : `<span style="background: var(--danger-light); color: var(--danger); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; text-transform: uppercase;">Expense</span>`;
            
            tr.innerHTML = `
                <td><input type="checkbox" class="check-tx" data-id="${t.id}"></td>
                <td><span style="background: var(--border-color); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">${t.category}</span></td>
                <td style="font-weight: 500;">${t.description || '-'}</td>
                <td style="color: var(--text-muted); font-size: 0.85rem;">${t.date}</td>
                <td style="color: var(--text-muted); font-size: 0.85rem;">${t.account || '-'}</td>
                <td>${typeLabel}</td>
                <td class="${amtClass}" style="font-weight: 600; text-align: right;">${sign}${formatCurrency(t.amount || 0)}</td>
                <td style="text-align: right;">
                    <button class="icon-btn btn-edit-tx" data-id="${t.id}" title="Edit"><i class="ph ph-pencil"></i></button>
                    <button class="icon-btn text-danger btn-del-tx" data-id="${t.id}" title="Delete"><i class="ph ph-trash"></i></button>
                </td>
            `;
            fullLedgerBody.appendChild(tr);
        });
    }

    // Bind Edit/Delete/Check Events
    document.querySelectorAll('.btn-del-tx').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm("Are you sure you want to delete this transaction?")) {
                const id = e.currentTarget.getAttribute('data-id');
                await deleteTransaction(id);
            }
        });
    });

    document.querySelectorAll('.btn-edit-tx').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const tx = transactionsList.find(t => t.id === id);
            if (tx) {
                document.getElementById('modal-transaction-title').innerText = "Edit Transaction";
                document.getElementById('trans-id').value = tx.id;
                document.getElementById('trans-type').value = tx.type;
                document.getElementById('trans-amount').value = tx.amount;
                document.getElementById('trans-desc').value = tx.description;
                document.getElementById('trans-category').value = tx.category;
                document.getElementById('trans-account').value = tx.account || '';
                document.getElementById('trans-date').value = tx.date;
                transactionModal.classList.remove('hidden');
            }
        });
    });

    document.querySelectorAll('.check-tx').forEach(chk => {
        chk.addEventListener('change', updateBulkDeleteVisibility);
    });
    if (checkAllTx) {
        checkAllTx.checked = false;
    }
    updateBulkDeleteVisibility();

    // Update Pagination UI
    if (paginationInfo) paginationInfo.innerText = `Showing ${paginated.length > 0 ? startIndex + 1 : 0}–${startIndex + paginated.length} of ${totalItems} records`;
    if (paginationPageDisplay) paginationPageDisplay.innerText = `Page ${ledgerCurrentPage} of ${totalPages}`;
    if (btnPrevPage) btnPrevPage.disabled = ledgerCurrentPage <= 1;
    if (btnNextPage) btnNextPage.disabled = ledgerCurrentPage >= totalPages;
}

function updateBulkDeleteVisibility() {
    const anyChecked = Array.from(document.querySelectorAll('.check-tx')).some(c => c.checked);
    if (btnBulkDelete) {
        if (anyChecked) btnBulkDelete.classList.remove('hidden');
        else btnBulkDelete.classList.add('hidden');
    }
    if (btnBulkEdit) {
        if (anyChecked) btnBulkEdit.classList.remove('hidden');
        else btnBulkEdit.classList.add('hidden');
    }
}

if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', async () => {
        const ids = Array.from(document.querySelectorAll('.check-tx:checked')).map(c => c.getAttribute('data-id'));
        if (ids.length > 0 && confirm(`Are you sure you want to delete ${ids.length} transactions?`)) {
            await bulkDeleteTransactions(ids);
            // Reset pagination to first page and refresh ledger
            ledgerCurrentPage = 1;
            renderFullLedger();
            // Clear any selected checkboxes
            if (checkAllTx) checkAllTx.checked = false;
            updateBulkDeleteVisibility();
        }
    });
}

if (btnBulkEdit) {
    btnBulkEdit.addEventListener('click', () => {
        // Populate selects with current categories and accounts
        const categories = getCategories();
        bulkEditCategory.innerHTML = '<option value="">-- Keep Existing --</option>';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.innerText = c.name;
            bulkEditCategory.appendChild(opt);
        });
        const accounts = getBankAccounts();
        bulkEditAccount.innerHTML = '<option value="">-- Keep Existing --</option>';
        accounts.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.name;
            opt.innerText = a.name;
            bulkEditAccount.appendChild(opt);
        });
        bulkEditModal.classList.remove('hidden');
    });
}

if (btnCloseBulkEdit) {
    btnCloseBulkEdit.addEventListener('click', () => {
        bulkEditModal.classList.add('hidden');
    });
}
if (btnCancelBulkEdit) {
    btnCancelBulkEdit.addEventListener('click', () => {
        bulkEditModal.classList.add('hidden');
    });
}

if (formBulkEdit) {
    formBulkEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ids = Array.from(document.querySelectorAll('.check-tx:checked')).map(c => c.getAttribute('data-id'));
        if (ids.length === 0) { alert('No transactions selected.'); return; }
        const updates = {};
        const cat = bulkEditCategory.value;
        const acct = bulkEditAccount.value;
        if (cat) updates.category = cat;
        if (acct) updates.account = acct;
        if (Object.keys(updates).length === 0) { alert('Select at least one field to update.'); return; }
        await bulkEditTransactions(ids, updates);
        bulkEditModal.classList.add('hidden');
        if (checkAllTx) checkAllTx.checked = false;
        updateBulkDeleteVisibility();
    });
}

if (checkAllTx) {
    checkAllTx.addEventListener('change', (e) => {
        document.querySelectorAll('.check-tx').forEach(chk => {
            chk.checked = e.target.checked;
        });
        updateBulkDeleteVisibility();
    });
}

// Filter listeners
[filterSearch, filterType, filterCategory, filterMonth].forEach(el => {
    if (el) {
        el.addEventListener('input', () => {
            ledgerCurrentPage = 1;
            renderFullLedger();
        });
    }
});

if (btnPrevPage) {
    btnPrevPage.addEventListener('click', () => {
        if (ledgerCurrentPage > 1) {
            ledgerCurrentPage--;
            renderFullLedger();
        }
    });
}
if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
        ledgerCurrentPage++;
        renderFullLedger();
    });
}

if (selectItemsPerPage) {
    selectItemsPerPage.addEventListener('change', (e) => {
        ledgerItemsPerPage = parseInt(e.target.value);
        ledgerCurrentPage = 1;
        renderFullLedger();
    });
}

// --- DASHBOARD LOGIC ---
// Initialize the date range picker — fires renderDashboard whenever the range changes
initDashboardDatePicker(() => {
    const { income, outcome, netBalance } = renderDashboard(transactionsList);
    updateQuoteUI(netBalance, income, outcome);
});

// --- BANK ACCOUNTS LOGIC ---
if (filterBankDateRange) {
    filterBankDateRange.addEventListener('change', renderBankAccountsUI);
}

if (btnAddBank) {
    btnAddBank.addEventListener('click', async () => {
        const val = inputNewBank.value.trim();
        if (val) {
            addBankAccounts([{ name: val, initialBalance: 0, initialDate: '' }]);
            renderBankAccountsUI();
            inputNewBank.value = '';
        }
    });
}

function renderBankAccountsUI() {
    if (!bankCardsContainer) return;

    // Get list of manual banks
    const storedBanks = getBankAccounts();

    const accountsData = {};
    storedBanks.forEach(b => {
        accountsData[b.name] = { income: 0, expense: 0, net: 0 };
    });
    
    const range = filterBankDateRange ? filterBankDateRange.value : 'all';
    const now = new Date();
    
    transactionsList.forEach(t => {
        const accName = t.account;
        if (!accName || !accountsData[accName]) return;
        
        let include = true;
        const txDate = new Date(t.date);
        if (range === 'this_month') {
            if (txDate.getFullYear() !== now.getFullYear() || txDate.getMonth() !== now.getMonth()) include = false;
        } else if (range === 'last_3_months') {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            if (txDate < threeMonthsAgo) include = false;
        } else if (range === 'this_year') {
            if (txDate.getFullYear() !== now.getFullYear()) include = false;
        }

        if (include) {
            if (t.type === 'income') {
                accountsData[accName].income += t.amount;
                accountsData[accName].net += t.amount;
            } else {
                accountsData[accName].expense += t.amount;
                accountsData[accName].net -= t.amount;
            }
        }
    });

    bankCardsContainer.innerHTML = '';

    if (storedBanks.length === 0) {
        bankCardsContainer.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;">No bank accounts added.</p>';
        return;
    }

    storedBanks.sort((a,b) => a.name.localeCompare(b.name)).forEach(bankObj => {
        const name = bankObj.name;
        const data = accountsData[name];
        const card = document.createElement('div');
        card.className = 'card';
        card.style = 'display: flex; flex-direction: column; gap: 8px; border-top: 4px solid var(--primary);';

        const balanceClass = data.net >= 0 ? 'text-success' : 'text-danger';

        // Get recent transactions for this account (sorted newest first, max 5)
        const acctTxs = transactionsList
            .filter(t => t.account === name)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        const txRowsHTML = acctTxs.length === 0
            ? `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:8px;font-size:0.8rem;">No transactions</td></tr>`
            : acctTxs.map(t => {
                const sign = t.type === 'income' ? '+' : '-';
                const cls  = t.type === 'income' ? 'text-success' : 'text-danger';
                return `<tr>
                    <td style="color:var(--text-muted);font-size:0.78rem;white-space:nowrap;padding:4px 6px 4px 0">${t.date}</td>
                    <td style="font-size:0.82rem;padding:4px 6px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.description || t.category || '-'}</td>
                    <td class="${cls}" style="font-size:0.82rem;font-weight:600;text-align:right;padding:4px 0 4px 6px;white-space:nowrap">${sign}${formatCurrency(t.amount)}</td>
                </tr>`;
            }).join('');

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <span style="font-weight: 600; font-size: 1.1rem;">${name}</span>
                <button class="icon-btn text-danger btn-delete-bank" data-name="${name}" style="font-size: 1rem;"><i class="ph ph-trash"></i></button>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                <div style="display: flex; flex-direction: column;">
                    <span class="summary-title">Total In</span>
                    <span class="text-success" style="font-weight: 600;">${formatCurrency(data.income)}</span>
                </div>
                <div style="display: flex; flex-direction: column; text-align: right;">
                    <span class="summary-title">Total Out</span>
                    <span class="text-danger" style="font-weight: 600;">${formatCurrency(data.expense)}</span>
                </div>
            </div>

            <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 4px 0;">

            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="summary-title">Net Balance</span>
                <span class="summary-value ${balanceClass}" style="font-size: 1.2rem;">${formatCurrency(data.net)}</span>
            </div>

            <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 4px 0;">

            <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.05em;">Recent Transactions</div>
            <table style="width:100%; border-collapse: collapse;">
                <tbody>${txRowsHTML}</tbody>
            </table>
        `;
        bankCardsContainer.appendChild(card);
    });

    document.querySelectorAll('.btn-delete-bank').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.currentTarget.getAttribute('data-name');
            if (confirm(`Are you sure you want to delete ${name} from your Bank Accounts? This will not delete the transactions.`)) {
                const updated = storedBanks.filter(b => b.name !== name);
                saveBankAccounts(updated);
            }
        });
    });
}

// --- TRANSACTION MODAL LOGIC ---
const btnAddTransaction = document.getElementById('btn-add-transaction');
const btnAddTransactionLedger = document.getElementById('btn-add-transaction-ledger');

function openTransactionModal() {
    document.getElementById('modal-transaction-title').innerText = "Add Transaction";
    document.getElementById('trans-id').value = '';
    formTransaction.reset();
    
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
    document.getElementById('trans-date').value = localISOTime;

    // Auto-select type if we are on a specific type filter in ledger
    const filterType = document.getElementById('filter-type');
    if (filterType && filterType.value !== 'All') {
        document.getElementById('trans-type').value = filterType.value;
    }

    transactionModal.classList.remove('hidden');
}

if (btnAddTransaction) {
    btnAddTransaction.addEventListener('click', openTransactionModal);
}
if (btnAddTransactionLedger) {
    btnAddTransactionLedger.addEventListener('click', openTransactionModal);
}

if (btnCloseTrans) {
    btnCloseTrans.addEventListener('click', () => {
        transactionModal.classList.add('hidden');
    });
}

if (formTransaction) {
    formTransaction.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('trans-id').value;
        const type = document.getElementById('trans-type').value;
        const amount = Number(document.getElementById('trans-amount').value);
        const desc = document.getElementById('trans-desc').value;
        const category = document.getElementById('trans-category').value;
        const account = document.getElementById('trans-account').value;
        const date = document.getElementById('trans-date').value;

        const btnSubmit = formTransaction.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;

        try {
            const txData = { type, amount, description: desc, category, account, date };
            
            if (id) {
                await editTransaction(id, txData);
            } else {
                await addTransaction(txData);
            }
            
            const existingCats = getCategories();
            if (!existingCats.find(c => c.name === category)) {
                addCategories([category]);
            }
            const existingBanks = getBankAccounts();
            if (account && !existingBanks.find(b => b.name === account)) {
                addBankAccounts([{ name: account, initialBalance: 0, initialDate: '' }]);
            }

            formTransaction.reset();
            transactionModal.classList.add('hidden');
        } catch (err) {
            alert("Error saving transaction: " + err.message);
        } finally {
            btnSubmit.disabled = false;
        }
    });
}

// --- CSV IMPORT LOGIC ---
if (btnImportCsvIcon) {
    btnImportCsvIcon.addEventListener('click', () => {
        inputCsvFile.click();
    });
}

if (inputCsvFile) {
    inputCsvFile.addEventListener('change', () => {
        const file = inputCsvFile.files[0];
        if (!file) return;

        btnImportCsvIcon.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Parsing...`;
        btnImportCsvIcon.disabled = true;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async function(results) {
                const data = results.data;
                const txsToImport = [];
                const newCategories = new Set();
                const newBanks = new Set();

                data.forEach(row => {
                    const lowerRow = {};
                    for (const key in row) {
                        if (key) lowerRow[key.trim().toLowerCase()] = row[key];
                    }

                    const rawDate = lowerRow['tanggal'] || lowerRow['date'];
                    const rawType = lowerRow['transaksi'] || lowerRow['type'];
                    const rawCat = lowerRow['kategori'] || lowerRow['category'];
                    const rawDesc = lowerRow['deskripsi'] || lowerRow['description'];
                    const rawAmount = lowerRow['total'] || lowerRow['amount'] || lowerRow['nominal'] || lowerRow['jumlah'] || lowerRow['nilai'];
                    const rawAccount = lowerRow['bank'] || lowerRow['account'] || lowerRow['rekening'];

                    if (!rawDate || rawAmount === undefined || rawAmount === null || rawAmount === '') return;

                    let dateStr = rawDate;
                    if (!isNaN(rawDate)) {
                        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                        dateStr = new Date(excelEpoch.getTime() + rawDate * 86400000).toISOString().split('T')[0];
                    } else {
                        const parsed = new Date(rawDate);
                        if (!isNaN(parsed)) {
                            dateStr = parsed.toISOString().split('T')[0];
                        }
                    }

                    let type = 'expense';
                    if (rawType) {
                        const t = rawType.toString().trim().toUpperCase();
                        if (
                            t.includes('INCOME') || t.includes('PENDAPATAN') ||
                            t.includes('CREDIT') || t.includes('KREDIT') ||
                            t.includes('CR') || t === 'IN' || t === 'MASUK'
                        ) type = 'income';
                    }
                    // If no type column, infer from amount sign
                    const rawAmountNum = Number((rawAmount || '').toString().replace(/[^0-9.-]+/g, ''));
                    if (!rawType && rawAmountNum > 0) type = 'income';
                    if (!rawType && rawAmountNum < 0) type = 'expense';
                    const amount = Math.abs(rawAmountNum);

                    const category = rawCat || 'Uncategorized';
                    if (category) newCategories.add(category);
                    
                    const account = rawAccount || 'Imported';
                    if (account) newBanks.add({ name: account, initialBalance: 0, initialDate: '' });

                    txsToImport.push({
                        type,
                        amount,
                        category,
                        description: rawDesc || '',
                        account,
                        date: dateStr
                    });
                });

                if (txsToImport.length > 0) {
                    window.pendingCsvImport = {
                        txs: txsToImport,
                        cats: Array.from(newCategories),
                        banks: Array.from(newBanks)
                    };
                    
                    const csvPreviewModal = document.getElementById('csv-preview-modal');
                    const csvPreviewBody = document.getElementById('csv-preview-body');
                    const info = document.getElementById('csv-preview-info');
                    
                    if (csvPreviewBody) {
                        csvPreviewBody.innerHTML = '';
                        txsToImport.forEach(tx => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td>${tx.date}</td>
                                <td><span class="badge ${tx.type === 'income' ? 'badge-income' : 'badge-expense'}">${tx.type}</span></td>
                                <td>${tx.category}</td>
                                <td>${tx.description}</td>
                                <td>${formatCurrency(tx.amount)}</td>
                                <td>${tx.account}</td>
                            `;
                            csvPreviewBody.appendChild(tr);
                        });
                        
                        if (info) info.innerText = `Found ${txsToImport.length} valid transactions. Please review them before confirming.`;
                        if (csvPreviewModal) csvPreviewModal.classList.remove('hidden');
                    } else {
                        // Fallback if modal HTML is somehow missing
                        addMultipleTransactions(txsToImport).then(() => {
                            addCategories(Array.from(newCategories));
                            addBankAccounts(Array.from(newBanks));
                            alert(`Successfully imported ${txsToImport.length} transactions and added new categories!`);
                        });
                    }
                } else {
                    alert("No valid transactions found in the CSV. Please check headers.");
                }

                btnImportCsvIcon.innerHTML = `<i class="ph ph-upload"></i> Import CSV`;
                btnImportCsvIcon.disabled = false;
                inputCsvFile.value = '';
            },
            error: function(err) {
                alert("Error parsing CSV: " + err.message);
                btnImportCsvIcon.innerHTML = `<i class="ph ph-upload"></i> Import CSV`;
                btnImportCsvIcon.disabled = false;
                inputCsvFile.value = '';
            }
        });
    });
}

// Firebase login removed – app operates in offline mode only.
// Offline mode is started automatically on load, so login buttons are non-functional.
// Optionally hide login UI via CSS if desired.

// --- CALENDAR LOGIC ---
function renderCalendarGrid() {
    if (!calendarGrid) { console.warn('[CAL] calendarGrid is null'); return; }
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    console.log(`[CAL] Rendering: ${year}-${month+1}, firstDay=${new Date(year,month,1).getDay()}`);
    
    if (selectCalendarMonth) selectCalendarMonth.value = month;
    if (selectCalendarYear) selectCalendarYear.value = year;
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    // Group transactions by date for current month
    const txByDate = {};
    transactionsList.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === year && txDate.getMonth() === month) {
            const dateKey = txDate.getDate();
            if (!txByDate[dateKey]) {
                txByDate[dateKey] = { income: 0, outcome: 0, txs: [] };
            }
            txByDate[dateKey].txs.push(tx);
            if (tx.type === 'income') txByDate[dateKey].income += tx.amount;
            else if (tx.type === 'expense') txByDate[dateKey].outcome += tx.amount;
        }
    });

    calendarGrid.innerHTML = '';
    
    // Day headers
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    dayNames.forEach((day, idx) => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header-cell';
        if (idx === 0 || idx === 6) header.classList.add('weekend');
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell trailing';
        const dateNum = document.createElement('div');
        dateNum.className = 'calendar-date-num';
        dateNum.textContent = prevMonthDays - i;
        cell.appendChild(dateNum);
        calendarGrid.appendChild(cell);
    }
    
    // Current month days
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
    for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        if (isCurrentMonth && today.getDate() === i) {
            cell.classList.add('today');
        }
        if (selectedCalendarDate === i) {
            cell.classList.add('selected');
        }
        
        const dateNum = document.createElement('div');
        dateNum.className = 'calendar-date-num';
        dateNum.textContent = i;
        cell.appendChild(dateNum);
        
        if (txByDate[i]) {
            const totals = document.createElement('div');
            totals.className = 'calendar-day-totals';
            
            if (txByDate[i].income > 0) {
                const incSpan = document.createElement('span');
                incSpan.className = 'cal-income';
                incSpan.textContent = '+' + formatCurrency(txByDate[i].income);
                totals.appendChild(incSpan);
            }
            if (txByDate[i].outcome > 0) {
                const outSpan = document.createElement('span');
                outSpan.className = 'cal-expense';
                outSpan.textContent = '-' + formatCurrency(txByDate[i].outcome);
                totals.appendChild(outSpan);
            }
            cell.appendChild(totals);
        }
        
        cell.addEventListener('click', () => {
            selectedCalendarDate = i;
            renderCalendarGrid();
        });
        
        calendarGrid.appendChild(cell);
    }
    
    // Trailing days from next month to fill the grid
    const totalCells = firstDayIndex + daysInMonth;
    const targetCells = totalCells <= 35 ? 35 : 42;
    const remainingCells = targetCells - totalCells;
    for (let i = 1; i <= remainingCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell trailing';
        const dateNum = document.createElement('div');
        dateNum.className = 'calendar-date-num';
        dateNum.textContent = i;
        cell.appendChild(dateNum);
        calendarGrid.appendChild(cell);
    }
    
    // Update calendar summary cards
    updateCalendarSummary(txByDate);
    
    // Render side panel for selected date
    if (selectedCalendarDate !== null && selectedCalendarDate >= 1 && selectedCalendarDate <= daysInMonth) {
        const dayData = txByDate[selectedCalendarDate] || { income: 0, outcome: 0, txs: [] };
        renderDailyDetails(year, month, selectedCalendarDate, dayData);
    } else {
        renderDailyDetailsEmpty();
    }
}

function updateCalendarSummary(txByDate) {
    let totalIncome = 0, totalExpense = 0;
    Object.values(txByDate).forEach(d => {
        totalIncome += d.income;
        totalExpense += d.outcome;
    });
    const calIncome = document.getElementById('val-income-calendar');
    const calOutcome = document.getElementById('val-outcome-calendar');
    const calNet = document.getElementById('val-netbalance-calendar');
    if (calIncome) calIncome.textContent = formatCurrency(totalIncome);
    if (calOutcome) calOutcome.textContent = formatCurrency(totalExpense);
    if (calNet) {
        const net = totalIncome - totalExpense;
        calNet.textContent = formatCurrency(Math.abs(net));
        calNet.style.color = net >= 0 ? 'var(--success)' : 'var(--danger)';
    }
}

function renderDailyDetails(year, month, day, dayData) {
    if (!panelDailyTitle || !dailyDetailsTable || !dailyDetailsTbody || !dailyDetailsEmpty) return;
    
    const fullDate = new Date(year, month, day);
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(fullDate);
    panelDailyTitle.textContent = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(fullDate);
    if (panelDailySubtitle) panelDailySubtitle.textContent = dayOfWeek;
    
    // Update mini stats
    if (panelDailySummary) {
        panelDailySummary.classList.remove('hidden');
        if (panelDailyIncome) panelDailyIncome.textContent = formatCurrency(dayData.income || 0);
        if (panelDailyExpense) panelDailyExpense.textContent = formatCurrency(dayData.outcome || 0);
    }
    
    const txs = dayData.txs || [];
    dailyDetailsTbody.innerHTML = '';
    if (txs.length === 0) {
        dailyDetailsEmpty.innerHTML = '<i class="ph ph-receipt" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.3;"></i><span>No transactions on this date</span>';
        dailyDetailsEmpty.classList.remove('hidden');
        dailyDetailsTable.classList.add('hidden');
    } else {
        dailyDetailsEmpty.classList.add('hidden');
        dailyDetailsTable.classList.remove('hidden');
        
        txs.forEach(tx => {
            const tr = document.createElement('tr');
            
            const tdDesc = document.createElement('td');
            tdDesc.textContent = tx.description || 'No Description';
            
            const tdAmt = document.createElement('td');
            tdAmt.textContent = (tx.type === 'income' ? '+' : '-') + formatCurrency(tx.amount);
            tdAmt.className = tx.type === 'income' ? 'text-success' : 'text-danger';
            tdAmt.style.textAlign = 'right';
            tdAmt.style.fontWeight = '600';
            
            tr.appendChild(tdDesc);
            tr.appendChild(tdAmt);
            dailyDetailsTbody.appendChild(tr);
        });
    }
}

function renderDailyDetailsEmpty() {
    if (!panelDailyTitle || !dailyDetailsTable || !dailyDetailsEmpty) return;
    panelDailyTitle.textContent = 'Select a Date';
    if (panelDailySubtitle) panelDailySubtitle.textContent = '';
    if (panelDailySummary) panelDailySummary.classList.add('hidden');
    dailyDetailsTable.classList.add('hidden');
    dailyDetailsEmpty.classList.remove('hidden');
    dailyDetailsEmpty.innerHTML = '<i class="ph ph-calendar-blank" style="font-size: 2.5rem; margin-bottom: 8px; opacity: 0.3;"></i><span>Click on a date to view transactions</span>';
}

if (btnPrevMonth) {
    btnPrevMonth.addEventListener('click', () => {
        console.log('[CAL] Prev clicked, before:', calendarDate.toDateString());
        calendarDate.setDate(1);
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        selectedCalendarDate = null;
        console.log('[CAL] After prev:', calendarDate.toDateString());
        renderCalendarGrid();
    });
} else {
    console.warn('[CAL] btnPrevMonth is null!');
}

if (btnNextMonth) {
    btnNextMonth.addEventListener('click', () => {
        console.log('[CAL] Next clicked, before:', calendarDate.toDateString());
        calendarDate.setDate(1);
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        selectedCalendarDate = null;
        console.log('[CAL] After next:', calendarDate.toDateString());
        renderCalendarGrid();
    });
} else {
    console.warn('[CAL] btnNextMonth is null!');
}

if (btnToday) {
    btnToday.addEventListener('click', () => {
        const now = new Date();
        calendarDate = new Date(now.getFullYear(), now.getMonth(), 1);
        selectedCalendarDate = now.getDate();
        renderCalendarGrid();
    });
}

if (selectCalendarMonth) {
    selectCalendarMonth.addEventListener('change', (e) => {
        calendarDate.setDate(1);
        calendarDate.setMonth(parseInt(e.target.value));
        selectedCalendarDate = null;
        renderCalendarGrid();
    });
}

if (selectCalendarYear) {
    selectCalendarYear.addEventListener('change', (e) => {
        calendarDate.setDate(1);
        calendarDate.setFullYear(parseInt(e.target.value));
        selectedCalendarDate = null;
        renderCalendarGrid();
    });
}

// Close any modal when clicking outside the modal content (on the overlay)
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
    }
});

// CSV Preview Modal Listeners
const csvPreviewModal = document.getElementById('csv-preview-modal');
const btnCloseCsvPreview = document.getElementById('btn-close-csv-preview');
const btnCancelCsvPreview = document.getElementById('btn-cancel-csv-preview');
const btnConfirmCsvPreview = document.getElementById('btn-confirm-csv-preview');

if (btnCloseCsvPreview) btnCloseCsvPreview.addEventListener('click', () => csvPreviewModal.classList.add('hidden'));
if (btnCancelCsvPreview) btnCancelCsvPreview.addEventListener('click', () => {
    window.pendingCsvImport = null;
    csvPreviewModal.classList.add('hidden');
});
if (btnConfirmCsvPreview) btnConfirmCsvPreview.addEventListener('click', async () => {
    if (!window.pendingCsvImport) return;
    btnConfirmCsvPreview.disabled = true;
    btnConfirmCsvPreview.innerText = 'Saving...';
    try {
        const { txs, cats, banks } = window.pendingCsvImport;
        // Single server call: transactions + categories + banks all at once
        const result = await addMultipleTransactions(txs, cats, banks);
        alert(`Successfully imported ${txs.length} transactions!`);
        csvPreviewModal.classList.add('hidden');
        window.pendingCsvImport = null;
        ledgerCurrentPage = 1;
    } catch (e) {
        alert('Error saving imported data: ' + e.message);
    }
});
