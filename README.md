# PDFForge Brasil 📄

Gerador de Documentos Express — contratos, recibos e declarações em PDF com preenchimento assistido por IA.

## Stack

- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Banco de Dados & Storage**: Convex (tabelas `users`, `documents`, `receipts`)
- **Motor de PDF**: `@pdfme/generator` (100% client-side, sem Puppeteer/Chromium)
- **IA**: Vercel AI SDK — Google Gemini (`@ai-sdk/google`) e Groq/Llama (`@ai-sdk/groq`)
- **Hospedagem**: Vercel

## Fluxo

Formulário dinâmico → geração do PDF → metadados salvos no Convex → dashboard atualiza.

## Rodando localmente

```bash
npm install
npm run build    # gera dist/ (Vite) — pronto para a Vercel
npm run dev
```

## Build de produção

```bash
bun run build   # gera dist/ (Vite) — pronto para a Vercel
```

## Conectando o Convex

O schema completo está em `convex/` (raiz do projeto):

- `schema.ts` — tabelas `users`, `documents` (com `pdfUrl`), `receipts` (parcelas + comprovante)
- `documents.ts`, `receipts.ts`, `users.ts` — queries e mutations prontas

Para vincular um deployment:

```bash
bunx convex dev        # desenvolvimento
bunx convex deploy     # produção (gera NEXT_PUBLIC_CONVEX_URL e CONVEX_DEPLOYMENT)
```

Depois, preencha `NEXT_PUBLIC_CONVEX_URL` e `CONVEX_DEPLOYMENT` no painel da Vercel.

## Variáveis de ambiente

| Chave | Uso |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | URL do deployment Convex (frontend) |
| `CONVEX_DEPLOYMENT` | Nome do deployment Convex |
| `GEMINI_API_KEY` | Google Gemini (estruturação de dados por IA) |
| `GROQ_API_KEY` | Groq / Meta Llama (alternativa de IA) |

Para desenvolvimento local, as chaves de IA também são lidas de `VITE_GEMINI_API_KEY` / `VITE_GROQ_API_KEY` via `.env.local`.
