import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

const IGNORE = "__ignore";

export default function ExcelImportDialog({ open, onOpenChange, file, onDone }) {
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open || !file) return;
    setPreview(null);
    setResult(null);
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    api.post("/policies/import/preview", fd)
      .then(({ data }) => {
        setPreview(data);
        setOptions(data.field_options || []);
        const init = {};
        (data.headers || []).forEach((h) => { init[h] = data.auto_map?.[h] || IGNORE; });
        setMapping(init);
      })
      .catch((e) => toast.error(e.response?.data?.detail || "Anteprima non riuscita"))
      .finally(() => setLoading(false));
  }, [open, file]);

  const setMap = (header, key) => setMapping((m) => ({ ...m, [header]: key }));

  const doImport = async () => {
    setImporting(true);
    const clean = {};
    Object.entries(mapping).forEach(([h, k]) => { if (k && k !== IGNORE) clean[h] = k; });
    if (Object.keys(clean).length === 0) {
      toast.error("Associa almeno una colonna a un campo");
      setImporting(false);
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapping", JSON.stringify(clean));
    try {
      const { data } = await api.post("/policies/import", fd);
      toast.success(data.message);
      onDone?.();
      setResult(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Import non riuscito");
    } finally {
      setImporting(false);
    }
  };

  const close = () => { onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="excel-import-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Associa colonne Excel
          </DialogTitle>
          <DialogDescription>Abbina le colonne del file ai campi della polizza prima di importare.</DialogDescription>
        </DialogHeader>
        {!result && (
        <p className="text-xs text-slate-500">
          Abbina ogni colonna del tuo file ai campi della polizza. Le colonne riconosciute sono già preselezionate.
        </p>
        )}

        {loading && <div className="py-10 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>}

        {preview && !loading && !result && (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto scrollbar-thin pr-1">
            {preview.headers.length === 0 && <p className="text-sm text-slate-400">Nessuna colonna trovata.</p>}
            {preview.headers.map((h, i) => (
              <div key={i} className="grid grid-cols-2 items-center gap-3 rounded-lg border border-slate-100 p-2.5" data-testid={`map-row-${i}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{h || `Colonna ${i + 1}`}</p>
                  <p className="truncate text-xs text-slate-400">
                    es. {preview.sample?.[0]?.[i] || "—"}
                  </p>
                </div>
                <Select value={mapping[h] || IGNORE} onValueChange={(v) => setMap(h, v)}>
                  <SelectTrigger data-testid={`map-select-${i}`}><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value={IGNORE}>— Ignora colonna —</SelectItem>
                    {options.map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div className="space-y-4" data-testid="import-result-report">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400">Righe totali</p>
                <p className="font-display text-2xl font-bold text-slate-900">{result.total}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                <p className="text-xs text-emerald-600">Importate</p>
                <p className="font-display text-2xl font-bold text-emerald-700" data-testid="import-imported-count">{result.imported}</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-center">
                <p className="text-xs text-amber-600">Scartate</p>
                <p className="font-display text-2xl font-bold text-amber-700" data-testid="import-skipped-count">{result.skipped_count}</p>
              </div>
            </div>
            {result.skipped_count > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Righe scartate</p>
                <div className="max-h-[40vh] space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
                  {result.skipped.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm" data-testid={`skipped-row-${s.row}`}>
                      <span className="font-medium text-slate-700">Riga {s.row}</span>
                      <span className="text-xs text-amber-700">{s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={close} data-testid="import-close-button">Chiudi</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
              <Button onClick={doImport} disabled={importing || loading} data-testid="excel-import-confirm-button">
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Importa
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
