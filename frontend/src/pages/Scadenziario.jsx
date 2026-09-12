import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Filter } from "lucide-react";

const STATUS = {
  scaduta: { label: "Scaduta", cls: "bg-red-100 text-red-700" },
  in_scadenza: { label: "In Scadenza", cls: "bg-amber-100 text-amber-700" },
  attiva: { label: "Attiva", cls: "bg-emerald-100 text-emerald-700" },
};

export default function Scadenziario() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/scadenziario", { params: { date_from: from, date_to: to } });
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6" data-testid="scadenziario-page">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Scadenziario</h1>
        <p className="text-sm text-slate-500">Visualizza le polizze in scadenza filtrando per data.</p>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="from" className="text-xs text-slate-500">Da</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              data-testid="scadenziario-date-from-input" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="to" className="text-xs text-slate-500">A</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)}
              data-testid="scadenziario-date-to-input" className="mt-1" />
          </div>
          <Button onClick={load} data-testid="scadenziario-filter-button">
            <Filter className="mr-2 h-4 w-4" /> Filtra
          </Button>
          {(from || to) && (
            <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); setTimeout(load, 0); }}>Azzera</Button>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        {loading && <p className="text-sm text-slate-400">Caricamento…</p>}
        {!loading && items.length === 0 && (
          <Card className="p-12 text-center text-slate-400">
            <CalendarClock className="mx-auto mb-3 h-8 w-8" />
            Nessuna scadenza nel periodo selezionato.
          </Card>
        )}
        {items.map((p) => {
          const st = STATUS[p.status] || STATUS.attiva;
          return (
            <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid={`scadenza-${p.id}`}>
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{p.numero_polizza || "Senza numero"}</p>
                  <p className="text-xs text-slate-400">
                    {p.contraente_nome || "—"} · {p.compagnia_emissione || "—"} · {p.ramo_polizza || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Scadenza</p>
                  <p className="font-semibold text-slate-800">{p.data_scadenza}</p>
                </div>
                <Badge className={`${st.cls} border-0`}>{st.label}</Badge>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
