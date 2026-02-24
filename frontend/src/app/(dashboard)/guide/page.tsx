import { GuideToc } from "@/components/app/GuideToc";

const TOC_ITEMS = [
  { id: "setup", label: "First-Time Setup", num: 1 },
  { id: "model", label: "Data Model", num: 2 },
  { id: "dashboard-overview", label: "Dashboard", num: 3 },
  { id: "daily", label: "Daily Workflows", num: 4 },
  { id: "transactions", label: "Recording Transactions", num: 5 },
  { id: "recurring", label: "Recurring Transactions", num: 6 },
  { id: "ai-import", label: "AI-Assisted Import", num: 7 },
  { id: "cards", label: "Credit Cards & Statements", num: 8 },
  { id: "budgets", label: "Budgets", num: 9 },
  { id: "analytics", label: "Analytics", num: 10 },
  { id: "notifications", label: "Notifications", num: 11 },
  { id: "pwa", label: "Install as App", num: 12 },
  { id: "tips", label: "Tips & Workarounds", num: 13 },
];

// ── Layout primitives ────────────────────────────────────────────────────────

function SectionHeading({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-bold flex items-center gap-3 pb-3 border-b">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-bold shrink-0">
        {num}
      </span>
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-base mt-6 mb-2">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>;
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2 mt-3">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex gap-3 items-start bg-muted/40 border rounded-lg px-3 py-2.5"
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5 mt-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 items-start text-sm text-muted-foreground">
          <span className="text-primary mt-0.5 shrink-0">▸</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Callout({
  type,
  children,
}: {
  type: "tip" | "warning" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    tip: "bg-accent-green-dim border-accent-green/20 text-accent-green",
    warning: "bg-accent-amber-dim border-accent-amber/20 text-accent-amber",
    info: "bg-accent-blue-dim border-accent-blue/20 text-accent-blue",
  };
  const icons = { tip: "💡", warning: "⚠️", info: "ℹ️" };
  return (
    <div className={`flex gap-3 rounded-lg border p-3.5 mt-3 text-sm ${styles[type]}`}>
      <span className="shrink-0">{icons[type]}</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border mt-3">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide border-b"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-muted-foreground align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-xs bg-muted border rounded px-1.5 py-0.5 text-primary">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-muted border rounded-lg p-4 overflow-x-auto font-mono text-xs text-muted-foreground leading-relaxed mt-3">
      {children}
    </pre>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GuidePage() {
  return (
    <div className="flex gap-12">
      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-14 pb-20">
        {/* Page header */}
        <div className="border-b pb-6">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full text-xs font-semibold px-3 py-1 mb-3">
            📖 User Guide
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">FinTrack</h1>
          <p className="text-muted-foreground text-sm">
            Personal finance tracker for income, expenses, credit cards, budgets, and recurring
            bills. This guide covers how to use the app day-to-day.
          </p>
        </div>

        {/* ── 1. First-Time Setup ── */}
        <section id="setup" className="space-y-4 scroll-mt-6">
          <SectionHeading num={1}>First-Time Setup</SectionHeading>
          <P>Complete these steps once before you start logging real transactions.</P>

          <H3>1. Register</H3>
          <P>
            Go to <Code>/register</Code>. Enter your name, email, and a password. There is no invite
            system — anyone who can reach the URL can register. When logging in, check{" "}
            <strong>Remember me</strong> to stay logged in across browser restarts (up to 30 days).
          </P>

          <H3>2. Create Your Accounts</H3>
          <P>
            Go to <strong>Accounts → New Account</strong>. Create one account for each real-world
            bucket where you hold money:
          </P>
          <DataTable
            headers={["What you have", "Account type"]}
            rows={[
              ["BDO, BPI, UnionBank, etc.", "Bank"],
              ["GCash, Maya, ShopeePay", "Digital Wallet"],
              ["Physical cash / petty cash", "Cash"],
              [
                "Credit card (Metrobank, BDO, etc.)",
                "Credit Card (then manage via Cards page)",
              ],
            ]}
          />
          <Callout type="tip">
            Set <strong>Opening Balance</strong> to your actual current balance on the day you start
            using FinTrack. This is the baseline all future calculations build from.
          </Callout>

          <H3>3. Set Up Categories</H3>
          <P>
            System categories are pre-loaded: Groceries, Dining Out, Transport, Utilities,
            Entertainment, Healthcare, Shopping, Subscriptions, Travel, and more. Income categories
            include Salary, 13th Month, Bonus, Freelance, and SSS/PhilHealth/Pag-IBIG benefits.
            Custom categories can be added via the API — see Tips &amp; Workarounds.
          </P>

          <H3>4. Add Your Credit Cards</H3>
          <P>
            Go to <strong>Cards → Add Card</strong>. You&apos;ll need:
          </P>
          <Bullets
            items={[
              <>
                <strong>Linked account</strong> — create a Credit Card type account first, then link
                it here
              </>,
              <>
                <strong>Bank name</strong> — BDO, BPI, Metrobank, etc.
              </>,
              <>
                <strong>Last 4 digits</strong> — shown on statements and in the UI
              </>,
              <>
                <strong>Statement day</strong> — day the billing cycle closes (e.g. 3 = the 3rd of
                each month)
              </>,
              <>
                <strong>Due day</strong> — day payment is due (e.g. 23)
              </>,
            ]}
          />

          <H3>5. Set Up Budgets</H3>
          <P>
            Go to <strong>Budgets → New Budget</strong>. Set a monthly peso limit per spending
            category (e.g. Groceries ₱8,000). The app alerts you at 80% and 100%.
          </P>

          <H3>6. Add Recurring Transactions</H3>
          <P>
            Go to <strong>Recurring → New Recurring Transaction</strong> for fixed regular expenses
            (rent, subscriptions, loan payments) or income (salary). The app auto-generates these
            each morning. See section 6 for full details.
          </P>
        </section>

        {/* ── 2. Data Model ── */}
        <section id="model" className="space-y-4 scroll-mt-6">
          <SectionHeading num={2}>Understanding the Data Model</SectionHeading>

          <H3>Accounts vs Credit Cards</H3>
          <P>
            An <strong>Account</strong> is any bucket that holds money — bank account, e-wallet,
            cash. It has a balance that goes up and down.
          </P>
          <P>
            A <strong>Credit Card</strong> is a liability. The card record stores your billing cycle
            settings and links to a backing Account. When you swipe your card, record an{" "}
            <strong>Expense</strong> on the credit card&apos;s account. When you pay your bill,
            record a <strong>Transfer</strong> from your bank to the credit card account.
          </P>
          <Callout type="info">
            Your credit card account balance will go <strong>negative</strong> as you spend.
            That&apos;s correct — it represents what you owe the bank.
          </Callout>

          <H3>Why Card Payment Is a Transfer, Not an Expense</H3>
          <P>
            When you pay your Metrobank bill, do <strong>not</strong> record it as an expense. The
            spending already happened when you swiped — recording it again double-counts it. Instead,
            record a <strong>Transfer → Own Account</strong> from your BPI savings to your Metrobank
            credit card account.
          </P>

          <H3>Account Balance Calculation</H3>
          <P>
            Every balance is computed live from: opening balance + income deposits − expense debits
            ± transfers ± ATM fees. There is no stored balance field. Edit or delete any past
            transaction and the balance updates instantly.
          </P>
        </section>

        {/* ── 3. Dashboard ── */}
        <section id="dashboard-overview" className="space-y-4 scroll-mt-6">
          <SectionHeading num={3}>Dashboard</SectionHeading>
          <P>Your financial snapshot at a glance.</P>
          <DataTable
            headers={["Card", "What it shows"]}
            rows={[
              ["📈 Monthly Income", "Total income transactions this calendar month"],
              ["📉 Monthly Expenses", "Total expense transactions this calendar month"],
              ["⚖️ Net Cash Flow", "Income minus expenses. Green = positive cash flow"],
              [
                "💰 Net Worth",
                "Sum of all account balances (credit cards contribute negatively)",
              ],
              ["🔁 Upcoming Bills", "Next 5 active recurring transactions by due date"],
              ["🕐 Recent Transactions", "Last 10 transactions across all accounts"],
            ]}
          />
        </section>

        {/* ── 4. Daily Workflows ── */}
        <section id="daily" className="space-y-4 scroll-mt-6">
          <SectionHeading num={4}>Daily Workflows</SectionHeading>

          <H3>Recording an Expense</H3>
          <Steps
            items={[
              <>
                Go to <strong>Transactions → New</strong>
              </>,
              <>
                Type: <strong>Expense</strong>
              </>,
              <>
                Sub-type: pick the most specific one (e.g. &quot;Subscription&quot; for Netflix,
                &quot;Bill Payment&quot; for utilities)
              </>,
              <>Account: which account the money came from</>,
              <>Category: e.g. Groceries, Dining Out, Transport</>,
              <>Amount: peso amount (positive number)</>,
              <>Date: today or the actual transaction date</>,
              <>Description: optional but useful (e.g. &quot;SM Supermarket weekly&quot;)</>,
            ]}
          />

          <H3>Recording Income</H3>
          <P>
            Same flow, Type: <strong>Income</strong>. Common sub-types: Salary, 13th Month,
            Overtime/Bonus, Freelance/Business, SSS/PhilHealth/Pag-IBIG Benefit.
          </P>

          <H3>Recording a Transfer</H3>
          <P>
            Use Type: <strong>Transfer</strong> when money moves between your own accounts.
          </P>
          <DataTable
            headers={["Scenario", "Sub-type"]}
            rows={[
              ["Bank → GCash / Maya", "Own Account"],
              ["Send money to another person", "Sent to Person"],
              ["ATM withdrawal (bank → cash)", "ATM Withdrawal"],
              ["Credit card payment (bank → card)", "Own Account"],
            ]}
          />
          <Callout type="tip">
            For ATM withdrawals: an <strong>ATM Fee</strong> field appears. Enter the bank&apos;s
            withdrawal fee — it&apos;s deducted from the source account as a separate fee.
          </Callout>
        </section>

        {/* ── 5. Recording Transactions ── */}
        <section id="transactions" className="space-y-4 scroll-mt-6">
          <SectionHeading num={5}>Recording Transactions</SectionHeading>

          <H3>Editing a Transaction</H3>
          <P>
            On the <strong>Transactions</strong> page, click any row to open an edit drawer. You can
            update the account, type, sub-type, category, amount, date, and description. Click{" "}
            <strong>Delete</strong> at the bottom to permanently remove it.
          </P>

          <H3>Filtering</H3>
          <P>
            Click the filter icon to filter by date range, account, or category. The type buttons
            (All / Income / Expense / Transfer) above the list filter instantly.
          </P>

          <H3>Pagination</H3>
          <P>
            The list shows 50 results per page. Use Previous/Next to navigate. The count shown is
            per-page, not your total transaction count.
          </P>
        </section>

        {/* ── 6. Recurring Transactions ── */}
        <section id="recurring" className="space-y-4 scroll-mt-6">
          <SectionHeading num={6}>Recurring Transactions</SectionHeading>
          <P>
            Set up recurring transactions for anything on a fixed schedule — rent, subscriptions,
            loan EMIs, salary. The app generates each transaction automatically at{" "}
            <strong>00:05 every morning</strong>.
          </P>

          <H3>Creating a Recurring Transaction</H3>
          <P>
            Go to <strong>Recurring → New Recurring Transaction</strong>:
          </P>
          <Bullets
            items={[
              <>
                <strong>Account</strong> — which account to debit or credit
              </>,
              <>
                <strong>Type</strong> — Income or Expense
              </>,
              <>
                <strong>Sub-type &amp; Category</strong> — e.g. Subscription / Entertainment
              </>,
              <>
                <strong>Amount</strong> — fixed peso amount per occurrence
              </>,
              <>
                <strong>Description</strong> — e.g. &quot;Netflix subscription&quot;, &quot;BDO home
                loan EMI&quot;
              </>,
              <>
                <strong>Frequency</strong> — Daily / Weekly / Biweekly / Monthly / Yearly
              </>,
              <>
                <strong>Start date</strong> — first occurrence date
              </>,
              <>
                <strong>End date</strong> — optional; auto-deactivates when exceeded
              </>,
            ]}
          />

          <H3>Managing</H3>
          <DataTable
            headers={["Action", "How"]}
            rows={[
              ["Pause / resume", "Toggle the active switch on the Recurring page"],
              ["Edit amount, description, frequency", "Click the edit icon"],
              [
                "Delete",
                "Removes the template; already-generated transactions are unaffected",
              ],
            ]}
          />

          <H3>What Happens Each Morning</H3>
          <Steps
            items={[
              <>
                Finds all active recurring transactions where{" "}
                <Code>next_due_date ≤ today</Code>
              </>,
              <>Creates a new transaction linked to the template</>,
              <>
                Creates an in-app notification: &quot;Recurring Transaction Created — ₱X —
                [description]&quot;
              </>,
              <>
                Advances <Code>next_due_date</Code> to the next occurrence
              </>,
              <>
                If <Code>next_due_date</Code> would exceed <Code>end_date</Code>, deactivates
                the template
              </>,
            ]}
          />
          <Callout type="info">
            If the app is offline on a due date, the worker catches up all past-due items the next
            time it runs — you won&apos;t miss any transactions.
          </Callout>
        </section>

        {/* ── 7. AI-Assisted Import ── */}
        <section id="ai-import" className="space-y-4 scroll-mt-6">
          <SectionHeading num={7}>AI-Assisted Import</SectionHeading>
          <P>
            Use this for receipts with many line items, or credit card PDFs you want to bulk-import.
          </P>

          <H3>Single Receipt</H3>
          <Steps
            items={[
              <>
                Go to <strong>Scan</strong>
              </>,
              <>
                Tap <strong>Take Photo</strong> (mobile) or <strong>Upload File</strong> (desktop)
              </>,
              <>
                Document type: <strong>Receipt</strong>
              </>,
              <>
                Click <strong>Save Document</strong>
              </>,
              <>
                Click <strong>Copy AI Prompt</strong>
              </>,
              <>Open Claude.ai in a new tab → start a new conversation</>,
              <>Attach your receipt image and paste the copied prompt → send</>,
              <>Copy the entire JSON response from the AI</>,
              <>
                Go to <strong>Documents</strong> → click your document → paste JSON → click{" "}
                <strong>Parse</strong>
              </>,
              <>Review pre-filled fields — amber highlights mean low confidence</>,
              <>
                Click <strong>Add Transaction</strong>
              </>,
            ]}
          />

          <H3>Credit Card PDF Statement (Bulk)</H3>
          <P>
            Same flow, but select <strong>CC Statement</strong> as document type and attach the PDF.
            After parsing, check/uncheck rows in the table to choose which transactions to import →
            click <strong>Import N transactions</strong>.
          </P>
          <Callout type="tip">
            Password-protected PDFs are handled automatically — you&apos;ll be prompted to enter the
            password.
          </Callout>
          <Callout type="warning">
            All bulk-imported transactions are assigned to your first account by default. If
            importing a credit card statement, make sure the correct card account is first on the
            Accounts page — or reassign after import.
          </Callout>
        </section>

        {/* ── 8. Credit Cards & Statements ── */}
        <section id="cards" className="space-y-4 scroll-mt-6">
          <SectionHeading num={8}>Credit Cards &amp; Statements</SectionHeading>

          <H3>How Billing Periods Work</H3>
          <P>
            FinTrack calculates billing periods from the <Code>statement_day</Code> and{" "}
            <Code>due_day</Code> you set when creating a card. On the <strong>Cards</strong> page,
            each card shows:
          </P>
          <Bullets
            items={[
              <>
                <strong>Current period</strong> — open billing window accumulating charges now
              </>,
              <>
                <strong>Previous period</strong> — most recently closed period
              </>,
              <>
                <strong>Due date</strong> — with a days-remaining badge (turns red at ≤5 days)
              </>,
            ]}
          />

          <H3>Creating a Statement</H3>
          <P>
            When you receive your statement: go to <strong>Statements → New Statement</strong>. Enter
            the card, period start/end dates, due date, total amount due, and minimum due.
          </P>

          <H3>Marking a Statement Paid</H3>
          <P>
            Click <strong>Mark Paid</strong> after making the payment. This records the payment date
            and clears the notification.
          </P>
          <Callout type="warning">
            Marking paid does NOT auto-record the bank transfer. Go to{" "}
            <strong>Transactions → New → Transfer → Own Account</strong> and log the payment from
            your bank to the card account separately.
          </Callout>

          <H3>Due Date Notifications</H3>
          <P>
            Every morning at 09:00, the app sends a notification for any statement due within the
            next 7 days. If Discord is configured, the same alert goes there too.
          </P>
        </section>

        {/* ── 9. Budgets ── */}
        <section id="budgets" className="space-y-4 scroll-mt-6">
          <SectionHeading num={9}>Budgets</SectionHeading>

          <H3>Setting Up</H3>
          <P>
            Go to <strong>Budgets → New Budget</strong>. Choose Category budget (e.g. limit Groceries
            to ₱8,000/month) or Account budget (e.g. limit GCash spending to ₱5,000/month).
          </P>

          <H3>Reading Budget Cards</H3>
          <DataTable
            headers={["Status", "What it means"]}
            rows={[
              [
                <span
                  key="on-track"
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-green-dim text-accent-green"
                >
                  On Track
                </span>,
                "Under 80% of the monthly limit",
              ],
              [
                <span
                  key="warning"
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-amber-dim text-accent-amber"
                >
                  Warning
                </span>,
                "80–100% of the monthly limit",
              ],
              [
                <span
                  key="exceeded"
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-red-dim text-accent-red"
                >
                  Exceeded
                </span>,
                "Over 100% of the monthly limit",
              ],
            ]}
          />

          <H3>Alerts</H3>
          <P>
            When a transaction pushes a category over 80% or 100%: an in-app notification is created
            automatically. If a Discord webhook is configured, the same alert is sent there. Budgets
            reset on the 1st of each month.
          </P>
        </section>

        {/* ── 10. Analytics ── */}
        <section id="analytics" className="space-y-4 scroll-mt-6">
          <SectionHeading num={10}>Analytics</SectionHeading>

          <H3>Spending by Category (Pie Chart)</H3>
          <P>
            Shows your expense breakdown by category for the selected month. Use the month/year
            selectors to view past months. Transfers are excluded — only expenses appear. Each slice
            shows the category name, percentage, and peso total.
          </P>

          <H3>Statement History (Bar Chart)</H3>
          <P>
            Shows the last 6 statements per credit card as a grouped bar chart in chronological
            order. Each color represents one card. Hover a bar to see the exact statement total. Use
            this to spot whether your card spending is trending up or down.
          </P>
        </section>

        {/* ── 11. Notifications ── */}
        <section id="notifications" className="space-y-4 scroll-mt-6">
          <SectionHeading num={11}>Notifications</SectionHeading>
          <P>The bell icon in the sidebar shows your unread count.</P>

          <DataTable
            headers={["Type", "When it fires"]}
            rows={[
              [
                "Budget Warning",
                "A transaction pushes a category to 80% of its monthly limit",
              ],
              [
                "Budget Exceeded",
                "A transaction pushes a category over 100% of its limit",
              ],
              [
                "Statement Due",
                "A credit card statement is due within 7 days (daily at 09:00)",
              ],
              [
                "Recurring Created",
                "A recurring transaction was auto-generated this morning",
              ],
            ]}
          />
          <P>
            Click any notification to mark it read. Use <strong>Mark All Read</strong> to clear the
            list.
          </P>

          <H3>Push Notifications</H3>
          <P>
            The app supports native browser push notifications. When prompted, accept the permission
            request. Budget alerts and recurring transaction notifications will appear as native OS
            notifications even when the browser is minimized.
          </P>
          <P>
            To disable: Browser Settings → Site Settings → Notifications → find the FinTrack URL →
            Block.
          </P>

          <H3>Discord Integration</H3>
          <P>
            Set <Code>DISCORD_WEBHOOK_URL</Code> in your <Code>.env</Code> to a Discord incoming
            webhook URL. Budget alerts and statement due reminders will be sent as formatted Discord
            messages. To create: Discord server → Channel Settings → Integrations → Webhooks → New
            Webhook → Copy URL.
          </P>
        </section>

        {/* ── 12. PWA ── */}
        <section id="pwa" className="space-y-4 scroll-mt-6">
          <SectionHeading num={12}>Install as App (PWA)</SectionHeading>
          <P>
            FinTrack can be installed as a standalone app — it opens without browser chrome, like a
            native app.
          </P>

          <DataTable
            headers={["Platform", "Steps"]}
            rows={[
              [
                <span key="desktop">
                  <strong>Desktop</strong>
                  <br />
                  <span className="text-xs opacity-60">Chrome / Edge</span>
                </span>,
                "Look for the install icon (⊕) in the address bar → click it → Install",
              ],
              [
                <span key="android">
                  <strong>Android</strong>
                  <br />
                  <span className="text-xs opacity-60">Chrome</span>
                </span>,
                "Tap three-dot menu → Add to Home Screen → Install",
              ],
              [
                <span key="ios">
                  <strong>iOS</strong>
                  <br />
                  <span className="text-xs opacity-60">Safari</span>
                </span>,
                "Tap share icon (□↑) → scroll down → Add to Home Screen → Add",
              ],
            ]}
          />

          <H3>Offline Access</H3>
          <P>
            Previously visited pages load from cache when you&apos;re offline. A banner at the top
            indicates you&apos;re viewing cached data. If you create a transaction while offline,
            it&apos;s queued locally and replayed automatically when your connection returns.
          </P>
        </section>

        {/* ── 13. Tips & Workarounds ── */}
        <section id="tips" className="space-y-4 scroll-mt-6">
          <SectionHeading num={13}>Tips &amp; Workarounds</SectionHeading>

          <H3>Session Management</H3>
          <P>
            Access tokens auto-refresh silently every 30 minutes. If you checked{" "}
            <strong>Remember me</strong> at login, you stay logged in for up to 30 days across
            browser restarts. If pages suddenly look empty, log out and log back in.
          </P>

          <H3>Renaming an Account</H3>
          <P>
            There&apos;s no rename UI yet. Use the Swagger UI at{" "}
            <Code>http://localhost:8000/docs</Code>: authenticate via{" "}
            <Code>POST /auth/login</Code>, get your account ID from <Code>GET /accounts</Code>, then
            use <Code>PATCH /accounts/{"{id}"}</Code> with <Code>{`{"name": "New Name"}`}</Code>.
          </P>

          <H3>Adding Custom Categories</H3>
          <CodeBlock>{`curl -X POST http://localhost:8000/categories \\
  -H "Content-Type: application/json" \\
  -b "access_token=YOUR_TOKEN" \\
  -d '{"name": "Home Repair", "type": "expense", "icon": "🔨", "color": "#8b5cf6"}'`}</CodeBlock>

          <H3>Checking the Celery Worker</H3>
          <P>
            Recurring transactions and statement notifications run via Celery Beat. If transactions
            aren&apos;t generating:
          </P>
          <CodeBlock>{`docker compose logs worker --tail=50`}</CodeBlock>
          <P>
            Look for <Code>generate_recurring_transactions_task</Code> and{" "}
            <Code>send_statement_due_notifications_task</Code>.
          </P>

          <H3>Finding Account IDs</H3>
          <P>
            Go to <Code>http://localhost:8000/docs</Code> → <Code>GET /accounts</Code> → Execute.
            The response includes all account IDs and current balances.
          </P>
        </section>

        <div className="border-t pt-6 text-xs text-muted-foreground">
          FinTrack User Guide — February 2026
        </div>
      </div>

      {/* Sticky TOC */}
      <GuideToc items={TOC_ITEMS} />
    </div>
  );
}
