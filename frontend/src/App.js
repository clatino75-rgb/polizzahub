import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Policies from "@/pages/Policies";
import AIExtract from "@/pages/AIExtract";
import Scadenziario from "@/pages/Scadenziario";
import Templates from "@/pages/Templates";
import TemplateEditor from "@/pages/TemplateEditor";
import Signatures from "@/pages/Signatures";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === undefined)
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Caricamento…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/polizze" element={<Protected><Policies /></Protected>} />
          <Route path="/estrazione" element={<Protected><AIExtract /></Protected>} />
          <Route path="/scadenziario" element={<Protected><Scadenziario /></Protected>} />
          <Route path="/modelli" element={<Protected><Templates /></Protected>} />
          <Route path="/modelli/:id" element={<Protected><TemplateEditor /></Protected>} />
          <Route path="/firme" element={<Protected><Signatures /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
