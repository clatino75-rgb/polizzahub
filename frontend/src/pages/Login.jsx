import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login, apiError } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      toast.success("Accesso effettuato");
      nav("/");
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-extrabold">PolizzaHub</span>
        </div>
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-tight">
            Gestione polizze,<br />estrazione AI e firma digitale.
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Estrai automaticamente i dati da PDF e immagini, gestisci lo scadenziario
            e invia i documenti in firma con OTP.
          </p>
        </div>
        <p className="text-sm text-white/60">© 2026 PolizzaHub</p>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold text-slate-900">Bentornato</h2>
          <p className="mt-1 text-sm text-slate-500">Accedi al tuo account per continuare.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" data-testid="login-email-input" value={email}
                onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" placeholder="nome@email.it" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" data-testid="login-password-input" value={password}
                onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
            <Button type="submit" data-testid="login-submit-button" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Accedi
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-primary hover:underline">Password dimenticata?</Link>
            <Link to="/register" className="text-slate-600 hover:underline" data-testid="go-register-link">Crea account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
