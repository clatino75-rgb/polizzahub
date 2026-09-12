import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FIELD_SECTIONS, emptyPolicy } from "@/lib/fields";
import * as Icons from "lucide-react";
import { Loader2 } from "lucide-react";

export default function PolicyFormDialog({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(emptyPolicy());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...emptyPolicy(), ...(initial || {}) });
  }, [open, initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
        </DialogHeader>

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
