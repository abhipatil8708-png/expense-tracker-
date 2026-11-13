/**
 * dashboard.js — Dashboard View Module (Feature 1)
 *
 * Dynamically calculates and renders:
 * - Total Balance (= Total Income - Total Expenses)
 * - Total Income & Total Expenses
 * - Monthly Spending & Budget utilization context
 * - Monthly Spending Overview chart
 * - Expense Category Breakdown chart & legend
 * - Recent Transactions list
 */

import { calculateBudgetStatus } from './budget.js';
import { getBudget, getTransactions } from './storage.js';
import {
  calculateCategoryBreakdown,
  calculateMonthlyTotals,
  calculateTotals,
  escapeHtml,
  filterAndSortTransactions,
  formatCurrency,
  formatMonthLabel,
  getMonthlySeries,
  openTransactionModal,
  renderTransactionRowsHtml,
} from './transactions.js';

let monthlyChart = null;
let categoryChart = null;

let dashboardCallbacks = {
  onNavigate: () => {},
  getCurrency: () => 'USD',
  getActiveMonth: () => '',
};

function destroyDashboardCharts() {
  if (monthlyChart) {
    monthlyChart.destroy();
    monthlyChart = null;
  }
  if (categoryChart) {
    categoryChart.destroy();
    categoryChart = null;
  }
}

function renderMonthlySpendingChart(transactions, activeMonth, currency) {
  const canvas = document.getElementById('dashboard-monthly-chart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  const series = getMonthlySeries(transactions, 6, activeMonth);

  monthlyChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Monthly Spending',
          data: series.expenseSeries,
          backgroundColor: series.monthKeys.map((key) =>
            key === activeMonth ? '#1E3A8A' : '#CBD5E1'
          ),
          borderRadius: 5,
          maxBarThickness: 38,
        },
        {
          label: 'Monthly Income',
          data: series.incomeSeries,
          type: 'line',
          borderColor: '#15803D',
          backgroundColor: 'rgba(21, 128, 61, 0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#15803D',
          tension: 0.25,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            usePointStyle: true,
            font: { family: 'Plus Jakarta Sans', size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y, currency)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Plus Jakarta Sans', size: 11.5 }, color: '#64748B' },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#F1F5F9' },
          ticks: {
            font: { family: 'JetBrains Mono', size: 11 },
            color: '#64748B',
            callback: (val) => formatCurrency(val, currency),
          },
        },
      },
    },
  });
}

