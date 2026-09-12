import { useEffect, useState, useRef } from "react";
import { api, API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PolicyFormDialog from "@/components/PolicyFormDialog";
import {
  Plus, Search, Pencil, Trash2, Download, Upload, FileSpreadsheet, FileText,
} from "lucide-react";
import { toast } from "sonner";

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId] = useState(null);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  const load = async (q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get(`/policies`, { params: { search: q } });
      setPolicies(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const save = async (form) => {
    try {
      if (editing?.id) {
        await api.put(`/policies/${editing.id}`, form);
        toast.success("Polizza aggiornata");
      } else {
        await api.post(`/policies`, form);
        toast.success("Polizza creata");
      }
      setDialogOpen(false);
      setEditing(null);
      load(search);
    } catch (e) {
      toast.error("Errore nel salvataggio");
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/policies/${delId}`);
      toast.success("Polizza eliminata");
      load(search);
    } catch {
      toast.error("Errore nell'eliminazione");
    } finally {
      setDelId(null);
    }
  };

  const downloadFile = async (path, filename) => {
    const res = await api.get(path, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/policies/import`, fd);
      toast.success(data.message);
      load(search);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Import non riuscito");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6" data-testid="policies-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Polizze</h1>
          <p className="text-sm text-slate-500">Gestisci e modifica le anagrafiche delle polizze.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={onImport} data-testid="import-file-input" />
          <Button variant="outline" size="sm" onClick={() => downloadFile("/policies/export-template", "modello_import.xlsx")} data-testid="download-template-button">
            <FileText className="mr-2 h-4 w-4" /> Modello Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} data-testid="import-excel-button">
            <Upload className="mr-2 h-4 w-4" /> Importa Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadFile("/policies/export", "anagrafiche_polizze.xlsx")} data-testid="export-excel-button">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Esporta Excel
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} data-testid="policy-add-button">
            <Plus className="mr-2 h-4 w-4" /> Nuova Polizza
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="policy-search-input"
          placeholder="Cerca per numero, contraente, targa, compagnia…" className="pl-9" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60">
                <TableHead>Numero</TableHead>
                <TableHead>Contraente</TableHead>
                <TableHead>Compagnia</TableHead>
                <TableHead>Ramo</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Frazionamento</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-slate-400">Caricamento…</TableCell></TableRow>
              )}
              {!loading && policies.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-slate-400">
                  Nessuna polizza. Creane una nuova, importa da Excel o usa l'Estrazione AI.
                </TableCell></TableRow>
              )}
              {policies.map((p) => (
                <TableRow key={p.id} data-testid={`policy-row-${p.id}`} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-800">{p.numero_polizza || "—"}</TableCell>
                  <TableCell>{p.contraente_nome || "—"}</TableCell>
                  <TableCell>{p.compagnia_emissione || "—"}</TableCell>
                  <TableCell>{p.ramo_polizza ? <Badge variant="secondary">{p.ramo_polizza}</Badge> : "—"}</TableCell>
                  <TableCell>{p.data_scadenza || "—"}</TableCell>
                  <TableCell>{p.frazionamento || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" data-testid={`policy-edit-${p.id}`}
                      onClick={() => { setEditing(p); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" data-testid={`policy-delete-${p.id}`}
                      onClick={() => setDelId(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <PolicyFormDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} onSave={save} />

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la polizza?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione non puo essere annullata.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={remove} data-testid="confirm-delete-button" className="bg-destructive hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
