# FinTrack User Guide

This guide covers how to use FinTrack day-to-day. It assumes the app is already running (see the main README for setup).

---

## Table of Contents

1. [First-Time Setup](#first-time-setup)
2. [Understanding the Data Model](#understanding-the-data-model)
3. [Daily Workflows](#daily-workflows)
4. [Recording Transactions](#recording-transactions)
5. [AI-Assisted Import](#ai-assisted-import)
6. [Managing Credit Cards and Statements](#managing-credit-cards-and-statements)
7. [Budgets](#budgets)
8. [Analytics](#analytics)
9. [Notifications](#notifications)
10. [Tips and Workarounds](#tips-and-workarounds)

---

## First-Time Setup

Do this once before you start using the app.

### 1. Register

Go to `/register`. Only two users are intended — the owner and their partner. Both register independently with separate email addresses. There is no invite system; anyone who can reach the URL can register.

### 2. Create Your Accounts

Go to **Accounts** → click **New Account**.

Create one account for each real-world bucket where you hold money:

| What you have | Type to choose |
|---|---|
| BDO, BPI, UnionBank, etc. | Bank |
| GCash, Maya, ShopeePay | Digital Wallet |
| Physical cash / petty cash | Cash |

> **Credit cards:** Do not create a credit card account here if you plan to use the dedicated Cards section. See step 4 below. The "Credit Card" account type is only the backing record — you manage it through `/cards`.

Set the **Opening Balance** to the actual current balance of that account. This is the starting point from which all future transactions are calculated. If you're migrating from another app, this should be your balance on the day you start using FinTrack.

### 3. Set Up Categories

Go to **Transactions → New** to see the available categories. A set of system categories is seeded by default (Groceries, Dining Out, Transport, etc.). If you need custom categories, they can be added via the API directly for now — the category management UI is minimal.

### 4. Add Your Credit Cards

Go to **Cards** → click **Add Card**.

Each card requires:
- **Linked account** — select an existing account, or create a new "Credit Card" type account on the Accounts page first. This account represents your card's balance.
- **Bank name** — e.g. BDO, BPI, Metrobank
- **Last 4 digits** — shown on statements and in the UI
- **Statement day** — the day of the month your billing cycle closes (e.g. 3 means the 3rd of each month)
- **Due day** — the day your payment is due (e.g. 23)

The app uses statement_day and due_day to automatically calculate your current billing period and due dates — you don't need to enter these manually each month.

### 5. Set Up Budgets

Go to **Budgets** → click **New Budget**.

Set a monthly peso limit per spending category (e.g. Groceries: ₱8,000, Dining Out: ₱4,000). The app tracks your spending against this limit throughout the month and alerts you at 80% and 100%.

---

## Understanding the Data Model

A few concepts that are not obvious from the UI:

### Accounts vs Credit Cards

An **Account** is any bucket that holds money — bank account, e-wallet, cash. It has a balance.

A **Credit Card** is not an account in the traditional sense — it's a liability. The card record stores your billing cycle settings and links to a backing Account record. When you swipe your card, you record it as an **expense** on the credit card's account. When you pay your bill, you record a **transfer** from your bank account to the credit card account.

This means: your credit card account balance will go negative as you spend. That's correct.

### Why credit card payment is a Transfer, not an Expense

When you pay your Metrobank bill:
- The ₱15,000 charge you paid is **not a new expense** — you already recorded individual expenses when you swiped
- It is a **Transfer** from your BPI savings account to your Metrobank credit card account
- This moves money from one bucket to another without creating a new spending event

If you recorded the payment as an expense, it would be counted twice (once when you swiped, once when you paid). Don't do this.

### Account Balance Calculation

The **current balance** shown on every account is computed dynamically from:
- Opening balance you entered when creating the account
- All income transactions deposited into it
- All expense transactions charged against it
- All transfers in and out of it
- ATM fees

There is no separate "balance" field — the balance is always a live calculation. This means if you edit or delete a past transaction, the balance updates immediately.

---

## Daily Workflows

### Recording an Expense

**Manual entry (fastest for simple purchases):**

1. Go to **Transactions → New**
2. Type: Expense
3. Sub-type: choose the most specific one (e.g. "Bill Payment" for utilities, "Subscription" for Netflix)
4. Account: the account the money came from
5. Category: e.g. Groceries
6. Amount: the peso amount
7. Date: today or the actual transaction date
8. Description: optional but useful (e.g. "SM Supermarket weekly")

**Via AI import (for receipts with many line items):** See the AI-Assisted Import section below.

### Recording Income

Same flow, Type: Income.

Common sub-types:
- **Salary** — monthly payroll
- **13th Month** — mid-year and year-end bonus
- **Overtime / Bonus** — separate from regular salary
- **Freelance / Business** — project income
- **SSS Benefit / PhilHealth / Pag-IBIG** — government benefits

### Recording a Transfer

Use Type: Transfer when money moves between your own accounts.

| Scenario | Sub-type |
|---|---|
| Bank to GCash / Maya | Own Account |
| Send money to another person | Sent to Person |
| ATM withdrawal (bank → cash) | ATM Withdrawal |
| Credit card payment (bank → card) | Own Account |

For ATM withdrawals: an **ATM Fee** field appears when you select that sub-type. Enter the bank's withdrawal fee — it will be deducted from the source account separately as a fee transaction.

---

## Recording Transactions

### Editing a Transaction

On the **Transactions** page, click any row to open an edit drawer. You can update:
- Account
- Type and sub-type
- Category
- Amount
- Date
- Description

Click **Delete** at the bottom to remove it permanently.

### Filtering Transactions

The filter panel (click the filter icon on the Transactions page) lets you filter by:
- Date range (from / to)
- Account
- Category

The quick type buttons (All / Income / Expense / Transfer) above the list filter by transaction type instantly.

### A Note on Pagination

The transaction list shows 50 results per page. The "X transactions" count shown is the count on the current page — it does not show your total transaction count across all pages. Use the Previous/Next buttons to navigate.

---

## AI-Assisted Import

Use this for receipts with many line items or credit card PDF statements.

### For a Single Receipt

1. Go to **Scan**
2. Tap **Take Photo** (mobile) or **Upload File** (desktop)
3. Select **Document Type**: Receipt
4. Click **Save Document**
5. The app shows a prompt text — click **Copy AI Prompt**
6. Open Claude.ai or Gemini in another tab
7. Start a new conversation
8. Attach your receipt image
9. Paste the copied prompt text
10. Send and wait for the JSON response
11. Copy the entire JSON response from the AI
12. Go to **Documents** in FinTrack
13. Click the document you just uploaded
14. Paste the AI response into the text area and click **Parse**
15. Review the pre-filled transaction details — check amount, date, description, type
16. Click **Save Transaction**

### For a Credit Card PDF Statement

Same flow, but:
- Step 3: Select **CC Statement**
- Step 9: Attach the PDF file instead of an image
- Step 15: You'll see a table of all transactions — check/uncheck rows to select which ones to import
- Step 16: Click **Import N transactions**

> **Tip:** If the PDF is password-protected, FinTrack handles decryption automatically — you'll be prompted for the password.

> **Known limitation:** All bulk-imported transactions are currently assigned to your first account. If you're importing a credit card statement, make sure your credit card account is listed first on the Accounts page, or edit the transactions after import to assign the correct account.

### Tips for Better AI Extraction

- Use good lighting when photographing receipts — blurry images produce low-confidence results
- For PDFs, use the original digital PDF rather than a scanned image when possible
- Fields highlighted in amber in the review screen have low confidence — double-check them before saving

---

## Managing Credit Cards and Statements

### How Billing Periods Work

FinTrack calculates your billing periods automatically from the `statement_day` and `due_day` you set when creating a card. You don't need to enter period dates manually.

On the **Cards** page, each card shows:
- **Current period** — the open billing window accumulating charges now
- **Previous period** — the most recently closed statement period
- **Due date** — when payment is due, with a days-remaining badge (turns red at ≤5 days)

### Creating a Statement

When you receive your physical or digital statement:

1. Go to **Statements** → **New Statement**
2. Select the credit card
3. Enter period start and end dates (should match the closed billing period shown on your card)
4. Enter the due date
5. Enter the **total amount due** and **minimum due** from the statement

### Marking a Statement Paid

On the **Statements** page, click **Mark Paid** on any unpaid statement after you've made the payment. This records the payment date and removes it from pending notifications.

> **Important:** Marking a statement paid does NOT automatically record the transfer from your bank account. You still need to go to **Transactions → New** and record a Transfer (Own Account) from your bank to your credit card account for the amount you paid.

### Importing Statement Transactions

Use the AI-assisted import flow (see above) to bulk-import individual line items from a statement PDF into your transactions.

---

## Budgets

Budgets track your spending against a monthly peso limit.

### Setting Up Budgets

Go to **Budgets** → **New Budget**:
- **Type**: Category (e.g. limit Groceries to ₱8,000) or Account (e.g. limit your GCash to ₱5,000 spending per month)
- **Amount**: monthly limit in pesos

### Reading the Budget Page

Each budget card shows:
- Label and current status badge: **On Track** (under 80%) / **Warning** (80–100%) / **Exceeded** (over 100%)
- Progress bar: green → amber → red as you approach and exceed the limit
- Amount spent vs limit, and percentage

### Alerts

When you record a transaction that pushes a category over 80% or 100% of its budget:
- An in-app notification is created automatically
- If you've set up a Discord webhook, a message is sent to that channel

Budgets reset on the 1st of each month — only transactions dated in the current calendar month count toward spending.

---

## Analytics

Go to **Analytics** in the sidebar.

### Spending by Category (Pie Chart)

Shows your expense breakdown by category for the selected month. Use the month/year selectors at the top to navigate to past months.

- Each slice is labeled with the category name and percentage
- The legend below shows category name and peso total
- Transfers are excluded — only expenses appear here
- Empty state shown if no expenses recorded for that month

### Statement History (Bar Chart)

Shows the last 6 statements per credit card as a grouped bar chart, in chronological order. Use this to see whether your card spending is trending up or down over the past 6 months.

Each color represents one credit card. Hover over a bar to see the exact statement total.

---

## Notifications

The bell icon in the top right of the sidebar shows your unread notification count.

### Types of Notifications

| Type | When it fires |
|---|---|
| Budget Warning | A transaction pushes a category to 80% of its monthly limit |
| Budget Exceeded | A transaction pushes a category over 100% of its limit |
| Statement Due | A credit card statement is due within 7 days (sent by a daily scheduled task) |

### Marking Notifications Read

Click any notification to mark it read. Use **Mark All Read** to clear the entire list.

---

## Tips and Workarounds

### Session Expiry

Access tokens expire after 30 minutes (configurable via `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`). When your session expires, API calls silently fail and pages show empty data. If the app suddenly looks empty, log out and log back in.

### Account Name Typos

There is currently no account rename feature in the UI. To fix a typo, use the API directly:

```bash
curl -X PATCH http://localhost:8000/accounts/{account_id} \
  -H "Content-Type: application/json" \
  -b "access_token=YOUR_TOKEN" \
  -d '{"name": "Fixed Name"}'
```

Or use the Swagger UI at http://localhost:8000/docs — it supports cookie auth.

### Finding Your Account IDs

Go to http://localhost:8000/docs → GET /accounts → Execute. The response includes all account IDs.

### Adding Categories

Custom categories can be added via the API:

```bash
curl -X POST http://localhost:8000/categories \
  -H "Content-Type: application/json" \
  -b "access_token=YOUR_TOKEN" \
  -d '{"name": "Home Repair", "type": "expense", "icon": "🔨", "color": "#8b5cf6"}'
```

### Discord Notifications

Set `DISCORD_WEBHOOK_URL` in your `.env` to a Discord incoming webhook URL. Budget alerts and statement due reminders will be sent there as formatted messages.

To create a webhook: Discord server → Channel Settings → Integrations → Webhooks → New Webhook → Copy URL.
