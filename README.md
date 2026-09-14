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
Usuário → DocumentForm (schema JSON) → paywall Pix (Mercado Pago)
       → pdf-engine (@pdfme, A4) → Convex (documents/receipts/qrGalleries)
       → Dashboard (histórico, Livro de Recibos, Histórico de Pix)

Ferramentas extras:
- QrCodeGenerator (/src/components/QrCodeGenerator.tsx)
  · Texto/Link → QR instantâneo com cores customizadas (PNG/SVG)
  · Galeria → arquivos no Convex Storage + QR para /g/:key (página GalleryPage)
- Currículo Profissional (schemas/curriculo-profissional.json → pdfme)
- NotFoundPage interativa (404 reativa ao cursor)
- ProfileMenu (avatar, Meus Documentos, Histórico de Pix, QR, Logout)
```

### Rotas

| Rota | Descrição |
|---|---|
| `/` | Landing (vitrine de documentos + ferramentas) |
| `/app` | Dashboard autenticado (modal de login automática sem sessão) |
| `/g/:key` | Galeria pública hospedada (Gerador de QR Code) |
| `/termos-de-servico` · `/politica-de-privacidade` | Páginas legais |
| `*` | 404 interativa |

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
