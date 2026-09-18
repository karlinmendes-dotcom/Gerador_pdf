import {
  Car,
  ReceiptText,
  Home,
  KeyRound,
  Briefcase,
  FileText,
  Building2,
  Hammer,
  HardHat,
  Lock,
  SearchCheck,
  BadgeCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ícone profissional (Lucide) por tipo de documento — substitui emojis.
 * O mapeamento é por id do schema; tipos novos recebem FileText por padrão.
 */
const DOC_ICONS: Record<string, LucideIcon> = {
  "compra-venda-veiculo": Car,
  "recibo-pagamento": ReceiptText,
  "declaracao-residencia": Home,
  "contrato-aluguel-simples": KeyRound,
  "curriculo-profissional": Briefcase,
  "contrato-compra-venda-imovel": Building2,
  "contrato-prestacao-servicos": Hammer,
  "contrato-empreitada": HardHat,
  "acordo-confidencialidade": Lock,
  "termo-vistoria-imovel": SearchCheck,
  "declaracao-quitacao": BadgeCheck,
  "declaracao-renda-autonomo": TrendingUp,
};

/** Resolve o ícone Lucide do tipo de documento (fallback: FileText). */
export function getDocIcon(documentType: string | undefined): LucideIcon {
  if (!documentType) return FileText;
  return DOC_ICONS[documentType] ?? FileText;
}

interface DocIconProps {
  documentType: string | undefined;
  className?: string;
}

/** Ícone do documento com classes padrão de cor corporativa. */
export function DocIcon({ documentType, className }: DocIconProps) {
  const Icon = getDocIcon(documentType);
  return <Icon className={cn("h-5 w-5 text-blue-600", className)} aria-hidden />;
}
