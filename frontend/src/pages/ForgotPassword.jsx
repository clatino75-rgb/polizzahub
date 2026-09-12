import { useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        {sent ? (
          <div className="text-center">
            <MailCheck className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Controlla la tua email</h2>
            <p className="mt-2 text-sm text-slate-500">
              Se l'email e registrata, riceverai un link per reimpostare la password.
            </p>
            <Link to="/login" className="mt-6 inline-block text-sm text-primary hover:underline">Torna all'accesso</Link>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold text-slate-900">Reimposta password</h2>
            <p className="mt-1 text-sm text-slate-500">Inserisci la tua email per ricevere il link.</p>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" data-testid="forgot-email-input" value={email}
                  onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" data-testid="forgot-submit-button" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Invia link
              </Button>
            </form>
            <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">Torna all'accesso</Link>
          </>
        )}
      </div>
    </div>
  );
}
