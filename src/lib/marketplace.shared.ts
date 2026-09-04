export const PRODUCT_KIND_LABELS = {
  BOOK_PHYSICAL: "Buku fisik",
  BOOK_DIGITAL: "Buku digital",
  STATIONERY: "Alat tulis",
} as const;

export type ProductKind = keyof typeof PRODUCT_KIND_LABELS;

export const STORE_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Menunggu review",
  ACTIVE: "Aktif",
  SUSPENDED: "Ditangguhkan",
  REJECTED: "Ditolak",
};

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draf",
  PENDING_REVIEW: "Menunggu review",
  PUBLISHED: "Terbit",
  REJECTED: "Ditolak",
  ARCHIVED: "Diarsipkan",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu bayar",
  PAID: "Dibayar",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  READY: "Siap unduh",
  SHIPPED: "Dikirim",
};
