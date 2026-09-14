import { create } from "zustand";

export type DocStatus = "draft" | "paid";

export interface Document {
  _id: string;
  userId: string;
  documentType: string;
  title: string;
  dataJson: string;
  pdfUrl?: string;
  status: DocStatus;
  paymentId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Receipt {
  _id: string;
  documentId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidDate?: string;
  receiptFileId?: string;
  status: "pending" | "paid" | "overdue";
  createdAt: number;
  updatedAt: number;
}

interface StoreState {
  documents: Document[];
  receipts: Receipt[];
  userId: string;
  /** true enquanto os dados do usuário estão sendo hidratados do Convex. */
  hydrating: boolean;
  /** true quando a hidratação do Convex falhou/está offline (modo draft). */
  offline: boolean;

  /** Liga a store ao usuário autenticado (chamado por lib/auth.ts). */
  syncUser: (id: string, email: string) => void;
  /** Carrega documentos/recibos reais do Convex para o usuário logado. */
  hydrateFromConvex: (userId: string) => Promise<void>;
  addDocument: (doc: Omit<Document, "_id" | "createdAt" | "updatedAt">) => Document;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  removeDocument: (id: string) => void;
  getDocument: (id: string) => Document | undefined;
  getUserDocuments: () => Document[];

  addReceipts: (receipts: Omit<Receipt, "_id" | "createdAt" | "updatedAt">[]) => void;
  updateReceipt: (id: string, updates: Partial<Receipt>) => void;
  getReceiptsForDocument: (documentId: string) => Receipt[];
}

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const LOCAL_USER = "user_local";

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_CONVEX_URL as string | undefined) ??
  "";

/** Fire-and-forget persistence into Convex when the backend is connected. */
async function convexSync(
  kind: "documents" | "receipts",
  action: string,
  payload: unknown
): Promise<{ status?: string; value?: unknown } | null> {
  if (!CONVEX_URL) return null; // offline/draft mode: localStorage only
  try {
    const res = await fetch(`${CONVEX_URL}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${kind}:${action}`, args: payload }),
    });
    const body = (await res.json().catch(() => null)) as {
      status?: string;
      value?: unknown;
    } | null;
    return body?.status === "success" ? body : null;
  } catch {
    // Convex unreachable — local state remains source of truth in draft mode
    return null;
  }
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota — ignore
  }
}

function documentFromConvex(row: {
  _id: string;
  userId: string;
  documentType: string;
  title: string;
  dataJson: string;
  pdfUrl?: string;
  status: "draft" | "paid";
  paymentId?: string;
  createdAt: number;
  updatedAt: number;
}): Document {
  return { ...row };
}

function receiptFromConvex(row: {
  _id: string;
  documentId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: "pending" | "paid" | "overdue";
  createdAt: number;
  updatedAt: number;
}): Receipt {
  return { ...row };
}

export const useStore = create<StoreState>((set, get) => ({
  documents: load<Document[]>("pdfforge:documents", []),
  receipts: load<Receipt[]>("pdfforge:receipts", []),
  userId: LOCAL_USER,
  hydrating: false,
  offline: false,

  syncUser: (id, _email) => set({ userId: id }),

  /**
   * Hidrata documentos e recibos reais do Convex para o usuário autenticado.
   * Em caso de falha (rede/sem backend), mantém o estado local e sinaliza
   * `offline` — o dashboard segue 100% utilizável em modo draft.
   */
  hydrateFromConvex: async (userId: string) => {
    if (!CONVEX_URL || !userId || userId === LOCAL_USER) return;
    set({ hydrating: true });
    try {
      const [docsRes, receiptsRes] = await Promise.all([
        fetch(`${CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "documents:listByUser", args: { userId } }),
        }),
        fetch(`${CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "receipts:listByUser", args: { userId } }),
        }),
      ]);
      const docsBody = (await docsRes.json().catch(() => null)) as {
        status?: string;
        value?: unknown;
      } | null;
      const recBody = (await receiptsRes.json().catch(() => null)) as {
        status?: string;
        value?: unknown;
      } | null;
      if (docsBody?.status !== "success" || recBody?.status !== "success") {
        throw new Error("convex_query_failed");
      }
      const documents = (Array.isArray(docsBody.value) ? docsBody.value : []).map(documentFromConvex);
      const receipts = (Array.isArray(recBody.value) ? recBody.value : []).map(receiptFromConvex);
      set({ documents, receipts, userId, hydrating: false, offline: false });
      save("pdfforge:documents", documents);
      save("pdfforge:receipts", receipts);
    } catch {
      set({ hydrating: false, offline: true });
    }
  },

  addDocument: (doc) => {
    const now = Date.now();
    const created: Document = { ...doc, _id: uid("doc"), createdAt: now, updatedAt: now };
    set((s) => {
      const documents = [created, ...s.documents];
      save("pdfforge:documents", documents);
      return { documents };
    });
    void convexSync("documents", "create", {
      userId: created.userId,
      documentType: created.documentType,
      title: created.title,
      dataJson: created.dataJson,
      status: created.status,
    }).then((res) => {
      // Stash the Convex ID so the PIX webhook can locate this document later.
      if (res?.value && typeof res.value === "string" && res.value.length > 10) {
        set((s) => {
          const documents = s.documents.map((d) =>
            d._id === created._id ? { ...d, _id: res.value as string } : d
          );
          save("pdfforge:documents", documents);
          return { documents };
        });
      }
    });
    return created;
  },

  updateDocument: (id, updates) =>
    set((s) => {
      const documents = s.documents.map((d) =>
        d._id === id ? { ...d, ...updates, updatedAt: Date.now() } : d
      );
      save("pdfforge:documents", documents);
      void convexSync("documents", "update", { id, ...updates });
      return { documents };
    }),

  removeDocument: (id) =>
    set((s) => {
      const documents = s.documents.filter((d) => d._id !== id);
      save("pdfforge:documents", documents);
      void convexSync("documents", "remove", { id });
      return { documents };
    }),

  getDocument: (id) => get().documents.find((d) => d._id === id),

  getUserDocuments: () =>
    get()
      .documents.filter((d) => d.userId === get().userId)
      .sort((a, b) => b.createdAt - a.createdAt),

  addReceipts: (list) => {
    const now = Date.now();
    const created: Receipt[] = list.map((r) => ({ ...r, _id: uid("rct"), createdAt: now, updatedAt: now }));
    set((s) => {
      const receipts = [...s.receipts, ...created];
      save("pdfforge:receipts", receipts);
      return { receipts };
    });
    for (const r of created) {
      void convexSync("receipts", "create", {
        documentId: r.documentId,
        installmentNumber: r.installmentNumber,
        amount: r.amount,
        dueDate: r.dueDate,
        status: r.status,
      });
    }
  },

  updateReceipt: (id, updates) =>
    set((s) => {
      const receipts = s.receipts.map((r) =>
        r._id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
      );
      save("pdfforge:receipts", receipts);
      void convexSync("receipts", "update", { id, ...updates });
      return { receipts };
    }),

  getReceiptsForDocument: (documentId) =>
    get()
      .receipts.filter((r) => r.documentId === documentId)
      .sort((a, b) => a.installmentNumber - b.installmentNumber),
}));
