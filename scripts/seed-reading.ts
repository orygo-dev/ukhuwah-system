import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const books = [
  {
    slug: "membaca-kritis-di-era-digital",
    title: "Membaca Kritis di Era Digital",
    authorName: "Tim Literasi Guru Space",
    category: "Literasi",
    estimatedMinutes: 12,
    contentText: `Setiap hari kita menerima informasi dari pesan singkat, media sosial, video, dan situs berita. Banyaknya informasi tidak selalu membuat kita lebih memahami dunia. Agar tidak mudah percaya pada informasi yang keliru, kita perlu membaca secara kritis.

Membaca kritis dimulai dengan mengenali siapa yang menyampaikan informasi. Periksa nama penulis, lembaga penerbit, tanggal terbit, serta tujuan tulisan. Sebuah pendapat pribadi berbeda dengan laporan penelitian. Keduanya boleh dibaca, tetapi pembaca harus memahami jenis bukti yang digunakan.

Langkah berikutnya adalah memeriksa klaim utama. Tanyakan: bukti apa yang diberikan, apakah sumbernya dapat diperiksa, dan adakah penjelasan lain yang masuk akal? Judul yang sangat mengejutkan sering dibuat untuk menarik perhatian. Karena itu, jangan berhenti pada judul. Bacalah isi lengkap dan bandingkan dengan setidaknya satu sumber tepercaya lainnya.

Pembaca kritis juga menyadari bias dirinya sendiri. Kita cenderung menyukai informasi yang sesuai dengan keyakinan kita. Ketika menemukan informasi yang terasa sangat meyakinkan, berhentilah sejenak dan cari sudut pandang yang berbeda. Tujuannya bukan untuk mencurigai semua hal, melainkan membuat keputusan berdasarkan alasan yang dapat dipertanggungjawabkan.

Kebiasaan sederhana ini membantu kita menjadi warga digital yang lebih aman, terbuka, dan bertanggung jawab.`,
  },
  {
    slug: "hutan-hujan-kalimantan",
    title: "Hutan Hujan Kalimantan dan Kehidupan Kita",
    authorName: "Tim Sains Guru Space",
    category: "Sains",
    estimatedMinutes: 10,
    contentText: `Hutan hujan Kalimantan merupakan salah satu ekosistem penting di dunia. Pepohonan, tanah, sungai, hewan, tumbuhan, dan manusia saling terhubung dalam jaringan kehidupan yang kompleks. Hutan menyimpan karbon, menjaga siklus air, serta menjadi ruang hidup bagi banyak spesies.

Ketika hujan turun, tajuk pohon memperlambat air sebelum mencapai tanah. Akar membantu tanah menyerap air dan mengurangi erosi. Sebagian air kemudian mengalir menuju sungai yang digunakan masyarakat untuk kebutuhan sehari-hari. Kerusakan hutan dapat mengganggu proses tersebut dan meningkatkan risiko banjir atau kekeringan.

Masyarakat lokal memiliki pengetahuan panjang tentang cara memanfaatkan sumber daya tanpa menghabiskannya. Pengetahuan tersebut penting dipadukan dengan penelitian modern dan kebijakan yang adil. Pelestarian tidak cukup hanya dengan melarang; masyarakat juga memerlukan pilihan ekonomi yang layak.

Siswa dapat berkontribusi melalui kebiasaan sederhana: mengurangi pemborosan kertas, memahami asal produk yang digunakan, menanam tumbuhan lokal, dan menyebarkan informasi yang benar. Perlindungan hutan adalah kerja bersama yang dimulai dari pemahaman.`,
  },
  {
    slug: "ruang-kelas-yang-beragam",
    title: "Ruang Kelas yang Beragam, Ruang Belajar yang Kaya",
    authorName: "Tim Kebhinnekaan Guru Space",
    category: "Kebhinnekaan",
    estimatedMinutes: 9,
    contentText: `Setiap siswa datang ke sekolah dengan pengalaman, bahasa keluarga, kebiasaan, kemampuan, dan cara belajar yang berbeda. Perbedaan tersebut bukan hambatan. Jika dikelola dengan saling menghormati, keberagaman membuat proses belajar menjadi lebih kaya.

Sikap inklusif dimulai dari kebiasaan mendengarkan. Ketika teman menyampaikan pendapat, kita berusaha memahami alasan di baliknya sebelum menanggapi. Kita boleh tidak setuju, tetapi penolakan harus diarahkan pada gagasan, bukan pada identitas orangnya.

Kerja kelompok memberikan kesempatan untuk mempraktikkan sikap tersebut. Pembagian tugas perlu mempertimbangkan kekuatan setiap anggota. Siswa yang cepat berbicara memberi ruang kepada teman yang lebih tenang. Siswa yang memahami materi membantu tanpa merendahkan. Semua anggota bertanggung jawab terhadap hasil bersama.

Sekolah yang aman bukan sekolah tanpa perbedaan pendapat. Sekolah yang aman adalah tempat setiap orang dapat menyampaikan pendapat tanpa takut dihina, serta bersedia memperbaiki diri ketika melakukan kesalahan.`,
  },
];

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("Super Admin diperlukan untuk membuat koleksi awal Zona Baca.");
  for (const book of books) {
    await prisma.readingBook.upsert({
      where: { slug: book.slug },
      update: {},
      create: {
        ...book,
        description: book.contentText.split("\n")[0],
        targetLevel: "SMA/SMK",
        contentType: "ARTICLE",
        pageCount: 3,
        licenseName: "Konten internal untuk pembelajaran",
        rightsHolder: "Guru Space",
        scope: "GLOBAL",
        status: "PUBLISHED",
        createdById: admin.id,
        reviewerId: admin.id,
        publishedAt: new Date(),
      },
    });
  }
  console.log(`Zona Baca: ${books.length} koleksi awal tersedia.`);
}

main().finally(() => prisma.$disconnect());
