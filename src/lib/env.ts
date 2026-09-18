/** Lê variáveis de ambiente nos dois formatos suportados (Vite e Next-style). */

export const CONVEX_URL: string =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_CONVEX_URL as string | undefined) ??
  "";

export const APP_URL: string =
  (import.meta.env.NEXT_PUBLIC_APP_URL as string | undefined) ??
  (import.meta.env.VITE_APP_URL as string | undefined) ??
  "";

/**
 * Google OAuth Client ID (público por natureza). Injetado pela Vercel como
 * variável de build; quando ausente, o botão "Entrar com Google" é ocultado
 * e o login por e-mail/senha segue funcionando normalmente.
 */
export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string | undefined) ??
  "";
