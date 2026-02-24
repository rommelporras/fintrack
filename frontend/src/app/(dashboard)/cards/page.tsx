"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CreditCard as CreditCardIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CrudSheet } from "@/components/app/CrudSheet";
import { CurrencyInput } from "@/components/app/CurrencyInput";
import { formatPeso } from "@/lib/utils";

interface Institution {
  id: string;
  name: string;
  type: string;
  color: string | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface CreditCardInLine {
  id: string;
  card_name: string | null;
  last_four: string;
  statement_day: number;
  due_day: number;
  account_id: string;
  institution: Institution | null;
  closed_period: { period_start: string; period_end: string } | null;
  open_period: { period_start: string; period_end: string } | null;
  due_date: string | null;
  days_until_due: number | null;
}

interface CreditLine {
  id: string;
  name: string;
  institution_id: string | null;
  institution: Institution | null;
  total_limit: string | null;
  available_override: string | null;
  available_credit: string | null;
  cards: CreditCardInLine[];
}

interface CreditCard {
  id: string;
  card_name: string | null;
  last_four: string;
  statement_day: number;
  due_day: number;
  credit_limit: string | null;
  available_credit: string | null;
  available_override: string | null;
  credit_line_id: string | null;
  institution: Institution | null;
  closed_period: { period_start: string; period_end: string } | null;
  open_period: { period_start: string; period_end: string } | null;
  due_date: string | null;
  days_until_due: number | null;
}

function BillingInfo({ card }: { card: CreditCard | CreditCardInLine }) {
  return (
    <div className="space-y-2 mt-3">
      {card.closed_period && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Current Statement</p>
          <p className="text-sm">
            {card.closed_period.period_start} → {card.closed_period.period_end}
          </p>
          {card.due_date && (
            <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
              Due: {card.due_date}
              {card.days_until_due !== null && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    card.days_until_due < 0
                      ? "bg-accent-red-dim text-accent-red"
                      : card.days_until_due <= 5
                        ? "bg-accent-amber-dim text-accent-amber"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {card.days_until_due < 0 ? "Overdue" : `${card.days_until_due}d left`}
                </span>
              )}
            </p>
          )}
        </div>
      )}
      {card.open_period && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Open Period</p>
          <p className="text-sm">
            {card.open_period.period_start} → {card.open_period.period_end}
          </p>
        </div>
      )}
    </div>
  );
}

function InstitutionBadge({ institution }: { institution: Institution | null }) {
  if (!institution) return null;
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
      {institution.color && (
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ background: institution.color }}
        />
      )}
      {institution.name}
    </p>
  );
}

