# PDFForge Brasil 📄

Gerador de Documentos Express — contratos, recibos, declarações, currículos e QR Codes com preenchimento assistido por IA, paywall Pix e dashboard completo.

## Stack

- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion
- **Banco de Dados & Storage**: Convex (`users`, `documents`, `receipts`, `qrGalleries` + Storage de arquivos)
- **Motor de PDF**: `@pdfme/generator` (100% client-side, folha A4 210×297mm, margens 20mm)
- **IA**: Vercel AI SDK — Google Gemini (`@ai-sdk/google`) e Groq/Llama (`@ai-sdk/groq`)
- **Pagamentos**: Mercado Pago Pix (QR Code + Copia e Cola + webhook de baixa automática)
- **Observabilidade**: buffer local + `POST /api/telemetry` (pronto para sink externo via `TELEMETRY_SINK_URL`)
- **Hospedagem**: Vercel

## Desenvolvimento

```bash
npm install
npm run dev        # servidor local (0.0.0.0)
npm run build      # tsc + vite build (zero erros exigido)
npm run typecheck  # só TypeScript
npx eslint src api # lint
```

### Padrão de qualidade

- TypeScript estrito (`tsc -b --noEmit`) com **zero erros** antes de qualquer merge.
- ESLint flat config: `no-explicit-any` = erro, unused vars = erro (exceto `_`).
- Motor único baseado em schemas JSON (`schemas/*.json`) — novos documentos/ferramentas entram sem código novo no formulário.
- Estados de carregamento usam Skeletons; todas as transições usam Framer Motion (nada estático).

## Arquitetura

```
Usuário → DocumentForm (schema JSON, 12 documentos) → paywall Pix (Mercado Pago)
       → pdf-engine (@pdfme, A4, campos em branco viram linhas p/ caneta)
       → Convex (documents/receipts/qrGalleries/payments)
       → Dashboard /app (sidebar azul, KPIs, colunas de status, Livro de Recibos)

Ferramentas extras:
- QrCodeGenerator (/src/components/QrCodeGenerator.tsx)
  · Texto/Link, Pix (BR Code EMV), WhatsApp (wa.me) → QR com cores, logo central,
    molduras, CTA e PNG/SVG alta resolução
  · Galeria → arquivos no Convex Storage + QR para /g/:key (página GalleryPage)
- Currículo Profissional (schemas/curriculo-profissional.json → pdfme)
- NotFoundPage interativa (404 reativa ao cursor + Lottie lazy)
- ProfileMenu (avatar, Meus Documentos, Histórico de Pix, QR, Logout)
```

### Rotas

| Rota | Descrição |
|---|---|
| `/` | Landing (âncoras `#docs`, `#tools`, `#how`, `#faq` · 16 documentos · FAQ accordion · todos os CTAs operacionais) |
| `/app` | **Dashboard SaaS**: sidebar fixa azul `#0066FF` (Painel · Novo Documento · Meus Documentos · Livro de Recibos · Histórico Pix · QR Codes · Configurações), header com busca + perfil, KPIs e colunas de status. Sem login entra em **Modo Visitante** (localStorage) — nunca trava em loop ou tela branca |
| `/g/:key` | Galeria pública hospedada (Gerador de QR Code) |
| `/termos-de-servico` · `/politica-de-privacidade` | Páginas legais |
| `*` | 404 interativa |

### Ligação de botões (link check)

- **Header**: logo → `/` · "Acessar Plataforma" → `/app` · "Entrar" → AuthModal · âncoras de scroll com `scroll-mt-20` (Documentos/Ferramentas/Como funciona) · perfil → dropdown com atalhos funcionais
- **Landing**: hero "Gerar Documentos Grátis" e "Começar Grátis" → formulário do documento · cards de documentos e ferramentas → formulário correspondente ou QR · CTA de recebíveis → `/app`
- **Dashboard**: sidebar e bottom-nav alternam views via estado (sem reload) · downloads respeitam paywall (rascunho → checkout Pix; pago → PDF) · **pagar rascunho promove o mesmo documento (sem duplicar)** · **botão "Solicitar Assinatura"** em docs pagos (canvas de desenho ou nome digitado → PNG transparente) · exclusão com animação Crumple & Toss + mutation no Convex · todo erro de geração/download exibe toast (zero silent failures)
- **Catálogo**: 16 modelos oficiais — veículos, aluguel, imóveis, serviços, empreitada, NDA, vistoria, recibos (simples e com encargos), rescisão com quitação, quitação de débitos, renda autônomo, residência, currículo, redes sociais/tráfego e parceria comercial

### API serverless (Vercel)

| Rota | Função |
|---|---|
| `POST /api/checkout` | Cria cobrança Pix (QR + Copia e Cola) |
| `GET /api/status` | Polling do pagamento (aprovação em tempo real) |
| `POST /api/webhooks/mercadopago` | Baixa automática (`approved` → documento `pago` no Convex) |
| `POST /api/generate-document` | Estruturação de texto livre via Gemini/Groq (fallback mock offline) |
| `POST /api/telemetry` | Coletor de eventos/erros do cliente |

## Conectando o Convex

O schema completo está em `convex/` (raiz do projeto): `schema.ts`, `documents.ts`, `receipts.ts`, `users.ts`, `payments.ts`, `galleries.ts`.

```bash
npx convex dev        # desenvolvimento
npx convex deploy     # produção
```

## Variáveis de ambiente

Veja `env.example`. Chaves em uso:

| Chave | Uso |
|---|---|
| `VITE_CONVEX_URL` / `NEXT_PUBLIC_CONVEX_URL` | Deployment Convex (frontend) |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | IA (estruturação de documentos) |
| `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_PUBLIC_KEY` | Pix real |
| `MERCADOPAGO_WEBHOOK_SECRET` | Validação HMAC do webhook (opcional) |
| `NEXT_PUBLIC_APP_URL` | URL base (webhook/QR de galerias) |
| `TELEMETRY_SINK_URL` | (Opcional) sink externo de telemetria |

Sem `.env`, o app roda em **modo draft**: dados em `localStorage`, IA com dados de exemplo e Pix simulado — nenhum fluxo quebra.
