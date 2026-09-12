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
import { Contact, FileText, Euro, CalendarClock, Mail, Phone } from "lucide-react";

export default function CollaboratoreDetailDialog({ id, open, onOpenChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !id) return;
    setLoading(true);
    setData(null);
    api.get(`/collaboratori/${id}/detail`).then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, [open, id]);

  const c = data?.collaboratore;
  const stats = data?.stats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-thin" data-testid="collaboratore-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Contact className="h-5 w-5 text-primary" /> {c?.nome || "Cruscotto collaboratore"}
          </DialogTitle>
          <DialogDescription>Polizze gestite e premi totali del collaboratore.</DialogDescription>
        </DialogHeader>

        {loading && <p className="py-8 text-center text-slate-400">Caricamento…</p>}

        {data && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm">
              {c.ruolo && <Badge variant="secondary">{c.ruolo}</Badge>}
              {c.email && <span className="flex items-center gap-2 text-slate-600"><Mail className="h-4 w-4 text-slate-400" /> {c.email}</span>}
              {c.telefono && <span className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4 text-slate-400" /> {c.telefono}</span>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4" data-testid="collab-stat-count">
                <div className="flex items-center gap-2 text-xs text-slate-400"><FileText className="h-4 w-4" /> Polizze gestite</div>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900">{stats.count}</p>
              </Card>
              <Card className="p-4" data-testid="collab-stat-premio">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Euro className="h-4 w-4" /> Premi gestiti</div>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900">€ {stats.premio_totale.toLocaleString("it-IT")}</p>
              </Card>
              <Card className="p-4" data-testid="collab-stat-upcoming">
                <div className="flex items-center gap-2 text-xs text-slate-400"><CalendarClock className="h-4 w-4" /> In corso</div>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900">{stats.upcoming.length}</p>
              </Card>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Polizze gestite</p>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/60">
                        <TableHead>Numero</TableHead>
                        <TableHead>Contraente</TableHead>
                        <TableHead>Ramo</TableHead>
                        <TableHead>Scadenza</TableHead>
                        <TableHead>Premio Lordo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.policies.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="py-8 text-center text-slate-400">Nessuna polizza gestita.</TableCell></TableRow>
                      )}
                      {data.policies.map((p) => (
                        <TableRow key={p.id} data-testid={`collab-policy-${p.id}`}>
                          <TableCell className="font-medium text-slate-800">{p.numero_polizza || "—"}</TableCell>
                          <TableCell>{p.contraente_nome || "—"}</TableCell>
                          <TableCell>{p.ramo_polizza || "—"}</TableCell>
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
