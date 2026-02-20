# FinTrack User Guide

Personal finance tracker for logging income, expenses, transfers, credit card statements, budgets, and recurring transactions.

This guide covers how to use FinTrack day-to-day. It assumes the app is already running (see the main README for local setup).

---

## Table of Contents

1. [First-Time Setup](#first-time-setup)
2. [Understanding the Data Model](#understanding-the-data-model)
3. [Dashboard](#dashboard)
4. [Daily Workflows](#daily-workflows)
5. [Recording Transactions](#recording-transactions)
6. [Recurring Transactions](#recurring-transactions)
7. [AI-Assisted Import](#ai-assisted-import)
8. [Managing Credit Cards and Statements](#managing-credit-cards-and-statements)
9. [Budgets](#budgets)
10. [Analytics](#analytics)
11. [Notifications](#notifications)
12. [Install as App (PWA)](#install-as-app-pwa)
13. [Tips and Workarounds](#tips-and-workarounds)

---

## First-Time Setup

Do this once before you start using the app.

### 1. Register

Go to `/register`. Enter your name, email, and a password. There is no invite system — anyone who can reach the URL can register. The app is designed for a small number of users (e.g. you and a partner, each with their own account).

**Remember me:** When logging in, check **Remember me** to stay logged in across browser sessions. Without it, your session ends when you close the tab.

### 2. Create Your Accounts

Go to **Accounts** → click **New Account**.

Create one account for each real-world bucket where you hold money:

| What you have | Type to choose |
|---|---|
| BDO, BPI, UnionBank, etc. | Bank |
| GCash, Maya, ShopeePay | Digital Wallet |
| Physical cash / petty cash | Cash |

> **Credit cards:** Do not create a credit card account here if you plan to use the dedicated Cards section. See step 4 below. The "Credit Card" account type is the backing record — you manage it through `/cards`.

Set the **Opening Balance** to the actual current balance of that account. This is the starting point from which all future transactions are calculated. If you're migrating from another app, set this to your balance on the day you start using FinTrack.

### 3. Set Up Categories

Go to **Transactions → New** to see the available categories. A set of system categories is pre-loaded by default:

**Expense categories:** Groceries, Dining Out, Transport, Utilities, Entertainment, Healthcare, Education, Shopping, Personal Care, Rent/Mortgage, Insurance, Investments, Taxes, Charity, Travel, Subscriptions, Clothing, Home & Maintenance, Pets, Gifts

**Income categories:** Salary, 13th Month, Overtime/Bonus, Freelance/Business Income, Side Income, SSS Benefit, PhilHealth Benefit, Pag-IBIG Benefit, Passive Income, Rental Income

Custom categories can be added via the API — see [Tips and Workarounds](#tips-and-workarounds).

### 4. Add Your Credit Cards

Go to **Cards** → click **Add Card**.

Each card requires:
- **Linked account** — select an existing account, or create a new "Credit Card" type account on the Accounts page first
- **Bank name** — e.g. BDO, BPI, Metrobank
- **Last 4 digits** — shown on statements and in the UI
- **Statement day** — the day of the month your billing cycle closes (e.g. 3 means the 3rd of each month)
- **Due day** — the day your payment is due (e.g. 23)

The app uses these two dates to automatically calculate your current billing period and due dates — you don't need to enter these manually each month.

### 5. Set Up Budgets (Optional)

Go to **Budgets** → click **New Budget**.

Set a monthly peso limit per spending category (e.g. Groceries: ₱8,000, Dining Out: ₱4,000). The app tracks your spending against this limit throughout the month and alerts you at 80% and 100%.

### 6. Set Up Recurring Transactions (Optional)

If you have fixed regular expenses (rent, subscriptions, loan payments) or income (salary), set them up as recurring transactions. The app will automatically generate the transaction on the due date each day.

See [Recurring Transactions](#recurring-transactions) for setup details.

---

## Understanding the Data Model

A few concepts that are not obvious from the UI:

### Accounts vs Credit Cards

An **Account** is any bucket that holds money — bank account, e-wallet, cash. It has a balance.

A **Credit Card** is a liability. The card record stores your billing cycle settings and links to a backing Account record. When you swipe your card, you record it as an **expense** on the credit card's account. When you pay your bill, you record a **transfer** from your bank account to the credit card account.

This means: your credit card account balance will go negative as you spend. That's correct — it represents what you owe.

### Why Credit Card Payment Is a Transfer, Not an Expense

When you pay your Metrobank bill:
- The ₱15,000 charge you paid is **not a new expense** — you already recorded individual expenses when you swiped
- It is a **Transfer** from your BPI savings account to your Metrobank credit card account
- This moves money from one bucket to another without creating a new spending event

If you recorded the payment as an expense, it would be counted twice (once when you swiped, once when you paid). Always use Transfer for card payments.

### Account Balance Calculation

The **current balance** shown on every account is computed dynamically from:
- Opening balance entered when creating the account
- All income transactions deposited into it
- All expense transactions charged against it
- All transfers in and out of it
- ATM fees

There is no separate "balance" field — the balance is always a live calculation. If you edit or delete a past transaction, the balance updates immediately.

---

## Dashboard

The dashboard (`/`) is your financial overview at a glance.

### Summary Cards

Three cards at the top show your current month's totals:
- **Total Income** — all income transactions this month
- **Total Expenses** — all expense transactions this month
- **Net** — income minus expenses (green = positive, red = negative)

### Net Worth

Displays the sum of all account balances. This includes cash, bank accounts, e-wallets, and credit card accounts (which contribute negatively when you have outstanding balances).

### Upcoming Recurring

Shows your next 5 active recurring transactions by due date. Useful for knowing what bills are coming up. Click any item to go to the full Recurring Transactions page.

### Recent Transactions

The last 10 transactions across all accounts. Click **View All** to go to the full transaction list.

### Onboarding Checklist

First-time users see a checklist (Create Account, Add Transactions, Set Up Budget, etc.). It disappears once all items are completed.

---

## Daily Workflows

### Recording an Expense

**Manual entry (fastest for simple purchases):**

1. Go to **Transactions → New**
2. Type: **Expense**
3. Sub-type: choose the most specific one (e.g. "Bill Payment" for utilities, "Subscription" for Netflix)
4. Account: the account the money came from
5. Category: e.g. Groceries
6. Amount: the peso amount (positive number)
7. Date: today or the actual transaction date
8. Description: optional but useful (e.g. "SM Supermarket weekly")

**Via AI import (for receipts with many line items):** See [AI-Assisted Import](#ai-assisted-import).

### Recording Income

Same flow, Type: **Income**.

Common sub-types:
- **Salary** — monthly payroll
- **13th Month** — mid-year and year-end bonus
- **Overtime / Bonus** — separate from regular salary
- **Freelance / Business** — project income
- **SSS Benefit / PhilHealth / Pag-IBIG** — government benefits

### Recording a Transfer

Use Type: **Transfer** when money moves between your own accounts.

| Scenario | Sub-type |
|---|---|
| Bank to GCash / Maya | Own Account |
| Send money to another person | Sent to Person |
| ATM withdrawal (bank → cash) | ATM Withdrawal |
| Credit card payment (bank → card) | Own Account |

For ATM withdrawals: an **ATM Fee** field appears when you select that sub-type. Enter the bank's withdrawal fee — it will be deducted from the source account separately as a fee.

---

## Recording Transactions

### Editing a Transaction

On the **Transactions** page, click any row to open an edit drawer. You can update the account, type, sub-type, category, amount, date, and description.

Click **Delete** at the bottom of the drawer to permanently remove the transaction.

### Filtering Transactions

The filter panel (click the filter icon) lets you filter by:
- Date range (from / to)
- Account
- Category

The quick type buttons (All / Income / Expense / Transfer) above the list filter by transaction type instantly.

### Pagination

The transaction list shows 50 results per page. Use Previous/Next to navigate.

---

## Recurring Transactions

Use recurring transactions for anything that happens on a regular schedule — rent, subscriptions, loan EMIs, salary, utility bills.

The app generates each transaction automatically at **00:05 local time** on the due date. You don't need to remember to log it.

### Creating a Recurring Transaction

Go to **Recurring** in the sidebar → click **New Recurring Transaction**.

Fields:
- **Account** — which account to debit or credit
- **Type** — Income or Expense (transfers not supported for recurring)
- **Sub-type** — e.g. Subscription, Salary, Bill Payment
- **Category** — spending category
- **Amount** — fixed amount per occurrence
- **Description** — e.g. "Netflix subscription", "BDO home loan"
- **Frequency** — Daily / Weekly / Biweekly / Monthly / Yearly
- **Start date** — first occurrence date (this is also the first `next_due_date`)
- **End date** — optional. If set, auto-generation stops after this date

### Managing Recurring Transactions

The **Recurring** page shows all your recurring templates with:
- Next due date
- Frequency badge
- Active/Paused toggle

**Pausing:** Toggle the active switch to pause a recurring transaction. The auto-generation task will skip it until you re-enable it.

**Editing:** Click the edit icon to update the amount, description, frequency, end date, or category. You cannot change the account, type, or start date after creation — delete and recreate instead.

**Deleting:** Removes the template. Transactions that were already generated are not affected.

### What Happens on the Due Date

Each morning at 00:05:
1. The system finds all active recurring transactions where `next_due_date ≤ today`
2. A new transaction is created with `source = recurring` and linked back to the template
3. A notification is created: "Recurring Transaction Created — ₱X,XXX.XX — [description]"
4. The template's `next_due_date` is advanced to the next occurrence
5. If `next_due_date` would exceed the `end_date`, the template is automatically deactivated

> **Note:** If the app is offline or the Celery worker is down on a due date, the transaction will be generated the next time the worker runs (it catches up all past-due items).

---

## AI-Assisted Import

Use this for receipts with many line items, or credit card PDF statements you want to bulk-import.

### For a Single Receipt

1. Go to **Scan**
2. Tap **Take Photo** (mobile) or **Upload File** (desktop)
3. Select **Document Type**: Receipt
4. Click **Save Document**
5. The app shows a prompt text — click **Copy AI Prompt**
6. Open Claude.ai or another AI assistant in a new tab
7. Start a new conversation
8. Attach your receipt image
9. Paste the copied prompt text
10. Send and wait for the JSON response
11. Copy the entire JSON from the AI response
12. Go to **Documents** in FinTrack
13. Click the document you just uploaded
14. Paste the AI response into the text area and click **Parse**
15. Review the pre-filled transaction details — check amount, date, description, type
16. Click **Save Transaction**

### For a Credit Card PDF Statement

Same flow, but:
- Step 3: Select **CC Statement**
- Step 8: Attach the PDF file instead of an image
- Step 15: You'll see a table of all transactions — check/uncheck rows to select which ones to import
- Step 16: Click **Import N transactions**

> **Tip:** If the PDF is password-protected, FinTrack handles decryption automatically — you'll be prompted for the password.

> **Known limitation:** All bulk-imported transactions are assigned to your first account by default. If you're importing a credit card statement, make sure your credit card account is first on the Accounts page, or edit the transactions after import.

### Tips for Better AI Extraction

- Use good lighting when photographing receipts — blurry images produce low-confidence results
- For PDFs, use the original digital file rather than a scanned image
- Fields highlighted in amber in the review screen have low confidence — double-check them

---

## Managing Credit Cards and Statements

### How Billing Periods Work

FinTrack calculates your billing periods automatically from the `statement_day` and `due_day` you set when creating a card.

On the **Cards** page, each card shows:
- **Current period** — the open billing window accumulating charges now
- **Previous period** — the most recently closed statement period
- **Due date** — when payment is due, with a days-remaining badge (turns red at ≤5 days)

### Creating a Statement

When you receive your physical or digital statement:

1. Go to **Statements** → **New Statement**
2. Select the credit card
3. Enter period start and end dates (match the closed billing period on your statement)
4. Enter the due date
5. Enter the **total amount due** and **minimum due** from the statement

### Marking a Statement Paid

Click **Mark Paid** on any unpaid statement after making the payment. This records the payment date and clears the notification.

> **Important:** Marking a statement paid does NOT automatically record the transfer. You still need to go to **Transactions → New** and record a Transfer (Own Account) from your bank to the credit card account.

### Due Date Notifications

The app sends a notification every morning at 09:00 for any credit card statement due within the next 7 days. If you've configured a Discord webhook, the same alert is sent there.

### Importing Statement Transactions

Use the AI-assisted import flow above to bulk-import individual line items from a statement PDF into your transactions.

---

## Budgets

Budgets track your expense spending against a monthly peso limit.

### Setting Up Budgets

Go to **Budgets** → **New Budget**:
- **Type**: Category (e.g. limit Groceries to ₱8,000) or Account (e.g. limit your GCash to ₱5,000 spending per month)
- **Amount**: monthly limit in pesos

### Reading the Budget Page

Each budget card shows:
- Status badge: **On Track** (under 80%) / **Warning** (80–100%) / **Exceeded** (over 100%)
- Progress bar: green → amber → red as you approach and exceed the limit
- Amount spent vs limit, and percentage

### Alerts

When a transaction pushes a category over 80% or 100% of its budget:
- An in-app notification is created automatically
- If a Discord webhook is configured, a message is sent there

Budgets reset on the 1st of each month — only transactions dated in the current calendar month count.

---

## Analytics

Go to **Analytics** in the sidebar.

### Spending by Category (Pie Chart)

Shows your expense breakdown by category for the selected month. Use the month/year selectors to navigate to past months.

- Each slice is labeled with the category name and percentage
- The legend shows category name and peso total
- Transfers are excluded — only expenses appear
- Empty state shown if no expenses recorded for that month

### Statement History (Bar Chart)

Shows the last 6 statements per credit card as a grouped bar chart, in chronological order. Use this to see whether your card spending is trending up or down over 6 months.

Each color represents one credit card. Hover over a bar to see the exact statement total.

---

## Notifications

The bell icon in the sidebar shows your unread notification count.

### Types of Notifications

| Type | When it fires |
|---|---|
| Budget Warning | A transaction pushes a category to 80% of its monthly limit |
| Budget Exceeded | A transaction pushes a category over 100% of its limit |
| Statement Due | A credit card statement is due within 7 days (daily scheduled task at 09:00) |
| Recurring Created | A recurring transaction was auto-generated this morning |

### Marking Notifications Read

Click any notification to mark it read. Use **Mark All Read** to clear the entire list.

### Push Notifications

The app supports native browser/OS push notifications.

To enable:
1. Go to any dashboard page
2. Accept the push notification permission prompt from your browser
3. Notifications for budget alerts and recurring transactions will now appear as native notifications, even when the browser is minimized

To disable: Go to your browser settings → Site Settings → Notifications → find the FinTrack URL → set to Block.

### Discord Integration

Set `DISCORD_WEBHOOK_URL` in your `.env` file to a Discord incoming webhook URL. Budget alerts and statement due reminders will be sent as formatted Discord messages.

To create a webhook: Discord server → Channel Settings → Integrations → Webhooks → New Webhook → Copy URL.

---

## Install as App (PWA)

FinTrack can be installed as a standalone app on your device — it will appear in your app list and open without browser chrome, like a native app.

### Desktop (Chrome / Edge)

1. Open FinTrack in Chrome or Edge
2. Look for the install icon (⊕) in the address bar
3. Click it → **Install**
4. FinTrack appears in your Applications / Start Menu

### Mobile (Android)

1. Open FinTrack in Chrome
2. Tap the three-dot menu → **Add to Home Screen**
3. Tap **Install**

### Mobile (iOS / Safari)

1. Open FinTrack in Safari
2. Tap the share icon (□↑) at the bottom
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add**

### Offline Access

When installed as a PWA, previously visited pages load from cache when you have no internet connection. A banner at the top indicates you're viewing cached data.

> **Offline writes:** If you try to create a transaction while offline, the request is queued locally and replayed automatically when your connection returns.

---

## Tips and Workarounds

### Session Management

Access tokens auto-refresh silently every 30 minutes using your refresh token. If you checked **Remember me** at login, your refresh token lasts 30 days — you stay logged in across browser restarts for up to a month.

If you did NOT check Remember me, your session ends when you close the browser tab.

If you're suddenly seeing empty pages, log out and log back in.

### Account Name Typos

There is currently no account rename feature in the UI. To fix a typo, use the Swagger UI at `http://localhost:8000/docs`:

1. Authenticate via the `/auth/login` endpoint in Swagger
2. Find `PATCH /accounts/{account_id}`
3. Get your account ID from `GET /accounts`
4. Send `{"name": "Fixed Name"}`

### Adding Custom Categories

Via the Swagger UI (`http://localhost:8000/docs`) or curl:

```bash
curl -X POST http://localhost:8000/categories \
  -H "Content-Type: application/json" \
  -b "access_token=YOUR_TOKEN" \
  -d '{"name": "Home Repair", "type": "expense", "icon": "🔨", "color": "#8b5cf6"}'
```

### Finding Your Account IDs

Go to `http://localhost:8000/docs` → `GET /accounts` → Execute. The response includes all account IDs and current balances.

### Checking What the Celery Worker Is Doing

Recurring transactions and statement notifications are processed by Celery Beat. If transactions aren't being generated:

```bash
docker compose logs celery --tail=50
```

Look for lines like `generate_recurring_transactions_task` and `send_statement_due_notifications_task`.

### Bulk-Import Account Assignment

All bulk-imported transactions (from the Paste/AI import flow) are assigned to the account with the lowest creation order. If you're importing credit card statements, ensure the correct credit card account appears first on the Accounts page, or reassign manually after import.

---

*Last updated: February 2026 — reflects Phase 7 (recurring transactions, session refresh, dark theme, PWA, push notifications)*
