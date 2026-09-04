import 'package:flutter/material.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/update/app_update_service.dart';

class AppUpdateScreen extends StatelessWidget {
  const AppUpdateScreen({
    super.key,
    required this.info,
    required this.progress,
    required this.busy,
    required this.onUpdate,
    required this.onLater,
    required this.onOpenStore,
    this.error,
  });

  final AppUpdateInfo info;
  final AppUpdateProgress? progress;
  final bool busy;
  final VoidCallback onUpdate;
  final VoidCallback? onLater;
  final VoidCallback onOpenStore;
  final String? error;

  bool get _downloaded =>
      progress?.status == AppUpdateInstallStatus.downloaded ||
      info.installStatus == AppUpdateInstallStatus.downloaded;

  bool get _downloading =>
      progress?.status == AppUpdateInstallStatus.downloading ||
      progress?.status == AppUpdateInstallStatus.pending;

  @override
  Widget build(BuildContext context) {
    final versionLabel = info.availableVersionCode > 0
        ? 'Build ${info.availableVersionCode}'
        : 'Pembaruan terbaru';
    return Scaffold(
      key: const Key('app-update-page'),
      backgroundColor: const Color(0xFFF8FBFF),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF5FAF6), Color(0xFFE8F6EA)],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 18, 22, 24),
            child: Column(
              children: [
                Image.asset(
                  'assets/branding/genpro_logo_full.png',
                  key: const Key('app-update-logo'),
                  width: 158,
                  fit: BoxFit.contain,
                ),
                const SizedBox(height: 22),
                const _UpdateIllustration(),
                const SizedBox(height: 22),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(22, 24, 22, 21),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x142B67C9),
                        blurRadius: 28,
                        offset: Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Text(
                        info.required
                            ? 'Pembaruan diperlukan'
                            : 'Versi baru tersedia',
                        key: const Key('app-update-title'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.navy,
                          fontSize: 28,
                          height: 1.1,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 15,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF5FAF6),
                          border: Border.all(color: const Color(0xFF7EB8FF)),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          versionLabel,
                          key: const Key('app-update-version'),
                          style: const TextStyle(
                            color: Color(0xFF145BCC),
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(height: 13),
                      Text(
                        info.required
                            ? 'Perbarui GenPro untuk melanjutkan dengan aman.'
                            : 'Lebih cepat, lebih aman, dan semakin nyaman digunakan.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 15,
                          height: 1.45,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 18),
                        child: Divider(height: 1),
                      ),
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Yang baru',
                          style: TextStyle(
                            color: AppColors.navy,
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      const _ReleaseNote(
                        text: 'Zona Kreasi menggantikan Spotlight',
                      ),
                      const _ReleaseNote(text: 'Tampilan Mading lebih modern'),
                      const _ReleaseNote(
                        text: 'Peningkatan stabilitas dan keamanan',
                      ),
                      if (_downloading) ...[
                        const SizedBox(height: 16),
                        LinearProgressIndicator(
                          key: const Key('app-update-progress'),
                          value: progress?.fraction,
                          minHeight: 8,
                          borderRadius: BorderRadius.circular(99),
                          backgroundColor: const Color(0xFFE6EEF9),
                          color: const Color(0xFF1477ED),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Mengunduh pembaruan…',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (error != null) ...[
                  const SizedBox(height: 14),
                  Text(
                    error!,
                    key: const Key('app-update-error'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFFB42318),
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: FilledButton(
                    key: const Key('app-update-primary'),
                    onPressed: busy ? null : onUpdate,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF0877EA),
                      disabledBackgroundColor: const Color(0xFF8CB9E8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                    child: Text(
                      busy
                          ? 'Menyiapkan pembaruan…'
                          : _downloaded
                          ? 'Pasang & Mulai Ulang'
                          : 'Perbarui Sekarang',
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
                if (onLater != null) ...[
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton(
                      key: const Key('app-update-later'),
                      onPressed: busy ? null : onLater,
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFF2184ED)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                      child: const Text(
                        'Nanti',
                        style: TextStyle(
                          color: Color(0xFF1268D5),
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ],
                if (error != null) ...[
                  TextButton(
                    key: const Key('app-update-store-fallback'),
                    onPressed: onOpenStore,
                    child: const Text('Buka halaman Google Play'),
                  ),
                ],
                const SizedBox(height: 14),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.shield_rounded,
                      color: Color(0xFF1772DB),
                      size: 20,
                    ),
                    SizedBox(width: 7),
                    Flexible(
                      child: Text(
                        'Data dan sesi login Anda tetap aman.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _UpdateIllustration extends StatelessWidget {
  const _UpdateIllustration();

  @override
  Widget build(BuildContext context) => Container(
    width: 188,
    height: 166,
    decoration: BoxDecoration(
      color: const Color(0xFFDFF2FF),
      borderRadius: BorderRadius.circular(52),
    ),
    child: Stack(
      alignment: Alignment.center,
      children: [
        Positioned(
          right: 21,
          top: 20,
          child: Transform.rotate(
            angle: .18,
            child: const Icon(
              Icons.auto_awesome_rounded,
              color: Color(0xFFFFBF22),
              size: 27,
            ),
          ),
        ),
        Container(
          width: 99,
          height: 142,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF92D5FF), Color(0xFF459BEF)],
            ),
            border: Border.all(color: const Color(0xFF1768D2), width: 4),
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33216FC6),
                blurRadius: 18,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(
            Icons.cloud_download_rounded,
            color: Colors.white,
            size: 57,
          ),
        ),
      ],
    ),
  );
}

class _ReleaseNote extends StatelessWidget {
  const _ReleaseNote({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(
      children: [
        const CircleAvatar(
          radius: 12,
          backgroundColor: Color(0xFF1976E9),
          child: Icon(Icons.check_rounded, size: 16, color: Colors.white),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              color: Color(0xFF26364F),
              fontSize: 14,
              height: 1.3,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );
}
