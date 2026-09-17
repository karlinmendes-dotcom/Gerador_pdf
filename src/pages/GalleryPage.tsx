import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton, DocumentCardSkeleton } from "@/components/Skeleton";
import { Footer } from "@/components/Footer";
import { CONVEX_URL } from "@/lib/env";
import { getLocalGallery, bumpLocalGalleryViews } from "@/lib/qr-engine";

interface GalleryItemView {
  fileId: string;
  name: string;
  mime: string;
  size: number;
  /** data URL (draft local) ou URL de arquivo do Convex. */
  src?: string;
}

interface GalleryView {
  key: string;
  title: string;
  mode: "convex" | "local";
  items: GalleryItemView[];
  views?: number;
}

function fileUrl(id: string): string {
  return `${CONVEX_URL}/api/storage/${id}`;
}

/**
 * Visualizador público de galerias criadas pelo Gerador de QR Code.
 * Resolve via Convex (galleries:getByKey) ou via draft local em modo offline.
 */
export default function GalleryPage() {
  const { key = "" } = useParams();
  const [gallery, setGallery] = useState<GalleryView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");

      // 1) Convex
      if (CONVEX_URL) {
        try {
          const res = await fetch(`${CONVEX_URL}/api/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: "galleries:getByKey", args: { key } }),
          });
          const body = (await res.json()) as {
            status?: string;
            value?: {
              _id: string;
              key: string;
              title: string;
              items: { fileId: string; name: string; mime: string; size: number }[];
              views: number;
            } | null;
          };
          if (body.status === "success" && body.value) {
            if (!cancelled) {
              setGallery({
                key: body.value.key,
                title: body.value.title,
                mode: "convex",
                views: body.value.views,
                items: body.value.items.map((it) => ({ ...it, src: fileUrl(it.fileId) })),
              });
              void fetch(`${CONVEX_URL}/api/mutation`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: "galleries:incrementViews", args: { id: body.value._id } }),
              }).catch(() => undefined);
            }
            setLoading(false);
            return;
          }
        } catch {
          /* cai para o modo local */
        }
      }

      // 2) Draft local
      const local = getLocalGallery(key);
      if (local && !cancelled) {
        setGallery({
          key: local.key,
          title: local.title,
          mode: "local",
          views: bumpLocalGalleryViews(key),
          items: local.items.map((it) => ({ ...it, src: local.data[it.fileId] })),
        });
        setLoading(false);
        return;
      }

      if (!cancelled) {
        setError("Galeria não encontrada — verifique o link ou crie uma nova no Gerador de QR Code.");
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <div className="min-h-screen">
      <div className="grid-backdrop absolute inset-x-0 top-0 h-64" />
      <div className="container relative mx-auto px-4 pb-16 pt-24">
        {loading ? (
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-8 w-64" />
            <DocumentCardSkeleton />
            <DocumentCardSkeleton />
            <DocumentCardSkeleton />
          </div>
        ) : error ? (
          <Card className="mx-auto max-w-lg border-red-200 bg-red-50 text-center">
            <CardHeader>
              <CardTitle className="text-lg">Galeria indisponível</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => (location.href = "/")}>
                ← Voltar ao início
              </Button>
            </CardContent>
          </Card>
        ) : gallery ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mx-auto max-w-2xl space-y-6">
            <div className="text-center">
              <Badge variant="secondary" className="mb-3 border-blue-200 bg-blue-50 text-blue-700">
                {gallery.mode === "convex" ? "Galeria hospedada" : "Galeria de teste (local)"}
              </Badge>
              <h1 className="mb-1 text-2xl font-extrabold tracking-tight md:text-3xl">{gallery.title}</h1>
              <p className="text-xs text-slate-500">
                {gallery.items.length} arquivo{gallery.items.length === 1 ? "" : "s"}
                {typeof gallery.views === "number" ? ` · ${gallery.views} visitas` : ""}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {gallery.items.map((item, i) => (
                <motion.div key={item.fileId + i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.06, 0.5) }}>
                  <Card className="group h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md">
                    <div className="flex h-40 items-center justify-center overflow-hidden bg-slate-50">
                      {item.mime.startsWith("image/") && item.src ? (
                        <img src={item.src} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : item.mime === "application/pdf" ? (
                        <FileText className="h-12 w-12 text-red-500" />
                      ) : (
                        <FolderOpen className="h-12 w-12 text-slate-400" />
                      )}
                    </div>
                    <CardContent className="space-y-2 p-4">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-[11px] text-slate-500">{Math.ceil(item.size / 1024)} KB</p>
                      {item.src && (
                        <a
                          href={item.src}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-xs text-blue-700 underline-offset-2 hover:underline"
                        >
                          Abrir em nova aba →
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </div>
      <Footer />
    </div>
  );
}
