import { Link } from "react-router-dom";

/**
 * Rodapé legal compartilhado — LGPD + Termos.
 * Sem dependências de banco ou ambiente.
 */
export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/20 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="text-base">⚡</span>
          <span className="font-semibold text-white">PDFForge Brasil</span>
          <span className="hidden sm:inline">— documentos jurídicos express</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <Link
            to="/termos-de-servico"
            className="text-slate-400 transition-colors hover:text-white"
          >
            Termos de Serviço
          </Link>
          <Link
            to="/politica-de-privacidade"
            className="text-slate-400 transition-colors hover:text-white"
          >
            Política de Privacidade
          </Link>
          <a
            href="https://assinador.iti.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 transition-colors hover:text-white"
          >
            Assinador Gov.br ↗
          </a>
        </nav>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} PDFForge Brasil · Lei nº 13.709/2018 (LGPD)
        </p>
      </div>
    </footer>
  );
}

export default Footer;
