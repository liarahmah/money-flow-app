// storage.js - Google Drive is the single source of truth.
import { loadDataFromDrive, saveToDrive } from './gdrive.js';

// ─── Internal state ──────────────────────────────────────────────────────────
let _transactions = [];
let _categories = [];
let _banks = [];
let _subscriptions = [];
let _debts = [];
let _listeners = [];

function _notify() {
    _listeners.forEach(cb => cb([..._transactions]));
}

function getAllState() {
    return {
        transactions: _transactions,
        categories: _categories,
        banks: _banks,
        subscriptions: _subscriptions,
        debts: _debts
    };
}

// ─── Bootstrap: load everything from Google Drive on startup ─────────────────
export async function initialLoadFromBackend() {
    try {
        const data = await loadDataFromDrive();
        _transactions = (data.transactions || []).sort((a, b) => new Date(b.date) - new Date(a.date));
        _categories = (data.categories || []).map(c => {
            if (typeof c === 'string') return { name: c, budgets: {} };
            if (c.budget !== undefined && !c.budgets) {
                const now = new Date();
                const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`;
                return { name: c.name, budgets: { [defaultMonth]: c.budget } };
            }
            return { name: c.name, budgets: c.budgets || {} };
        });
        _banks = (data.banks || []).map(b => typeof b === 'string' ? { name: b, initialBalance: 0, initialDate: '' } : b);
        _subscriptions = data.subscriptions || [];
        _debts = data.debts || [];
        
        _notify();
        window.dispatchEvent(new Event('categories_updated'));
        window.dispatchEvent(new Event('banks_updated'));
        window.dispatchEvent(new Event('subscriptions_updated'));
        window.dispatchEvent(new Event('debts_updated'));
    } catch (err) {
        console.error('Failed to load from Google Drive:', err);
    }
}

// ─── Listener (used by app.js to react to data changes) ──────────────────────
export function listenToTransactions(callback) {
    _listeners.push(callback);
    callback([..._transactions]); 
    return () => { _listeners = _listeners.filter(l => l !== callback); };
}

// ─── Categories ───────────────────────────────────────────────────────────────
export function getCategories() { return [..._categories]; }

export async function saveCategories(categories) {
    const unique = [];
    const seen = new Set();
    for (const c of categories) {
        if (c && c.name && !seen.has(c.name.toLowerCase())) {
            seen.add(c.name.toLowerCase());
            unique.push(c);
        }
    }
    _categories = unique;
    window.dispatchEvent(new Event('categories_updated'));
    try {
        await saveToDrive(getAllState());
    } catch (err) { console.error('Failed to save categories:', err); }
}

export function addCategories(newCats) {
    const formatted = newCats.map(c => typeof c === 'string' ? { name: c, budgets: {} } : c);
    saveCategories([..._categories, ...formatted]);
}

export function updateCategoryBudget(name, monthStr, newBudget) {
    const idx = _categories.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    if (idx !== -1) {
        if (!_categories[idx].budgets) _categories[idx].budgets = {};
        _categories[idx].budgets[monthStr] = newBudget;
        saveCategories([..._categories]);
    }
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export async function addTransaction(data) {
    try {
        const id = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const tx = { ...data, id };
        _transactions.unshift(tx);
        _transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        _notify();
        await saveToDrive(getAllState());
        return id;
    } catch (err) { console.error('Failed to add transaction:', err); }
}

export async function addMultipleTransactions(txArray, categories = [], banks = []) {
    try {
        txArray.forEach(tx => {
            if (!tx.id) tx.id = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        });
        _transactions = [..._transactions, ...txArray].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (categories.length > 0) {
            const formatted = categories.map(c => typeof c === 'string' ? { name: c, budgets: {} } : c);
            _categories = [..._categories, ...formatted];
            window.dispatchEvent(new Event('categories_updated'));
        }
        if (banks.length > 0) {
            const map = new Map(_banks.map(b => [b.name, b]));
            banks.forEach(b => {
                const entry = typeof b === 'string' ? { name: b, initialBalance: 0, initialDate: '' } : b;
                if (entry.name && !map.has(entry.name)) map.set(entry.name, entry);
            });
            _banks = Array.from(map.values());
            window.dispatchEvent(new Event('banks_updated'));
        }
        
        _notify();
        await saveToDrive(getAllState());
        return { success: true };
    } catch (err) {
        console.error('Failed to bulk add:', err);
        throw err;
    }
}

export async function deleteTransaction(id) {
    _transactions = _transactions.filter(tx => tx.id !== id);
    _notify();
    try {
        await saveToDrive(getAllState());
    } catch (err) {
        console.error('Server delete failed:', err);
        await initialLoadFromBackend();
    }
}

export async function bulkDeleteTransactions(ids) {
    _transactions = _transactions.filter(tx => !ids.includes(tx.id));
    _notify();
    try {
        await saveToDrive(getAllState());
    } catch (err) {
        console.error('Server bulk delete failed:', err);
        await initialLoadFromBackend();
    }
}

export async function editTransaction(id, updatedData) {
    const idx = _transactions.findIndex(tx => tx.id === id);
    if (idx !== -1) {
        _transactions[idx] = { ..._transactions[idx], ...updatedData };
        _notify();
    }
    try {
        await saveToDrive(getAllState());
    } catch (err) {
        console.error('Server edit failed:', err);
        await initialLoadFromBackend();
    }
}

export async function bulkEditTransactions(ids, updates) {
    _transactions = _transactions.map(tx => ids.includes(tx.id) ? { ...tx, ...updates } : tx);
    _notify();
    try {
        await saveToDrive(getAllState());
    } catch (err) {
        console.error('Server bulk edit failed:', err);
        await initialLoadFromBackend();
    }
}

// ─── Banks ────────────────────────────────────────────────────────────────────
export function getBankAccounts() { return [..._banks]; }

export async function saveBankAccounts(accounts) {
    _banks = accounts;
    window.dispatchEvent(new Event('banks_updated'));
    try {
        await saveToDrive(getAllState());
    } catch (err) { console.error('Failed to save banks:', err); }
}

export function addBankAccounts(newBanks) {
    const map = new Map(_banks.map(b => [b.name, b]));
    newBanks.forEach(b => {
        const entry = typeof b === 'string' ? { name: b, initialBalance: 0, initialDate: '' } : b;
        if (entry.name && !map.has(entry.name)) map.set(entry.name, entry);
    });
    saveBankAccounts(Array.from(map.values()));
}

// ─── Subscriptions ─────────────────────────────────────────────────────────────
export function getSubscriptions() { return [..._subscriptions]; }

export async function addSubscription(data) {
    try {
        const id = 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const sub = { ...data, id };
        _subscriptions.push(sub);
        window.dispatchEvent(new Event('subscriptions_updated'));
        await saveToDrive(getAllState());
        return id;
    } catch (err) { console.error('Failed to add subscription:', err); }
}

export async function deleteSubscription(id) {
    _subscriptions = _subscriptions.filter(s => s.id !== id);
    window.dispatchEvent(new Event('subscriptions_updated'));
    try {
        await saveToDrive(getAllState());
    } catch (err) {
        console.error('Server delete failed:', err);
        await initialLoadFromBackend();
    }
}

// ─── Debts ────────────────────────────────────────────────────────────────
export function getDebts() { return [..._debts]; }

export async function addDebt(data) {
    try {
        const id = 'debt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const debt = { ...data, id };
        _debts.push(debt);
        window.dispatchEvent(new Event('debts_updated'));
        await saveToDrive(getAllState());
        return id;
    } catch (err) { console.error('Failed to add debt:', err); }
}

export async function updateDebt(id, updates) {
    try {
        const index = _debts.findIndex(d => d.id === id);
        if (index !== -1) {
            _debts[index] = { ..._debts[index], ...updates };
            window.dispatchEvent(new Event('debts_updated'));
            await saveToDrive(getAllState());
        }
    } catch (err) { console.error('Failed to update debt:', err); }
}

export async function deleteDebt(id) {
    try {
        _debts = _debts.filter(d => d.id !== id);
        window.dispatchEvent(new Event('debts_updated'));
        await saveToDrive(getAllState());
    } catch (err) {
        console.error('Server delete failed:', err);
        await initialLoadFromBackend();
    }
}

// ─── Export / Import ──────────────────────────────────────────────────────────
export function exportAllData() {
    const data = getAllState();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`wimm_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json\`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importAllData(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.categories) _categories = data.categories;
            if (data.banks) _banks = data.banks;
            if (data.transactions) _transactions = data.transactions;
            if (data.subscriptions) _subscriptions = data.subscriptions;
            if (data.debts) _debts = data.debts;
            
            await saveToDrive(getAllState());
            await initialLoadFromBackend();
            alert('Data imported successfully.');
        } catch (err) {
            alert('Failed to import data: ' + err.message);
        }
    };
    reader.readAsText(file);
}
