import { useEffect, useState, useRef } from "react";
import { api, API } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, Download, Trash2, Loader2, FolderArchive, Eye } from "lucide-react";
import { toast } from "sonner";

export default function DocumentsDialog({ open, onOpenChange, policy }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    if (!policy?.id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/policies/${policy.id}/documents`);
      setDocs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open, policy?.id]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/policies/${policy.id}/documents`, fd);
      toast.success("Documento archiviato");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Caricamento non riuscito");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const download = async (d) => {
    const res = await api.get(`/documents/${d.id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url; a.download = d.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const openPreview = async (d) => {
    const res = await api.get(`/documents/${d.id}/view`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    setPreview({ url, type: d.content_type, name: d.filename });
  };

  const del = async (id) => {
    await api.delete(`/documents/${id}`);
    toast.success("Documento eliminato");
    load();
  };

  const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="documents-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FolderArchive className="h-5 w-5 text-primary" /> Documenti archiviati
          </DialogTitle>
          <DialogDescription>Carica e scarica le scansioni collegate a questa polizza.</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-slate-500">
          Polizza {policy?.numero_polizza || policy?.contraente_nome || "—"}. Carica scansioni (PDF/JPEG) e
          scaricale in una cartella sul PC o su chiavetta USB.
        </p>

        <div
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center hover:border-primary hover:bg-accent/40"
          data-testid="document-dropzone"
        >
          {uploading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <UploadCloud className="h-7 w-7 text-primary" />}
          <p className="mt-2 text-sm text-slate-600">Clicca per caricare un documento</p>
          <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={upload} data-testid="document-upload-input" />
        </div>

        <div className="mt-2 max-h-72 space-y-2 overflow-y-auto scrollbar-thin">
          {loading && <p className="text-sm text-slate-400">Caricamento…</p>}
          {!loading && docs.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Nessun documento archiviato.</p>}
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5" data-testid={`document-${d.id}`}>
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">{d.filename}</p>
                <p className="text-xs text-slate-400">{fmtSize(d.size)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openPreview(d)} data-testid={`document-view-${d.id}`}>
                <Eye className="h-4 w-4 text-primary" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => download(d)} data-testid={`document-download-${d.id}`}>
                <Download className="h-4 w-4 text-slate-500" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => del(d.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) { if (preview?.url) URL.revokeObjectURL(preview.url); setPreview(null); } }}>
        <DialogContent className="max-w-3xl" data-testid="document-preview-dialog">
          <DialogHeader>
            <DialogTitle className="truncate font-display">{preview?.name}</DialogTitle>
            <DialogDescription>Anteprima del documento archiviato.</DialogDescription>
          </DialogHeader>
          {preview && (preview.type?.startsWith("image/")
            ? <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full rounded-lg object-contain" />
            : <iframe title="anteprima" src={preview.url} className="h-[70vh] w-full rounded-lg border" />)}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
