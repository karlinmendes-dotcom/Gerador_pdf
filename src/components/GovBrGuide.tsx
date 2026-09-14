import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GovBrGuideProps {
  /** Variante compacta para rodapé de formulário. */
  compact?: boolean;
}

const STEPS = [
  {
    icon: "📥",
    title: "Baixe o PDF",
    desc: "Gere e baixe o documento aqui no PDFForge Brasil.",
    url: undefined as string | undefined,
    cta: undefined as string | undefined,
  },
  {
    icon: "🔐",
    title: "Acesse o assinador do ITI",
    desc: "Entre em assinador.iti.br com sua conta Gov.br — nível Prata ou Ouro.",
    url: "https://assinador.iti.br",
    cta: "assinador.iti.br",
  },
  {
    icon: "✍️",
    title: "Carregue e assine",
    desc: "Envie o PDF e posicione sua assinatura digital. Gratuito, com validade jurídica federal (MP 2.200-2/2001 / ICP-Brasil).",
    url: undefined as string | undefined,
    cta: undefined as string | undefined,
  },
];

/**
 * Guia Gov.br — como assinar gratuitamente o PDF gerado com validade
 * jurídica federal via assinador.iti.br (ICP-Brasil / Gov.br).
 */
export function GovBrGuide({ compact }: GovBrGuideProps) {
  if (compact) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3.5">
        <span className="mt-0.5 text-lg">🇧🇷</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-cyan-300">
            Validade jurídica federal: assine grátis com Gov.br
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            Baixe o PDF → entre em{" "}
            <a
              href="https://assinador.iti.br"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-cyan-400 underline decoration-cyan-500/40 underline-offset-2 hover:text-cyan-300"
            >
              assinador.iti.br
            </a>{" "}
            (conta Gov.br Prata/Ouro) → carregue o PDF e posicione a assinatura digital.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-cyan-500/20 bg-cyan-500/[0.04]">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2.5 text-lg">
          <span className="text-xl">🇧🇷</span>
          Assine grátis com validade jurídica federal
          <Badge variant="success" className="text-[10px]">Gov.br · ICP-Brasil</Badge>
        </CardTitle>
        <CardDescription>
          Todo PDF gerado aqui pode ser assinado digitalmente, de graça, pelo assinador
          oficial do Governo Federal. A assinatura tem a mesma validade jurídica de um
          reconhecimento de firma em cartório.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="relative rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <span className="absolute right-3 top-3 text-[10px] font-bold text-slate-600">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600/30 to-cyan-500/20 text-xl ring-1 ring-white/10">
                {step.icon}
              </div>
              <p className="text-sm font-medium text-white">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.desc}</p>
              {step.url && (
                <Button variant="outline" size="sm" className="mt-3 h-8 w-full" asChild>
                  <a href={step.url} target="_blank" rel="noopener noreferrer">
                    {step.cta} ↗
                  </a>
                </Button>
              )}
            </motion.div>
          ))}
        </div>

        <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
          <span>ℹ️</span>
          Requer conta Gov.br nível Prata ou Ouro (verificada por reconhecimento facial ou
          banco). A assinatura segue a MP 2.200-2/2001 e é aceita em todo o território nacional.
        </p>
      </CardContent>
    </Card>
  );
}
