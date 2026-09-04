import { PrismaClient, type TkaQuestionType } from "@prisma/client";
import { TKA_SUBJECTS } from "../src/lib/tka.shared";
import { assessTkaQuestionQuality } from "../src/lib/tka-question-quality";

const prisma = new PrismaClient();

type SeedQuestion = {
  type: TkaQuestionType;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  stimulus: string;
  prompt: string;
  options: string[];
  correctAnswers: number[];
  explanation: string;
  competency: string;
};

const LEGACY_PACKAGE_TITLE = "Simulasi TKA Matematika Dasar";
const PACKAGE_TITLE = "Simulasi TKA Matematika — Penerapan dan Penalaran 2026";

const MATHEMATICS_QUESTIONS: SeedQuestion[] = [
  {
    type: "SINGLE_CHOICE", difficulty: "MEDIUM",
    stimulus: "Sebuah loket menjual 120 tiket pertunjukan. Harga tiket dewasa Rp15.000 dan tiket pelajar Rp8.000. Total pendapatan loket adalah Rp1.380.000.",
    prompt: "Berapa tiket dewasa yang terjual?",
    options: ["48 tiket", "54 tiket", "60 tiket", "66 tiket"], correctAnswers: [2],
    explanation: "Misalkan x tiket dewasa. Persamaan pendapatan adalah 15.000x + 8.000(120 − x) = 1.380.000. Diperoleh 7.000x = 420.000 sehingga x = 60.",
    competency: "Memodelkan dan menyelesaikan persamaan linear satu variabel",
  },
  {
    type: "SINGLE_CHOICE", difficulty: "MEDIUM",
    stimulus: "Tagihan listrik sebuah rumah terdiri atas biaya tetap Rp25.000 dan biaya pemakaian Rp1.500 untuk setiap kWh. Keluarga itu ingin menurunkan tagihan bulan berikutnya sebesar Rp30.000 tanpa perubahan biaya tetap.",
    prompt: "Berapa pengurangan pemakaian listrik yang diperlukan?",
    options: ["15 kWh", "20 kWh", "25 kWh", "30 kWh"], correctAnswers: [1],
    explanation: "Penurunan hanya berasal dari biaya pemakaian. Dengan tarif Rp1.500 per kWh, pengurangan yang diperlukan adalah 30.000 ÷ 1.500 = 20 kWh.",
    competency: "Menerapkan fungsi linear dalam konteks biaya",
  },
  {
    type: "SINGLE_CHOICE", difficulty: "MEDIUM",
    stimulus: "Ketinggian sebuah bola yang dilempar vertikal dinyatakan oleh h(t) = −5t² + 20t + 1, dengan h dalam meter dan t dalam sekon.",
    prompt: "Berapa ketinggian maksimum bola tersebut?",
    options: ["16 meter", "20 meter", "21 meter", "25 meter"], correctAnswers: [2],
    explanation: "Puncak fungsi kuadrat terjadi saat t = −b/(2a) = −20/(2 × −5) = 2. Substitusi t = 2 menghasilkan h(2) = −20 + 40 + 1 = 21 meter.",
    competency: "Menginterpretasikan nilai maksimum fungsi kuadrat",
  },
  {
    type: "SINGLE_CHOICE", difficulty: "MEDIUM",
    stimulus: "Sebuah laptop berharga Rp800.000 memperoleh diskon 20%. Setelah diskon, pembeli membayar pajak 11% dari harga yang telah didiskon.",
    prompt: "Berapa jumlah akhir yang harus dibayar pembeli?",
    options: ["Rp640.000", "Rp688.000", "Rp704.000", "Rp710.400"], correctAnswers: [3],
    explanation: "Harga setelah diskon adalah 800.000 × 80% = 640.000. Setelah pajak, jumlahnya 640.000 × 111% = 710.400. Pajak tidak dihitung dari harga sebelum diskon.",
    competency: "Menerapkan persentase bertingkat dalam transaksi",
  },
  {
    type: "SINGLE_CHOICE", difficulty: "MEDIUM",
    stimulus: "Sebuah taman berbentuk persegi panjang berukuran 20 m × 14 m. Di sepanjang sisi bagian dalam taman dibuat jalan setapak selebar 1 m. Bagian yang tidak menjadi jalan ditanami rumput.",
    prompt: "Berapa luas bagian taman yang ditanami rumput?",
    options: ["216 m²", "224 m²", "248 m²", "280 m²"], correctAnswers: [0],
    explanation: "Jalan selebar 1 m mengurangi masing-masing dimensi sebanyak 2 m. Ukuran area rumput menjadi 18 m × 12 m, sehingga luasnya 216 m².",
    competency: "Menganalisis luas bangun datar dengan batas bagian dalam",
  },
  {
    type: "SINGLE_CHOICE", difficulty: "HARD",
    stimulus: "Di dalam kotak terdapat 5 bola merah, 3 bola biru, dan 2 bola hijau. Dua bola diambil sekaligus secara acak tanpa pengembalian.",
    prompt: "Berapa peluang kedua bola yang terambil memiliki warna yang sama?",
    options: ["7/45", "14/45", "16/45", "7/15"], correctAnswers: [1],
    explanation: "Pasangan berwarna sama berjumlah C(5,2) + C(3,2) + C(2,2) = 10 + 3 + 1 = 14. Seluruh pasangan berjumlah C(10,2) = 45, jadi peluangnya 14/45.",
    competency: "Menghitung peluang kejadian majemuk tanpa pengembalian",
  },
  {
    type: "SINGLE_CHOICE", difficulty: "MEDIUM",
    stimulus: "Pada waktu yang sama, sebuah tiang menghasilkan bayangan sepanjang 12 m. Sudut elevasi matahari dari ujung bayangan ke puncak tiang adalah 37°. Gunakan tan 37° = 3/4.",
    prompt: "Berapa tinggi tiang tersebut?",
    options: ["8 meter", "9 meter", "12 meter", "16 meter"], correctAnswers: [1],
    explanation: "tan 37° = tinggi/bayangan = 3/4. Jadi tinggi = 12 × 3/4 = 9 meter.",
    competency: "Menerapkan perbandingan trigonometri pada pengukuran tidak langsung",
  },
  {
    type: "SINGLE_CHOICE", difficulty: "MEDIUM",
    stimulus: "Sebuah usaha memproduksi 120 unit barang pada minggu pertama. Produksi bertambah tetap 15 unit setiap minggu.",
    prompt: "Berapa total barang yang diproduksi selama delapan minggu pertama?",
    options: ["1.260 unit", "1.320 unit", "1.380 unit", "1.440 unit"], correctAnswers: [2],
    explanation: "Produksi membentuk barisan aritmetika dengan a = 120, d = 15, dan n = 8. Jumlahnya S₈ = 8/2 × (2 × 120 + 7 × 15) = 1.380 unit.",
    competency: "Menerapkan jumlah barisan aritmetika dalam konteks produksi",
  },
  {
    type: "MULTIPLE_CHOICE", difficulty: "HARD",
    stimulus: "Diberikan fungsi kuadrat f(x) = x² − 4x + 3. Pilih semua pernyataan yang benar berdasarkan fungsi tersebut.",
    prompt: "Pernyataan manakah yang benar?",
    options: ["Grafik memotong sumbu-x di x = 1 dan x = 3.", "Sumbu simetri grafik adalah x = 2.", "Nilai minimum fungsi adalah 3.", "Nilai f(4) sama dengan 3.", "Grafik memotong sumbu-y di titik (0, −3)."],
    correctAnswers: [0, 1, 3],
    explanation: "Fungsi dapat ditulis (x − 1)(x − 3), sehingga akarnya 1 dan 3. Sumbu simetrinya x = 2 dan f(2) = −1, bukan 3. Selain itu f(4) = 3 dan f(0) = 3.",
    competency: "Menghubungkan bentuk aljabar dan karakteristik grafik fungsi kuadrat",
  },
  {
    type: "MULTIPLE_CHOICE", difficulty: "HARD",
    stimulus: "Kelas A terdiri atas 20 siswa dengan nilai rata-rata 78. Kelas B terdiri atas 30 siswa dengan nilai rata-rata 82. Kedua kelas mengikuti tes yang sama.",
    prompt: "Pilih semua pernyataan yang dapat dipastikan benar.",
    options: ["Rata-rata gabungan kedua kelas adalah 80,4.", "Jumlah seluruh nilai Kelas A adalah 1.560.", "Median gabungan kedua kelas pasti 80.", "Jumlah nilai Kelas B lebih besar 900 daripada jumlah nilai Kelas A.", "Siswa dengan nilai tertinggi pasti berasal dari Kelas B."],
    correctAnswers: [0, 1, 3],
    explanation: "Jumlah nilai A = 20 × 78 = 1.560 dan B = 30 × 82 = 2.460. Rata-rata gabungan = 4.020/50 = 80,4 dan selisih jumlah nilai = 900. Median serta nilai tertinggi tidak dapat ditentukan hanya dari rata-rata.",
    competency: "Menafsirkan ukuran pemusatan dan data agregat",
  },
  {
    type: "SINGLE_CHOICE", difficulty: "MEDIUM",
    stimulus: "Sebuah kultur mikroorganisme mula-mula berjumlah 500. Dalam kondisi tertentu, jumlahnya menjadi dua kali lipat setiap 3 jam.",
    prompt: "Berapa jumlah mikroorganisme setelah 12 jam jika pola pertumbuhan tetap?",
    options: ["2.000", "4.000", "8.000", "16.000"], correctAnswers: [2],
    explanation: "Dalam 12 jam terjadi 12/3 = 4 kali pelipatan. Jumlah akhir adalah 500 × 2⁴ = 500 × 16 = 8.000.",
    competency: "Menerapkan pertumbuhan eksponensial",
  },
  {
    type: "SINGLE_CHOICE", difficulty: "HARD",
    stimulus: "Sebuah bengkel membuat meja dan rak. Satu meja membutuhkan 3 jam pemotongan dan 2 jam perakitan, sedangkan satu rak membutuhkan 2 jam pemotongan dan 1 jam perakitan. Tersedia paling banyak 18 jam pemotongan dan 10 jam perakitan. Keuntungan satu meja Rp400.000 dan satu rak Rp250.000.",
    prompt: "Kombinasi produksi manakah yang memberikan keuntungan maksimum?",
    options: ["5 meja dan 0 rak", "4 meja dan 2 rak", "2 meja dan 6 rak", "0 meja dan 9 rak"], correctAnswers: [2],
    explanation: "Keuntungan keempat opsi berturut-turut Rp2.000.000, Rp2.100.000, Rp2.300.000, dan Rp2.250.000; semuanya memenuhi kendala. Nilai terbesar diperoleh dari 2 meja dan 6 rak.",
    competency: "Menentukan nilai optimum dari sistem pertidaksamaan linear",
  },
];

