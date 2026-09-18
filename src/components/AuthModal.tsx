import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { GOOGLE_CLIENT_ID } from "@/lib/env";
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

// ─── Botão "Entrar com Google" (GIS) ───────────────────────────────

interface GoogleCredentialResponse {
  credential?: string;
}

/** Carrega o script oficial do Google Identity Services uma única vez. */
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.google) return resolve();
    const existing = document.querySelector<HTMLScriptElement>("script[src*=gsi]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gsi_load_error")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gsi_load_error"));
    document.head.appendChild(s);
  });
}

/** Fallback: abre o fluxo OAuth em popup (codificar URL com btoa é inseguro;
 * usamos encodeURIComponent direto). */
function openGooglePopup(clientId: string, cb: (credential: string) => void) {
  const redirectUri = "https://developers.google.com/identity/gsi/web/client";
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "credential",
    include_granted_scopes: "true",
    scope: "openid email profile",
    redirect_uri: redirectUri,
    origin: location.origin,
    gsiwebsdk: "2",
  });
  window.open(`https://accounts.google.com/gsi/select?${params.toString()}`, "gis", "width=420,height=580");
  (window as unknown as Record<string, unknown>).pdfforgeGoogleCb = (event: MessageEvent) => {
    const data = event.data as { type?: string; credential?: string };
    if (data?.type === "credential" && data.credential) cb(data.credential);
  };
  window.addEventListener("message", (window as unknown as Record<string, unknown>).pdfforgeGoogleCb as EventListener);
}

/** Botão oficial do Google. Sem GOOGLE_CLIENT_ID configurada, não renderiza. */
function GoogleButton({ onCredential, onError }: { onCredential: (c: string) => void; onError: (m: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !hostRef.current) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !hostRef.current || typeof window === "undefined" || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp: GoogleCredentialResponse) => {
            if (resp.credential) onCredential(resp.credential);
            else onError("Resposta do Google sem credencial.");
          },
        });
        window.google.accounts.id.renderButton(hostRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          width: 320,
          locale: "pt-BR",
        });
        setReady(true);
      })
      .catch(() => onError("Não foi possível carregar o login do Google."));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <div className="space-y-2">
      <div ref={hostRef} className="flex justify-center" />
      {!ready && (
        <button
          type="button"
          onClick={() => openGooglePopup(GOOGLE_CLIENT_ID, onCredential)}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <GoogleGlyph /> Entrar com Google
        </button>
      )}
    </div>
  );
}

/** Glifo oficial "G" multicolorido do Google. */
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 5.9 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 5.9 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

// Tipagem mínima do GIS (sem pacote adicional).
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(cfg: { client_id: string; callback: (r: GoogleCredentialResponse) => void }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
          prompt(): void;
        };
      };
    };
  }
}

export function AuthModal({ open, onOpenChange, reason, onSuccess }: AuthModalProps) {
  const { signIn, signUp, googleSignIn } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleCredential = async (credential: string) => {
    setError("");
    setLoading(true);
    try {
      await googleSignIn(credential);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no login com Google");
    } finally {
      setLoading(false);
    }
  };

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

        <GoogleButton onCredential={(c) => void handleGoogleCredential(c)} onError={setError} />

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
          <span className="relative bg-white px-3 text-[10px] uppercase tracking-widest text-slate-400">ou use seu e-mail</span>
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
