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

  /** Liga a store ao usuário autenticado (chamado por lib/auth.ts). */
  syncUser: (id: string, email: string) => void;
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
async function convexSync(kind: "documents" | "receipts", action: string, payload: unknown) {
  if (!CONVEX_URL) return; // offline/draft mode: localStorage only
  try {
    await fetch(`${CONVEX_URL}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${kind}:${action}`, args: payload }),
    });
  } catch {
    // Convex unreachable — local state remains source of truth in draft mode
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

export const useStore = create<StoreState>((set, get) => ({
  documents: load<Document[]>("pdfforge:documents", []),
  receipts: load<Receipt[]>("pdfforge:receipts", []),
  userId: LOCAL_USER,

  syncUser: (id, _email) => set({ userId: id }),

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
    get().documents.filter((d) => d.userId === get().userId).sort((a, b) => b.createdAt - a.createdAt),

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
