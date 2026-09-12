import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";

export default function EntityManager({ config, onView }) {
  const { endpoint, title, subtitle, columns, fields, testid, addLabel } = config;
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState(null);
  const [loading, setLoading] = useState(true);

  const empty = () => Object.fromEntries(fields.map((f) => [f.key, ""]));

  const load = async (q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint, { params: { search: q } });
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const openNew = () => { setEditing(null); setForm(empty()); setOpen(true); };
  const openEdit = (it) => { setEditing(it); setForm({ ...empty(), ...it }); setOpen(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      if (editing?.id) { await api.put(`${endpoint}/${editing.id}`, form); toast.success("Aggiornato"); }
      else { await api.post(endpoint, form); toast.success("Creato"); }
      setOpen(false);
      load(search);
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try { await api.delete(`${endpoint}/${delId}`); toast.success("Eliminato"); load(search); }
    catch { toast.error("Errore nell'eliminazione"); }
    finally { setDelId(null); }
  };

  return (
    <div className="space-y-6" data-testid={`${testid}-page`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <Button size="sm" onClick={openNew} data-testid={`${testid}-add-button`}>
          <Plus className="mr-2 h-4 w-4" /> {addLabel || "Nuovo"}
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} data-testid={`${testid}-search-input`}
          placeholder="Cerca per nome, codice, email o telefono…" className="pl-9" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60">
                {columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={columns.length + 1} className="py-10 text-center text-slate-400">Caricamento…</TableCell></TableRow>}
              {!loading && items.length === 0 && (
                <TableRow><TableCell colSpan={columns.length + 1} className="py-12 text-center text-slate-400">Nessun elemento. Aggiungine uno nuovo.</TableCell></TableRow>
              )}
              {items.map((it) => (
                <TableRow key={it.id} data-testid={`${testid}-row-${it.id}`} className="hover:bg-slate-50/50">
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.key === columns[0].key ? "font-medium text-slate-800" : ""}>
                      {it[c.key] || "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    {onView && (
                      <Button variant="ghost" size="icon" onClick={() => onView(it)} data-testid={`${testid}-view-${it.id}`}>
                        <Eye className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(it)} data-testid={`${testid}-edit-${it.id}`}>
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDelId(it.id)} data-testid={`${testid}-delete-${it.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin" data-testid={`${testid}-dialog`}>
          <DialogHeader>
            <DialogTitle className="font-display">{editing?.id ? `Modifica ${title.slice(0, -1)}` : (addLabel || "Nuovo elemento")}</DialogTitle>
            <DialogDescription>Compila i campi e salva.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                <Label className="text-xs text-slate-500">{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea value={form[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}
                    className="mt-1" data-testid={`${testid}-field-${f.key}`} />
                ) : f.type === "select" ? (
                  <Select value={form[f.key] || ""} onValueChange={(v) => set(f.key, v === "__none" ? "" : v)}>
                    <SelectTrigger className="mt-1" data-testid={`${testid}-field-${f.key}`}><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => <SelectItem key={o || "__none"} value={o || "__none"}>{o || "—"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input type={f.type || "text"} value={form[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}
                    className="mt-1" data-testid={`${testid}-field-${f.key}`} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving} data-testid={`${testid}-save-button`}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo elemento?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione non può essere annullata.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={remove} data-testid={`${testid}-confirm-delete`} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
