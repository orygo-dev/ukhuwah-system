# Play Store checklist — GenPro / GuruSpace

## Sudah disiapkan di repo

- [x] Upload keystore PKCS12 (`android/app/upload-keystore.p12`, **gitignored**)
- [x] `android/key.properties` (**gitignored**) — password + alias
- [x] Release signing di `android/app/build.gradle.kts`
- [x] Template `android/key.properties.example`
- [x] Script build: `tool/build_play_aab.ps1`
- [x] Backup lokal: `%USERPROFILE%\Documents\GenPro-PlayStore-Keystore-BACKUP` (**simpan di USB/cloud private**)

## Package ID

| App | applicationId | Flavor | Entry |
|-----|---------------|--------|-------|
| Siswa | `com.genpro.app` | student | `lib/main.dart` |
| Guru | `com.genpro.teacher` | teacher | `lib/main_teacher.dart` |

Keduanya adalah listing **terpisah** di Play Console.

## Build AAB (signed)

Jalankan lewat junction (hindari apostrophe di path):

```bat
cd /d C:\gs-mobile
powershell -ExecutionPolicy Bypass -File tool\build_play_aab.ps1 -Flavor student
powershell -ExecutionPolicy Bypass -File tool\build_play_aab.ps1 -Flavor teacher
```

Output:

- `build/app/outputs/bundle/studentRelease/app-student-release.aab`
- `build/app/outputs/bundle/teacherRelease/app-teacher-release.aab`

## Play Console (manual)

1. Buat app baru (satu untuk student, satu untuk teacher jika keduanya dipublish).
2. Aktifkan **Play App Signing** (default) — upload keystore di atas = *upload key*.
3. Upload AAB ke track **Internal testing** dulu.
4. Isi store listing: ikon 512×512, feature graphic 1024×500, screenshot, deskripsi singkat/panjang.
5. **Privacy policy URL** (wajib — app pakai kamera, mikrofon, notifikasi):
   `https://guruspaceai.cloud/privacy/siswa`
   (halaman: `src/app/privacy/siswa/page.tsx` — deploy server dulu agar URL hidup).
6. **Data safety** form.
7. Deklarasi permission sensitif (kamera/mic untuk kelas live/PJJ).
8. Content rating questionnaire.
9. Target audience / Families policy jika relevan untuk siswa.
10. Naikkan `version:` di `pubspec.yaml` setiap rilis (`1.0.0+1` → `1.0.1+2`, angka setelah `+` = versionCode, harus naik).
11. Set AdMob App ID sebelum build release:
    - Salin `android/admob.properties.example` → `android/admob.properties`, atau
    - Set env `ADMOB_STUDENT_APP_ID` / `ADMOB_TEACHER_APP_ID`
    - Ambil dari AdMob Console → Apps → App settings → App ID (`ca-app-pub-…~…`)

## Jangan

- Jangan commit `key.properties` / `*.p12` / `*.jks`
- Jangan hilangkan backup keystore
- Jangan upload AAB yang masih signed dengan **debug** key
