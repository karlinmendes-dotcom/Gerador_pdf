/** Lê variáveis de ambiente nos dois formatos suportados (Vite e Next-style). */

export const CONVEX_URL: string =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_CONVEX_URL as string | undefined) ??
  "";

export const APP_URL: string =
  (import.meta.env.NEXT_PUBLIC_APP_URL as string | undefined) ??
  (import.meta.env.VITE_APP_URL as string | undefined) ??
  "";
