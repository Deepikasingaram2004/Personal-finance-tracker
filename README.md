# Ledger — Personal Finance Tracker (v2)

A full-stack web app for logging income and expenses, categorizing transactions,
tracking budgets, and monitoring your balance over time — now with real user
accounts.

**Stack:** HTML, CSS, JavaScript (frontend) · Node.js + Express (backend) · SQLite (persistence)

## Features
- **Accounts** — register/sign in; each user's data is private (session-based auth, passwords hashed with bcrypt)
- Add income/expense entries with category, amount, date, and an optional note
- Live dashboard: total income, total expense, running balance
- Spending-by-category breakdown with proportional bars
- **Monthly budgets** — set a limit per category; the progress bar turns amber near the limit and red when you go over
- **Balance-over-time chart** — a hand-drawn SVG line chart of your running balance, no external chart library
- **Search, sort, and filter** transaction history (by keyword, by month, by amount/date)
- **CSV export** of your (filtered) transaction history
- Delete a transaction or a budget
- Data persists in a local SQLite database file (`finance.db`)

## Project structure
```
finance-tracker/
├── server.js        # Express app, auth routes, REST API
├── db.js            # SQLite schema and queries (users, transactions, budgets)
├── package.json
└── public/
    ├── index.html   # Auth screen + main dashboard
    ├── style.css
    └── script.js
```

## Setup
Requires **Node.js 22.5 or later** (uses the built-in `node:sqlite` module).

```bash
cd finance-tracker
npm install
npm start
```

Then open **http://localhost:3000**, create an account, and start logging transactions.

> For a real deployment, set a `SESSION_SECRET` environment variable instead of
> relying on the default dev secret in `server.js`.

## API reference
| Method | Route                          | Auth | Description |
|--------|----------------------------------|------|-------------|
| POST   | `/api/auth/register`             | —    | Create an account (name, email, password) |
| POST   | `/api/auth/login`                 | —    | Log in (email, password) |
| POST   | `/api/auth/logout`                | ✓    | End the session |
| GET    | `/api/auth/me`                    | ✓    | Current logged-in user |
| GET    | `/api/transactions`               | ✓    | List transactions (`?month=&search=&sort=`) |
| POST   | `/api/transactions`               | ✓    | Add a transaction |
| DELETE | `/api/transactions/:id`           | ✓    | Delete a transaction |
| GET    | `/api/transactions/export`        | ✓    | Download filtered history as CSV |
| GET    | `/api/summary`                    | ✓    | Totals and spend-by-category |
| GET    | `/api/budgets`                     | ✓    | List budgets with current-month spend |
| POST   | `/api/budgets`                     | ✓    | Create/update a budget (category, monthly_limit) |
| DELETE | `/api/budgets/:id`                 | ✓    | Remove a budget |

Sort options for `/api/transactions`: `date_desc` (default), `date_asc`, `amount_desc`, `amount_asc`.

### Transaction shape
```json
{
  "type": "expense",
  "category": "Groceries",
  "amount": 1200,
  "description": "Weekly shopping",
  "tx_date": "2026-09-03"
}
```

## Notes for your resume / portfolio
This now goes beyond the original brief: it demonstrates authentication and
session management, per-user data scoping, budget-vs-actual comparison logic,
CSV generation, and hand-built SVG data visualization — all useful talking
points in an interview about full-stack fundamentals.
