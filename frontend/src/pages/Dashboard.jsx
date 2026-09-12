import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText, CalendarClock, Euro, FileSignature, TrendingUp, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

const COLORS = ["#0284C7", "#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

function Stat({ icon: Icon, label, value, tint, testid }) {
  return (
    <Card className="p-5" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const s = stats || { total_policies: 0, in_scadenza: 0, premio_totale: 0, pending_signatures: 0, ramo_distribution: [], upcoming: [] };

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-slate-500">Panoramica del tuo portafoglio polizze.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileText} label="Totale Polizze" value={s.total_policies} tint="bg-sky-100 text-sky-600" testid="stat-total" />
        <Stat icon={CalendarClock} label="In Scadenza (30gg)" value={s.in_scadenza} tint="bg-amber-100 text-amber-600" testid="stat-scadenza" />
        <Stat icon={Euro} label="Premio Lordo Tot." value={`€ ${s.premio_totale.toLocaleString("it-IT")}`} tint="bg-emerald-100 text-emerald-600" testid="stat-premio" />
        <Stat icon={FileSignature} label="In Attesa di Firma" value={s.pending_signatures} tint="bg-violet-100 text-violet-600" testid="stat-firme" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-slate-900">Distribuzione per Ramo</h3>
          </div>
          {s.ramo_distribution.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">Nessun dato disponibile.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={s.ramo_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="ramo" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {s.ramo_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Prossime Scadenze</h3>
            <button onClick={() => nav("/scadenziario")} className="flex items-center gap-1 text-xs text-primary hover:underline">
              Vedi tutte <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-3">
            {s.upcoming.length === 0 && <p className="text-sm text-slate-400">Nessuna scadenza imminente.</p>}
            {s.upcoming.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{p.numero_polizza || "—"}</p>
                  <p className="truncate text-xs text-slate-400">{p.contraente_nome || p.ramo_polizza}</p>
                </div>
                <Badge variant="secondary" className="ml-2 shrink-0">{p.data_scadenza}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
