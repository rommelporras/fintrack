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
import { Plus, Building2, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CrudSheet } from "@/components/app/CrudSheet";

interface Institution {
  id: string;
  name: string;
  type: "traditional" | "digital" | "government" | "in_house";
  color: string | null;
}

const TYPE_LABELS: Record<Institution["type"], string> = {
  traditional: "Traditional Bank",
  digital: "Digital / E-Wallet",
  government: "Government Agency",
  in_house: "In-House / Developer",
};

const TYPE_ORDER: Institution["type"][] = ["traditional", "digital", "government", "in_house"];

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add form
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<Institution["type"]>("traditional");
  const [color, setColor] = useState("");

  // Edit form
  const [editInst, setEditInst] = useState<Institution | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<Institution["type"]>("traditional");
  const [editColor, setEditColor] = useState("");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.get<Institution[]>("/institutions");
      setInstitutions(data);
    } catch {
      setLoadError("Failed to load institutions. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/institutions", {
        name,
        type,
        color: color || null,
      });
      setOpen(false);
      setName("");
      setType("traditional");
      setColor("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create institution");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(inst: Institution) {
    setEditInst(inst);
    setEditName(inst.name);
    setEditType(inst.type);
    setEditColor(inst.color ?? "");
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editInst) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await api.patch(`/institutions/${editInst.id}`, {
        name: editName || undefined,
        type: editType,
        color: editColor || null,
      });
      setEditOpen(false);
      await load();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update institution");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await api.delete(`/institutions/${deleteId}`);
      setDeleteConfirmOpen(false);
      setDeleteId(null);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete institution";
      setDeleteError(
        msg.includes("referenced")
          ? "This institution is linked to accounts or credit lines. Remove those links first."
          : msg,
      );
    } finally {
      setDeleteSubmitting(false);
    }
  }

  // Group by type
  const grouped = TYPE_ORDER.reduce<Record<string, Institution[]>>(
    (acc, t) => {
      acc[t] = institutions.filter((i) => i.type === t);
      return acc;
    },
    {} as Record<string, Institution[]>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Institutions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Banks, wallets, and lenders you deal with
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Add Institution
        </Button>
      </div>

      {/* Add Sheet */}
      <CrudSheet
        open={open}
        onOpenChange={setOpen}
        title="New Institution"
        description="Add a bank, wallet, government agency, or in-house lender"
        onSave={handleAdd}
        saveLabel={submitting ? "Creating…" : "Create"}
        saveDisabled={submitting}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="BPI" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as Institution["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Color{" "}
              <span className="text-muted-foreground text-xs">(optional hex, e.g. #e63c2f)</span>
            </Label>
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#e63c2f"
              maxLength={7}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </CrudSheet>

      {/* Edit Sheet */}
      <CrudSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Institution"
        description="Update institution details"
        onSave={handleEdit}
        saveLabel={editSubmitting ? "Saving…" : "Save Changes"}
        saveDisabled={editSubmitting}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={editType} onValueChange={(v) => setEditType(v as Institution["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Color <span className="text-muted-foreground text-xs">(optional hex)</span>
            </Label>
            <Input
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              placeholder="#e63c2f"
              maxLength={7}
            />
          </div>
          {editError && <p className="text-sm text-destructive">{editError}</p>}
        </div>
      </CrudSheet>

      {/* Delete confirmation */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-card rounded-xl border p-6 max-w-sm mx-4 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-inst-title"
            aria-describedby="delete-inst-desc"
          >
            <h2 id="delete-inst-title" className="text-lg font-semibold">
              Delete institution?
            </h2>
            <p id="delete-inst-desc" className="text-sm text-muted-foreground">
              This cannot be undone. Unlink all accounts and credit lines before deleting.
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
              <Button variant="destructive" onClick={handleDelete} disabled={deleteSubmitting}>
                {deleteSubmitting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : institutions.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center space-y-3">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">No institutions yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Add your banks and wallets to organize your accounts
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Add Institution
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {TYPE_ORDER.filter((t) => grouped[t].length > 0).map((t) => (
            <div key={t} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                {TYPE_LABELS[t]}
              </p>
              <div className="rounded-xl border bg-card divide-y divide-border overflow-hidden">
                {grouped[t].map((inst) => (
                  <div
                    key={inst.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      {inst.color && (
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: inst.color }}
                        />
                      )}
                      <span className="font-medium text-sm">{inst.name}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(inst)}>
                          <Pencil className="h-4 w-4 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setDeleteId(inst.id);
                            setDeleteConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
