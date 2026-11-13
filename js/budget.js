/**
 * budget.js — Budget Management Module (Feature 5)
 *
 * Pure budget status calculations + UI rendering for monthly budget limit,
 * remaining balance, utilization bar, 80% warning, and >100% exceeded alert.
 */

import { getBudget, getTransactions, saveBudget } from './storage.js';
import {
  calculateCategoryBreakdown,
  calculateMonthlyTotals,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getCurrencySymbol,
  getMonthlySeries,
} from './transactions.js';

let budgetHistoryChart = null;
let budgetCallbacks = {
  onDataChanged: () => {},
  onToast: () => {},
  getCurrency: () => 'USD',
  getActiveMonth: () => '',
};

/**
 * Pure budget calculation independent of storage.
 * Returns status: 'unset' | 'healthy' | 'warning' | 'exceeded'
 */
export function calculateBudgetStatus(monthlyExpenses, monthlyLimit) {
  const spent = Number(monthlyExpenses) || 0;
  const limit = Number(monthlyLimit) || 0;

  if (limit <= 0) {
    return {
      limit: 0,
      spent,
      remaining: 0,
      overBy: 0,
      utilizationPercent: 0,
      clampedPercent: 0,
      status: 'unset',
      label: 'Not Set',
    };
  }

  const remaining = limit - spent;
  const utilizationPercent = (spent / limit) * 100;
  const clampedPercent = Math.min(Math.max(utilizationPercent, 0), 100);

  let status = 'healthy';
  let label = 'On Track';

  if (utilizationPercent > 100) {
    status = 'exceeded';
    label = 'Budget Exceeded';
  } else if (utilizationPercent >= 80) {
    status = 'warning';
    label = 'Approaching Limit (80%+)';
  }

  return {
    limit,
    spent,
    remaining,
    overBy: remaining < 0 ? Math.abs(remaining) : 0,
    utilizationPercent,
    clampedPercent,
    status,
    label,
  };
}

function renderBudgetChart(transactions, activeMonth, limit, currency) {
  const canvas = document.getElementById('budget-history-chart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (budgetHistoryChart) {
    budgetHistoryChart.destroy();
    budgetHistoryChart = null;
  }

  const series = getMonthlySeries(transactions, 6, activeMonth);
  const limitLine = series.labels.map(() => limit);

  budgetHistoryChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Monthly Spending',
          data: series.expenseSeries,
          backgroundColor: series.expenseSeries.map((val) => {
            if (limit > 0 && val > limit) return '#B91C1C';
            if (limit > 0 && val >= limit * 0.8) return '#D97706';
            return '#1E3A8A';
          }),
          borderRadius: 5,
          maxBarThickness: 36,
        },
        ...(limit > 0
          ? [
              {
                label: 'Monthly Budget Limit',
                data: limitLine,
                type: 'line',
                borderColor: '#64748B',
                borderWidth: 1.5,
                borderDash: [5, 4],
                pointRadius: 0,
                fill: false,
              },
            ]
          : []),
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

