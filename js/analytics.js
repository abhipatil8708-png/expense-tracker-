/**
 * analytics.js — Expense Analytics Module (Feature 4)
 *
 * Renders dynamic charts and analytical insights:
 * - Monthly income vs. expenses
 * - Category-wise expense breakdown & comparison
 * - Spending distribution
 * - Highest spending category & total savings
 */

import { getTransactions } from './storage.js';
import {
  calculateCategoryBreakdown,
  calculateMonthlyTotals,
  calculateTotals,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getMonthlySeries,
} from './transactions.js';

let incomeExpenseChart = null;
let distributionChart = null;
let categoryBarChart = null;

let analyticsScope = 'month'; // 'month' | 'all'
let analyticsCallbacks = {
  getCurrency: () => 'USD',
  getActiveMonth: () => '',
};

function destroyCharts() {
  if (incomeExpenseChart) {
    incomeExpenseChart.destroy();
    incomeExpenseChart = null;
  }
  if (distributionChart) {
    distributionChart.destroy();
    distributionChart = null;
  }
  if (categoryBarChart) {
    categoryBarChart.destroy();
    categoryBarChart = null;
  }
}

function renderIncomeVsExpenseChart(transactions, activeMonth, currency) {
  const canvas = document.getElementById('analytics-income-expense-chart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  const series = getMonthlySeries(transactions, 6, activeMonth);

  incomeExpenseChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Income',
          data: series.incomeSeries,
          backgroundColor: '#15803D',
          borderRadius: 4,
          maxBarThickness: 28,
        },
        {
          label: 'Expenses',
          data: series.expenseSeries,
          backgroundColor: '#B91C1C',
          borderRadius: 4,
          maxBarThickness: 28,
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

function renderDistributionDoughnut(breakdown, currency) {
  const wrap = document.getElementById('analytics-distribution-wrap');
  if (!wrap) return;

  if (breakdown.items.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">No expense data</p>
        <p class="empty-state-desc">Expenses recorded in this scope will appear here.</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = '<canvas id="analytics-distribution-chart" aria-label="Spending distribution doughnut chart"></canvas>';
  const canvas = document.getElementById('analytics-distribution-chart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  distributionChart = new window.Chart(canvas, {
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
      cutout: '64%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            padding: 12,
            usePointStyle: true,
            font: { family: 'Plus Jakarta Sans', size: 11.5 },
          },
        },
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

function renderCategoryComparisonBar(breakdown, currency) {
  const wrap = document.getElementById('analytics-category-bar-wrap');
  if (!wrap) return;

  if (breakdown.items.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">No category spending</p>
        <p class="empty-state-desc">Add expense entries to compare categories.</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = '<canvas id="analytics-category-bar-chart" aria-label="Category expense bar chart"></canvas>';
  const canvas = document.getElementById('analytics-category-bar-chart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  categoryBarChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: breakdown.items.map((i) => i.category),
      datasets: [
        {
          label: 'Total Spent',
          data: breakdown.items.map((i) => i.total),
          backgroundColor: breakdown.items.map((i) => i.color),
          borderRadius: 4,
          maxBarThickness: 22,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.parsed.x, currency),
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#F1F5F9' },
          ticks: {
            font: { family: 'JetBrains Mono', size: 11 },
            color: '#64748B',
            callback: (val) => formatCurrency(val, currency),
          },
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: 'Plus Jakarta Sans', size: 12 }, color: '#0F172A' },
        },
      },
    },
  });
}

