import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, QrCode, Grid2X2, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

interface ProfileMenuProps {
  /** Ações opcionais expostas pelo host (ex: abrir o Gerador de QR). */
  onOpenQrGenerator?: () => void;
  /** Navegação para views do dashboard (ex: histórico de pix). */
  onNavigate?: (view: "documents" | "pix") => void;
  /** Variante compacta para mobile (só avatar + sair). */
  compact?: boolean;
}

/**
 * Menu do perfil do usuário logado: avatar, dados da conta, atalhos
 * (Meus Documentos, Histórico de Pix, QR Generator) e Logout.
 * Renderizado no header da Landing e do Dashboard.
 */
export function ProfileMenu({ onOpenQrGenerator, onNavigate, compact }: ProfileMenuProps) {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha em clique fora / ESC.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const initials = user.name.slice(0, 2).toUpperCase();

  const go = (view: "documents" | "pix") => {
    setOpen(false);
    onNavigate?.(view);
    if (!onNavigate) location.assign("/app");
  };

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full ring-1 ring-slate-200 transition-shadow hover:ring-blue-400 hover:shadow-md"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu do perfil"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-sm">
          {initials}
        </span>
        {!compact && (
          <span className="hidden max-w-[110px] truncate pr-2 text-xs text-slate-600 sm:block">
            {user.name}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            role="menu"
          >
            {/* Cabeçalho da conta */}
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-[11px] text-slate-400">{user.email}</p>
            </div>

            <div className="p-1.5 text-sm">
              <MenuItem
                onClick={() => go("documents")}
                icon={<FileText className="h-4 w-4" />}
                label="Meus Documentos"
              />
              <MenuItem
                onClick={() => go("pix")}
                icon={<QrCode className="h-4 w-4" />}
                label="Histórico de Pix"
              />
              {onOpenQrGenerator && (
                <MenuItem
                  onClick={() => {
                    setOpen(false);
                    onOpenQrGenerator();
                  }}
                  icon={<Grid2X2 className="h-4 w-4" />}
                  label="Gerador de QR Code"
                />
              )}
            </div>

            <div className="border-t border-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" /> Sair da conta
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
      role="menuitem"
    >
      <span className="text-blue-600">{icon}</span>
      {label}
    </button>
  );
}

/** Botão "Entrar" padrão quando não há usuário logado. */
export function LoginButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      Entrar
    </Button>
  );
}
