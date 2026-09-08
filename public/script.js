const rupee = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const authScreen = document.getElementById('authScreen');
const app = document.getElementById('app');

// ---------------- Auth ----------------
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authSubmit = document.getElementById('authSubmit');
const authError = document.getElementById('authError');
const nameField = document.getElementById('nameField');
const authToggleText = document.getElementById('authToggleText');
const authToggleLink = document.getElementById('authToggleLink');

let mode = 'login'; // or 'register'

authToggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  mode = mode === 'login' ? 'register' : 'login';
  const isRegister = mode === 'register';
  authTitle.textContent = isRegister ? 'Create your Ledger account' : 'Sign in to Ledger';
  authSubmit.textContent = isRegister ? 'Create account' : 'Sign in';
  nameField.style.display = isRegister ? 'flex' : 'none';
  authToggleText.textContent = isRegister ? 'Already have an account?' : "Don't have an account?";
  authToggleLink.textContent = isRegister ? 'Sign in' : 'Create one';
  authError.textContent = '';
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();

  const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
  const body = mode === 'login' ? { email, password } : { name, email, password };

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    authError.textContent = errBody.error || 'Something went wrong.';
    return;
  }

  const user = await res.json();
  showApp(user);
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  authForm.reset();
  authScreen.style.display = 'flex';
  app.style.display = 'none';
});

function showApp(user) {
  document.getElementById('userName').textContent = user.name;
  authScreen.style.display = 'none';
  app.style.display = 'block';
  loadAll();
}

(async function checkSession() {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (res.ok) {
    const user = await res.json();
    showApp(user);
  } else {
    authScreen.style.display = 'flex';
  }
})();

// ---------------- Entry form ----------------
const entryForm = document.getElementById('entryForm');
const formError = document.getElementById('formError');
document.getElementById('tx_date').valueAsDate = new Date();

entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';

  const type = entryForm.querySelector('input[name="type"]:checked').value;
  const category = document.getElementById('category').value.trim();
  const amount = document.getElementById('amount').value;
  const tx_date = document.getElementById('tx_date').value;
  const description = document.getElementById('description').value.trim();

  const res = await fetch('/api/transactions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, category, amount, tx_date, description })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    formError.textContent = body.error || 'Could not save that entry.';
    return;
  }

  entryForm.reset();
  document.getElementById('tx_date').valueAsDate = new Date();
  await loadAll();
});

// ---------------- History controls ----------------
const searchBox = document.getElementById('searchBox');
const monthFilter = document.getElementById('monthFilter');
const sortSelect = document.getElementById('sortSelect');
const rowsEl = document.getElementById('transactionRows');
const historyEmpty = document.getElementById('historyEmpty');
let searchTimer = null;

searchBox.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadAll, 250); });
monthFilter.addEventListener('change', loadAll);
sortSelect.addEventListener('change', loadAll);

document.getElementById('exportBtn').addEventListener('click', () => {
  const params = buildQuery();
  window.location.href = `/api/transactions/export?${params.toString()}`;
});

function buildQuery() {
  const params = new URLSearchParams();
  if (monthFilter.value) params.set('month', monthFilter.value);
  if (searchBox.value.trim()) params.set('search', searchBox.value.trim());
  if (sortSelect.value) params.set('sort', sortSelect.value);
  return params;
}

rowsEl.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('delete-btn')) return;
  await fetch(`/api/transactions/${e.target.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
  await loadAll();
});

// ---------------- Budgets ----------------
const budgetForm = document.getElementById('budgetForm');
const budgetError = document.getElementById('budgetError');
const budgetList = document.getElementById('budgetList');
const budgetEmpty = document.getElementById('budgetEmpty');

budgetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  budgetError.textContent = '';

  const category = document.getElementById('budgetCategory').value.trim();
  const monthly_limit = document.getElementById('budgetLimit').value;

  const res = await fetch('/api/budgets', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, monthly_limit })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    budgetError.textContent = body.error || 'Could not save that budget.';
    return;
  }

  budgetForm.reset();
  await loadBudgets();
});

budgetList.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('budget-row__remove')) return;
  await fetch(`/api/budgets/${e.target.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
  await loadBudgets();
});

