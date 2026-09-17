import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, FilePen, Database, Building2, Lock, Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Section {
  icon: typeof ShieldCheck;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

const SECTIONS: Section[] = [
  {
    icon: ShieldCheck,
    title: "1. Conformidade com a LGPD",
    paragraphs: [
      "O PDFForge Brasil declara expresso respeito à Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD) e às demais normas de proteção de dados aplicáveis no Brasil.",
      "O tratamento de dados pessoais realizado pela plataforma observa os princípios da finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação e responsabilização, previstos no Art. 6º da LGPD. A base legal utilizada é o consentimento do titular e a execução do serviço solicitado (Art. 7º, I e V).",
    ],
  },
  {
    icon: FilePen,
    title: "2. Tratamento dos Dados",
    paragraphs: [
      "Os dados preenchidos nos formulários (nomes, CPF/CNPJ, endereços, valores e demais informações do documento) são utilizados EXCLUSIVAMENTE para a compilação do PDF solicitado pelo usuário.",
    ],
    bullets: [
      "Não há análise de perfil, publicidade direcionada ou uso para treinamento de modelos de IA",
      "O assistente de IA (opcional) processa o texto livre apenas para estruturar os campos do formulário, sem armazenar o conteúdo em servidores de terceiros para outros fins",
      "Nenhum dado é usado para finalidade diversa da geração do documento escolhido",
    ],
  },
  {
    icon: Database,
    title: "3. Armazenamento e Controle pelo Usuário",
    paragraphs: [
      "Enquanto conectado ao banco em nuvem, os metadados dos documentos ficam armazenados no Convex, vinculados à sua conta. Em modo de teste local (sem conexão), tudo permanece apenas no armazenamento local do seu navegador.",
      "O usuário pode gerenciar ou excluir seu histórico de documentos a qualquer momento, diretamente pelo Dashboard — cada documento possui um botão de exclusão imediata, sem necessidade de contato com suporte.",
    ],
    bullets: [
      "Exclusão individual: botão de lixeira em cada documento do histórico",
      "Comprovantes do Livro de Recibos: gerenciados por parcela, a qualquer momento",
      "Conta: a exclusão da conta implica a remoção dos dados a ela vinculados",
    ],
  },
  {
    icon: Building2,
    title: "4. Compartilhamento com Terceiros",
    paragraphs: [
      "Garantimos que não vendemos, alugamos ou compartilhamos dados pessoais com terceiros para qualquer finalidade comercial ou publicitária.",
    ],
    bullets: [
      "Mercado Pago: recebe apenas os dados estritamente necessários para processar o pagamento PIX (valor e referência do documento) — o conteúdo do documento não é compartilhado",
      "Provedores de IA (Gemini/Groq): recebem somente o texto livre digitado, exclusivamente quando o usuário escolhe usar o assistente",
      "Hospedagem e banco (Vercel/Convex): infraestrutura técnica, protegida por contrato de processamento de dados",
      "Autoridades: apenas mediante ordem judicial válida, conforme a lei",
    ],
  },
  {
    icon: Lock,
    title: "5. Segurança",
    paragraphs: [
      "Aplicamos medidas técnicas e administrativas para proteger os dados: transporte criptografado (HTTPS/TLS), isolamento de dados por usuário e acesso restrito por função. Senhas são armazenadas exclusivamente como hashes, nunca em texto puro.",
      "Em caso de incidente de segurança relevante, os titulares afetados serão comunicados de forma clara, conforme o Art. 48 da LGPD.",
    ],
  },
  {
    icon: Mail,
    title: "6. Seus Direitos (Art. 18, LGPD)",
    paragraphs: [
      "Como titular, você pode solicitar: confirmação de tratamento, acesso aos dados, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade e informação sobre compartilhamentos.",
      "No PDFForge Brasil, a maioria desses direitos é exercida diretamente pela interface (exclusão no Dashboard). Para as demais solicitações, utilize os canais do próprio aplicativo.",
    ],
  },
];

export default function PrivacyPage() {
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
          <Badge variant="success" className="mb-4">Lei nº 13.709/2018</Badge>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">Política de Privacidade</h1>
          <p className="mb-8 text-sm text-slate-500">
            Última atualização: setembro de 2026 · Transparência total sobre como seus dados são tratados.
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
                          <span className="mt-0.5 text-emerald-600">✓</span>
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
          <a href="/termos-de-servico" className="underline decoration-slate-600 underline-offset-2 hover:text-slate-400">
            Termos de Serviço
          </a>
        </div>
      </footer>
    </div>
  );
}
