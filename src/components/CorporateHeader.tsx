import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Menu, X, FileText, CircleHelp, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { CONVEX_URL } from "@/lib/env";
import { cn } from "@/lib/utils";

interface ConvexUser {
  _id: string;
  email: string;
  name?: string;
  createdAt: number;
}

/** Query real do Convex: perfil do usuário logado (by_email). */
function useConvexUser(email: string | undefined): ConvexUser | null {
  const [profile, setProfile] = useState<ConvexUser | null>(null);
  useEffect(() => {
    if (!CONVEX_URL || !email) return;
    let cancelled = false;
    void fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "users:getByEmail", args: { email } }),
    })
      .then((r) => r.json() as Promise<{ status?: string; value?: ConvexUser }>)
      .then((body) => {
        if (!cancelled && body.status === "success" && body.value) setProfile(body.value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [email]);
  return profile;
}

interface CorporateHeaderProps {
  onOpenAuth: () => void;
  rightSlot?: React.ReactNode;
  /** Executado quando o visitante clica em "Acessar Plataforma" sem sessão. */
  onCtaClick?: () => void;
  /** Encerra a sessão a partir do dropdown do perfil. */
  onSignOut?: () => void;
}

const LINKS = [
  { id: "docs", label: "Documentos" },
  { id: "tools", label: "Ferramentas" },
  { id: "how", label: "Como funciona" },
  { id: "faq", label: "FAQ" },
];

/** Header corporativo clean: barra branca fixa com borda fina e sombra leve. */
export function CorporateHeader({ onOpenAuth, rightSlot, onCtaClick, onSignOut }: CorporateHeaderProps) {
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const profile = useConvexUser(user?.email);
  const [showProfile, setShowProfile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const profileDropdown = user ? (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowProfile((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm"
        aria-label="Perfil"
        aria-expanded={showProfile}
      >
        {user.name.slice(0, 2).toUpperCase()}
      </button>
      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            role="menu"
          >
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-900">{profile?.name ?? user.name}</p>
              <p className="truncate text-[11px] text-slate-500">{user.email}</p>
              {profile?.createdAt && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Membro desde {new Date(profile.createdAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
            <div className="p-1">
              <button
                type="button"
                onClick={() => {
                  setShowProfile(false);
                  nav("/app");
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                role="menuitem"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" /> Meus Documentos
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfile(false);
                  nav("/#faq");
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                role="menuitem"
              >
                <span className="flex items-center gap-2">
                  <CircleHelp className="h-4 w-4 text-blue-600" /> Suporte
                </span>
              </button>
            </div>
            <div className="border-t border-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setShowProfile(false);
                  onSignOut?.();
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                role="menuitem"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> Sair
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ) : null;

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 22, stiffness: 180 }}
      className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Marca — logo SVG oficial */}
        <button type="button" onClick={() => nav("/")} aria-label="PDFForge Brasil — início">
          <Logo size={36} tagline="Gerador de Documentos Express" className="hidden sm:flex" />
          <LogoMark size={36} className="sm:hidden" />
        </button>

        {/* Links desktop */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => document.getElementById(l.id)?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700"
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* Ações */}
        <div className="flex items-center gap-2">
          {profileDropdown}
          {rightSlot}
          {user ? (
            <Button size="sm" onClick={() => nav("/app")} className="hidden sm:inline-flex">
              Ir para meu Painel →
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={onOpenAuth}>
                Entrar
              </Button>
              <Button size="sm" onClick={onCtaClick ?? (() => nav("/app"))}>
                Acessar Plataforma →
              </Button>
            </>
          )}
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-50 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-200 bg-white md:hidden"
          >
            <div className="space-y-1 px-4 py-3">
              {LINKS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    document.getElementById(l.id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={cn(
                    "block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                  )}
                >
                  {l.label}
                </button>
              ))}
              {!user && (
                <>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { setMobileOpen(false); onOpenAuth(); }}>
                    Entrar
                  </Button>
                  <Button size="sm" className="w-full" onClick={() => { setMobileOpen(false); (onCtaClick ?? (() => nav("/app")))(); }}>
                    Acessar Plataforma →
                  </Button>
                </>
              )}
              {user && (
                <Button size="sm" className="w-full" onClick={() => { setMobileOpen(false); nav("/app"); }}>
                  Ir para meu Painel →
                </Button>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
