import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { PenTool, Plus, FileText, Trash2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function Templates() {
  const nav = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const load = () => api.get("/templates").then(({ data }) => setTemplates(data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name || !file) { toast.error("Nome e file richiesti"); return; }
    setSaving(true);
    const fd = new FormData();
    fd.append("name", name);
    fd.append("file", file);
    try {
      const { data } = await api.post("/templates", fd);
      toast.success("Modello caricato");
      setOpen(false); setName(""); setFile(null);
      nav(`/modelli/${data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Caricamento non riuscito");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    await api.delete(`/templates/${id}`);
    toast.success("Modello eliminato");
    load();
  };

  return (
    <div className="space-y-6" data-testid="templates-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Modelli PDF</h1>
          <p className="text-sm text-slate-500">Carica un PDF e posiziona i campi da compilare automaticamente.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="template-add-button"><Plus className="mr-2 h-4 w-4" /> Nuovo Modello</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Carica modello PDF</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="tname">Nome modello</Label>
                <Input id="tname" value={name} onChange={(e) => setName(e.target.value)}
                  data-testid="template-name-input" placeholder="Es. Modulo proposta RCA" className="mt-1.5" />
              </div>
              <div>
                <Label>File PDF (o immagine)</Label>
                <div onClick={() => fileRef.current?.click()}
                  className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-slate-200 px-4 py-6 hover:border-primary"
                  data-testid="pdf-field-dropzone">
                  <FileText className="h-6 w-6 text-primary" />
                  <span className="text-sm text-slate-600">{file ? file.name : "Clicca per selezionare un PDF"}</span>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden
                    onChange={(e) => setFile(e.target.files?.[0])} data-testid="template-file-input" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button onClick={create} disabled={saving} data-testid="template-create-button">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Carica e apri editor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.length === 0 && (
          <Card className="col-span-full p-12 text-center text-slate-400">
            <PenTool className="mx-auto mb-3 h-8 w-8" /> Nessun modello. Carica il tuo primo PDF.
          </Card>
        )}
        {templates.map((t) => (
          <Card key={t.id} onClick={() => nav(`/modelli/${t.id}`)}
            className="cursor-pointer p-5 hover:shadow-md" data-testid={`template-card-${t.id}`}>
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <Button variant="ghost" size="icon" onClick={(e) => remove(t.id, e)} data-testid={`template-delete-${t.id}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <h3 className="mt-3 font-semibold text-slate-800">{t.name}</h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <MapPin className="h-3 w-3" /> {t.fields?.length || 0} campi · {t.page_count} pagine
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
