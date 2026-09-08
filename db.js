// db.js — SQLite data layer for the Personal Finance Tracker
// Uses Node's built-in node:sqlite module (no native build step required).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'finance.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category    TEXT NOT NULL,
    amount      REAL NOT NULL CHECK (amount > 0),
    description TEXT,
    tx_date     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category       TEXT NOT NULL,
    monthly_limit  REAL NOT NULL CHECK (monthly_limit > 0),
    UNIQUE(user_id, category)
  );
`);

// ---------- Users ----------
function createUser({ name, email, passwordHash }) {
  const stmt = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
  const info = stmt.run(name, email.toLowerCase(), passwordHash);
  return db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
}

function findUserById(id) {
  return db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(id);
}

// ---------- Transactions ----------
const SORT_COLUMNS = {
  date_desc: 'tx_date DESC, id DESC',
  date_asc: 'tx_date ASC, id ASC',
  amount_desc: 'amount DESC',
  amount_asc: 'amount ASC'
};

function listTransactions(userId, { month, search, sort } = {}) {
  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [userId];

  if (month) {
    query += " AND strftime('%Y-%m', tx_date) = ?";
    params.push(month);
  }
  if (search) {
    query += ' AND (category LIKE ? OR description LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like);
  }
  query += ` ORDER BY ${SORT_COLUMNS[sort] || SORT_COLUMNS.date_desc}`;
  return db.prepare(query).all(...params);
}

function addTransaction(userId, { type, category, amount, description, tx_date }) {
  const stmt = db.prepare(`
    INSERT INTO transactions (user_id, type, category, amount, description, tx_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(userId, type, category, amount, description || '', tx_date);
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);
}

function deleteTransaction(userId, id) {
  const info = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);
  return info.changes > 0;
}

function getSummary(userId) {
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0)  AS totalIncome,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS totalExpense
    FROM transactions WHERE user_id = ?
  `).get(userId);

  const byCategory = db.prepare(`
    SELECT category, SUM(amount) AS total
    FROM transactions
    WHERE user_id = ? AND type = 'expense'
    GROUP BY category
    ORDER BY total DESC
  `).all(userId);

  return {
    totalIncome: totals.totalIncome,
    totalExpense: totals.totalExpense,
    balance: totals.totalIncome - totals.totalExpense,
    byCategory
  };
}

// ---------- Budgets ----------
function listBudgets(userId) {
  const month = new Date().toISOString().slice(0, 7); // current YYYY-MM
  return db.prepare(`
    SELECT
      b.id, b.category, b.monthly_limit,
      COALESCE((
        SELECT SUM(t.amount) FROM transactions t
        WHERE t.user_id = b.user_id
          AND t.category = b.category
          AND t.type = 'expense'
          AND strftime('%Y-%m', t.tx_date) = ?
      ), 0) AS spent
    FROM budgets b
    WHERE b.user_id = ?
    ORDER BY b.category ASC
  `).all(month, userId);
}

function upsertBudget(userId, { category, monthly_limit }) {
  db.prepare(`
    INSERT INTO budgets (user_id, category, monthly_limit)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit
  `).run(userId, category, monthly_limit);
  return db.prepare('SELECT * FROM budgets WHERE user_id = ? AND category = ?').get(userId, category);
}

function deleteBudget(userId, id) {
  const info = db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(id, userId);
  return info.changes > 0;
}

module.exports = {
  createUser, findUserByEmail, findUserById,
  listTransactions, addTransaction, deleteTransaction, getSummary,
  listBudgets, upsertBudget, deleteBudget
};