function validateSeedQuestions() {
  const prompts = new Set<string>();
  for (const seed of MATHEMATICS_QUESTIONS) {
    const quality = assessTkaQuestionQuality(seed);
    if (quality.errors.length) throw new Error(`${seed.prompt}: ${quality.errors.join(" ")}`);
    if (prompts.has(seed.prompt)) throw new Error(`Pertanyaan seed duplikat: ${seed.prompt}`);
    prompts.add(seed.prompt);
  }
  return MATHEMATICS_QUESTIONS.length;
}

async function main() {
  validateSeedQuestions();
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!admin) throw new Error("Super Admin tidak ditemukan. Jalankan seed utama terlebih dahulu.");

  for (const [sortOrder, subject] of TKA_SUBJECTS.entries()) {
    await prisma.tkaSubject.upsert({
      where: { slug: subject.slug }, create: { ...subject, sortOrder },
      update: { name: subject.name, category: subject.category, sortOrder, isActive: true },
    });
  }

  const math = await prisma.tkaSubject.findUniqueOrThrow({ where: { slug: "matematika" } });
  const questionIds: string[] = [];
  for (const seed of MATHEMATICS_QUESTIONS) {
    const existing = await prisma.tkaQuestion.findFirst({ where: { authorId: admin.id, scope: "GLOBAL", prompt: seed.prompt }, select: { id: true } });
    const question = existing ?? await prisma.tkaQuestion.create({
      data: {
        subjectId: math.id, authorId: admin.id, scope: "GLOBAL", status: "PUBLISHED",
        type: seed.type, stimulus: seed.stimulus, prompt: seed.prompt, options: seed.options,
        correctAnswers: seed.correctAnswers, explanation: seed.explanation, competency: seed.competency,
        difficulty: seed.difficulty, publishedAt: new Date(),
      },
    });
    questionIds.push(question.id);
  }

  await prisma.tkaPackage.updateMany({ where: { title: LEGACY_PACKAGE_TITLE, scope: "GLOBAL", status: "PUBLISHED" }, data: { status: "ARCHIVED" } });
  const existingPackage = await prisma.tkaPackage.findFirst({ where: { title: PACKAGE_TITLE, scope: "GLOBAL" }, select: { id: true } });
  if (!existingPackage) {
    await prisma.tkaPackage.create({
      data: {
        subjectId: math.id, authorId: admin.id, title: PACKAGE_TITLE,
        description: "Latihan orisinal berbasis penerapan dan penalaran matematika. Paket ini adalah simulasi GenPro, bukan soal atau hasil TKA resmi.",
        scope: "GLOBAL", status: "PUBLISHED", durationMinutes: 35, publishedAt: new Date(),
        questions: { create: questionIds.map((questionId, sortOrder) => ({ questionId, sortOrder })) },
      },
    });
  }
  console.log(`Seed TKA selesai: ${questionIds.length} soal berkualitas dan 1 paket simulasi aktif.`);
}

if (process.argv.includes("--validate-only")) {
  console.log(`Validasi seed TKA lulus: ${validateSeedQuestions()} soal.`);
  void prisma.$disconnect();
} else {
  main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
