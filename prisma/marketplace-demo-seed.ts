import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const DEMO_PRODUCTS = [
  {
    title: "Buku Fisik Matematika SMA",
    slug: "buku-fisik-matematika-sma",
    kind: "BOOK_PHYSICAL" as const,
    price: 75000,
    stock: 20,
    description: "Buku paket matematika SMA cetak, dikirim ke alamat guru atau sekolah.",
    imageFile: "buku-matematika.jpg",
    imageSrc: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Modul Digital IPA SMP",
    slug: "modul-digital-ipa-smp",
    kind: "BOOK_DIGITAL" as const,
    price: 35000,
    stock: 0,
    description: "Modul digital IPA SMP. Diunduh setelah pembayaran lunas.",
    imageFile: "modul-ipa.jpg",
    imageSrc: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Paket ATK Pulpen Gel 12 pcs",
    slug: "paket-atk-pulpen-gel",
    kind: "STATIONERY" as const,
    price: 15000,
    stock: 100,
    description: "Paket 12 pulpen gel untuk keperluan kelas dan administrasi guru.",
    imageFile: "pulpen-gel.jpg",
    imageSrc: "https://images.unsplash.com/photo-1583484963886-cfe2bff2945f?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Buku Bahasa Indonesia Kelas 5 SD",
    slug: "buku-bahasa-indonesia-kelas-5",
    kind: "BOOK_PHYSICAL" as const,
    price: 52000,
    stock: 35,
    description: "Buku teks Bahasa Indonesia kelas 5, lengkap dengan latihan dan contoh teks.",
    imageFile: "buku-bindo.jpg",
    imageSrc: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Kamus Bahasa Inggris Bergambar",
    slug: "kamus-bahasa-inggris-bergambar",
    kind: "BOOK_PHYSICAL" as const,
    price: 68000,
    stock: 18,
    description: "Kamus bergambar untuk siswa SD–SMP, cetak hardcover.",
    imageFile: "kamus-inggris.jpg",
    imageSrc: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Atlas Indonesia & Dunia",
    slug: "atlas-indonesia-dunia",
    kind: "BOOK_PHYSICAL" as const,
    price: 89000,
    stock: 12,
    description: "Atlas berwarna untuk pelajaran IPS dan geografi, ukuran A4.",
    imageFile: "atlas.jpg",
    imageSrc: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Buku Cerita Anak Seri Karakter",
    slug: "buku-cerita-anak-karakter",
    kind: "BOOK_PHYSICAL" as const,
    price: 42000,
    stock: 40,
    description: "Kumpulan cerita pendek untuk menumbuhkan karakter siswa.",
    imageFile: "buku-cerita.jpg",
    imageSrc: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Buku Latihan Matematika SD",
    slug: "buku-latihan-matematika-sd",
    kind: "BOOK_PHYSICAL" as const,
    price: 38000,
    stock: 50,
    description: "Lembar latihan soal matematika SD, siap pakai di kelas.",
    imageFile: "latihan-mtk.jpg",
    imageSrc: "https://images.unsplash.com/photo-1596495577886-d920f1fb7238?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Modul Digital RPP Kurikulum Merdeka",
    slug: "modul-digital-rpp-merdeka",
    kind: "BOOK_DIGITAL" as const,
    price: 45000,
    stock: 0,
    description: "Paket RPP digital Kurikulum Merdeka, diunduh setelah pembayaran lunas.",
    imageFile: "modul-rpp.jpg",
    imageSrc: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "E-Book Bank Soal Asesmen",
    slug: "ebook-bank-soal-asesmen",
    kind: "BOOK_DIGITAL" as const,
    price: 55000,
    stock: 0,
    description: "Bank soal digital untuk asesmen formatif dan sumatif.",
    imageFile: "ebook-soal.jpg",
    imageSrc: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Buku Digital Literasi Membaca",
    slug: "buku-digital-literasi-membaca",
    kind: "BOOK_DIGITAL" as const,
    price: 29000,
    stock: 0,
    description: "Kumpulan teks literasi digital untuk kegiatan membaca 15 menit.",
    imageFile: "literasi.jpg",
    imageSrc: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Paket Spidol Whiteboard 8 Warna",
    slug: "paket-spidol-whiteboard",
    kind: "STATIONERY" as const,
    price: 32000,
    stock: 60,
    description: "Spidol papan tulis 8 warna, tinta mudah dihapus.",
    imageFile: "spidol.jpg",
    imageSrc: "https://images.unsplash.com/photo-1568205612837-017257d2310a?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Pensil Warna 24 Warna",
    slug: "pensil-warna-24",
    kind: "STATIONERY" as const,
    price: 28000,
    stock: 80,
    description: "Set pensil warna 24 untuk pelajaran seni dan LKPD.",
    imageFile: "pensil-warna.jpg",
    imageSrc: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Buku Tulis Bergaris Isi 10",
    slug: "buku-tulis-bergaris-isi-10",
    kind: "STATIONERY" as const,
    price: 22000,
    stock: 120,
    description: "Paket 10 buku tulis bergaris 38 lembar untuk siswa.",
    imageFile: "buku-tulis.jpg",
    imageSrc: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Binder Map Plastik A4",
    slug: "binder-map-plastik-a4",
    kind: "STATIONERY" as const,
    price: 18000,
    stock: 70,
    description: "Map binder A4 untuk arsip tugas dan dokumen kelas.",
    imageFile: "binder.jpg",
    imageSrc: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Sticky Notes Warna-warni",
    slug: "sticky-notes-warna-warni",
    kind: "STATIONERY" as const,
    price: 12000,
    stock: 150,
    description: "Set sticky notes 5 warna untuk catatan cepat di meja guru.",
    imageFile: "sticky-notes.jpg",
    imageSrc: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Set Penggaris Geometri",
    slug: "set-penggaris-geometri",
    kind: "STATIONERY" as const,
    price: 14000,
    stock: 90,
    description: "Penggaris, jangka, dan busur derajat untuk pelajaran matematika.",
    imageFile: "penggaris.jpg",
    imageSrc: "https://images.unsplash.com/photo-1596495578065-6e0763fa1178?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Kalkulator Scientific Guru",
    slug: "kalkulator-scientific-guru",
    kind: "STATIONERY" as const,
    price: 95000,
    stock: 25,
    description: "Kalkulator scientific untuk guru matematika dan IPA.",
    imageFile: "kalkulator.jpg",
    imageSrc: "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Tempat Pensil Kanvas",
    slug: "tempat-pensil-kanvas",
    kind: "STATIONERY" as const,
    price: 19000,
    stock: 45,
    description: "Pouch kanvas untuk pulpen, pensil, dan spidol.",
    imageFile: "tempat-pensil.jpg",
    imageSrc: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    title: "Kertas HVS A4 70gsm 1 Rim",
    slug: "kertas-hvs-a4-1-rim",
    kind: "STATIONERY" as const,
    price: 48000,
    stock: 30,
    description: "Kertas HVS A4 70gsm isi 500 lembar untuk fotokopi dan LKPD.",
    imageFile: "kertas-hvs.jpg",
    imageSrc: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=900&h=700&q=80",
  },
];