export function renderAnalyticsView() {
  const transactions = getTransactions();
  const currency = analyticsCallbacks.getCurrency();
  const activeMonth = analyticsCallbacks.getActiveMonth();
  const monthFilter = analyticsScope === 'month' ? activeMonth : null;
  const scopeLabel = analyticsScope === 'month' ? formatMonthLabel(activeMonth) : 'All Time';

  const subtitleEl = document.getElementById('analytics-scope-subtitle');
  const distSubEl = document.getElementById('analytics-distribution-subtitle');
  if (subtitleEl) subtitleEl.textContent = `Cashflow and category breakdown · ${scopeLabel}`;
  if (distSubEl) distSubEl.textContent = `Share of expenses by category (${scopeLabel})`;

  const scopedTotals =
    analyticsScope === 'month'
      ? (() => {
          const m = calculateMonthlyTotals(transactions, activeMonth);
          return {
            income: m.monthlyIncome,
            expenses: m.monthlyExpenses,
            savings: m.monthlyBalance,
            savingsRate: m.savingsRate,
          };
        })()
      : (() => {
          const all = calculateTotals(transactions);
          return {
            income: all.totalIncome,
            expenses: all.totalExpenses,
            savings: all.totalBalance,
            savingsRate: all.savingsRate,
          };
        })();

  const breakdown = calculateCategoryBreakdown(transactions, 'expense', monthFilter);
  const scopedExpensesCount = breakdown.items.reduce((sum, item) => sum + item.count, 0);
  const avgExpense = scopedExpensesCount > 0 ? breakdown.grandTotal / scopedExpensesCount : 0;

  const kpiGrid = document.getElementById('analytics-kpi-grid');
  if (kpiGrid) {
    const highest = breakdown.highestCategory;
    const savingsClass = scopedTotals.savings >= 0 ? 'text-income' : 'text-expense';

    kpiGrid.innerHTML = `
      <article class="kpi-card">
        <div class="kpi-label"><span>Highest Spending Category</span></div>
        <div class="kpi-value">${highest ? escapeHtml(highest.category) : '—'}</div>
        <div class="kpi-meta mono">
          ${
            highest
              ? `${escapeHtml(formatCurrency(highest.total, currency))} · ${highest.percentage.toFixed(1)}% of expenses`
              : 'No expenses in scope'
          }
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label"><span>Total Savings (${escapeHtml(scopeLabel)})</span></div>
        <div class="kpi-value ${savingsClass}">${escapeHtml(
      formatCurrency(scopedTotals.savings, currency)
    )}</div>
        <div class="kpi-meta mono">
          ${
            scopedTotals.income > 0
              ? `${scopedTotals.savingsRate.toFixed(1)}% savings rate`
              : 'No income recorded in scope'
          }
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label"><span>Average Expense</span></div>
        <div class="kpi-value">${escapeHtml(formatCurrency(avgExpense, currency))}</div>
        <div class="kpi-meta mono">${scopedExpensesCount} expense transactions</div>
      </article>

      <article class="kpi-card">
        <div class="kpi-label"><span>Active Categories</span></div>
        <div class="kpi-value">${breakdown.items.length}</div>
        <div class="kpi-meta mono">Total spent: ${escapeHtml(
          formatCurrency(breakdown.grandTotal, currency)
        )}</div>
      </article>
    `;
  }

  // Category Breakdown Table
  const tableWrap = document.getElementById('analytics-category-table-wrap');
  if (tableWrap) {
    if (breakdown.items.length === 0) {
      tableWrap.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-title">No expense breakdown available</p>
          <p class="empty-state-desc">Record an expense to inspect category percentages and totals.</p>
        </div>
      `;
    } else {
      tableWrap.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th class="col-right">Count</th>
                <th class="col-right">Amount</th>
                <th class="col-right">Share</th>
              </tr>
            </thead>
            <tbody>
              ${breakdown.items
                .map(
                  (item) => `
                  <tr>
                    <td>
                      <span class="breakdown-label">
                        <span class="swatch-dot" style="background-color: ${escapeHtml(item.color)}"></span>
                        <span>${escapeHtml(item.category)}</span>
                      </span>
                    </td>
                    <td class="col-right mono">${item.count}</td>
                    <td class="col-right mono">${escapeHtml(formatCurrency(item.total, currency))}</td>
                    <td class="col-right mono">${item.percentage.toFixed(1)}%</td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  destroyCharts();
  renderIncomeVsExpenseChart(transactions, activeMonth, currency);
  renderDistributionDoughnut(breakdown, currency);
  renderCategoryComparisonBar(breakdown, currency);
}

export function initAnalyticsModule(config) {
  analyticsCallbacks = { ...analyticsCallbacks, ...config };

  document.querySelectorAll('[data-analytics-scope]').forEach((btn) => {
    btn.addEventListener('click', () => {
      analyticsScope = btn.dataset.analyticsScope;
      document.querySelectorAll('[data-analytics-scope]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      renderAnalyticsView();
    });
  });
}
