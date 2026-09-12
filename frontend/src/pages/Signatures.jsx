import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  FileSignature, Send, ShieldCheck, Loader2, Eye, Trash2, KeyRound,
} from "lucide-react";
import { toast } from "sonner";

const STATUS = {
  bozza: { label: "Bozza", cls: "bg-slate-100 text-slate-600" },
  inviato: { label: "Inviato", cls: "bg-amber-100 text-amber-700" },
  firmato: { label: "Firmato", cls: "bg-emerald-100 text-emerald-700" },
};

export default function Signatures() {
  const [params] = useSearchParams();
  const [templates, setTemplates] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    template_id: params.get("template") || "",
    policy_id: params.get("policy") || "",
    signer_name: "", signer_email: "", signer_phone: "",
  });
  const [sending, setSending] = useState(false);
  const [otpFor, setOtpFor] = useState(null);
  const [otp, setOtp] = useState("");

  const loadList = () => api.get("/signatures").then(({ data }) => setList(data));
  useEffect(() => {
    api.get("/templates").then(({ data }) => setTemplates(data));
    api.get("/policies").then(({ data }) => setPolicies(data));
    loadList();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v === "__none" ? "" : v }));

  const send = async () => {
    if (!form.template_id) { toast.error("Seleziona un modello"); return; }
    if (!form.signer_name || (!form.signer_email && !form.signer_phone)) {
      toast.error("Inserisci nome e email/telefono del firmatario"); return;
    }
    setSending(true);
    try {
      const { data } = await api.post("/signatures", { ...form, field_values: {} });
      toast.success(data.message);
      setForm((f) => ({ ...f, signer_name: "", signer_email: "", signer_phone: "" }));
      loadList();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Invio non riuscito");
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    try {
      await api.post(`/signatures/${otpFor}/verify-otp`, { otp });
      toast.success("Firma completata");
      setOtpFor(null); setOtp("");
      loadList();
    } catch (e) {
      toast.error(e.response?.data?.detail || "OTP non valido");
    }
  };

  const del = async (sid) => {
    await api.delete(`/signatures/${sid}`);
    loadList();
  };

  return (
    <div className="space-y-6" data-testid="signatures-page">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Firma YouSign</h1>
        <p className="text-sm text-slate-500">Genera il documento da un modello e invialo per la firma con OTP.</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Il flusso YouSign è attualmente in <b>MODALITÀ SIMULAZIONE (MOCK)</b>. La firma OTP è simulata
        (accetta qualsiasi codice di 4+ cifre). È pronto per collegare la tua API key YouSign.
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Send className="h-4 w-4 text-primary" /> Nuova richiesta di firma
          </h3>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Modello PDF</Label>
              <Select value={form.template_id} onValueChange={(v) => set("template_id", v)}>
                <SelectTrigger className="mt-1" data-testid="signature-template-select"><SelectValue placeholder="Seleziona modello" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Polizza (per compilare i campi)</Label>
              <Select value={form.policy_id} onValueChange={(v) => set("policy_id", v)}>
                <SelectTrigger className="mt-1" data-testid="signature-policy-select"><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none">Nessuna</SelectItem>
                  {policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.numero_polizza || p.contraente_nome || p.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sn" className="text-xs text-slate-500">Nome firmatario</Label>
              <Input id="sn" value={form.signer_name} onChange={(e) => set("signer_name", e.target.value)}
                data-testid="signer-name-input" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="se" className="text-xs text-slate-500">Email</Label>
                <Input id="se" type="email" value={form.signer_email} onChange={(e) => set("signer_email", e.target.value)}
                  data-testid="signer-email-input" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="sp" className="text-xs text-slate-500">Telefono (OTP)</Label>
                <Input id="sp" value={form.signer_phone} onChange={(e) => set("signer_phone", e.target.value)}
                  data-testid="signer-phone-input" className="mt-1" placeholder="+39…" />
              </div>
            </div>
            <Button onClick={send} disabled={sending} className="w-full" data-testid="yousign-send-otp-button">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Genera e invia per firma OTP
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <FileSignature className="h-4 w-4 text-primary" /> Richieste di firma
          </h3>
          <div className="max-h-[520px] space-y-3 overflow-y-auto scrollbar-thin pr-1">
            {list.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nessuna richiesta inviata.</p>}
            {list.map((s) => {
              const st = STATUS[s.status] || STATUS.inviato;
              return (
                <div key={s.id} className="rounded-lg border border-slate-100 p-3" data-testid={`signature-${s.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{s.signer_name || "—"}</p>
                      <p className="truncate text-xs text-slate-400">{s.signer_email || s.signer_phone || "—"}</p>
                    </div>
                    <Badge className={`${st.cls} border-0`}>{st.label}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(`${API}/signatures/${s.id}/document`, "_blank")}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> Documento
                    </Button>
                    {s.status !== "firmato" && (
                      <Button size="sm" onClick={() => { setOtpFor(s.id); setOtp(""); }} data-testid={`verify-otp-${s.id}`}>
                        <KeyRound className="mr-1 h-3.5 w-3.5" /> Verifica OTP
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="ml-auto" onClick={() => del(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Dialog open={!!otpFor} onOpenChange={(o) => !o && setOtpFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Verifica firma OTP</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="mb-3 text-sm text-slate-500">Inserisci il codice OTP ricevuto dal firmatario (simulato: qualsiasi codice di 4+ cifre).</p>
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="es. 123456"
              data-testid="otp-input" className="text-center text-lg tracking-widest" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpFor(null)}>Annulla</Button>
            <Button onClick={verifyOtp} data-testid="confirm-otp-button">Conferma firma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
