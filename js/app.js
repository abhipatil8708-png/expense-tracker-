/**
 * app.js — Application Entry Point & View Orchestrator
 *
 * Coordinates initialization, sidebar/view routing, active month & currency
 * selection, confirmation dialogs, toast feedback, and reactive cross-module rendering.
 */

import { initAnalyticsModule, renderAnalyticsView } from './analytics.js';
import { initBudgetModule, renderBudgetView } from './budget.js';
import { initDashboardModule, renderDashboardView } from './dashboard.js';
import {
  getSettings,
  getTransactions,
  initializeStorageIfNeeded,
  resetDemoData,
  saveSettings,
} from './storage.js';
import {
  buildCsvContent,
  closeTransactionModal,
  escapeHtml,
  formatMonthLabel,
  getAvailableMonths,
  getCurrentMonthKey,
  initTransactionsModule,
  openTransactionModal,
  renderTransactionsView,
} from './transactions.js';

const VIEW_LABELS = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  analytics: 'Analytics',
  budget: 'Budget',
};

const appState = {
  activeView: 'dashboard',
  activeMonth: getCurrentMonthKey(),
  currency: 'USD',
};

let pendingConfirmAction = null;

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, variant = 'default') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${variant === 'error' ? 'is-error' : variant === 'warning' ? 'is-warning' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

function openConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm }) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-title').textContent = title || 'Confirm Action';
  document.getElementById('confirm-message').textContent = message || '';
  document.getElementById('confirm-proceed-btn').textContent = confirmLabel;
  pendingConfirmAction = onConfirm;
  modal.hidden = false;
  document.getElementById('confirm-proceed-btn').focus();
}

function closeConfirmDialog() {
  const modal = document.getElementById('confirm-modal');
  modal.hidden = true;
  pendingConfirmAction = null;
}

function syncMonthSelector() {
  const select = document.getElementById('active-month-select');
  if (!select) return;

  const transactions = getTransactions();
  const months = getAvailableMonths(transactions);

  if (!months.includes(appState.activeMonth)) {
    appState.activeMonth = months[0] || getCurrentMonthKey();
  }

  select.innerHTML = months
    .map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(formatMonthLabel(m))}</option>`)
    .join('');
  select.value = appState.activeMonth;
}

function renderActiveView() {
  switch (appState.activeView) {
    case 'transactions':
      renderTransactionsView();
      break;
    case 'analytics':
      renderAnalyticsView();
      break;
    case 'budget':
      renderBudgetView();
      break;
    case 'dashboard':
    default:
      renderDashboardView();
      break;
  }
  refreshIcons();
}

function handleDataChanged() {
  syncMonthSelector();
  renderActiveView();
}

function navigateTo(viewName) {
  if (!VIEW_LABELS[viewName]) return;
  appState.activeView = viewName;

  document.getElementById('page-title').textContent = VIEW_LABELS[viewName];

  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === viewName);
  });

  document.querySelectorAll('.view-section').forEach((section) => {
    const isMatch = section.id === `view-${viewName}`;
    section.hidden = !isMatch;
    section.classList.toggle('is-active', isMatch);
  });

  closeMobileSidebar();
  renderActiveView();
}

function openMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('is-open');
  if (backdrop) backdrop.hidden = false;
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('is-open');
  if (backdrop) backdrop.hidden = true;
}

function handleExportCsv() {
  const transactions = getTransactions();
  if (transactions.length === 0) {
    showToast('No transactions available to export.', 'warning');
    return;
  }

  const csv = buildCsvContent(transactions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `clearledger-transactions-${getCurrentMonthKey()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  showToast(`Exported ${transactions.length} transactions to CSV.`);
}

function bootstrap() {
  initializeStorageIfNeeded();

  const settings = getSettings();
  appState.currency = settings.currency || 'USD';

  const currencySelect = document.getElementById('currency-select');
  if (currencySelect) {
    currencySelect.value = appState.currency;
    currencySelect.addEventListener('change', (e) => {
      appState.currency = e.target.value;
      saveSettings({ currency: appState.currency });
      renderActiveView();
      showToast(`Display currency changed to ${appState.currency}.`);
    });
  }

  // Active Month Selector
  syncMonthSelector();
  const monthSelect = document.getElementById('active-month-select');
  if (monthSelect) {
    monthSelect.addEventListener('change', (e) => {
      appState.activeMonth = e.target.value;
      renderActiveView();
    });
  }

  // Initialize feature modules with shared state accessors & callbacks
  const sharedConfig = {
    onDataChanged: handleDataChanged,
    onNavigate: navigateTo,
    onConfirm: openConfirmDialog,
    onToast: showToast,
    getCurrency: () => appState.currency,
    getActiveMonth: () => appState.activeMonth,
  };

  initTransactionsModule(sharedConfig);
  initDashboardModule(sharedConfig);
  initAnalyticsModule(sharedConfig);
  initBudgetModule(sharedConfig);

  // Navigation listeners
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });

  document.querySelector('.brand-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('dashboard');
  });

  // Top bar Add Transaction button
  document.getElementById('open-add-modal-btn')?.addEventListener('click', () => {
    openTransactionModal();
  });

  // Mobile sidebar drawer controls
  document.getElementById('sidebar-open-btn')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Confirm modal controls
  document.getElementById('confirm-close-btn')?.addEventListener('click', closeConfirmDialog);
  document.getElementById('confirm-cancel-btn')?.addEventListener('click', closeConfirmDialog);
  document.getElementById('confirm-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'confirm-modal') closeConfirmDialog();
  });
  document.getElementById('confirm-proceed-btn')?.addEventListener('click', () => {
    const fn = pendingConfirmAction;
    closeConfirmDialog();
    if (typeof fn === 'function') fn();
  });

  // Sidebar Utility Actions
  document.getElementById('export-csv-btn')?.addEventListener('click', handleExportCsv);
  document.getElementById('reset-demo-btn')?.addEventListener('click', () => {
    openConfirmDialog({
      title: 'Reset Sample Data',
      message:
        'Restore the default multi-month sample transactions and $3,200 monthly budget? Current changes will be replaced.',
      confirmLabel: 'Reset Data',
      onConfirm: () => {
        resetDemoData();
        appState.activeMonth = getCurrentMonthKey();
        handleDataChanged();
        showToast('Sample data restored.');
      },
    });
  });

  // Keyboard Escape handler for modals & mobile drawer
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const txnModal = document.getElementById('transaction-modal');
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal && !confirmModal.hidden) {
      closeConfirmDialog();
    } else if (txnModal && !txnModal.hidden) {
      closeTransactionModal();
    } else {
      closeMobileSidebar();
    }
  });

  // Initial render
  navigateTo('dashboard');
}

// Wait for deferred CDN scripts (Chart.js, Lucide) before bootstrapping
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
