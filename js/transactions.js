/**
 * transactions.js — Pure Financial Calculations + Transaction Management & History UI
 *
 * All calculation helpers accept arrays/values directly and remain completely
 * independent of LocalStorage so they work seamlessly with future REST API responses.
 */

import {
  addTransaction,
  clearAllTransactions,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from './storage.js';

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Business',
  'Bonus',
  'Gift',
  'Other',
];

export const CATEGORY_COLORS = {
  Food: '#1E3A8A',
  Housing: '#0F766E',
  Transport: '#2563EB',
  Utilities: '#D97706',
  Healthcare: '#DC2626',
  Entertainment: '#7C3AED',
  Shopping: '#0284C7',
  Education: '#059669',
  Other: '#64748B',
  Salary: '#15803D',
  Freelance: '#0D9488',
  Investments: '#1D4ED8',
  Business: '#4338CA',
  Bonus: '#16A34A',
  Gift: '#9333EA',
};

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
};

// ==========================================================================
// Pure Formatting & Date Helpers (Timezone-safe YYYY-MM-DD parsing)
// ==========================================================================

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getCurrencySymbol(currencyCode = 'USD') {
  return CURRENCY_SYMBOLS[currencyCode] || '$';
}

export function formatCurrency(amount, currencyCode = 'USD') {
  const value = Number(amount) || 0;
  const isZeroDecimal = currencyCode === 'JPY';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(value);
}

export function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthKey() {
  return getTodayDateString().slice(0, 7);
}

export function formatDateLabel(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatMonthLabel(monthKey, short = false) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '—';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: short ? 'short' : 'long',
    year: short ? '2-digit' : 'numeric',
  }).format(date);
}

export function getAvailableMonths(transactions) {
  const monthSet = new Set([getCurrentMonthKey()]);
  const [curYear, curMonth] = getCurrentMonthKey().split('-').map(Number);

  // Always include the trailing 6 months for smooth exploration
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(curYear, curMonth - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthSet.add(key);
  }

  transactions.forEach((t) => {
    if (t.date && t.date.length >= 7) {
      monthSet.add(t.date.slice(0, 7));
    }
  });

  return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
}

// ==========================================================================
// Pure Financial Calculations (Independent of Storage)
// ==========================================================================

export function calculateTotals(transactions) {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const t of transactions) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += amt;
    } else {
      totalExpenses += amt;
    }
  }

  const totalBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  return {
    totalIncome,
    totalExpenses,
    totalBalance,
    savingsRate,
    transactionCount: transactions.length,
  };
}

export function calculateMonthlyTotals(transactions, monthKey) {
  const monthTxns = transactions.filter((t) => t.date && t.date.startsWith(monthKey));
  const totals = calculateTotals(monthTxns);
  return {
    monthKey,
    monthlyIncome: totals.totalIncome,
    monthlyExpenses: totals.totalExpenses,
    monthlyBalance: totals.totalBalance,
    savingsRate: totals.savingsRate,
    transactionCount: monthTxns.length,
  };
}

export function calculateCategoryBreakdown(transactions, type = 'expense', monthKey = null) {
  const filtered = transactions.filter((t) => {
    const typeMatches = !type || t.type === type;
    const monthMatches = !monthKey || (t.date && t.date.startsWith(monthKey));
    return typeMatches && monthMatches;
  });

  const map = new Map();
  let grandTotal = 0;

  for (const t of filtered) {
    const amt = Number(t.amount) || 0;
    grandTotal += amt;
    const prev = map.get(t.category) || { category: t.category, total: 0, count: 0 };
    prev.total += amt;
    prev.count += 1;
    map.set(t.category, prev);
  }

  const items = Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .map((item) => ({
      ...item,
      percentage: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0,
      color: CATEGORY_COLORS[item.category] || '#64748B',
    }));

  return {
    items,
    grandTotal,
    highestCategory: items.length > 0 ? items[0] : null,
  };
}

