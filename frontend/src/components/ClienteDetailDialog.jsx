import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { User, FileText, Euro, CalendarClock, Mail, Phone, MapPin } from "lucide-react";

export default function ClienteDetailDialog({ id, open, onOpenChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !id) return;
    setLoading(true);
    setData(null);
    api.get(`/anagrafiche/${id}/detail`).then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, [open, id]);

  const a = data?.anagrafica;
  const stats = data?.stats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-thin" data-testid="cliente-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <User className="h-5 w-5 text-primary" /> {a?.nome || "Scheda cliente"}
          </DialogTitle>
          <DialogDescription>Riepilogo anagrafica e polizze collegate.</DialogDescription>
        </DialogHeader>

        {loading && <p className="py-8 text-center text-slate-400">Caricamento…</p>}

        {data && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm sm:grid-cols-2">
              {a.cf_piva && <div className="flex items-center gap-2 text-slate-600"><FileText className="h-4 w-4 text-slate-400" /> {a.cf_piva}</div>}
              {a.tipo && <div><Badge variant="secondary">{a.tipo}</Badge></div>}
              {a.email && <div className="flex items-center gap-2 text-slate-600"><Mail className="h-4 w-4 text-slate-400" /> {a.email}</div>}
              {a.telefono && <div className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4 text-slate-400" /> {a.telefono}</div>}
              {a.indirizzo && <div className="flex items-center gap-2 text-slate-600 sm:col-span-2"><MapPin className="h-4 w-4 text-slate-400" /> {a.indirizzo}</div>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4" data-testid="cliente-stat-count">
                <div className="flex items-center gap-2 text-xs text-slate-400"><FileText className="h-4 w-4" /> Polizze</div>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900">{stats.count}</p>
              </Card>
              <Card className="p-4" data-testid="cliente-stat-premio">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Euro className="h-4 w-4" /> Premio Lordo</div>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900">€ {stats.premio_totale.toLocaleString("it-IT")}</p>
              </Card>
              <Card className="p-4" data-testid="cliente-stat-upcoming">
                <div className="flex items-center gap-2 text-xs text-slate-400"><CalendarClock className="h-4 w-4" /> In corso</div>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900">{stats.upcoming.length}</p>
              </Card>
            </div>

            {stats.upcoming.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Prossime scadenze</p>
                <div className="space-y-2">
                  {stats.upcoming.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{p.numero_polizza || "—"}</p>
                        <p className="truncate text-xs text-slate-400">{p.ramo_polizza || p.compagnia_emissione || "—"}</p>
                      </div>
                      <Badge variant="secondary">{p.data_scadenza}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.expired && stats.expired.length > 0 && (
              <div data-testid="cliente-storico">
                <p className="mb-2 text-sm font-semibold text-slate-700">Storico (polizze scadute / rinnovi)</p>
                <div className="space-y-2">
                  {stats.expired.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/40 p-3" data-testid={`cliente-storico-${p.id}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{p.numero_polizza || "—"}</p>
                        <p className="truncate text-xs text-slate-400">{p.ramo_polizza || p.compagnia_emissione || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.renewed_to && <Badge variant="secondary">Rinnovata</Badge>}
                        {p.renewed_from && <Badge variant="secondary">Rinnovo</Badge>}
                        <Badge className="border-0 bg-red-100 text-red-700">Scaduta {p.data_scadenza}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Tutte le polizze collegate</p>              <Card className="overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/60">
                        <TableHead>Numero</TableHead>
                        <TableHead>Ramo</TableHead>
                        <TableHead>Compagnia</TableHead>
                        <TableHead>Scadenza</TableHead>
                        <TableHead>Premio Lordo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.policies.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="py-8 text-center text-slate-400">Nessuna polizza collegata.</TableCell></TableRow>
                      )}
                      {data.policies.map((p) => (
                        <TableRow key={p.id} data-testid={`cliente-policy-${p.id}`}>
                          <TableCell className="font-medium text-slate-800">{p.numero_polizza || "—"}</TableCell>
                          <TableCell>{p.ramo_polizza || "—"}</TableCell>
                          <TableCell>{p.compagnia_emissione || "—"}</TableCell>
                          <TableCell>{p.data_scadenza || "—"}</TableCell>
                          <TableCell>{p.premio_lordo_annuale ? `€ ${p.premio_lordo_annuale}` : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