export default function CardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [creditLines, setCreditLines] = useState<CreditLine[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accountId, setAccountId] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [cardName, setCardName] = useState("");
  const [selectedLineId, setSelectedLineId] = useState("");
  const [statementDay, setStatementDay] = useState("15");
  const [dueDay, setDueDay] = useState("3");
  const [newAccountName, setNewAccountName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit card state
  const [editCard, setEditCard] = useState<CreditCard | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState("");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editCreditLineId, setEditCreditLineId] = useState("__none__");
  const [editStatementDay, setEditStatementDay] = useState("15");
  const [editDueDay, setEditDueDay] = useState("3");

  // Credit line state
  const [lineOpen, setLineOpen] = useState(false);
  const [lineSubmitting, setLineSubmitting] = useState(false);
  const [lineError, setLineError] = useState<string | null>(null);
  const [lineName, setLineName] = useState("");
  const [lineTotalLimit, setLineTotalLimit] = useState("");
  const [lineInstitutionId, setLineInstitutionId] = useState("");

  const [editLine, setEditLine] = useState<CreditLine | null>(null);
  const [editLineOpen, setEditLineOpen] = useState(false);
  const [editLineName, setEditLineName] = useState("");
  const [editLineTotalLimit, setEditLineTotalLimit] = useState("");
  const [editLineInstitutionId, setEditLineInstitutionId] = useState("");
  const [editLineSubmitting, setEditLineSubmitting] = useState(false);
  const [editLineError, setEditLineError] = useState<string | null>(null);

  const [deleteLineId, setDeleteLineId] = useState<string | null>(null);
  const [deleteLineConfirmOpen, setDeleteLineConfirmOpen] = useState(false);
  const [deleteLineSubmitting, setDeleteLineSubmitting] = useState(false);
  const [deleteLineError, setDeleteLineError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [c, a, cl, inst] = await Promise.all([
        api.get<CreditCard[]>("/credit-cards"),
        api.get<Account[]>("/accounts"),
        api.get<CreditLine[]>("/credit-lines"),
        api.get<Institution[]>("/institutions"),
      ]);
      setCards(c);
      setAccounts(a);
      setCreditLines(cl);
      setInstitutions(inst);
    } catch {
      setLoadError("Failed to load cards. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (accountId === "__new__") {
      setNewAccountName(cardName ? `${cardName} Credit Card` : "");
    }
  }, [cardName, accountId]);

  async function handleAdd() {
    setSubmitting(true);
    setError(null);
    try {
      let resolvedAccountId = accountId;
      if (accountId === "__new__") {
        const newAccount = await api.post<{ id: string }>("/accounts", {
          name: newAccountName,
          type: "credit_card",
          opening_balance: "0",
        });
        resolvedAccountId = newAccount.id;
      }
      await api.post("/credit-cards", {
        account_id: resolvedAccountId,
        last_four: lastFour,
        card_name: cardName || null,
        credit_limit:
          (!selectedLineId || selectedLineId === "__none__") && creditLimit
            ? Number(creditLimit)
            : null,
        credit_line_id:
          selectedLineId && selectedLineId !== "__none__" ? selectedLineId : null,
        statement_day: Number(statementDay),
        due_day: Number(dueDay),
      });
      setOpen(false);
      setLastFour("");
      setCardName("");
      setSelectedLineId("");
      setAccountId("");
      setCreditLimit("");
      setNewAccountName("");
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create card");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(card: CreditCard) {
    setEditCard(card);
    setEditCardName(card.card_name ?? "");
    setEditCreditLimit(card.credit_limit ?? "");
    setEditCreditLineId(card.credit_line_id ?? "__none__");
    setEditStatementDay(String(card.statement_day));
    setEditDueDay(String(card.due_day));
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEditCard() {
    if (!editCard) return;
    setEditSubmitting(true);
    setEditError(null);
    const isInLine = editCreditLineId && editCreditLineId !== "__none__";
    try {
      await api.patch(`/credit-cards/${editCard.id}`, {
        card_name: editCardName || null,
        credit_line_id: isInLine ? editCreditLineId : null,
        credit_limit: !isInLine && editCreditLimit ? Number(editCreditLimit) : null,
        statement_day: Number(editStatementDay),
        due_day: Number(editDueDay),
      });
      setEditOpen(false);
      await loadData();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update card");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteCard() {
    if (!deleteCardId) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await api.delete(`/credit-cards/${deleteCardId}`);
      setDeleteConfirmOpen(false);
      setDeleteCardId(null);
      await loadData();
    } catch {
      setDeleteError("Failed to delete card. Please try again.");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleAddLine() {
    setLineSubmitting(true);
    setLineError(null);
    try {
      await api.post("/credit-lines", {
        name: lineName,
        total_limit: lineTotalLimit ? Number(lineTotalLimit) : null,
        institution_id:
          lineInstitutionId && lineInstitutionId !== "__none__" ? lineInstitutionId : null,
      });
      setLineOpen(false);
      setLineName("");
      setLineTotalLimit("");
      setLineInstitutionId("");
      await loadData();
    } catch (e: unknown) {
      setLineError(e instanceof Error ? e.message : "Failed to create credit line");
    } finally {
      setLineSubmitting(false);
    }
  }

  function openEditLine(line: CreditLine) {
    setEditLine(line);
    setEditLineName(line.name);
    setEditLineTotalLimit(line.total_limit ?? "");
    setEditLineInstitutionId(line.institution_id ?? "");
    setEditLineError(null);
    setEditLineOpen(true);
  }

  async function handleEditLine() {
    if (!editLine) return;
    setEditLineSubmitting(true);
    setEditLineError(null);
    try {
      await api.patch(`/credit-lines/${editLine.id}`, {
        name: editLineName || undefined,
        total_limit: editLineTotalLimit ? Number(editLineTotalLimit) : null,
        institution_id:
          editLineInstitutionId && editLineInstitutionId !== "__none__"
            ? editLineInstitutionId
            : null,
      });
      setEditLineOpen(false);
      await loadData();
    } catch (e: unknown) {
      setEditLineError(e instanceof Error ? e.message : "Failed to update credit line");
    } finally {
      setEditLineSubmitting(false);
    }
  }

  async function handleDeleteLine() {
    if (!deleteLineId) return;
    setDeleteLineSubmitting(true);
    setDeleteLineError(null);
    try {
      await api.delete(`/credit-lines/${deleteLineId}`);
      setDeleteLineConfirmOpen(false);
      setDeleteLineId(null);
      await loadData();
    } catch {
      setDeleteLineError("Failed to delete credit line. Please try again.");
    } finally {
      setDeleteLineSubmitting(false);
    }
  }

  const standaloneCards = cards.filter((c) => c.credit_line_id === null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Credit Cards</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your cards and billing cycles
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setLineOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Add Credit Line
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Add Card
          </Button>
        </div>
      </div>

      <CrudSheet
        open={open}
        onOpenChange={setOpen}
        title="New Credit Card"
        description="Add a credit card to track billing cycles"
        onSave={handleAdd}
        saveLabel={submitting ? "Creating…" : "Create Card"}
        saveDisabled={submitting}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Linked Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">+ Create new account</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {accountId === "__new__" && (
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="e.g. BPI Credit Card"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Last 4 Digits</Label>
            <Input
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value)}
              placeholder="1234"
              maxLength={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Card Name</Label>
            <Input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g. Amore Cashback"
            />
          </div>
          <div className="space-y-2">
            <Label>Credit Line</Label>
            <Select value={selectedLineId} onValueChange={setSelectedLineId}>
              <SelectTrigger>
                <SelectValue placeholder="None (standalone)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (standalone)</SelectItem>
                {creditLines.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(!selectedLineId || selectedLineId === "__none__") && (
            <div className="space-y-2">
              <Label>Credit Limit</Label>
              <CurrencyInput value={creditLimit} onChange={setCreditLimit} placeholder="0.00" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statement Day</Label>
              <Input
                type="number"
                min="1"
                max="28"
                value={statementDay}
                onChange={(e) => setStatementDay(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Day</Label>
              <Input
                type="number"
                min="1"
                max="28"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </CrudSheet>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : cards.length === 0 && creditLines.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center space-y-3">
          <CreditCardIcon className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">No credit cards yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Add a card to track statements and due dates
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Card
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Credit Lines */}
          {creditLines.map((line) => (
            <div key={line.id} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <p className="text-sm font-semibold text-foreground">{line.name}</p>
                  <InstitutionBadge institution={line.institution} />
                  <p className="text-xs text-muted-foreground">
                    {line.total_limit != null && `Total: ${formatPeso(line.total_limit)}`}
                    {line.available_credit != null &&
                      ` · Available: ${formatPeso(line.available_credit)}`}
                    {line.available_override != null && (
                      <span className="ml-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        manual
                      </span>
                    )}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditLine(line)}>
                      <Pencil className="h-4 w-4 mr-2" />Edit line
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        setDeleteLineId(line.id);
                        setDeleteLineConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />Delete line
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {line.cards.map((c) => (
                  <div key={c.id} className="rounded-xl border bg-card p-5 card-interactive">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-accent-blue-dim flex items-center justify-center shrink-0">
                          <CreditCardIcon className="h-4 w-4 text-accent-blue" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">
                            {c.card_name ?? `···${c.last_four}`}
                          </p>
                          <p className="text-xs text-muted-foreground">···{c.last_four}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              openEdit({
                                ...c,
                                credit_limit: null,
                                available_credit: null,
                                available_override: null,
                                credit_line_id: line.id,
                              } as unknown as CreditCard)
                            }
                          >
                            <Pencil className="h-4 w-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setDeleteCardId(c.id);
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <BillingInfo card={c} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Standalone cards */}
          {standaloneCards.length > 0 && (
            <div className="space-y-3">
              {creditLines.length > 0 && (
                <p className="text-sm font-semibold text-foreground px-1">Standalone</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {standaloneCards.map((c) => (
                  <div key={c.id} className="rounded-xl border bg-card p-5 card-interactive">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-accent-blue-dim flex items-center justify-center shrink-0">
                          <CreditCardIcon className="h-4 w-4 text-accent-blue" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">
                            {c.card_name ?? `···${c.last_four}`}
                          </p>
                          {c.institution ? (
                            <InstitutionBadge institution={c.institution} />
                          ) : (
                            <p className="text-xs text-muted-foreground">···{c.last_four}</p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setDeleteCardId(c.id);
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {(c.credit_limit != null || c.available_credit != null) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {c.credit_limit != null && `Total: ${formatPeso(c.credit_limit)}`}
                        {c.available_credit != null &&
                          ` · Available: ${formatPeso(c.available_credit)}`}
                        {c.available_override != null && (
                          <span className="ml-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            manual
                          </span>
                        )}
                      </p>
                    )}
                    <BillingInfo card={c} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Card Sheet */}
      <CrudSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Credit Card"
        description="Update card details"
        onSave={handleEditCard}
        saveLabel={editSubmitting ? "Saving…" : "Save Changes"}
        saveDisabled={editSubmitting}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Card Name</Label>
            <Input
              value={editCardName}
              onChange={(e) => setEditCardName(e.target.value)}
              placeholder="e.g. Amore Cashback"
            />
          </div>
          <div className="space-y-2">
            <Label>Credit Line</Label>
            <Select value={editCreditLineId} onValueChange={setEditCreditLineId}>
              <SelectTrigger>
                <SelectValue placeholder="None (standalone)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (standalone)</SelectItem>
                {creditLines.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(!editCreditLineId || editCreditLineId === "__none__") && (
            <div className="space-y-2">
              <Label>Credit Limit</Label>
              <CurrencyInput
                value={editCreditLimit}
                onChange={setEditCreditLimit}
                placeholder="0.00"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statement Day</Label>
              <Input
                type="number"
                min="1"
                max="28"
                value={editStatementDay}
                onChange={(e) => setEditStatementDay(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Day</Label>
              <Input
                type="number"
                min="1"
                max="28"
                value={editDueDay}
                onChange={(e) => setEditDueDay(e.target.value)}
              />
            </div>
          </div>
          {editError && <p className="text-sm text-destructive">{editError}</p>}
        </div>
      </CrudSheet>

      {/* Delete Card Confirmation */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-card rounded-xl border p-6 max-w-sm mx-4 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-card-dialog-title"
            aria-describedby="delete-card-dialog-desc"
          >
            <h2 id="delete-card-dialog-title" className="text-lg font-semibold">
              Delete card?
            </h2>
            <p id="delete-card-dialog-desc" className="text-sm text-muted-foreground">
              This card and its billing cycle history will be removed. Your transactions are not
              affected.
            </p>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteError(null);
                }}
                disabled={deleteSubmitting}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteCard} disabled={deleteSubmitting}>
                {deleteSubmitting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credit Line Sheet */}
      <CrudSheet
        open={lineOpen}
        onOpenChange={setLineOpen}
        title="New Credit Line"
        description="A credit line groups cards that share a spending limit"
        onSave={handleAddLine}
        saveLabel={lineSubmitting ? "Creating…" : "Create Credit Line"}
        saveDisabled={lineSubmitting}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={lineName}
              onChange={(e) => setLineName(e.target.value)}
              placeholder="BPI Credit Line"
            />
          </div>
          <div className="space-y-2">
            <Label>Institution</Label>
            <Select value={lineInstitutionId} onValueChange={setLineInstitutionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select institution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {institutions.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Total Limit</Label>
            <CurrencyInput
              value={lineTotalLimit}
              onChange={setLineTotalLimit}
              placeholder="0.00"
            />
          </div>
          {lineError && <p className="text-sm text-destructive">{lineError}</p>}
        </div>
      </CrudSheet>

      {/* Edit Credit Line Sheet */}
      <CrudSheet
        open={editLineOpen}
        onOpenChange={setEditLineOpen}
        title="Edit Credit Line"
        description="Update credit line details"
        onSave={handleEditLine}
        saveLabel={editLineSubmitting ? "Saving…" : "Save Changes"}
        saveDisabled={editLineSubmitting}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={editLineName} onChange={(e) => setEditLineName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Institution</Label>
            <Select value={editLineInstitutionId} onValueChange={setEditLineInstitutionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select institution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {institutions.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Total Limit</Label>
            <CurrencyInput
              value={editLineTotalLimit}
              onChange={setEditLineTotalLimit}
              placeholder="0.00"
            />
          </div>
          {editLineError && <p className="text-sm text-destructive">{editLineError}</p>}
        </div>
      </CrudSheet>

      {/* Delete Credit Line Confirmation */}
      {deleteLineConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-card rounded-xl border p-6 max-w-sm mx-4 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-line-dialog-title"
            aria-describedby="delete-line-dialog-desc"
          >
            <h2 id="delete-line-dialog-title" className="text-lg font-semibold">
              Delete credit line?
            </h2>
            <p id="delete-line-dialog-desc" className="text-sm text-muted-foreground">
              Cards will become standalone. Your transactions are not affected.
            </p>
            {deleteLineError && <p className="text-sm text-destructive">{deleteLineError}</p>}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteLineConfirmOpen(false);
                  setDeleteLineError(null);
                }}
                disabled={deleteLineSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteLine}
                disabled={deleteLineSubmitting}
              >
                {deleteLineSubmitting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
