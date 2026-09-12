import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PolicyFormDialog from "@/components/PolicyFormDialog";
import { FIELD_LABEL } from "@/lib/fields";
import { UploadCloud, ScanLine, Loader2, CheckCircle2, FileType2 } from "lucide-react";
import { toast } from "sonner";

export default function AIExtract() {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pick = (f) => {
    if (!f) return;
    setFile(f);
    setFields(null);
    if (f.type.startsWith("image/")) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  };

  const extract = async () => {
    if (!file) return;
    setLoading(true);
    setFields(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/extract", fd);
      setFields(data.fields);
      toast.success("Dati estratti con successo");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Estrazione non riuscita");
    } finally {
      setLoading(false);
    }
  };

  const filled = fields ? Object.entries(fields).filter(([, v]) => v && v.trim()) : [];

  const saveExtracted = async (form) => {
    try {
      await api.post("/policies", form);
      toast.success("Polizza salvata");
      setDialogOpen(false);
      setFields(null);
      setFile(null);
      setPreview(null);
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  return (
    <div className="space-y-6" data-testid="ai-extract-page">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Estrazione AI</h1>
        <p className="text-sm text-slate-500">Carica un PDF o un'immagine della polizza: i dati vengono estratti automaticamente.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center transition-colors hover:border-primary hover:bg-accent/40"
            data-testid="ai-extract-dropzone"
          >
            <UploadCloud className="h-10 w-10 text-primary" />
            <p className="mt-3 text-sm font-medium text-slate-700">Trascina qui il file o clicca per caricare</p>
            <p className="mt-1 text-xs text-slate-400">PDF, JPG o PNG · max 15MB</p>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden
              data-testid="ai-extract-upload-input" onChange={(e) => pick(e.target.files?.[0])} />
          </div>

          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-100 p-3">
              <FileType2 className="h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>
          )}
          {preview && <img src={preview} alt="anteprima" className="mt-4 max-h-64 w-full rounded-lg border object-contain" />}

          <Button onClick={extract} disabled={!file || loading} className="mt-4 w-full" data-testid="ai-extract-run-button">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
            {loading ? "Estrazione in corso…" : "Estrai dati con AI"}
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Dati estratti
          </h3>
          {!fields && <p className="py-12 text-center text-sm text-slate-400">I dati estratti appariranno qui.</p>}
          {fields && (
            <>
              <div className="max-h-[420px] space-y-2 overflow-y-auto scrollbar-thin pr-1">
                {filled.length === 0 && <p className="text-sm text-slate-400">Nessun campo riconosciuto.</p>}
                {filled.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2" data-testid={`extracted-${k}`}>
                    <span className="text-xs font-medium text-slate-500">{FIELD_LABEL[k] || k}</span>
                    <span className="text-right text-sm font-medium text-slate-800">{v}</span>
                  </div>
                ))}
              </div>
              <Button className="mt-4 w-full" onClick={() => setDialogOpen(true)} data-testid="ai-extract-review-button">
                Verifica e salva polizza
              </Button>
            </>
          )}
        </Card>
      </div>

      <PolicyFormDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={fields} onSave={saveExtracted} />
    </div>
  );
}