export function renderBudgetView() {
  const transactions = getTransactions();
  const budget = getBudget();
  const currency = budgetCallbacks.getCurrency();
  const activeMonth = budgetCallbacks.getActiveMonth();
  const monthLabel = formatMonthLabel(activeMonth);

  const monthly = calculateMonthlyTotals(transactions, activeMonth);
  const statusInfo = calculateBudgetStatus(monthly.monthlyExpenses, budget.monthlyLimit);

  // Sync form input & currency prefix
  const limitInput = document.getElementById('budget-limit-input');
  const prefixEl = document.getElementById('budget-currency-prefix');
  if (prefixEl) prefixEl.textContent = getCurrencySymbol(currency);
  if (limitInput && document.activeElement !== limitInput) {
    limitInput.value = budget.monthlyLimit > 0 ? budget.monthlyLimit : '';
  }

  // Title & status label
  const trackerTitle = document.getElementById('budget-tracker-title');
  const trackerSub = document.getElementById('budget-tracker-subtitle');
  const statusTextEl = document.getElementById('budget-status-text');
  if (trackerTitle) trackerTitle.textContent = `Budget Utilization · ${monthLabel}`;
  if (trackerSub) {
    trackerSub.textContent = `${monthly.transactionCount} transactions recorded in ${monthLabel}`;
  }
  if (statusTextEl) {
    statusTextEl.textContent = statusInfo.label;
    statusTextEl.className = 'status-label';
    if (statusInfo.status === 'exceeded') statusTextEl.classList.add('text-expense');
    else if (statusInfo.status === 'warning') statusTextEl.classList.add('text-warning');
    else if (statusInfo.status === 'healthy') statusTextEl.classList.add('text-income');
  }

  // Banner alerts for >= 80% warning and > 100% exceeded
  const bannerEl = document.getElementById('budget-status-banner');
  if (bannerEl) {
    if (statusInfo.status === 'exceeded') {
      bannerEl.hidden = false;
      bannerEl.className = 'inline-alert is-danger';
      bannerEl.innerHTML = `
        <div class="inline-alert-content">
          <i data-lucide="alert-octagon" class="inline-alert-icon" aria-hidden="true"></i>
          <div>
            <p class="inline-alert-title">Budget Exceeded for ${escapeHtml(monthLabel)}</p>
            <p class="inline-alert-desc">
              Monthly expenses (${escapeHtml(formatCurrency(statusInfo.spent, currency))}) have exceeded your ${escapeHtml(formatCurrency(statusInfo.limit, currency))} budget by ${escapeHtml(formatCurrency(statusInfo.overBy, currency))} (${statusInfo.utilizationPercent.toFixed(1)}% used).
            </p>
          </div>
        </div>
      `;
    } else if (statusInfo.status === 'warning') {
      bannerEl.hidden = false;
      bannerEl.className = 'inline-alert is-warning';
      bannerEl.innerHTML = `
        <div class="inline-alert-content">
          <i data-lucide="alert-triangle" class="inline-alert-icon" aria-hidden="true"></i>
          <div>
            <p class="inline-alert-title">Approaching Monthly Budget Limit</p>
            <p class="inline-alert-desc">
              You have used ${statusInfo.utilizationPercent.toFixed(1)}% of your ${escapeHtml(formatCurrency(statusInfo.limit, currency))} budget in ${escapeHtml(monthLabel)}. ${escapeHtml(formatCurrency(statusInfo.remaining, currency))} remaining.
            </p>
          </div>
        </div>
      `;
    } else {
      bannerEl.hidden = true;
      bannerEl.innerHTML = '';
    }
  }

  // Metrics Row
  const metricsRow = document.getElementById('budget-metrics-row');
  if (metricsRow) {
    const remainingLabel = statusInfo.remaining < 0 ? 'Over Budget' : 'Remaining Budget';
    const remainingValue =
      statusInfo.status === 'unset'
        ? '—'
        : statusInfo.remaining < 0
          ? `-${formatCurrency(Math.abs(statusInfo.remaining), currency)}`
          : formatCurrency(statusInfo.remaining, currency);
    const remainingClass =
      statusInfo.remaining < 0 ? 'text-expense' : statusInfo.status === 'healthy' ? 'text-income' : '';

    metricsRow.innerHTML = `
      <div class="budget-metric-item">
        <span class="budget-metric-label">Monthly Budget</span>
        <span class="budget-metric-value">${
          statusInfo.limit > 0 ? escapeHtml(formatCurrency(statusInfo.limit, currency)) : 'Not Set'
        }</span>
      </div>
      <div class="budget-metric-item">
        <span class="budget-metric-label">Monthly Expenses</span>
        <span class="budget-metric-value text-expense">${escapeHtml(
          formatCurrency(statusInfo.spent, currency)
        )}</span>
      </div>
      <div class="budget-metric-item">
        <span class="budget-metric-label">${remainingLabel}</span>
        <span class="budget-metric-value ${remainingClass}">${escapeHtml(remainingValue)}</span>
      </div>
      <div class="budget-metric-item">
        <span class="budget-metric-label">Utilization</span>
        <span class="budget-metric-value">${
          statusInfo.limit > 0 ? `${statusInfo.utilizationPercent.toFixed(1)}%` : '0.0%'
        }</span>
      </div>
    `;
  }

  // Progress bar
  const progressBar = document.getElementById('budget-progress-bar');
  const progressFill = document.getElementById('budget-progress-fill');
  if (progressBar && progressFill) {
    progressBar.setAttribute('aria-valuenow', Math.round(statusInfo.utilizationPercent).toString());
    progressFill.style.width = `${statusInfo.clampedPercent.toFixed(1)}%`;
    progressFill.className = 'progress-fill';
    if (statusInfo.status === 'exceeded') progressFill.classList.add('is-danger');
    else if (statusInfo.status === 'warning') progressFill.classList.add('is-warning');
  }

  // Category consumption table
  const catTableWrap = document.getElementById('budget-category-table-wrap');
  if (catTableWrap) {
    const breakdown = calculateCategoryBreakdown(transactions, 'expense', activeMonth);
    if (breakdown.items.length === 0) {
      catTableWrap.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-title">No expenses in ${escapeHtml(monthLabel)}</p>
          <p class="empty-state-desc">Add an expense transaction to see how it consumes your monthly budget.</p>
        </div>
      `;
    } else {
      catTableWrap.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th class="col-right">Transactions</th>
                <th class="col-right">Spent</th>
                <th class="col-right">Budget Share</th>
              </tr>
            </thead>
            <tbody>
              ${breakdown.items
                .map((item) => {
                  const shareOfBudget =
                    statusInfo.limit > 0 ? ((item.total / statusInfo.limit) * 100).toFixed(1) : '—';
                  return `
                    <tr>
                      <td>
                        <span class="breakdown-label">
                          <span class="swatch-dot" style="background-color: ${escapeHtml(item.color)}"></span>
                          <span>${escapeHtml(item.category)}</span>
                        </span>
                      </td>
                      <td class="col-right mono">${item.count}</td>
                      <td class="col-right mono">${escapeHtml(formatCurrency(item.total, currency))}</td>
                      <td class="col-right mono">${
                        shareOfBudget === '—' ? '—' : `${shareOfBudget}%`
                      }</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  renderBudgetChart(transactions, activeMonth, statusInfo.limit, currency);
}

export function initBudgetModule(config) {
  budgetCallbacks = { ...budgetCallbacks, ...config };

  const form = document.getElementById('budget-form');
  const limitInput = document.getElementById('budget-limit-input');
  const errEl = document.getElementById('budget-form-error');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      errEl.textContent = '';
      errEl.hidden = true;
      limitInput.classList.remove('is-invalid');

      const value = Number(limitInput.value);
      if (!Number.isFinite(value) || value <= 0) {
        errEl.textContent = 'Please enter a monthly budget greater than 0.';
        errEl.hidden = false;
        limitInput.classList.add('is-invalid');
        return;
      }

      saveBudget({ monthlyLimit: value });
      budgetCallbacks.onToast('Monthly budget updated.', 'default');
      budgetCallbacks.onDataChanged();
    });
  }
}
