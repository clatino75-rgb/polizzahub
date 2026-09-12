import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ALL_FIELDS, FIELD_LABEL } from "@/lib/fields";
import { ArrowLeft, Save, Download, Trash2, MousePointerClick, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export default function TemplateEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tpl, setTpl] = useState(null);
  const [fields, setFields] = useState([]);
  const [activeKey, setActiveKey] = useState(ALL_FIELDS[0].key);
  const [fontSize, setFontSize] = useState(11);
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState("");
  const [saving, setSaving] = useState(false);
  const imgRefs = useRef({});

  useEffect(() => {
    api.get(`/templates/${id}`).then(({ data }) => { setTpl(data); setFields(data.fields || []); });
    api.get("/policies").then(({ data }) => setPolicies(data));
  }, [id]);

  const placeField = (e, pageIndex) => {
    const img = imgRefs.current[pageIndex];
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const meta = tpl.page_meta[pageIndex];
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const x = (px / rect.width) * meta.width;
    const y = (py / rect.height) * meta.height;
    const label = FIELD_LABEL[activeKey] || activeKey;
    setFields((prev) => [
      ...prev.filter((f) => f.key !== activeKey),
      { key: activeKey, label, page: pageIndex, x: +x.toFixed(1), y: +y.toFixed(1), font_size: fontSize },
    ]);
    toast.success(`Campo "${label}" posizionato`);
  };

  const removeField = (key) => setFields((prev) => prev.filter((f) => f.key !== key));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/templates/${id}/fields`, fields);
      toast.success("Posizioni salvate");
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    try {
      const res = await api.post(`/templates/${id}/generate`,
        { policy_id: selectedPolicy || null, field_values: {} }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch {
      toast.error("Errore nella generazione");
    }
  };

  if (!tpl) return <div className="text-slate-400">Caricamento…</div>;

  const placedByPage = (pi) => fields.filter((f) => f.page === pi);

  return (
    <div className="space-y-5" data-testid="template-editor-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav("/modelli")}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">{tpl.name}</h1>
            <p className="text-xs text-slate-500">Seleziona un campo, poi clicca sul documento per posizionarlo.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={save} disabled={saving} data-testid="template-save-fields-button">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salva posizioni
          </Button>
          <Button variant="outline" onClick={generate} data-testid="template-generate-button">
            <Download className="mr-2 h-4 w-4" /> Genera PDF
          </Button>
          <Button onClick={() => nav(`/firme?template=${id}${selectedPolicy ? `&policy=${selectedPolicy}` : ""}`)} data-testid="template-to-sign-button">
            <Send className="mr-2 h-4 w-4" /> Invia in firma
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <Card className="p-4 lg:sticky lg:top-20 lg:h-fit">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MousePointerClick className="h-4 w-4 text-primary" /> Campo da posizionare
          </h3>
          <Select value={activeKey} onValueChange={setActiveKey}>
            <SelectTrigger data-testid="active-field-select"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {ALL_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="mt-3">
            <Label className="text-xs text-slate-500">Dimensione testo</Label>
            <Input type="number" min={6} max={40} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))} className="mt-1" />
          </div>

          <div className="mt-4">
            <Label className="text-xs text-slate-500">Anteprima con polizza</Label>
            <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
              <SelectTrigger className="mt-1" data-testid="preview-policy-select">
                <SelectValue placeholder="Nessuna (campi vuoti)" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__none">Nessuna</SelectItem>
                {policies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.numero_polizza || p.contraente_nome || p.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-slate-500">Campi posizionati ({fields.length})</p>
            <div className="max-h-56 space-y-1.5 overflow-y-auto scrollbar-thin">
              {fields.length === 0 && <p className="text-xs text-slate-400">Nessuno ancora.</p>}
              {fields.map((f) => (
                <div key={f.key} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-xs">
                  <span className="truncate text-slate-700">{f.label} <span className="text-slate-400">(p{f.page + 1})</span></span>
                  <button onClick={() => removeField(f.key)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-3">
          {tpl.pages.map((pg, pi) => (
            <Card key={pi} className="overflow-hidden p-3">
              <p className="mb-2 text-xs font-medium text-slate-400">Pagina {pi + 1}</p>
              <div className="relative inline-block w-full">
                <img
                  ref={(el) => (imgRefs.current[pi] = el)}
                  src={pg.image}
                  alt={`pagina ${pi + 1}`}
                  onClick={(e) => placeField(e, pi)}
                  className="w-full cursor-crosshair rounded-md border border-slate-200"
                  data-testid={`template-page-${pi}`}
                />
                {placedByPage(pi).map((f) => {
                  const meta = tpl.page_meta[pi];
                  return (
                    <div key={f.key}
                      style={{ left: `${(f.x / meta.width) * 100}%`, top: `${(f.y / meta.height) * 100}%` }}
                      className="absolute -translate-y-0 rounded bg-primary/85 px-1.5 py-0.5 text-[10px] font-medium text-white shadow ring-2 ring-white">
                      {f.label}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
