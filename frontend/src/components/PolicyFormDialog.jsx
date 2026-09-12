import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FIELD_SECTIONS, emptyPolicy } from "@/lib/fields";
import { api } from "@/lib/api";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { Loader2, ScanLine, Link2, Plus, Trash2, ShieldCheck } from "lucide-react";

export default function PolicyFormDialog({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(emptyPolicy());
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [anagrafiche, setAnagrafiche] = useState([]);
  const [compagnie, setCompagnie] = useState([]);
  const [collaboratori, setCollaboratori] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) setForm({ ...emptyPolicy(), ...(initial || {}) });
  }, [open, initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get("/registry/anagrafiche"),
      api.get("/registry/compagnie"),
      api.get("/registry/collaboratori"),
    ]).then(([a, c, k]) => {
      setAnagrafiche(a.data); setCompagnie(c.data); setCollaboratori(k.data);
    }).catch(() => {});
  }, [open]);

  const pickAnagrafica = (v) => {
    if (v === "__none") { setForm((f) => ({ ...f, anagrafica_id: "" })); return; }
    const a = anagrafiche.find((x) => x.id === v);
    setForm((f) => ({
      ...f, anagrafica_id: v,
      contraente_nome: a?.nome || f.contraente_nome,
      contraente_cf_piva: a?.cf_piva || f.contraente_cf_piva,
      contraente_indirizzo: a?.indirizzo || f.contraente_indirizzo,
    }));
  };
  const pickCompagnia = (v) => {
    if (v === "__none") { setForm((f) => ({ ...f, compagnia_id: "" })); return; }
    const c = compagnie.find((x) => x.id === v);
    setForm((f) => ({ ...f, compagnia_id: v, compagnia_emissione: c?.nome || f.compagnia_emissione }));
  };
  const pickCollaboratore = (v) => setForm((f) => ({ ...f, collaboratore_id: v === "__none" ? "" : v }));
  const addGaranzia = () => setForm((f) => ({ ...f, garanzie: [...(f.garanzie || []), { nome: "", premio_netto: "", premio_lordo: "" }] }));
  const updateGaranzia = (i, k, v) => setForm((f) => { const g = [...(f.garanzie || [])]; g[i] = { ...g[i], [k]: v }; return { ...f, garanzie: g }; });
  const removeGaranzia = (i) => setForm((f) => ({ ...f, garanzie: (f.garanzie || []).filter((_, idx) => idx !== i) }));
  const pickProprietario = (v) => {
    if (v === "__none") { setForm((f) => ({ ...f, proprietario_anagrafica_id: "" })); return; }
    const a = anagrafiche.find((x) => x.id === v);
    setForm((f) => ({
      ...f, proprietario_anagrafica_id: v,
      proprietario_nome: a?.nome || f.proprietario_nome,
      proprietario_cf_piva: a?.cf_piva || f.proprietario_cf_piva,
      proprietario_indirizzo: a?.indirizzo || f.proprietario_indirizzo,
    }));
  };

  const extractIntoForm = async (file) => {
    if (!file) return;
    setExtracting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/extract", fd);
      const fields = data.fields || {};
      const { garanzie, ...rest } = fields;
      const norm = (s) => { const v = String(s || "").trim().toLowerCase(); if (["si", "sì", "s", "presente", "true"].includes(v)) return "Sì"; if (["no", "n", "assente", "false"].includes(v)) return "No"; return rest.scatola_nera || ""; };
      if (rest.scatola_nera) rest.scatola_nera = norm(rest.scatola_nera);
      const next = { ...form };
      let added = 0;
      Object.entries(rest).forEach(([k, v]) => {
        if (v && String(v).trim() && !String(next[k] || "").trim()) {
          next[k] = String(v);
          added += 1;
        }
      });
      if (Array.isArray(garanzie) && garanzie.length && (!next.garanzie || next.garanzie.length === 0)) {
        next.garanzie = garanzie.map((g) => ({
          nome: g.nome || "", premio_netto: String(g.premio_netto || ""), premio_lordo: String(g.premio_lordo || ""),
        }));
        added += garanzie.length;
      }
      setForm(next);
      if (initial?.id) {
        const fd2 = new FormData();
        fd2.append("file", file);
        try { await api.post(`/policies/${initial.id}/documents`, fd2); } catch {}
      }
      toast.success(added > 0
        ? `${added} ${added === 1 ? "campo mancante compilato" : "campi mancanti compilati"} dal PDF`
        : "Nessun nuovo campo da aggiungere (già valorizzati)");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Estrazione non riuscita");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-thin" data-testid="policy-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {initial?.id ? "Modifica Polizza" : "Nuova Polizza"}
          </DialogTitle>
          <DialogDescription>
            Compila i campi manualmente oppure aggiungi automaticamente i dati mancanti da un altro documento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-accent/50 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <ScanLine className="h-4 w-4 text-primary" />
            <span>Aggiungi dati da un altro PDF/JPEG: compila i <b>campi ancora vuoti</b>.</span>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden
            data-testid="policy-form-extract-input" onChange={(e) => extractIntoForm(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" disabled={extracting}
            onClick={() => fileRef.current?.click()} data-testid="policy-form-extract-button">
            {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
            {extracting ? "Estrazione…" : "Carica PDF e compila"}
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Link2 className="h-4 w-4" /> Collegamenti
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-slate-500">Anagrafica contraente</Label>
              <Select value={form.anagrafica_id || "__none"} onValueChange={pickAnagrafica}>
                <SelectTrigger className="mt-1" data-testid="policy-link-anagrafica"><SelectValue placeholder="Nuova / manuale" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none">— Nuova / manuale —</SelectItem>
                  {anagrafiche.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome || a.cf_piva || a.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Anagrafica proprietario</Label>
              <Select value={form.proprietario_anagrafica_id || "__none"} onValueChange={pickProprietario}>
                <SelectTrigger className="mt-1" data-testid="policy-link-proprietario"><SelectValue placeholder="Come contraente / manuale" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none">— Come contraente / manuale —</SelectItem>
                  {anagrafiche.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome || a.cf_piva || a.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Compagnia</Label>
              <Select value={form.compagnia_id || "__none"} onValueChange={pickCompagnia}>
                <SelectTrigger className="mt-1" data-testid="policy-link-compagnia"><SelectValue placeholder="Nuova / manuale" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none">— Nuova / manuale —</SelectItem>
                  {compagnie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome || c.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Collaboratore</Label>
              <Select value={form.collaboratore_id || "__none"} onValueChange={pickCollaboratore}>
                <SelectTrigger className="mt-1" data-testid="policy-link-collaboratore"><SelectValue placeholder="Nessuno" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none">— Nessuno —</SelectItem>
                  {collaboratori.map((k) => <SelectItem key={k.id} value={k.id}>{k.nome || k.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-6 py-2">
          {FIELD_SECTIONS.map((section) => {
            const Icon = Icons[section.icon] || Icons.FileText;
            return (
              <div key={section.title}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                  <Icon className="h-4 w-4" /> {section.title}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {section.fields.map((f) => (
                    <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                      <Label htmlFor={f.key} className="text-xs text-slate-500">{f.label}</Label>
                      {f.type === "textarea" ? (
                        <Textarea id={f.key} value={form[f.key] || ""} data-testid={`policy-form-${f.key}`}
                          onChange={(e) => set(f.key, e.target.value)} className="mt-1" />
                      ) : f.type === "select" ? (
                        <Select value={form[f.key] || ""} onValueChange={(v) => set(f.key, v === "__none" ? "" : v)}>
                          <SelectTrigger className="mt-1" data-testid={`policy-form-${f.key}`}>
                            <SelectValue placeholder="Seleziona" />
                          </SelectTrigger>
                          <SelectContent>
                            {f.options.map((o) => (
                              <SelectItem key={o || "__none"} value={o || "__none"}>{o || "—"}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input id={f.key} type={f.type} value={form[f.key] || ""} data-testid={`policy-form-${f.key}`}
                          onChange={(e) => set(f.key, e.target.value)} className="mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldCheck className="h-4 w-4" /> Garanzie
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addGaranzia} data-testid="garanzia-add-button">
                <Plus className="mr-1 h-4 w-4" /> Aggiungi garanzia
              </Button>
            </div>
            {(!form.garanzie || form.garanzie.length === 0) && (
              <p className="text-xs text-slate-400">Nessuna garanzia. Aggiungine una o estraila dal PDF.</p>
            )}
            {(form.garanzie || []).map((g, i) => (
              <div key={i} className="mb-2 grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-[1fr_120px_120px_auto]" data-testid={`garanzia-row-${i}`}>
                <Input placeholder="Nome garanzia" value={g.nome || ""} onChange={(e) => updateGaranzia(i, "nome", e.target.value)} data-testid={`garanzia-nome-${i}`} />
                <Input placeholder="Premio netto" value={g.premio_netto || ""} onChange={(e) => updateGaranzia(i, "premio_netto", e.target.value)} data-testid={`garanzia-netto-${i}`} />
                <Input placeholder="Premio lordo" value={g.premio_lordo || ""} onChange={(e) => updateGaranzia(i, "premio_lordo", e.target.value)} data-testid={`garanzia-lordo-${i}`} />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeGaranzia(i)} data-testid={`garanzia-remove-${i}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={submit} disabled={saving} data-testid="policy-form-save-button">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