export function getMonthlySeries(transactions, monthCount = 6, referenceMonthKey = null) {
  const anchorKey = referenceMonthKey || getCurrentMonthKey();
  const [anchorYear, anchorMonth] = anchorKey.split('-').map(Number);
  const monthKeys = [];

  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const d = new Date(anchorYear, anchorMonth - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthKeys.push(key);
  }

  const labels = monthKeys.map((k) => formatMonthLabel(k, true));
  const incomeSeries = [];
  const expenseSeries = [];
  const netSeries = [];

  for (const key of monthKeys) {
    const m = calculateMonthlyTotals(transactions, key);
    incomeSeries.push(Math.round(m.monthlyIncome * 100) / 100);
    expenseSeries.push(Math.round(m.monthlyExpenses * 100) / 100);
    netSeries.push(Math.round(m.monthlyBalance * 100) / 100);
  }

  return { monthKeys, labels, incomeSeries, expenseSeries, netSeries };
}

export function filterAndSortTransactions(transactions, filters = {}) {
  const {
    search = '',
    category = 'all',
    type = 'all',
    month = 'all',
    sortBy = 'date-desc',
  } = filters;

  const query = search.trim().toLowerCase();

  const filtered = transactions.filter((t) => {
    if (type !== 'all' && t.type !== type) return false;
    if (category !== 'all' && t.category !== category) return false;
    if (month !== 'all' && (!t.date || !t.date.startsWith(month))) return false;

    if (query) {
      const haystack = `${t.title} ${t.description} ${t.category} ${t.amount} ${t.date}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'date-asc':
        return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
      case 'amount-desc':
        return b.amount - a.amount || b.date.localeCompare(a.date);
      case 'amount-asc':
        return a.amount - b.amount || b.date.localeCompare(a.date);
      case 'date-desc':
      default:
        return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
    }
  });
}

export function validateTransactionInput(data) {
  const errors = {};
  const title = String(data.title || '').trim();
  const amount = Number(data.amount);
  const type = data.type;
  const category = String(data.category || '').trim();
  const date = String(data.date || '').trim();
  const description = String(data.description || '').trim();

  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length > 80) {
    errors.title = 'Title must be 80 characters or fewer.';
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter a valid amount greater than 0.';
  } else if (amount > 1000000000) {
    errors.amount = 'Amount exceeds the maximum supported limit.';
  }

  if (type !== 'income' && type !== 'expense') {
    errors.type = 'Transaction type must be income or expense.';
  }

  if (!category) {
    errors.category = 'Please select a category.';
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  }

  if (description.length > 240) {
    errors.description = 'Description must be 240 characters or fewer.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildCsvContent(transactions) {
  const headers = ['ID', 'Date', 'Type', 'Category', 'Title', 'Amount', 'Description'];
  const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const rows = transactions.map((t) =>
    [t.id, t.date, t.type, t.category, t.title, t.amount.toFixed(2), t.description]
      .map(escapeCsv)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

// ==========================================================================
// Shared Transaction Table Renderer
// ==========================================================================

export function renderTransactionRowsHtml(transactions, currencyCode, options = {}) {
  const { showActions = true } = options;

  return transactions
    .map((t) => {
      const isIncome = t.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'text-income' : 'text-expense';
      const typeIcon = isIncome ? 'arrow-down-left' : 'arrow-up-right';
      const typeLabel = isIncome ? 'Income' : 'Expense';
      const safeTitle = escapeHtml(t.title);
      const safeDesc = escapeHtml(t.description);
      const safeCat = escapeHtml(t.category);

      return `
        <tr data-txn-id="${escapeHtml(t.id)}">
          <td>
            <div class="txn-title-cell">
              <span class="txn-name">${safeTitle}</span>
              ${safeDesc ? `<span class="txn-desc" title="${safeDesc}">${safeDesc}</span>` : ''}
            </div>
          </td>
          <td><span class="meta-inline">${safeCat}</span></td>
          <td>
            <span class="type-indicator ${amountClass}">
              <i data-lucide="${typeIcon}" aria-hidden="true"></i>
              <span>${typeLabel}</span>
            </span>
          </td>
          <td class="mono meta-inline">${escapeHtml(formatDateLabel(t.date))}</td>
          <td class="col-right amount-cell ${amountClass}">
            ${sign}${escapeHtml(formatCurrency(t.amount, currencyCode))}
          </td>
          ${
            showActions
              ? `<td class="col-right">
                  <div class="row-actions">
                    <button
                      type="button"
                      class="icon-btn"
                      data-action="edit-txn"
                      data-id="${escapeHtml(t.id)}"
                      aria-label="Edit ${safeTitle}"
                      title="Edit transaction"
                    >
                      <i data-lucide="pencil" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      class="icon-btn icon-btn-danger"
                      data-action="delete-txn"
                      data-id="${escapeHtml(t.id)}"
                      aria-label="Delete ${safeTitle}"
                      title="Delete transaction"
                    >
                      <i data-lucide="trash-2" aria-hidden="true"></i>
                    </button>
                  </div>
                </td>`
              : ''
          }
        </tr>
      `;
    })
    .join('');
}

// ==========================================================================
// Transaction History & Modal Form Controller (Features 2 & 3)
// ==========================================================================

const filterState = {
  search: '',
  type: 'all',
  category: 'all',
  month: 'all',
  sortBy: 'date-desc',
};

let callbacks = {
  onDataChanged: () => {},
  onConfirm: () => {},
  onToast: () => {},
  getCurrency: () => 'USD',
  getActiveMonth: () => getCurrentMonthKey(),
};

function populateFormCategories(type, selectedCategory = '') {
  const select = document.getElementById('txn-category');
  const baseList = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const list =
    selectedCategory && !baseList.includes(selectedCategory)
      ? [...baseList, selectedCategory]
      : baseList;

  select.innerHTML = list
    .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    .join('');

  if (selectedCategory && list.includes(selectedCategory)) {
    select.value = selectedCategory;
  } else {
    select.value = list[0];
  }
}

function setFormType(type) {
  const normalized = type === 'income' ? 'income' : 'expense';
  document.getElementById('txn-type').value = normalized;
  document.querySelectorAll('[data-form-type]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.formType === normalized);
  });
  populateFormCategories(normalized, document.getElementById('txn-category').value);
}

function clearFormErrors() {
  const fields = ['title', 'amount', 'category', 'date', 'description'];
  fields.forEach((f) => {
    const errEl = document.getElementById(`err-txn-${f}`);
    const inputEl = document.getElementById(`txn-${f}`);
    if (errEl) {
      errEl.textContent = '';
      errEl.hidden = true;
    }
    if (inputEl) inputEl.classList.remove('is-invalid');
  });
}

function showFormErrors(errors) {
  Object.entries(errors).forEach(([field, msg]) => {
    const errEl = document.getElementById(`err-txn-${field}`);
    const inputEl = document.getElementById(`txn-${field}`);
    if (errEl) {
      errEl.textContent = msg;
      errEl.hidden = false;
    }
    if (inputEl) inputEl.classList.add('is-invalid');
  });
}

export function openTransactionModal(transactionToEdit = null) {
  const modal = document.getElementById('transaction-modal');
  const modalTitle = document.getElementById('modal-title');
  const submitBtn = document.getElementById('modal-submit-btn');
  const currencyPrefix = document.getElementById('txn-currency-prefix');

  clearFormErrors();
  currencyPrefix.textContent = getCurrencySymbol(callbacks.getCurrency());

  if (transactionToEdit) {
    modalTitle.textContent = 'Edit Transaction';
    submitBtn.textContent = 'Update Transaction';
    document.getElementById('txn-id').value = transactionToEdit.id;
    setFormType(transactionToEdit.type);
    populateFormCategories(transactionToEdit.type, transactionToEdit.category);
    document.getElementById('txn-title').value = transactionToEdit.title;
    document.getElementById('txn-amount').value = transactionToEdit.amount;
    document.getElementById('txn-date').value = transactionToEdit.date;
    document.getElementById('txn-description').value = transactionToEdit.description || '';
  } else {
    modalTitle.textContent = 'Add Transaction';
    submitBtn.textContent = 'Save Transaction';
    document.getElementById('txn-id').value = '';
    setFormType('expense');
    document.getElementById('txn-title').value = '';
    document.getElementById('txn-amount').value = '';
    document.getElementById('txn-date').value = getTodayDateString();
    document.getElementById('txn-description').value = '';
  }

  modal.hidden = false;
  document.getElementById('txn-title').focus();
}

export function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  modal.hidden = true;
  clearFormErrors();
}

export function handleEditTransactionById(id) {
  const txn = getTransactions().find((t) => t.id === id);
  if (!txn) return;
  openTransactionModal(txn);
}

export function handleDeleteTransactionById(id) {
  const txn = getTransactions().find((t) => t.id === id);
  if (!txn) return;

  callbacks.onConfirm({
    title: 'Delete Transaction',
    message: `Delete "${txn.title}" (${formatCurrency(txn.amount, callbacks.getCurrency())})? This action cannot be undone.`,
    confirmLabel: 'Delete',
    onConfirm: () => {
      const removed = deleteTransaction(id);
      if (removed) {
        callbacks.onToast('Transaction deleted.', 'default');
        callbacks.onDataChanged();
      }
    },
  });
}

function populateHistoryFilterOptions(transactions) {
  const categorySelect = document.getElementById('filter-category');
  const monthSelect = document.getElementById('filter-month');
  if (!categorySelect || !monthSelect) return;

  const prevCat = filterState.category;
  const allCategories = Array.from(
    new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...transactions.map((t) => t.category)])
  ).sort();

  categorySelect.innerHTML = [
    '<option value="all">All Categories</option>',
    ...allCategories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`),
  ].join('');
  categorySelect.value = allCategories.includes(prevCat) ? prevCat : 'all';
  filterState.category = categorySelect.value;

  const prevMonth = filterState.month;
  const months = getAvailableMonths(transactions);
  monthSelect.innerHTML = [
    '<option value="all">All Months</option>',
    ...months.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(formatMonthLabel(m))}</option>`),
  ].join('');
  monthSelect.value = months.includes(prevMonth) ? prevMonth : 'all';
  filterState.month = monthSelect.value;
}

export function renderTransactionsView() {
  const transactions = getTransactions();
  const currency = callbacks.getCurrency();
  populateHistoryFilterOptions(transactions);

  const filtered = filterAndSortTransactions(transactions, filterState);
  const filteredTotals = calculateTotals(filtered);

  const summaryEl = document.getElementById('transactions-summary-line');
  if (summaryEl) {
    summaryEl.textContent = `${filtered.length} of ${transactions.length} transactions · Net ${formatCurrency(
      filteredTotals.totalBalance,
      currency
    )}`;
  }

  const container = document.getElementById('transactions-table-container');
  if (!container) return;

  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="receipt" aria-hidden="true"></i>
        </div>
        <h3 class="empty-state-title">No transactions recorded yet</h3>
        <p class="empty-state-desc">
          Start tracking your finances by adding your first income or expense entry.
        </p>
        <button type="button" class="btn btn-primary btn-sm" id="empty-add-txn-btn">
          <i data-lucide="plus" aria-hidden="true"></i>
          <span>Add First Transaction</span>
        </button>
      </div>
    `;
    const addBtn = document.getElementById('empty-add-txn-btn');
    if (addBtn) addBtn.addEventListener('click', () => openTransactionModal());
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="search-x" aria-hidden="true"></i>
        </div>
        <h3 class="empty-state-title">No matching transactions</h3>
        <p class="empty-state-desc">
          Try clearing your search query or adjusting the category, type, and month filters.
        </p>
        <button type="button" class="btn btn-ghost btn-sm" id="reset-filters-btn">
          Reset Filters
        </button>
      </div>
    `;
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        filterState.search = '';
        filterState.type = 'all';
        filterState.category = 'all';
        filterState.month = 'all';
        filterState.sortBy = 'date-desc';
        document.getElementById('filter-search').value = '';
        document.getElementById('filter-category').value = 'all';
        document.getElementById('filter-month').value = 'all';
        document.getElementById('sort-transactions').value = 'date-desc';
        document.querySelectorAll('[data-type-filter]').forEach((b) => {
          b.classList.toggle('is-active', b.dataset.typeFilter === 'all');
        });
        renderTransactionsView();
        if (window.lucide) window.lucide.createIcons();
      });
    }
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Category</th>
            <th>Type</th>
            <th>Date</th>
            <th class="col-right">Amount</th>
            <th class="col-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${renderTransactionRowsHtml(filtered, currency, { showActions: true })}
        </tbody>
      </table>
    </div>
  `;
}

export function initTransactionsModule(config) {
  callbacks = { ...callbacks, ...config };

  // Modal open/close controls
  document.getElementById('modal-close-btn').addEventListener('click', closeTransactionModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeTransactionModal);
  document.getElementById('transaction-modal').addEventListener('click', (e) => {
    if (e.target.id === 'transaction-modal') closeTransactionModal();
  });

  // Type toggle inside modal form
  document.querySelectorAll('[data-form-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setFormType(btn.dataset.formType);
    });
  });

  // Form submit (Add / Update)
  document.getElementById('transaction-form').addEventListener('submit', (e) => {
    e.preventDefault();
    clearFormErrors();

    const id = document.getElementById('txn-id').value.trim();
    const payload = {
      title: document.getElementById('txn-title').value,
      amount: document.getElementById('txn-amount').value,
      type: document.getElementById('txn-type').value,
      category: document.getElementById('txn-category').value,
      date: document.getElementById('txn-date').value,
      description: document.getElementById('txn-description').value,
    };

    const validation = validateTransactionInput(payload);
    if (!validation.valid) {
      showFormErrors(validation.errors);
      return;
    }

    if (id) {
      updateTransaction(id, payload);
      callbacks.onToast('Transaction updated.', 'default');
    } else {
      addTransaction(payload);
      callbacks.onToast(
        `${payload.type === 'income' ? 'Income' : 'Expense'} added.`,
        'default'
      );
    }

    closeTransactionModal();
    callbacks.onDataChanged();
  });

  // History view controls
  document.getElementById('transactions-add-btn').addEventListener('click', () => {
    openTransactionModal();
  });

  document.getElementById('clear-all-txns-btn').addEventListener('click', () => {
    const existing = getTransactions();
    if (existing.length === 0) {
      callbacks.onToast('There are no transactions to clear.', 'warning');
      return;
    }
    callbacks.onConfirm({
      title: 'Clear All Transactions',
      message: `Remove all ${existing.length} transactions from LocalStorage? Your monthly budget setting will be preserved.`,
      confirmLabel: 'Clear All',
      onConfirm: () => {
        clearAllTransactions();
        callbacks.onToast('All transactions cleared.', 'default');
        callbacks.onDataChanged();
      },
    });
  });

  document.getElementById('filter-search').addEventListener('input', (e) => {
    filterState.search = e.target.value;
    renderTransactionsView();
    if (window.lucide) window.lucide.createIcons();
  });

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterState.type = btn.dataset.typeFilter;
      document.querySelectorAll('[data-type-filter]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      renderTransactionsView();
      if (window.lucide) window.lucide.createIcons();
    });
  });

  document.getElementById('filter-category').addEventListener('change', (e) => {
    filterState.category = e.target.value;
    renderTransactionsView();
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById('filter-month').addEventListener('change', (e) => {
    filterState.month = e.target.value;
    renderTransactionsView();
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById('sort-transactions').addEventListener('change', (e) => {
    filterState.sortBy = e.target.value;
    renderTransactionsView();
    if (window.lucide) window.lucide.createIcons();
  });

  // Event delegation for Edit / Delete inside both Dashboard and Transactions tables
  document.getElementById('main-content').addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;
    if (action === 'edit-txn' && id) {
      handleEditTransactionById(id);
    } else if (action === 'delete-txn' && id) {
      handleDeleteTransactionById(id);
    }
  });
}
