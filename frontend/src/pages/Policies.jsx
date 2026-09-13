import { useEffect, useState, useRef } from "react";
import { api, API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PolicyFormDialog from "@/components/PolicyFormDialog";
import DocumentsDialog from "@/components/DocumentsDialog";
import ExcelImportDialog from "@/components/ExcelImportDialog";
import {
  Plus, Search, Pencil, Trash2, Download, Upload, FileSpreadsheet, FileText, RefreshCw, Paperclip, Filter, X,
} from "lucide-react";
import { toast } from "sonner";

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [docFor, setDocFor] = useState(null);
  const [mapFile, setMapFile] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [filters, setFilters] = useState({ compagnia_id: "", ramo: "", collaboratore_id: "" });
  const [compagnie, setCompagnie] = useState([]);
  const [collaboratori, setCollaboratori] = useState([]);
  const [rami, setRami] = useState([]);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = { search };
      if (filters.compagnia_id) params.compagnia_id = filters.compagnia_id;
      if (filters.ramo) params.ramo = filters.ramo;
      if (filters.collaboratore_id) params.collaboratore_id = filters.collaboratore_id;
      const { data } = await api.get(`/policies`, { params });
      setPolicies(data);
      api.get("/policies/rami").then((r) => setRami(r.data)).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get("/registry/compagnie").then((r) => setCompagnie(r.data)).catch(() => {});
    api.get("/registry/collaboratori").then((r) => setCollaboratori(r.data)).catch(() => {});
    api.get("/policies/rami").then((r) => setRami(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [search, filters]);

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
      load();
    } catch (e) {
      toast.error("Errore nel salvataggio");
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/policies/${delId}`);
      toast.success("Polizza eliminata");
      load();
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

  const renew = async (id) => {
    try {
      await api.post(`/policies/${id}/renew`);
      toast.success("Polizza rinnovata: creata copia con nuove date");
      load();
    } catch {
      toast.error("Rinnovo non riuscito");
    }
  };

  const onImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMapFile(file);
    setMapOpen(true);
    if (fileRef.current) fileRef.current.value = "";
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="policy-search-input"
            placeholder="Cerca numero, contraente, targa…" className="pl-9" />
        </div>
        <Select value={filters.compagnia_id || "__all"} onValueChange={(v) => setFilters((f) => ({ ...f, compagnia_id: v === "__all" ? "" : v }))}>
          <SelectTrigger className="w-[180px]" data-testid="filter-compagnia"><SelectValue placeholder="Compagnia" /></SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="__all">Tutte le compagnie</SelectItem>
            {compagnie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.ramo || "__all"} onValueChange={(v) => setFilters((f) => ({ ...f, ramo: v === "__all" ? "" : v }))}>
          <SelectTrigger className="w-[160px]" data-testid="filter-ramo"><SelectValue placeholder="Ramo" /></SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="__all">Tutti i rami</SelectItem>
            {rami.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.collaboratore_id || "__all"} onValueChange={(v) => setFilters((f) => ({ ...f, collaboratore_id: v === "__all" ? "" : v }))}>
          <SelectTrigger className="w-[180px]" data-testid="filter-collaboratore"><SelectValue placeholder="Collaboratore" /></SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="__all">Tutti i collaboratori</SelectItem>
            {collaboratori.map((k) => <SelectItem key={k.id} value={k.id}>{k.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filters.compagnia_id || filters.ramo || filters.collaboratore_id) && (
          <Button variant="ghost" size="sm" data-testid="filter-clear"
            onClick={() => { setSearch(""); setFilters({ compagnia_id: "", ramo: "", collaboratore_id: "" }); }}>
            <X className="mr-1 h-4 w-4" /> Azzera
          </Button>
        )}
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
                <TableHead>Garanzie / Box</TableHead>
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
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" data-testid={`policy-garanzie-count-${p.id}`}>
                        {(p.garanzie?.length || 0)} gar.
                      </Badge>
                      {p.scatola_nera === "Sì" && (
                        <Badge className="border-0 bg-sky-100 text-sky-700" data-testid={`policy-box-${p.id}`}>Box</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" data-testid={`policy-docs-${p.id}`}
                      onClick={() => setDocFor(p)} title="Documenti archiviati">
                      <Paperclip className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" data-testid={`policy-renew-${p.id}`}
                      onClick={() => renew(p.id)} title="Rinnovo rapido">
                      <RefreshCw className="h-4 w-4 text-primary" />
                    </Button>
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

      <DocumentsDialog open={!!docFor} onOpenChange={(o) => !o && setDocFor(null)} policy={docFor} />

      <ExcelImportDialog open={mapOpen} onOpenChange={setMapOpen} file={mapFile} onDone={() => load()} />

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
