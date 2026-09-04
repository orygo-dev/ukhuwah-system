/** Public explanatory content. These links never grant access or start a purchase. */
export type InformationLink = { label: string; href: string };
export type InformationSection = {
  title: string;
  body: string;
  points?: string[];
  steps?: string[];
  link?: InformationLink;
};
export type InformationPage = {
  eyebrow: string;
  title: string;
  description: string;
  sections: InformationSection[];
  next: InformationLink[];
};

export const LANDING_INFORMATION = {
  fitur: {
    eyebrow: "KENALI SISTEM",
    title: "Dari persiapan mengajar hingga perkembangan siswa.",
    description:
      "UKHUWAH SYSTEM menghubungkan guru, siswa, pengelola unit sekolah, dan orang tua Yayasan Ukhuwah Kalimantan Selatan. Setiap fitur memiliki panduan, cara memulai, serta batas akses sesuai peran.",
    sections: [
      {
        title: "Kelas, tugas, dan penilaian",
        body: "Guru menyiapkan kegiatan di kelas yang dikelolanya. Siswa mengikuti tugas dan kuis dari akun yang terhubung ke kelas; guru meninjau hasil dan memberi penilaian.",
        points: [
          "Tugas dan kuis untuk kegiatan belajar.",
          "Absensi dan nilai untuk memantau kemajuan.",
          "PJJ untuk pertemuan daring pada kelas yang mendapat akses.",
        ],
        link: { label: "Pelajari alur kegiatan kelas", href: "/fitur/kelas" },
      },
      {
        title: "Perangkat ajar berbantuan asisten",
        body: "Bantu menyusun draf dokumen pembelajaran dari informasi yang diberikan guru. Hasilnya perlu diperiksa dan disesuaikan sebelum digunakan di kelas.",
        link: { label: "Pelajari asisten perangkat ajar", href: "/fitur/ai" },
      },
      {
        title: "Zona Baca",
        body: "Siswa membuka bacaan digital yang tersedia untuk akunnya. Koleksi mengikuti konten yang disediakan pengelola unit sekolah, bukan seluruh buku di internet.",
        link: {
          label: "Pelajari cara mengakses bacaan",
          href: "/fitur/zona-baca",
        },
      },
      {
        title: "Zona Kreasi",
        body: "Ruang berbagi karya dan inspirasi. Publikasi serta visibilitas menentukan siapa yang dapat melihat konten, termasuk ketika tautannya dibagikan.",
        link: {
          label: "Pelajari publikasi dan berbagi",
          href: "/fitur/spotlight",
        },
      },
      {
        title: "Pengelolaan sekolah",
        body: "Admin unit sekolah mengelola kebutuhan bersama, seperti akses guru, data siswa, jadwal, dan administrasi sesuai pengaturan yayasan.",
        link: { label: "Lihat solusi untuk sekolah", href: "/untuk-sekolah" },
      },
      {
        title: "Akses orang tua",
        body: "Orang tua menggunakan kode akses yang diberikan guru atau sekolah untuk melihat informasi anak yang terhubung. Kode ini bersifat pribadi dan tidak boleh disebarkan.",
        link: { label: "Buka akses orang tua", href: "/orangtua" },
      },
    ],
    next: [
      { label: "Masuk ke sistem", href: "/login" },
      { label: "Panduan siswa", href: "/panduan/siswa" },
    ],
  },
  sekolah: {
    eyebrow: "UNTUK SEKOLAH",
    title: "Kelola unit pendidikan Yayasan Ukhuwah dalam satu sistem.",
    description:
      "Admin sekolah mengatur operasional unit pendidikan. Guru tetap menjalankan pembelajaran pada kelas yang dikelolanya, sementara akun siswa mengikuti kelas dan sekolahnya.",
    sections: [
      {
        title: "Pembagian peran yang jelas",
        body: "Admin sekolah mengatur operasional unit. Guru tetap menjalankan pembelajaran pada kelas yang dikelolanya. Orang tua memantau perkembangan anak melalui portal terpisah.",
        points: [
          "Admin sekolah: mengelola guru, siswa, administrasi, dan pengaturan unit.",
          "Guru: menyiapkan pembelajaran, tugas, absensi, penilaian, dan dokumen sesuai akses.",
          "Siswa: mengikuti pembelajaran menggunakan akun yang disediakan guru atau sekolah.",
        ],
      },
      {
        title: "Administrasi, jadwal, dan perangkat ajar",
        body: "Fitur sekolah mencakup administrasi dokumen, penjadwalan pengajar, draf perangkat ajar, dan ekspor dokumen sesuai pengaturan yang diaktifkan yayasan.",
        points: [
          "Kapasitas guru dan siswa mengikuti data unit pendidikan.",
          "Akses generator perangkat ajar mengikuti penugasan dan hak akun; tidak otomatis diberikan ke semua akun.",
          "Draf berbantuan asisten tetap membutuhkan pemeriksaan dan persetujuan guru.",
        ],
      },
      {
        title: "Langkah memulai",
        body: "Pendaftaran guru bukan pendaftaran admin sekolah. Gunakan akun admin sekolah yang disiapkan pengelola yayasan.",
        steps: [
          "Koordinasikan pembuatan atau pengaitan akun admin sekolah dengan pengelola yayasan.",
          "Masuk sebagai admin sekolah dan periksa data guru serta siswa unit Anda.",
          "Atur akses guru, kelas, dan kebutuhan administrasi sesuai unit pendidikan.",
          "Mulai pembelajaran dengan kelas yang sudah disiapkan, lalu bagikan akses orang tua bila diperlukan.",
        ],
      },
      {
        title: "Bagaimana dengan PJJ?",
        body: "PJJ tidak otomatis aktif untuk setiap kelas. Akses mengikuti pengaturan sekolah. Batas ruang tetap maksimal 25 peserta; bukan janji kapasitas tanpa batas.",
        link: {
          label: "Pelajari alur PJJ dan kehadiran",
          href: "/fitur/kelas",
        },
      },
      {
        title: "Jika akun admin belum tersedia",
        body: "Hubungi pengelola yayasan untuk pengaitan akun admin sekolah. Jangan membuat akun guru baru untuk menggantikan akun admin sekolah.",
      },
    ],
    next: [
      { label: "Masuk sebagai admin sekolah", href: "/login" },
      { label: "Kenali seluruh fitur", href: "/fitur" },
    ],
  },
  aplikasi: {
    eyebrow: "WEB & ANDROID",
    title: "Pilih akses yang sesuai dengan peran Anda.",
    description:
      "Web dan Android merupakan akses ke platform yang sama. Gunakan akun yang benar; tampilan dan fitur yang tersedia mengikuti peran serta versi aplikasi.",
    sections: [
      {
        title: "Web untuk guru dan admin sekolah",
        body: "Buka aplikasi melalui browser, lalu masuk dengan akun yang sudah dimiliki. Guru mengelola pembelajaran dan dokumen; admin sekolah menggunakan dashboard sekolah.",
        steps: [
          "Guru baru dapat menggunakan pendaftaran akun guru jika diizinkan pengelola yayasan.",
          "Admin sekolah masuk menggunakan akun admin yang telah disiapkan; bukan mendaftar sebagai guru.",
          "Setelah masuk, gunakan menu yang tersedia sesuai peran dan hak akses.",
        ],
        link: { label: "Masuk melalui web", href: "/login" },
      },
      {
        title: "Web dan Android untuk siswa",
        body: "Minta akun siswa kepada guru atau sekolah. Gunakan akun yang sama untuk masuk ke web atau aplikasi Android resmi. Siswa tidak perlu mendaftar sebagai guru untuk mendapatkan akun siswa.",
        link: { label: "Baca panduan akses siswa", href: "/panduan/siswa" },
      },
      {
        title: "Sebelum menggunakan aplikasi Android",
        body: "Pastikan aplikasi berasal dari tautan resmi. Jika tombol unduh resmi belum tersedia di halaman ini, minta tautannya kepada guru atau sekolah; jangan memasang APK dari sumber yang tidak dikenal.",
        points: [
          "Gunakan versi aplikasi yang didukung dan koneksi internet yang stabil.",
          "Aktifkan izin kamera atau mikrofon saat fitur yang digunakan membutuhkannya.",
          "Jika sesi tidak valid, coba masuk kembali. Jika berulang, laporkan versi aplikasi dan pesan kesalahan tanpa mengirim kata sandi.",
        ],
      },
    ],
    next: [
      { label: "Panduan akses siswa", href: "/panduan/siswa" },
      { label: "Bantuan masuk dan akses", href: "/bantuan" },
    ],
  },
  siswa: {
    eyebrow: "PANDUAN SISWA",
    title: "Mulai belajar dengan akun dari guru atau sekolah.",
    description:
      "Panduan mendapatkan akun, masuk melalui web atau Android, menemukan kelas, dan mengatasi kendala akses. Jangan mendaftar sebagai guru untuk menjadi siswa.",
    sections: [
      {
        title: "1. Dapatkan akun siswa",
        body: "Minta email atau identitas login serta kata sandi akun siswa kepada guru atau pengelola sekolah. Pastikan akun terhubung dengan kelas yang benar. Jangan menggunakan akun milik teman.",
      },
      {
        title: "2. Pilih web atau Android",
        body: "Di web, buka halaman masuk. Di Android, gunakan aplikasi resmi dari tautan yang diberikan sekolah atau tersedia di halaman Aplikasi. Masukkan akun siswa yang sama; tidak perlu membuat akun guru baru.",
        link: { label: "Lihat pilihan aplikasi resmi", href: "/aplikasi" },
      },
      {
        title: "3. Temukan kelas dan kegiatan",
        body: "Sesudah masuk, periksa kelas, tugas, atau kuis yang tersedia. Jika kelas kosong atau bukan kelas Anda, minta guru memeriksa pengaitan akun. Akun berhasil login belum tentu sudah tergabung ke kelas yang benar.",
      },
      {
        title: "4. Bergabung ke PJJ",
        body: "Buka sesi yang disediakan guru dan tekan Gabung. Login ke aplikasi saja tidak berarti hadir di ruang PJJ. Izinkan kamera dan mikrofon jika dibutuhkan, lalu pastikan Anda benar-benar terhubung ke ruang yang sama.",
        link: { label: "Pelajari pertemuan daring", href: "/fitur/kelas" },
      },
      {
        title: "5. Jika tidak bisa masuk",
        body: "Periksa penulisan akun, koneksi internet, dan pesan yang tampil. Jika lupa kata sandi atau akun belum tersedia, minta bantuan guru atau sekolah. Jika sesi Android tidak valid berulang kali, sertakan versi aplikasi, waktu kejadian, dan tangkapan layar saat melapor.",
        points: [
          "Jangan mengirim kata sandi, token, atau kode akses pribadi dalam laporan.",
          "Gunakan menu Keluar saat selesai pada perangkat bersama.",
          "Jika bacaan atau tugas tidak tersedia, tanyakan akses kontennya kepada guru; jangan membuat akun lain.",
        ],
      },
    ],
    next: [
      { label: "Masuk dengan akun siswa", href: "/login" },
      { label: "Bantuan lainnya", href: "/bantuan" },
    ],
  },
  bantuan: {
    eyebrow: "PUSAT BANTUAN",
    title: "Temukan langkah berikutnya, bukan sekadar tautan masuk.",
    description:
      "Pilih kendala atau peran Anda. Panduan ini menjelaskan jalur akses yang sudah tersedia tanpa meminta kata sandi atau membuat akun pengganti.",
    sections: [
      {
        title: "Saya siswa baru atau lupa akun",
        body: "Akun siswa disiapkan guru atau sekolah. Minta mereka memeriksa identitas login, kata sandi, dan kelas yang terhubung. Pendaftaran guru bukan jalur pendaftaran siswa.",
        link: { label: "Ikuti panduan siswa", href: "/panduan/siswa" },
      },
      {
        title: "Login tidak merespons atau sesi tidak valid",
        body: "Periksa koneksi dan muat ulang halaman, lalu coba masuk kembali. Pada Android, pastikan versi aplikasi didukung. Jika tetap gagal, laporkan kepada pengelola akun dengan waktu kejadian, perangkat/browser, versi aplikasi, dan pesan kesalahan. Jangan sertakan kata sandi atau token.",
      },
      {
        title: "Orang tua belum memiliki kode akses",
        body: "Kode akses orang tua diberikan guru atau pengelola unit sekolah. Jika kode hilang atau kedaluwarsa, minta penerbitan ulang kepada sekolah. Jangan menggunakan kode milik orang tua lain.",
        link: { label: "Buka portal orang tua", href: "/orangtua" },
      },
      {
        title: "Admin sekolah belum dapat masuk",
        body: "Masuk dengan akun admin yang disiapkan pengelola yayasan. Jika akun belum terhubung ke unit pendidikan, minta pengelola yayasan memeriksa pengaitan akun. Jangan membuat akun guru baru untuk menggantikan akun admin sekolah.",
        link: { label: "Pahami peran sekolah", href: "/untuk-sekolah" },
      },
      {
        title: "Siswa login, tetapi terlihat offline di PJJ",
        body: "Status login aplikasi berbeda dari koneksi ke ruang PJJ. Pastikan siswa menekan Gabung pada sesi yang sama dan koneksinya berhasil. Jika sudah bergabung tetapi tetap offline, laporkan nama sesi, waktu kejadian, dan perangkat kepada guru atau pengelola.",
        link: { label: "Baca alur kelas dan PJJ", href: "/fitur/kelas" },
      },
      {
        title: "Bacaan atau tautan Zona Kreasi tidak dapat dibuka",
        body: "Konten dapat dibatasi oleh akses akun atau status publikasinya. Tautan berbagi tidak mengubah konten privat menjadi publik. Pastikan akun dan izin kontennya benar sebelum melaporkan masalah.",
        link: { label: "Pahami berbagi Zona Kreasi", href: "/fitur/spotlight" },
      },
      {
        title: "Kepada siapa saya meminta bantuan?",
        body: "Siswa dan orang tua menghubungi guru atau pengelola sekolah. Guru dan admin sekolah meneruskan kendala teknis kepada pengelola yayasan melalui jalur komunikasi resmi yang sudah digunakan unit pendidikan. Halaman ini tidak menyediakan formulir tiket atau nomor layanan yang belum dikonfigurasi.",
      },
    ],
    next: [
      { label: "Panduan siswa", href: "/panduan/siswa" },
      { label: "Pilihan web dan Android", href: "/aplikasi" },
    ],
  },
  kelas: {
    eyebrow: "FITUR / KEGIATAN KELAS",
    title: "Satu alur untuk belajar, menilai, dan memantau.",
    description:
      "Guru mengelola kelasnya, siswa mengikuti kegiatan yang tersedia, dan hasil pembelajaran dapat ditinjau sesuai hak akses.",
    sections: [
      {
        title: "Dari persiapan hingga penilaian",
        body: "Mulai dari kelas dan akun siswa yang sudah terhubung, bukan dari membuat akun baru untuk setiap tugas.",
        steps: [
          "Guru menyiapkan kegiatan, tugas, atau kuis untuk kelas yang dikelolanya.",
          "Siswa masuk dan membuka kegiatan yang tersedia untuk kelasnya.",
          "Guru meninjau jawaban atau pekerjaan siswa, memberi penilaian, dan memantau hasilnya.",
          "Gunakan absensi dan catatan pembelajaran untuk menindaklanjuti siswa yang membutuhkan bantuan.",
        ],
      },
      {
        title: "PJJ: bergabung ke ruang yang sama",
        body: "Guru membuka sesi PJJ sesuai akses yang diberikan. Siswa memilih sesi tersebut dan menekan Gabung. Kamera, mikrofon, dan kualitas koneksi perlu diperiksa pada perangkat masing-masing.",
        points: [
          "Login aplikasi tidak sama dengan bergabung ke ruang PJJ.",
          "Kehadiran di ruang dan status penilaian absensi adalah informasi yang berbeda; guru tetap perlu meninjau catatan absensi.",
          "PJJ mengikuti pengaturan dan add-on yang berlaku, dengan batas maksimal 25 peserta per ruang.",
          "Gunakan Keluar saat meninggalkan sesi; jika koneksi terputus, periksa status dan gabung kembali bila diperlukan.",
        ],
      },
      {
        title: "Akses mengikuti peran dan kelas",
        body: "Siswa hanya mengikuti kegiatan yang diberikan kepadanya. Admin sekolah mengelola lingkup unit pendidikan; hak admin bukan otomatis hak mengajar seluruh kelas. Menu dapat berbeda menurut akun dan pengaturan sekolah.",
      },
    ],
    next: [
      { label: "Panduan siswa", href: "/panduan/siswa" },
      { label: "Masuk ke kelas saya", href: "/login" },
    ],
  },
  ai: {
    eyebrow: "FITUR / ADMINISTRASI AI",
    title: "Bantu susun draf. Keputusan tetap di tangan guru.",
    description:
      "Generator membantu persiapan administrasi pembelajaran berdasarkan masukan guru. Hasilnya bukan dokumen yang otomatis benar atau langsung disahkan.",
    sections: [
      {
        title: "Cara menggunakan generator",
        body: "Gunakan generator yang tersedia pada akun Anda, sesuai kebutuhan dokumen pembelajaran.",
        steps: [
          "Masuk sebagai guru dan pilih generator yang sesuai.",
          "Lengkapi konteks pembelajaran yang diminta, seperti jenjang, mata pelajaran, dan kebutuhan dokumen.",
          "Jalankan pembuatan draf sesuai batas penggunaan akun.",
          "Tinjau isi, fakta, tujuan, dan kesesuaian dengan kondisi kelas; perbaiki sebelum digunakan.",
          "Simpan atau ekspor menggunakan pilihan format yang tersedia.",
        ],
      },
      {
        title: "Hak akses dan batas penggunaan",
        body: "Akses generator dan ekspor mengikuti hak akun guru di unit pendidikan. Untuk akses dari sekolah, penugasan guru juga berlaku. Kredit atau kuota bukan jaminan jumlah dokumen yang sama untuk semua jenis generator.",
        link: { label: "Kembali ke daftar fitur", href: "/fitur" },
      },
      {
        title: "Tetap tinjau dan lindungi data",
        body: "Hindari memasukkan data pribadi siswa yang tidak dibutuhkan. Periksa fakta dan penilaian yang dihasilkan AI; guru bertanggung jawab atas dokumen akhir. Tidak ada klaim bahwa hasil AI selalu akurat atau menggantikan pertimbangan pendidik.",
      },
    ],
    next: [
      { label: "Kenali seluruh fitur", href: "/fitur" },
      { label: "Masuk ke generator guru", href: "/dashboard/tools" },
    ],
  },
  "zona-baca": {
    eyebrow: "FITUR / ZONA BACA",
    title: "Temukan bacaan yang disediakan untuk Anda.",
    description:
      "Zona Baca menyediakan akses bacaan digital dalam platform. Koleksi yang terlihat bergantung pada konten pengelola dan hak akses akun.",
    sections: [
      {
        title: "Cara mulai membaca",
        body: "Masuk menggunakan akun yang telah tersedia; tidak perlu membuat akun baru khusus untuk setiap bacaan.",
        steps: [
          "Buka menu Zona Baca pada aplikasi.",
          "Pilih bacaan yang tersedia dan periksa judul serta informasinya.",
          "Buka bacaan untuk melihat isi ebook. Pastikan koneksi cukup stabil, terutama untuk dokumen berukuran besar.",
          "Jika bacaan tidak terlihat atau gagal dibuka, sampaikan judul bacaan dan pesan kesalahan kepada guru atau pengelola.",
        ],
      },
      {
        title: "Siapa yang menyediakan koleksi?",
        body: "Pengelola menambahkan dan mengatur bacaan sesuai kewenangannya. Akses konten mengikuti pengaturan yang berlaku. Sampul ilustrasi pada landing page bukan daftar buku yang dijanjikan tersedia.",
      },
      {
        title: "Jika halaman lambat atau kosong",
        body: "Periksa koneksi dan coba membuka kembali bacaan. Catat perangkat, waktu kejadian, judul, dan halaman yang bermasalah. Jangan menggandakan akun untuk mencoba melewati pembatasan akses; minta pengelola memeriksanya.",
      },
    ],
    next: [
      { label: "Panduan akun siswa", href: "/panduan/siswa" },
      { label: "Masuk untuk membaca", href: "/login" },
    ],
  },
  spotlight: {
    eyebrow: "FITUR / ZONA KREASI",
    title: "Bagikan karya dengan memahami siapa yang dapat melihatnya.",
    description:
      "Zona Kreasi menampilkan karya dan inspirasi sesuai akses serta status publikasi. Tautan berbagi tidak menghilangkan pembatasan konten.",
    sections: [
      {
        title: "Menemukan dan menerbitkan konten",
        body: "Masuk dan buka Zona Kreasi untuk melihat konten yang tersedia. Pembuatan, pengelolaan, dan penghapusan karya mengikuti kepemilikan serta kewenangan akun; publikasi mengikuti ketentuan yang berlaku.",
      },
      {
        title: "Apa yang terjadi saat menekan Bagikan?",
        body: "Pada perangkat yang mendukung berbagi, pilihan aplikasi berbagi dapat ditampilkan. Jika fitur berbagi perangkat tidak tersedia, tautan dapat disalin untuk ditempelkan sendiri. Tampilan ini dapat berbeda menurut browser dan versi Android.",
      },
      {
        title: "Apakah semua orang bisa membuka tautannya?",
        body: "Tidak. Penerima tautan tetap perlu masuk dengan akun yang memiliki izin melihat karya tersebut. Setelah masuk, penerima diarahkan kembali ke konten yang dibagikan. Status terbit atau jangkauan global tidak berarti konten dapat dilihat tanpa akun. Berbagi ke media sosial tidak mengubah izin akses.",
        points: [
          "Periksa konten dan pengaturan visibilitas sebelum membagikan.",
          "Jangan menyebarkan informasi pribadi siswa tanpa kewenangan.",
          "Jika penerima tidak dapat membuka konten, periksa status publikasi dan aksesnya, bukan meminta penerima mendaftar sebagai guru.",
        ],
      },
      {
        title: "Mengelola karya sendiri",
        body: "Gunakan pilihan pengelolaan pada konten milik sendiri jika tersedia untuk akun dan versi aplikasi. Jika pilihan hapus tidak muncul, laporkan judul konten, identitas akun kepada pengelola secara privat, dan versi aplikasi. Jangan mencoba menghapus karya milik pengguna lain.",
      },
    ],
    next: [
      { label: "Bantuan akses konten", href: "/bantuan" },
      { label: "Masuk ke Zona Kreasi", href: "/login" },
    ],
  },
} satisfies Record<string, InformationPage>;

export type InformationKey = keyof typeof LANDING_INFORMATION;
