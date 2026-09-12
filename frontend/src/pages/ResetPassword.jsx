import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password reimpostata");
      nav("/login");
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <h2 className="font-display text-2xl font-bold text-slate-900">Nuova password</h2>
        <p className="mt-1 text-sm text-slate-500">Scegli una nuova password per il tuo account.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="password">Nuova password</Label>
            <Input id="password" type="password" data-testid="reset-password-input" value={password}
              onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" />
          </div>
          {!token && <p className="text-sm text-destructive">Link non valido.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" data-testid="reset-submit-button" disabled={loading || !token} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reimposta password
          </Button>
        </form>
        <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">Torna all'accesso</Link>
      </div>
    </div>
  );
}