async function loadBudgets() {
  const budgets = await fetch('/api/budgets', { credentials: 'same-origin' }).then(r => r.json());
  budgetList.innerHTML = '';
  budgetEmpty.style.display = budgets.length ? 'none' : 'block';

  budgets.forEach(b => {
    const pct = Math.min((b.spent / b.monthly_limit) * 100, 100);
    const fillClass = b.spent >= b.monthly_limit ? 'is-over' : pct >= 80 ? 'is-close' : '';
    const row = document.createElement('div');
    row.className = 'budget-row';
    row.innerHTML = `
      <div class="budget-row__head">
        <span>${escapeHtml(b.category)}</span>
        <span class="budget-row__amounts">${rupee(b.spent)} / ${rupee(b.monthly_limit)}</span>
      </div>
      <div class="budget-row__track">
        <div class="budget-row__fill ${fillClass}" style="width:${pct}%"></div>
      </div>
      <button class="budget-row__remove" data-id="${b.id}">remove</button>
    `;
    budgetList.appendChild(row);
  });
}

// ---------------- Chart ----------------
const chartWrap = document.getElementById('chartWrap');
const chartEmpty = document.getElementById('chartEmpty');

async function loadChart() {
  const all = await fetch('/api/transactions?sort=date_asc', { credentials: 'same-origin' }).then(r => r.json());

  if (all.length < 2) {
    chartWrap.innerHTML = '';
    chartEmpty.style.display = 'block';
    return;
  }
  chartEmpty.style.display = 'none';

  let running = 0;
  const points = all.map(tx => {
    running += tx.type === 'income' ? tx.amount : -tx.amount;
    return { date: tx.tx_date, balance: running };
  });

  const W = 700, H = 220, PAD = 30;
  const balances = points.map(p => p.balance);
  const min = Math.min(0, ...balances);
  const max = Math.max(0, ...balances);
  const range = max - min || 1;

  const xStep = (W - PAD * 2) / (points.length - 1);
  const scaleY = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);

  const coords = points.map((p, i) => [PAD + i * xStep, scaleY(p.balance)]);
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1][0].toFixed(1)} ${H - PAD} L ${coords[0][0].toFixed(1)} ${H - PAD} Z`;
  const zeroY = scaleY(0).toFixed(1);

  const firstDate = formatShort(points[0].date);
  const lastDate = formatShort(points[points.length - 1].date);

  chartWrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${PAD}" y1="${zeroY}" x2="${W - PAD}" y2="${zeroY}" stroke="#D8D0BC" stroke-dasharray="4 3" />
      <path d="${areaPath}" fill="#F1EBDA" stroke="none" />
      <path d="${linePath}" fill="none" stroke="#93732F" stroke-width="2" />
      <text x="${PAD}" y="${H - 8}" font-size="11" fill="#33513F" font-family="ui-monospace, monospace">${firstDate}</text>
      <text x="${W - PAD}" y="${H - 8}" font-size="11" fill="#33513F" font-family="ui-monospace, monospace" text-anchor="end">${lastDate}</text>
    </svg>
  `;
}

function formatShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ---------------- Shared loaders ----------------
async function loadAll() {
  const params = buildQuery();
  const [transactions, summary] = await Promise.all([
    fetch(`/api/transactions?${params.toString()}`, { credentials: 'same-origin' }).then(r => r.json()),
    fetch('/api/summary', { credentials: 'same-origin' }).then(r => r.json())
  ]);
  renderSummary(summary);
  renderTransactions(transactions);
  loadBudgets();
  loadChart();
}

function renderSummary(summary) {
  document.getElementById('totalIncome').textContent = rupee(summary.totalIncome);
  document.getElementById('totalExpense').textContent = rupee(summary.totalExpense);
  document.getElementById('balance').textContent = rupee(summary.balance);

  const barsEl = document.getElementById('categoryBars');
  const breakdownEmpty = document.getElementById('breakdownEmpty');
  barsEl.innerHTML = '';
  if (!summary.byCategory.length) {
    breakdownEmpty.style.display = 'block';
    return;
  }
  breakdownEmpty.style.display = 'none';
  const max = Math.max(...summary.byCategory.map(c => c.total));
  summary.byCategory.forEach(c => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label">${escapeHtml(c.category)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(c.total / max) * 100}%"></span></span>
      <span class="bar-amount">${rupee(c.total)}</span>
    `;
    barsEl.appendChild(row);
  });
}

function renderTransactions(list) {
  rowsEl.innerHTML = '';
  historyEmpty.style.display = list.length ? 'none' : 'block';
  list.forEach(tx => {
    const tr = document.createElement('tr');
    const sign = tx.type === 'income' ? '+' : '−';
    tr.innerHTML = `
      <td>${formatShort(tx.tx_date)}</td>
      <td>${escapeHtml(tx.category)}</td>
      <td>${escapeHtml(tx.description || '—')}</td>
      <td class="amount-cell amount-cell--${tx.type}">${sign} ${rupee(tx.amount)}</td>
      <td><button class="delete-btn" data-id="${tx.id}">remove</button></td>
    `;
    rowsEl.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
