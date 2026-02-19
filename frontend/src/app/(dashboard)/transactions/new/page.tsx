"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

const INCOME_SUBTYPES = [
  { value: "salary", label: "Salary" },
  { value: "thirteenth_month", label: "13th Month Pay" },
  { value: "bonus", label: "Bonus" },
  { value: "overtime", label: "Overtime" },
  { value: "freelance", label: "Freelance" },
  { value: "business", label: "Business Income" },
  { value: "consulting", label: "Consulting" },
  { value: "rental", label: "Rental Income" },
  { value: "interest", label: "Interest" },
  { value: "dividends", label: "Dividends" },
  { value: "capital_gains", label: "Capital Gains" },
  { value: "sss_benefit", label: "SSS Benefit" },
  { value: "philhealth_reimbursement", label: "PhilHealth Reimbursement" },
  { value: "pagibig_dividend", label: "Pag-IBIG Dividend" },
  { value: "government_aid", label: "Government Aid" },
  { value: "remittance_received", label: "Remittance Received" },
  { value: "gift_received", label: "Gift Received" },
  { value: "tax_refund", label: "Tax Refund" },
  { value: "sale_of_items", label: "Sale of Items" },
  { value: "refund_cashback", label: "Refund / Cashback" },
  { value: "other_income", label: "Other Income" },
];

const EXPENSE_SUBTYPES = [
  { value: "regular", label: "Regular Expense" },
  { value: "bill_payment", label: "Bill Payment" },
  { value: "subscription", label: "Subscription" },
  { value: "gift_given", label: "Gift Given" },
  { value: "other_expense", label: "Other Expense" },
];

const TRANSFER_SUBTYPES = [
  { value: "own_account", label: "Own Account" },
  { value: "sent_to_person", label: "Sent to Person" },
  { value: "atm_withdrawal", label: "ATM Withdrawal" },
];

export default function NewTransactionPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("expense");
  const [subType, setSubType] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [description, setDescription] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    Promise.all([
      api.get<Account[]>("/accounts"),
      api.get<Category[]>("/categories"),
    ]).then(([accts, cats]) => {
      setAccounts(accts);
      setCategories(cats);
    });
  }, []);

  const isAtmWithdrawal = subType === "atm_withdrawal";
  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === "transfer"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/transactions", {
        account_id: accountId,
        to_account_id: toAccountId || undefined,
        category_id: categoryId || undefined,
        amount,
        fee_amount: feeAmount || undefined,
        type,
        sub_type: subType || undefined,
        date: txDate,
        description,
      });
      router.push("/transactions");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save transaction");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>New Transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => { setType(v); setSubType(""); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sub-type</Label>
                <Select value={subType} onValueChange={setSubType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {(type === "income" ? INCOME_SUBTYPES
                      : type === "expense" ? EXPENSE_SUBTYPES
                      : TRANSFER_SUBTYPES
                    ).map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type === "transfer" && subType === "own_account" && (
              <div className="space-y-2">
                <Label>To Account</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== accountId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type !== "transfer" && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Amount (₱)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            {isAtmWithdrawal && (
              <div className="space-y-2">
                <Label>ATM Fee (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="18.00"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                />
                {amount && feeAmount && (
                  <p className="text-xs text-muted-foreground">
                    You receive ₱{amount}. Total deducted from account: ₱
                    {(Number(amount) + Number(feeAmount)).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
