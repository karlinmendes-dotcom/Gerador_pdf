import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Handshake, FileText, CreditCard, FilePen, Scale } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Section {
  icon: typeof FileText;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

const SECTIONS: Section[] = [
  {
    icon: Handshake,
    title: "1. Objeto do Serviço",
    paragraphs: [
      "O PDFForge Brasil é uma plataforma de ferramentas para geração automatizada de documentos jurídicos e administrativos pessoais — contratos, recibos e declarações — compilados em PDF a partir de informações fornecidas pelo próprio usuário.",
      "Os modelos disponíveis são genéricos e baseados em práticas comuns do direito brasileiro. A plataforma não presta serviços de advocacia nem substitui a consulta a um profissional do direito habilitado.",
    ],
  },
  {
    icon: Scale,
    title: "2. Responsabilidade do Usuário",
    paragraphs: [
      "O usuário é 100% responsável pela exatidão, veracidade e completude dos dados inseridos nos formulários. Todas as informações preenchidas são transcritas integralmente para o documento final, sem verificação curatorial por parte da plataforma.",
      "A plataforma não se responsabiliza por prejuízos decorrentes de dados incorretos, incompletos ou desatualizados informados pelo usuário, nem pelo uso indevido dos documentos gerados.",
      "Recomenda-se a revisão cuidadosa do documento antes do download e, em caso de dúvida, a consulta a um advogado de confiança.",
    ],
  },
  {
    icon: FilePen,
    title: "3. Assinatura Eletrônica e Validade Legal",
    paragraphs: [
      "O PDF gerado é um documento particular válido entre as partes, nos termos do Código Civil brasileiro. Para dotá-lo de validade jurídica federal com presunção de veracidade, recomenda-se a assinatura digital gratuita pelo Portal Gov.br.",
      "O processo é simples: baixe o PDF aqui, acesse assinador.iti.br com sua conta Gov.br (nível Prata ou Ouro), carregue o arquivo e posicione a assinatura digital. A assinatura segue a MP 2.200-2/2001 e a infraestrutura ICP-Brasil.",
    ],
    bullets: [
      "Assinatura digital Gov.br: gratuita, com validade em todo o território nacional",
      "Alternativa: reconhecimento de firma em cartório, quando as partes preferirem",
      "A plataforma não realiza assinaturas — apenas orienta o processo oficial",
    ],
  },
  {
    icon: CreditCard,
    title: "4. Pagamentos",
    paragraphs: [
      "O preenchimento dos formulários e a navegação são gratuitos. A cobrança ocorre apenas por emissão — no momento do download do PDF oficial — via PIX, processada pelo gateway Mercado Pago.",
      "Valores por documento: R$ 5,00 a R$ 9,90, conforme o tipo, sempre exibidos com clareza antes da confirmação do pagamento.",
    ],
    bullets: [
      "O documento é liberado imediatamente após a confirmação do PIX (status 'aprovado')",
      "Direito de arrependimento (Art. 49, CDC): por se tratar de conteúdo digital personalizado, processado sob demanda com os dados exclusivos do usuário, o download efetivado não dá direito a reembolso",
      "Se o PDF não for gerado por falha da plataforma após pagamento aprovado, o usuário pode baixá-lo novamente pelo Dashboard a qualquer momento, sem custo adicional",
      "Dúvidas de cobrança: contestação diretamente no app do banco ou pelo suporte do Mercado Pago",
    ],
  },
  {
    icon: FileText,
    title: "5. Disposições Gerais",
    paragraphs: [
      "Estes Termos são regidos pelas leis da República Federativa do Brasil. Ao utilizar a plataforma, o usuário declara ter lido e concordado com este documento e com a Política de Privacidade.",
      "A plataforma pode atualizar estes Termos a qualquer momento; alterações relevantes serão comunicadas na própria interface.",
    ],
  },
];

export default function TermsPage() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-3.5">
          <button onClick={() => nav("/")} aria-label="PDFForge Brasil — início">
            <Logo size={36} withText tagline="" />
          </button>
          <Button size="sm" variant="outline" onClick={() => nav("/")}>← Voltar</Button>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">Termos de Serviço</h1>
          <p className="mb-8 text-sm text-slate-500">
            Última atualização: setembro de 2026 · Documento estático, sem coleta automática de dados.
          </p>
        </motion.div>

        <div className="space-y-5">
          {SECTIONS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2.5 text-lg">
                    <s.icon className="h-5 w-5 text-blue-600" />
                    {s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {s.paragraphs.map((p, j) => (
                    <p key={j} className="text-sm leading-relaxed text-slate-600">{p}</p>
                  ))}
                  {s.bullets && (
                    <ul className="space-y-2 pt-1">
                      {s.bullets.map((b, j) => (
                        <li key={j} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                          <span className="mt-0.5 text-blue-600">▸</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-200 py-8">
        <div className="container mx-auto px-4 text-center text-xs text-slate-500">
          © 2026 PDFForge Brasil ·{" "}
          <a href="/politica-de-privacidade" className="underline decoration-slate-600 underline-offset-2 hover:text-blue-700">
            Política de Privacidade
          </a>
        </div>
      </footer>
    </div>
  );
}
