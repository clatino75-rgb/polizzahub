import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { register, apiError } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(email, password, name);
      toast.success("Account creato");
      nav("/");
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <span className="font-display text-xl font-extrabold text-slate-900">PolizzaHub</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Crea il tuo account</h2>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" data-testid="register-name-input" value={name}
              onChange={(e) => setName(e.target.value)} className="mt-1.5" placeholder="Mario Rossi" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" data-testid="register-email-input" value={email}
              onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" data-testid="register-password-input" value={password}
              onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" />
          </div>
          {error && <p className="text-sm text-destructive" data-testid="register-error">{error}</p>}
          <Button type="submit" data-testid="register-submit-button" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrati
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Hai gia un account? <Link to="/login" className="text-primary hover:underline">Accedi</Link>
        </p>
      </div>
    </div>
  );
}
