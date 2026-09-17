import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { LogoMark } from "@/components/Logo";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mensagem exibida no topo (ex: "Entre para salvar seu documento"). */
  reason?: string;
  /** Chamado após login/cadastro bem-sucedido. */
  onSuccess?: () => void;
}

type Mode = "signin" | "signup";

export function AuthModal({ open, onOpenChange, reason, onSuccess }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(name, email, password);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setMode("signup");
    setName("Usuário Demo");
    setEmail(`demo${Date.now() % 10000}@pdfforge.com.br`);
    setPassword("demo123");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="max-w-md overflow-hidden border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        {/* Luz suave no topo do modal */}
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-gradient-to-r from-blue-100 via-sky-50 to-indigo-100 blur-3xl" />

        <DialogHeader className="relative">
          <DialogTitle className="flex items-center gap-2.5">
            <motion.span
              initial={{ rotate: -8, scale: 0.85 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className="flex h-9 w-9 items-center justify-center"
            >
              <LogoMark size={36} className="rounded-lg shadow-sm" />
            </motion.span>
            {mode === "signin" ? "Entrar na conta" : "Criar conta grátis"}
          </DialogTitle>
          <DialogDescription>
            {reason ?? "Preenchimento é grátis — entre para salvar rascunhos e gerar o PDF oficial."}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="relative grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`relative rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === m ? "text-blue-700" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {mode === m && (
                <motion.div
                  layoutId="auth-tab"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-slate-200"
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                />
              )}
              <span className="relative">{m === "signin" ? "Entrar" : "Cadastrar"}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence initial={false}>
            {mode === "signup" && (
              <motion.div
                key="name"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 pb-1">
                  <Label htmlFor="auth-name" className="text-slate-600">Nome completo</Label>
                  <Input
                    id="auth-name"
                    placeholder="Maria da Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field-neon"
                    autoComplete="name"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <Label htmlFor="auth-email" className="text-slate-600">E-mail</Label>
            <Input
              id="auth-email"
              type="email"
              placeholder="voce@exemplo.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-neon"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-password" className="text-slate-600">Senha</Label>
            <Input
              id="auth-password"
              type="password"
              placeholder="mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-neon"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </motion.p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
              />
            ) : mode === "signin" ? (
              "Entrar →"
            ) : (
              "Criar conta grátis"
            )}
          </Button>

          <motion.button
            type="button"
            onClick={fillDemo}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="w-full text-center text-[11px] text-slate-500 transition-colors hover:text-slate-600"
          >
            <Wand2 className="mr-1 inline h-3 w-3" /> Preencher dados de demonstração
          </motion.button>
        </form>

        <div className="flex items-center justify-center gap-2 border-t border-slate-100 pt-3">
          <Badge variant="secondary" className="text-[10px]">Dados no Convex</Badge>
          <Badge variant="success" className="text-[10px]">Grátis para começar</Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