function renderCategoryBreakdown(breakdown, currency, monthLabel) {
  const wrap = document.getElementById('dashboard-category-chart-wrap');
  const listEl = document.getElementById('dashboard-category-list');
  const subEl = document.getElementById('dashboard-category-subtitle');
  if (!wrap || !listEl) return;

  if (subEl) subEl.textContent = `Expense distribution · ${monthLabel}`;

  if (breakdown.items.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">No expenses in ${escapeHtml(monthLabel)}</p>
        <p class="empty-state-desc">Add an expense entry to view category proportions.</p>
      </div>
    `;
    listEl.innerHTML = '';
    return;
  }

  wrap.innerHTML =
    '<canvas id="dashboard-category-chart" aria-label="Expense category breakdown chart"></canvas>';
  const canvas = document.getElementById('dashboard-category-chart');

  if (canvas && typeof window.Chart !== 'undefined') {
    categoryChart = new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: breakdown.items.map((i) => i.category),
        datasets: [
          {
            data: breakdown.items.map((i) => i.total),
            backgroundColor: breakdown.items.map((i) => i.color),
            borderWidth: 2,
            borderColor: '#FFFFFF',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = breakdown.items[ctx.dataIndex];
                return `${item.category}: ${formatCurrency(item.total, currency)} (${item.percentage.toFixed(1)}%)`;
              },
            },
          },
        },
      },
    });
  }

  listEl.innerHTML = breakdown.items
    .slice(0, 5)
    .map(
      (item) => `
      <li class="breakdown-row">
        <span class="breakdown-label">
          <span class="swatch-dot" style="background-color: ${escapeHtml(item.color)}"></span>
          <span>${escapeHtml(item.category)}</span>
        </span>
        <span class="breakdown-values">
          <span class="breakdown-amount">${escapeHtml(formatCurrency(item.total, currency))}</span>
          <span>${item.percentage.toFixed(1)}%</span>
        </span>
      </li>
    `
    )
    .join('');
}

export function renderDashboardView() {
  const transactions = getTransactions();
  const budget = getBudget();
  const currency = dashboardCallbacks.getCurrency();
  const activeMonth = dashboardCallbacks.getActiveMonth();
  const monthLabel = formatMonthLabel(activeMonth);

  const totals = calculateTotals(transactions);
  const monthly = calculateMonthlyTotals(transactions, activeMonth);
  const budgetStatus = calculateBudgetStatus(monthly.monthlyExpenses, budget.monthlyLimit);
  const breakdown = calculateCategoryBreakdown(transactions, 'expense', activeMonth);

  // Dashboard Budget Warning / Exceeded Inline Alert
  const alertEl = document.getElementById('dashboard-budget-alert');
  if (alertEl) {
    if (budgetStatus.status === 'exceeded') {
      alertEl.hidden = false;
      alertEl.className = 'inline-alert is-danger';
      alertEl.innerHTML = `
        <div class="inline-alert-content">
          <i data-lucide="alert-octagon" class="inline-alert-icon" aria-hidden="true"></i>
          <div>
            <p class="inline-alert-title">Monthly Budget Exceeded (${budgetStatus.utilizationPercent.toFixed(1)}%)</p>
            <p class="inline-alert-desc">
              ${escapeHtml(monthLabel)} spending is ${escapeHtml(formatCurrency(budgetStatus.overBy, currency))} over your ${escapeHtml(formatCurrency(budgetStatus.limit, currency))} limit.
            </p>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="dash-alert-budget-btn">Review Budget</button>
      `;
    } else if (budgetStatus.status === 'warning') {
      alertEl.hidden = false;
      alertEl.className = 'inline-alert is-warning';
      alertEl.innerHTML = `
        <div class="inline-alert-content">
          <i data-lucide="alert-triangle" class="inline-alert-icon" aria-hidden="true"></i>
          <div>
            <p class="inline-alert-title">Budget Warning: ${budgetStatus.utilizationPercent.toFixed(1)}% Used</p>
            <p class="inline-alert-desc">
              ${escapeHtml(formatCurrency(budgetStatus.remaining, currency))} remaining out of ${escapeHtml(formatCurrency(budgetStatus.limit, currency))} for ${escapeHtml(monthLabel)}.
            </p>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="dash-alert-budget-btn">Review Budget</button>
      `;
    } else {
      alertEl.hidden = true;
      alertEl.innerHTML = '';
    }

    const alertBtn = document.getElementById('dash-alert-budget-btn');
    if (alertBtn) {
      alertBtn.addEventListener('click', () => dashboardCallbacks.onNavigate('budget'));
    }
  }

  // 4 Dynamic KPI Summary Cards
  const kpiGrid = document.getElementById('dashboard-kpi-grid');
  if (kpiGrid) {
    const balanceClass = totals.totalBalance >= 0 ? 'text-income' : 'text-expense';
    const budgetMetaText =
      budgetStatus.limit > 0
        ? `${budgetStatus.utilizationPercent.toFixed(1)}% of ${formatCurrency(budgetStatus.limit, currency)} budget`
        : 'No monthly budget set';

    kpiGrid.innerHTML = `
      <article class="kpi-card">
        <div class="kpi-label"><span>Total Balance</span></div>
        <div class="kpi-value ${balanceClass}">${escapeHtml(
      formatCurrency(totals.totalBalance, currency)
    )}</div>
        <div class="kpi-meta mono">${totals.transactionCount} total records</div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label"><span>Total Income</span></div>
        <div class="kpi-value text-income">${escapeHtml(
      formatCurrency(totals.totalIncome, currency)
    )}</div>
        <div class="kpi-meta mono">${escapeHtml(monthLabel)}: ${escapeHtml(
      formatCurrency(monthly.monthlyIncome, currency)
    )}</div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label"><span>Total Expenses</span></div>
        <div class="kpi-value text-expense">${escapeHtml(
      formatCurrency(totals.totalExpenses, currency)
    )}</div>
        <div class="kpi-meta mono">${
          totals.totalIncome > 0
            ? `${totals.savingsRate.toFixed(1)}% net savings rate`
            : 'All-time outgoing'
        }</div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label"><span>Monthly Spending (${escapeHtml(formatMonthLabel(activeMonth, true))})</span></div>
        <div class="kpi-value">${escapeHtml(formatCurrency(monthly.monthlyExpenses, currency))}</div>
        <div class="kpi-meta mono ${
          budgetStatus.status === 'exceeded'
            ? 'text-expense'
            : budgetStatus.status === 'warning'
              ? 'text-warning'
              : ''
        }">${escapeHtml(budgetMetaText)}</div>
      </article>
    `;
  }

  // Monthly spending subtitle
  const spendSub = document.getElementById('dashboard-spending-subtitle');
  if (spendSub) {
    spendSub.textContent = `Income and spending trend ending ${monthLabel}`;
  }

  // Recent Transactions (top 6 sorted newest first)
  const recentContainer = document.getElementById('dashboard-recent-container');
  if (recentContainer) {
    const recent = filterAndSortTransactions(transactions, { sortBy: 'date-desc' }).slice(0, 6);
    if (recent.length === 0) {
      recentContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i data-lucide="wallet" aria-hidden="true"></i>
          </div>
          <h3 class="empty-state-title">Your ledger is empty</h3>
          <p class="empty-state-desc">
            Add your first income or expense transaction to populate your dashboard metrics and charts.
          </p>
          <button type="button" class="btn btn-primary btn-sm" id="dash-empty-add-btn">
            <i data-lucide="plus" aria-hidden="true"></i>
            <span>Add Transaction</span>
          </button>
        </div>
      `;
      const addBtn = document.getElementById('dash-empty-add-btn');
      if (addBtn) addBtn.addEventListener('click', () => openTransactionModal());
    } else {
      recentContainer.innerHTML = `
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
              ${renderTransactionRowsHtml(recent, currency, { showActions: true })}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  destroyDashboardCharts();
  renderMonthlySpendingChart(transactions, activeMonth, currency);
  renderCategoryBreakdown(breakdown, currency, monthLabel);
}

export function initDashboardModule(config) {
  dashboardCallbacks = { ...dashboardCallbacks, ...config };

  const viewAllBtn = document.getElementById('dashboard-view-all-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => dashboardCallbacks.onNavigate('transactions'));
  }
}
