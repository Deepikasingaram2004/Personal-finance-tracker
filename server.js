// server.js — REST API for the Personal Finance Tracker
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'ledger-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  next();
}

// ---------- Auth ----------
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Valid email is required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    if (db.findUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = db.createUser({ name: name.trim(), email, passwordHash });
    req.session.userId = user.id;
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.findUserByEmail(email || '');
    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    req.session.userId = user.id;
    res.json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json(user);
});

// ---------- Transactions ----------
app.get('/api/transactions', requireAuth, (req, res) => {
  try {
    const { month, search, sort } = req.query;
    res.json(db.listTransactions(req.session.userId, { month, search, sort }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', requireAuth, (req, res) => {
  try {
    const { type, category, amount, description, tx_date } = req.body;
    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'type must be "income" or "expense"' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'category is required' });
    }
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    if (!tx_date) return res.status(400).json({ error: 'tx_date is required (YYYY-MM-DD)' });

    const created = db.addTransaction(req.session.userId, {
      type, category: category.trim(), amount: numericAmount,
      description: (description || '').trim(), tx_date
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', requireAuth, (req, res) => {
  const removed = db.deleteTransaction(req.session.userId, Number(req.params.id));
  if (!removed) return res.status(404).json({ error: 'Transaction not found' });
  res.status(204).end();
});

// CSV export — respects the same month/search/sort filters as the table view
app.get('/api/transactions/export', requireAuth, (req, res) => {
  try {
    const { month, search, sort } = req.query;
    const rows = db.listTransactions(req.session.userId, { month, search, sort });

    const escapeCsv = (val) => {
      const str = String(val ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const header = ['Date', 'Type', 'Category', 'Amount', 'Description'];
    const lines = [header.join(',')];
    rows.forEach(t => {
      lines.push([t.tx_date, t.type, t.category, t.amount, t.description].map(escapeCsv).join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Summary ----------
app.get('/api/summary', requireAuth, (req, res) => {
  try {
    res.json(db.getSummary(req.session.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Budgets ----------
app.get('/api/budgets', requireAuth, (req, res) => {
  try {
    res.json(db.listBudgets(req.session.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/budgets', requireAuth, (req, res) => {
  try {
    const { category, monthly_limit } = req.body;
    if (!category || !category.trim()) return res.status(400).json({ error: 'category is required' });
    const limit = Number(monthly_limit);
    if (!limit || limit <= 0) return res.status(400).json({ error: 'monthly_limit must be a positive number' });

    const budget = db.upsertBudget(req.session.userId, { category: category.trim(), monthly_limit: limit });
    res.status(201).json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/budgets/:id', requireAuth, (req, res) => {
  const removed = db.deleteBudget(req.session.userId, Number(req.params.id));
  if (!removed) return res.status(404).json({ error: 'Budget not found' });
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Finance tracker running at http://localhost:${PORT}`);
});
