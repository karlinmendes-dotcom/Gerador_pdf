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

  addDocument: (doc: Omit<Document, "_id" | "createdAt" | "updatedAt">) => Document;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  removeDocument: (id: string) => void;
  getDocument: (id: string) => Document | undefined;
  getUserDocuments: () => Document[];

  addReceipt: (r: Omit<Receipt, "_id" | "createdAt" | "updatedAt">) => Receipt;
  updateInstallment: (receiptId: string, updates: Partial<Receipt>) => void;
  getReceiptsForDocument: (documentId: string) => Receipt[];
}

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const LOCAL_USER = "user_local";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded — ignore
  }
}

export const useStore = create<StoreState>((set, get) => ({
  documents: loadFromStorage("pdfforge:documents", []),
  receipts: loadFromStorage("pdfforge:receipts", []),
  userId: LOCAL_USER,

  addDocument: (doc) => {
    const now = Date.now();
    const created: Document = { ...doc, _id: uid("doc"), createdAt: now, updatedAt: now };
    set((s) => {
      const documents = [created, ...s.documents];
      saveToStorage("pdfforge:documents", documents);
      return { documents };
    });
    return created;
  },

  updateDocument: (id, updates) =>
    set((s) => {
      const documents = s.documents.map((d) =>
        d._id === id ? { ...d, ...updates, updatedAt: Date.now() } : d
      );
      saveToStorage("pdfforge:documents", documents);
      return { documents };
    }),

  removeDocument: (id) =>
    set((s) => {
      const documents = s.documents.filter((d) => d._id !== id);
      saveToStorage("pdfforge:documents", documents);
      return { documents };
    }),

  getDocument: (id) => get().documents.find((d) => d._id === id),

  getUserDocuments: () =>
    get().documents.filter((d) => d.userId === get().userId).sort((a, b) => b.createdAt - a.createdAt),

  addReceipt: (r) => {
    const now = Date.now();
    const created: Receipt = { ...r, _id: uid("rct"), createdAt: now, updatedAt: now };
    set((s) => {
      const receipts = [...s.receipts, created];
      saveToStorage("pdfforge:receipts", receipts);
      return { receipts };
    });
    return created;
  },

  updateInstallment: (receiptId, updates) =>
    set((s) => {
      const receipts = s.receipts.map((r) =>
        r._id === receiptId ? { ...r, ...updates, updatedAt: Date.now() } : r
      );
      saveToStorage("pdfforge:receipts", receipts);
      return { receipts };
    }),

  getReceiptsForDocument: (documentId) =>
    get().receipts
      .filter((r) => r.documentId === documentId)
      .sort((a, b) => a.installmentNumber - b.installmentNumber),
}));
