import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, FileText, ScanLine, CalendarClock, FileSignature,
  PenTool, LogOut, Menu, X, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, tid: "nav-dashboard-link" },
  { to: "/polizze", label: "Polizze", icon: FileText, tid: "nav-policies-link" },
  { to: "/estrazione", label: "Estrazione AI", icon: ScanLine, tid: "nav-ai-extract-link" },
  { to: "/scadenziario", label: "Scadenziario", icon: CalendarClock, tid: "nav-agenda-link" },
  { to: "/modelli", label: "Modelli PDF", icon: PenTool, tid: "nav-pdf-editor-link" },
  { to: "/firme", label: "Firma YouSign", icon: FileSignature, tid: "nav-yousign-link" },
];

export default function Layout({ children }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (to) => (to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to));

  const SideContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg font-extrabold leading-none text-slate-900">PolizzaHub</div>
          <div className="text-[11px] font-medium text-slate-400">Gestione Polizze</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = isActive(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              data-testid={n.tid}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-600 hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 px-2 text-xs text-slate-500">
          <div className="font-semibold text-slate-700 truncate">{user?.name}</div>
          <div className="truncate">{user?.email}</div>
        </div>
        <Button
          variant="ghost"
          data-testid="logout-button"
          onClick={async () => { await logout(); nav("/login"); }}
          className="w-full justify-start gap-2 text-slate-600 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Esci
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SideContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button className="absolute right-3 top-4 text-slate-400" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            <SideContent />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md lg:hidden">
          <button onClick={() => setOpen(true)} className="text-slate-600">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-display font-bold text-slate-900">PolizzaHub</span>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
