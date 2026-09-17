/**
 * Registro central das animações Lottie do PDFForge Brasil.
 * Fonte: lottie.host (JSON remotos consumidos nativamente, sem <iframe>).
 */

export interface LottieAsset {
  id: string;
  /** URL oficial do .json hospedado no lottie.host. */
  url: string;
  /** Descrição para acessibilidade (aria-label). */
  alt: string;
  /** Peso aproximado — usado para priorizar o carregamento. */
  weightKB: number;
}

export const LOTTIE_ASSETS = {
  /** Animação 1 — ~404 KB. */
  hero: {
    id: "anim-1",
    url: "https://lottie.host/f59d64e9-641b-49d2-a4d2-4971f34228fb/fX4qRhxFFn.json",
    alt: "Animação de destaque",
    weightKB: 404,
  },
  /** Animação 2 — ~90 KB (leve, ideal para seções acima da dobra). */
  success: {
    id: "anim-2",
    url: "https://lottie.host/864afe1b-336b-41a9-929e-5bebbdaa70c7/OSqF6lTWEo.json",
    alt: "Animação de sucesso",
    weightKB: 90,
  },
  /** Animação 3 — ~281 KB. */
  documents: {
    id: "anim-3",
    url: "https://lottie.host/4587a6d3-1f93-4dd0-ad56-92871f4c4a4a/9p1iVpFsbC.json",
    alt: "Animação de documentos",
    weightKB: 281,
  },
  /** Animação 4 — ~2.16 MB. SEMPRE lazy (carrega fora da dobra, on-demand). */
  forge: {
    id: "anim-4",
    url: "https://lottie.host/91a4c41f-70a2-414c-9006-cfce175c0adf/ZsVh7ymVC8.json",
    alt: "Animação da forja",
    weightKB: 2212,
  },
} as const satisfies Record<string, LottieAsset>;

export type LottieAssetId = keyof typeof LOTTIE_ASSETS;
