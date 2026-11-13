/**
 * storage.js — Centralized LocalStorage Data Access Layer
 *
 * Isolates all persistence operations behind a clean repository interface so
 * LocalStorage can be swapped for Node.js/Express/SQL REST API calls later
 * without changing UI or calculation modules.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  SETTINGS: 'clearledger_settings_v1',
  INITIALIZED: 'clearledger_initialized_v1',
};

const DEFAULT_BUDGET = {
  monthlyLimit: 3200,
  updatedAt: '2026-11-01T09:00:00.000Z',
};

const DEFAULT_SETTINGS = {
  currency: 'USD',
};

/**
 * Generates a collision-resistant unique transaction ID.
 */
function generateTransactionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `txn_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `txn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Returns realistic multi-month sample transactions anchored around November 2026
 * so Dashboard, Analytics, and Budget views work meaningfully on first load.
 */
function getDefaultSampleTransactions() {
  return [
    {
      id: 'txn_seed_01',
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: '2026-11-01',
      description: 'Primary engineering payroll deposit',
    },
    {
      id: 'txn_seed_02',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: '2026-11-02',
      description: 'November lease payment',
    },
    {
      id: 'txn_seed_03',
      title: 'UI Audit Consulting',
      amount: 850,
      category: 'Freelance',
      type: 'income',
      date: '2026-11-04',
      description: 'Client design system review',
    },
    {
      id: 'txn_seed_04',
      title: 'Electric & Fiber Internet',
      amount: 168.5,
      category: 'Utilities',
      type: 'expense',
      date: '2026-11-05',
      description: 'Monthly power and gigabit internet',
    },
    {
      id: 'txn_seed_05',
      title: 'Trader Joe’s Groceries',
      amount: 214.25,
      category: 'Food',
      type: 'expense',
      date: '2026-11-07',
      description: 'Weekly pantry and produce restock',
    },
    {
      id: 'txn_seed_06',
      title: 'Metro Pass & Fuel',
      amount: 132,
      category: 'Transport',
      type: 'expense',
      date: '2026-11-08',
      description: 'Monthly commuter pass and gas',
    },
    {
      id: 'txn_seed_07',
      title: 'Dental Checkup',
      amount: 185,
      category: 'Healthcare',
      type: 'expense',
      date: '2026-11-10',
      description: 'Routine cleaning co-pay',
    },
    {
      id: 'txn_seed_08',
      title: 'Running Shoes & Gear',
      amount: 196,
      category: 'Shopping',
      type: 'expense',
      date: '2026-11-11',
      description: 'Replacement trainers and socks',
    },
    {
      id: 'txn_seed_09',
      title: 'Grocery Shopping',
      amount: 245,
      category: 'Food',
      type: 'expense',
      date: '2026-11-12',
      description: 'Weekly groceries and household supplies',
    },
    {
      id: 'txn_seed_10',
      title: 'Dinner & Cinema',
      amount: 118.75,
      category: 'Entertainment',
      type: 'expense',
      date: '2026-11-13',
      description: 'Weekend dinner and tickets',
    },
    // October 2026
    {
      id: 'txn_seed_11',
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: '2026-10-01',
      description: 'October payroll deposit',
    },
    {
      id: 'txn_seed_12',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: '2026-10-02',
      description: 'October lease payment',
    },
    {
      id: 'txn_seed_13',
      title: 'Groceries & Dining',
      amount: 520,
      category: 'Food',
      type: 'expense',
      date: '2026-10-12',
      description: 'Monthly food and dining expenses',
    },
    {
      id: 'txn_seed_14',
      title: 'Utilities & Mobile',
      amount: 192,
      category: 'Utilities',
      type: 'expense',
      date: '2026-10-16',
      description: 'Electricity, water, and phone plan',
    },
    {
      id: 'txn_seed_15',
      title: 'Online Course Subscription',
      amount: 149,
      category: 'Education',
      type: 'expense',
      date: '2026-10-21',
      description: 'Annual technical workshop access',
    },
    {
      id: 'txn_seed_16',
      title: 'Quarterly Dividend',
      amount: 320,
      category: 'Investments',
      type: 'income',
      date: '2026-10-24',
      description: 'Index fund distribution',
    },
    // September 2026
    {
      id: 'txn_seed_17',
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: '2026-09-01',
      description: 'September payroll deposit',
    },
    {
      id: 'txn_seed_18',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: '2026-09-02',
      description: 'September lease payment',
    },
    {
      id: 'txn_seed_19',
      title: 'Groceries & Coffee',
      amount: 465,
      category: 'Food',
      type: 'expense',
      date: '2026-09-14',
      description: 'Supermarket and coffee shops',
    },
    {
      id: 'txn_seed_20',
      title: 'Train Tickets & Rides',
      amount: 210,
      category: 'Transport',
      type: 'expense',
      date: '2026-09-19',
      description: 'Intercity rail and transit',
    },
    // August 2026
    {
      id: 'txn_seed_21',
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: '2026-08-01',
      description: 'August payroll deposit',
    },
    {
      id: 'txn_seed_22',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: '2026-08-02',
      description: 'August lease payment',
    },
    {
      id: 'txn_seed_23',
      title: 'Groceries & Market',
      amount: 495,
      category: 'Food',
      type: 'expense',
      date: '2026-08-15',
      description: 'Weekly market groceries',
    },
    {
      id: 'txn_seed_24',
      title: 'Summer Flight Booking',
      amount: 440,
      category: 'Entertainment',
      type: 'expense',
      date: '2026-08-20',
      description: 'Weekend trip airfare',
    },
  ];
}

function safeReadJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read key "${key}" from LocalStorage:`, err);
    return fallback;
  }
}

function safeWriteJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Failed to write key "${key}" to LocalStorage:`, err);
    return false;
  }
}

/**
 * Seeds sample data once on first visit so new users see a working ledger
 * while respecting empty states if the user later deletes all records.
 */
export function initializeStorageIfNeeded() {
  const alreadyInitialized = window.localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (!alreadyInitialized) {
    safeWriteJson(STORAGE_KEYS.TRANSACTIONS, getDefaultSampleTransactions());
    safeWriteJson(STORAGE_KEYS.BUDGET, DEFAULT_BUDGET);
    safeWriteJson(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    window.localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }
}

/**
 * Retrieves all stored transactions as normalized objects.
 * Future REST equivalent: GET /api/transactions
 */
export function getTransactions() {
  const list = safeReadJson(STORAGE_KEYS.TRANSACTIONS, []);
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    id: String(item.id),
    title: String(item.title || ''),
    amount: Number(item.amount) || 0,
    category: String(item.category || 'Other'),
    type: item.type === 'income' ? 'income' : 'expense',
    date: String(item.date || ''),
    description: String(item.description || ''),
  }));
}

/**
 * Persists the entire transactions list.
 */
export function saveTransactions(transactions) {
  return safeWriteJson(STORAGE_KEYS.TRANSACTIONS, transactions);
}

/**
 * Creates and persists a new transaction.
 * Future REST equivalent: POST /api/transactions
 */
export function addTransaction(transactionInput) {
  const existing = getTransactions();
  const newTransaction = {
    id: generateTransactionId(),
    title: String(transactionInput.title).trim(),
    amount: Math.round(Number(transactionInput.amount) * 100) / 100,
    category: String(transactionInput.category).trim(),
    type: transactionInput.type === 'income' ? 'income' : 'expense',
    date: String(transactionInput.date),
    description: String(transactionInput.description || '').trim(),
  };
  existing.push(newTransaction);
  saveTransactions(existing);
  return newTransaction;
}

/**
 * Updates an existing transaction by ID.
 * Future REST equivalent: PUT /api/transactions/:id
 */
export function updateTransaction(id, updatedFields) {
  const existing = getTransactions();
  const idx = existing.findIndex((item) => item.id === id);
  if (idx === -1) return null;

  const updated = {
    ...existing[idx],
    title: String(updatedFields.title).trim(),
    amount: Math.round(Number(updatedFields.amount) * 100) / 100,
    category: String(updatedFields.category).trim(),
    type: updatedFields.type === 'income' ? 'income' : 'expense',
    date: String(updatedFields.date),
    description: String(updatedFields.description || '').trim(),
  };

  existing[idx] = updated;
  saveTransactions(existing);
  return updated;
}

/**
 * Deletes a single transaction by ID.
 * Future REST equivalent: DELETE /api/transactions/:id
 */
export function deleteTransaction(id) {
  const existing = getTransactions();
  const next = existing.filter((item) => item.id !== id);
  if (next.length === existing.length) return false;
  saveTransactions(next);
  return true;
}

/**
 * Removes all transactions while preserving budget & initialization flag.
 */
export function clearAllTransactions() {
  return saveTransactions([]);
}

/**
 * Restores realistic sample transactions and default monthly budget.
 */
export function resetDemoData() {
  safeWriteJson(STORAGE_KEYS.TRANSACTIONS, getDefaultSampleTransactions());
  safeWriteJson(STORAGE_KEYS.BUDGET, { ...DEFAULT_BUDGET, updatedAt: new Date().toISOString() });
  window.localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}

/**
 * Retrieves monthly budget configuration.
 * Future REST equivalent: GET /api/budget
 */
export function getBudget() {
  const raw = safeReadJson(STORAGE_KEYS.BUDGET, DEFAULT_BUDGET);
  const monthlyLimit = Number(raw?.monthlyLimit);
  return {
    monthlyLimit: Number.isFinite(monthlyLimit) && monthlyLimit >= 0 ? monthlyLimit : 0,
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

/**
 * Persists monthly budget configuration.
 * Future REST equivalent: PUT /api/budget
 */
export function saveBudget(budgetData) {
  const payload = {
    monthlyLimit: Math.round(Number(budgetData.monthlyLimit) * 100) / 100,
    updatedAt: new Date().toISOString(),
  };
  safeWriteJson(STORAGE_KEYS.BUDGET, payload);
  return payload;
}

/**
 * Retrieves user preferences (currency, etc.).
 */
export function getSettings() {
  const raw = safeReadJson(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  return {
    currency: raw?.currency || 'USD',
  };
}

/**
 * Saves user preferences.
 */
export function saveSettings(settings) {
  const current = getSettings();
  const next = { ...current, ...settings };
  safeWriteJson(STORAGE_KEYS.SETTINGS, next);
  return next;
}
