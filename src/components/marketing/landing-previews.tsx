import {
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  ClipboardCheck,
  FileText,
  House,
  MessageSquare,
  Settings,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import styles from "./landing-page.module.css";

const books = ["Jejak Pena", "Ruang Alam", "Cerita Nusa"];
export function EditorialShelf({ spotlight = false }: { spotlight?: boolean }) {
  return (
    <div className={styles.shelf} aria-hidden="true">
      {(spotlight ? ["Puisi", "Komik", "Poster"] : books).map((title, i) => (
        <div key={title}>
          <div
            className={styles.cover}
            style={{
              backgroundPosition: `${(i + (spotlight ? 3 : 0)) * 20}% 50%`,
            }}
          >
            {!spotlight && <span>{title}</span>}
          </div>
          <b>{title}</b>
          <small>
            {spotlight
              ? "Karya contoh"
              : ["Antologi Cerpen", "Pengetahuan Alam", "Cerita Rakyat"][i]}
          </small>
        </div>
      ))}
    </div>
  );
}

export function PhonePreview({ reading = true }: { reading?: boolean }) {
  return (
    <div className={styles.phone} aria-hidden="true">
      <div className={styles.phoneTop}>
        <span>9:41</span>
        <span>● ▰</span>
      </div>
      <div className={styles.phoneHeading}>
        <b>Belajar hari ini</b>
        <span>Selasa, 21 Mei</span>
      </div>
      <div className={styles.phoneBody}>
        <div className={styles.phoneTask}>
          <b>Tugas hari ini</b>
          <div>
            <FileText />
            <p>
              <strong>Laporan Percobaan</strong>
              <small>IPA · Kelas 7A</small>
              <small>Kumpulkan hasil pengamatanmu.</small>
            </p>
          </div>
          <span className={styles.previewAction}>Kerjakan</span>
        </div>
        <b>{reading ? "Zona Baca" : "Kelas saya"}</b>
        {reading ? (
          <EditorialShelf />
        ) : (
          <div className={styles.phoneClasses}>
            {["IPA Terpadu", "Bahasa Indonesia"].map((v) => (
              <div key={v}>
                <UsersRound />
                <p>
                  <b>Kelas 7A</b>
                  <small>{v}</small>
                </p>
                <span>›</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.phoneNav}>
        {[
          [House, "Beranda"],
          [UsersRound, "Kelas"],
          [ClipboardCheck, "Tugas"],
          [BookOpen, "Baca"],
          [UserRound, "Akun"],
        ].map(([Icon, label]) => {
          const Item = Icon as typeof House;
          return (
            <span key={String(label)}>
              <Item />
              {String(label)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const tasks = [
  "Menyusun Teks Eksplanasi",
  "Latihan Persamaan Linear",
  "Laporan Percobaan",
];
function TaskList() {
  return (
    <div className={styles.taskList}>
      {tasks.map((task, i) => (
        <div key={task}>
          <FileText />
          <p>
            <b>{task}</b>
            <small>
              {["Bahasa Indonesia", "Matematika", "IPA Terpadu"][i]} · Kelas 7A
            </small>
            <small>Jatuh tempo {24 + i} Mei</small>
          </p>
        </div>
      ))}
    </div>
  );
}

export function DashboardPreview({ appName }: { appName: string }) {
  const side = [
    [House, "Beranda"],
    [UsersRound, "Kelas"],
    [FileText, "Tugas"],
    [ClipboardCheck, "Kuis"],
    [CalendarDays, "Absensi"],
    [ChartNoAxesColumnIncreasing, "Penilaian"],
    [BookOpen, "Zona Baca"],
    [Sparkles, "Zona Kreasi"],
    [FileText, "Dokumen"],
    [Settings, "Pengaturan"],
  ] as const;
  return (
    <figure className={styles.heroPreview}>
      <div className={styles.browserPreview} aria-hidden="true">
        <div className={styles.browserTop}>
          <div className={styles.traffic}>
            <i />
            <i />
            <i />
          </div>
          <b>{appName}</b>
          <span>
            <Bell />
            <CalendarDays />
            <UserRound />
          </span>
        </div>
        <div className={styles.dashboardBody}>
          <div className={styles.sidebar}>
            {side.map(([Icon, label]) => (
              <span key={label}>
                <Icon />
                {label}
              </span>
            ))}
          </div>
          <div className={styles.dashboardContent}>
            <h3>Ruang mengajar</h3>
            <p>Selamat datang kembali, Bapak/Ibu Guru.</p>
            <div className={styles.dashboardPanels}>
              <div className={styles.previewPanel}>
                <b>Jadwal minggu ini</b>
                {["Sen", "Sel", "Rab", "Kam", "Jum"].map((day, i) => (
                  <div className={styles.scheduleRow} key={day}>
                    <strong>
                      {day}
                      <small>{20 + i} Mei</small>
                    </strong>
                    <p>
                      <b>Kelas {7 + (i % 3)}A</b>
                      <small>
                        {
                          [
                            "Bahasa Indonesia",
                            "Matematika",
                            "IPA Terpadu",
                            "Bahasa Inggris",
                            "IPS",
                          ][i]
                        }
                      </small>
                    </p>
                    <small>08.00</small>
                  </div>
                ))}
              </div>
              <div className={styles.previewPanel}>
                <b>Tugas terbaru</b>
                <TaskList />
              </div>
            </div>
            <div className={styles.dashboardPanels}>
              <div className={styles.previewPanel}>
                <b>Absensi hari ini</b>
                <small>Kelas 7A</small>
                <div className={styles.previewStats}>
                  <span>
                    Hadir<strong>28</strong>
                  </span>
                  <span>
                    Izin<strong>2</strong>
                  </span>
                </div>
              </div>
              <div className={styles.previewPanel}>
                <b>Penilaian kelas</b>
                <small>Kelas 7A</small>
                <div className={styles.previewStats}>
                  <span>
                    Rata-rata<strong>86</strong>
                  </span>
                  <span>
                    Tuntas<strong>24/30</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.heroPhone}>
        <PhonePreview />
      </div>
      <figcaption>Ilustrasi tampilan · data contoh</figcaption>
    </figure>
  );
}

export function ClassroomPreview() {
  return (
    <figure className={styles.classroomPreview}>
      <div aria-hidden="true">
        <div className={styles.classroomTitle}>
          <ArrowLeft />
          <b>Kelas 7A</b>
        </div>
        <div className={styles.classroomTabs}>
          {["Ringkasan", "Anggota", "Tugas", "Kuis", "Absensi", "Nilai"].map(
            (v) => (
              <span key={v}>{v}</span>
            ),
          )}
        </div>
        <div className={styles.classroomPanels}>
          <div className={styles.previewPanel}>
            <b>Tugas terbaru</b>
            <TaskList />
          </div>
          <div className={styles.previewPanel}>
            <b>Ringkasan kelas</b>
            <div className={styles.classroomStats}>
              <div>
                <small>Kehadiran</small>
                <span className={styles.attendanceRing}>
                  <b>93%</b>
                  <small>Hadir hari ini</small>
                </span>
              </div>
              <div>
                <small>Nilai rata-rata</small>
                <strong>86</strong>
                <small>dari 100</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption>Ilustrasi ruang kelas · data contoh</figcaption>
    </figure>
  );
}

export function DocumentPreviews() {
  return (
    <div className={styles.documentPreviews} aria-hidden="true">
      {["Modul Ajar", "Bank Soal", "Administrasi"].map((v, i) => (
        <div key={v}>
          <div className={styles.documentTitle}>
            <FileText />
            <div>
              <b>{v}</b>
              <small>
                {
                  [
                    "Rancang pembelajaran.",
                    "Susun bahan evaluasi.",
                    "Rapikan dokumen sekolah.",
                  ][i]
                }
              </small>
            </div>
          </div>
          <div className={styles.documentPaper}>
            <b>
              {
                [
                  "Tujuan Pembelajaran",
                  "Contoh pilihan ganda",
                  "Program Tahunan",
                ][i]
              }
            </b>
            {i === 0 ? (
              [
                "Memahami konsep",
                "Menyusun hasil pengamatan",
                "Menyampaikan kesimpulan",
              ].map((t) => (
                <span key={t}>
                  <Check />
                  {t}
                </span>
              ))
            ) : i === 1 ? (
              <>
                <p>Perubahan wujud zat dari padat menjadi gas disebut …</p>
                <span>◯ Menyublim</span>
                <span>◯ Mencair</span>
                <span>◯ Mengembun</span>
              </>
            ) : (
              <div className={styles.paperTable}>
                {[
                  "Bulan",
                  "Tema",
                  "Materi",
                  "Juli",
                  "Lingkungan",
                  "Sains",
                  "Agustus",
                  "Keluarga",
                  "Bahasa",
                ].map((t, n) => (
                  <span key={n}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LearningMark() {
  return (
    <div className={styles.learningMark} aria-hidden="true">
      <BookOpen />
      <Sparkles />
      <ChartNoAxesColumnIncreasing />
      <MessageSquare />
    </div>
  );
}