async function localDemoImage(fileName: string, sourceUrl: string, title: string) {
  const demoImageDir = path.join(process.cwd(), "public", "market-demo");
  await mkdir(demoImageDir, { recursive: true });
  const dest = path.join(demoImageDir, fileName);
  try {
    await access(dest);
    return `/market-demo/${fileName}`;
  } catch {
    try {
      const res = await fetch(sourceUrl, { headers: { "User-Agent": "NavalogiDemoSeed/1.0" } });
      if (!res.ok) throw new Error(String(res.status));
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return `/market-demo/${fileName}`;
    } catch {
      const svgName = fileName.replace(/\.[a-z]+$/i, ".svg");
      const svgDest = path.join(demoImageDir, svgName);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700">
  <rect width="900" height="700" fill="#ecfdf5"/>
  <rect x="80" y="80" width="740" height="540" rx="28" fill="#ffffff" stroke="#a7f3d0" stroke-width="4"/>
  <text x="450" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#047857">${title.replace(/[<>&]/g, "")}</text>
</svg>`;
      await writeFile(svgDest, svg, "utf8");
      return `/market-demo/${svgName}`;
    }
  }
}

export async function seedMarketplaceDemo(prisma: PrismaClient) {
  await prisma.platformSetting.upsert({
    where: { key: "marketplace_config" },
    create: { key: "marketplace_config", value: { commissionPercent: 5 } },
    update: {},
  });

  const merchantPassword = await bcrypt.hash("merchant123456", 12);
  const merchant = await prisma.user.upsert({
    where: { email: "merchant@demo.navalogi.id" },
    create: {
      email: "merchant@demo.navalogi.id",
      name: "Toko Demo Navalogi",
      passwordHash: merchantPassword,
      role: UserRole.MERCHANT,
      creditsRemaining: 0,
      phone: "081234567890",
    },
    update: {
      name: "Toko Demo Navalogi",
      role: UserRole.MERCHANT,
      creditsRemaining: 0,
    },
  });

  const demoStore = await prisma.merchantStore.upsert({
    where: { userId: merchant.id },
    create: {
      userId: merchant.id,
      name: "Pustaka Guru Demo",
      slug: "pustaka-guru-demo",
      description: "Toko demo buku dan ATK untuk guru serta sekolah.",
      city: "Jakarta",
      address: "Jl. Pendidikan No. 1",
      flatShippingFee: 15000,
      status: "ACTIVE",
    },
    update: {
      name: "Pustaka Guru Demo",
      description: "Toko demo buku dan ATK untuk guru serta sekolah.",
      city: "Jakarta",
      address: "Jl. Pendidikan No. 1",
      flatShippingFee: 15000,
      status: "ACTIVE",
    },
  });

  for (const product of DEMO_PRODUCTS) {
    const imageUrl = await localDemoImage(product.imageFile, product.imageSrc, product.title);
    await prisma.marketplaceProduct.upsert({
      where: { storeId_slug: { storeId: demoStore.id, slug: product.slug } },
      create: {
        storeId: demoStore.id,
        title: product.title,
        slug: product.slug,
        kind: product.kind,
        price: product.price,
        stock: product.stock,
        description: product.description,
        imageUrl,
        status: "PUBLISHED",
      },
      update: {
        title: product.title,
        kind: product.kind,
        price: product.price,
        stock: product.stock,
        description: product.description,
        imageUrl,
        status: "PUBLISHED",
      },
    });
  }

  return {
    store: demoStore.slug,
    productCount: DEMO_PRODUCTS.length,
    merchantEmail: merchant.email,
  };
}
