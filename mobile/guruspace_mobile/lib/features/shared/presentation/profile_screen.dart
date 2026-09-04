import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/spotlight_admob_slide.dart';
import 'package:url_launcher/url_launcher.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key, required this.user, this.embedded = false});
  final AppUser user;
  final bool embedded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return CustomScrollView(
      slivers: [
        if (!embedded) const SliverAppBar.large(title: Text('Profil')),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
          sliver: SliverList.list(
            children: [
              Container(
                decoration: BoxDecoration(
                  gradient: AppGradients.brand,
                  borderRadius: BorderRadius.circular(AppRadii.hero),
                  boxShadow: AppShadows.floating,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 34,
                        backgroundColor: Colors.white.withValues(alpha: .18),
                        child: Text(
                          user.name.isEmpty ? 'G' : user.name[0].toUpperCase(),
                          style: const TextStyle(
                            fontSize: 27,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 19,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              user.email,
                              style: const TextStyle(color: Colors.white70),
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                _ProfileBadge(
                                  icon: user.role == UserRole.student
                                      ? Icons.school_outlined
                                      : Icons.co_present_outlined,
                                  label: user.role == UserRole.student
                                      ? 'Siswa'
                                      : 'Guru',
                                ),
                                if (user.membershipPlan != null)
                                  _ProfileBadge(
                                    icon: Icons.workspace_premium_rounded,
                                    label: user.membershipPlan!.name,
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (user.role == UserRole.teacher) ...[
                const SizedBox(height: 14),
                Card(
                  child: ListTile(
                    leading: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.blueSoft,
                        borderRadius: BorderRadius.circular(AppRadii.medium),
                      ),
                      child: const Icon(
                        Icons.account_balance_wallet_outlined,
                        color: AppColors.blue,
                      ),
                    ),
                    title: const Text(
                      'Kredit GuruSpace',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: const Text('Saldo untuk fitur AI'),
                    trailing: Text(
                      '${user.creditsRemaining}',
                      style: const TextStyle(
                        color: AppColors.blue,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Card(
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    _ProfileTile(
                      icon: Icons.person_outline_rounded,
                      label: 'Data pribadi',
                      onTap: () =>
                          _openAccountPage(context, title: 'Data Pribadi'),
                    ),
                    const Divider(height: 1),
                    _ProfileTile(
                      icon: Icons.security_rounded,
                      label: 'Keamanan akun',
                      onTap: () =>
                          _openAccountPage(context, title: 'Keamanan Akun'),
                    ),
                    const Divider(height: 1),
                    _ProfileTile(
                      icon: Icons.policy_outlined,
                      label: 'Kebijakan privasi',
                      onTap: () => _openPrivacyPolicy(context),
                    ),
                    const Divider(height: 1),
                    _ProfileTile(
                      icon: Icons.privacy_tip_outlined,
                      label: 'Privasi iklan',
                      onTap: () => _openAdPrivacy(context),
                    ),
                    const Divider(height: 1),
                    _ProfileTile(
                      icon: Icons.help_outline_rounded,
                      label: 'Bantuan',
                      onTap: () => showDialog<void>(
                        context: context,
                        builder: (_) => const AlertDialog(
                          title: Text('Bantuan GuruSpace'),
                          content: Text(
                            'Hubungi administrator sekolah atau Dinas Pendidikan jika Anda mengalami kendala akun dan layanan.',
                          ),
                        ),
                      ),
                    ),
                    const Divider(height: 1),
                    _ProfileTile(
                      icon: Icons.info_outline_rounded,
                      label: 'Tentang GuruSpace',
                      onTap: () => showAboutDialog(
                        context: context,
                        applicationName: 'GuruSpace',
                        applicationVersion: '1.0.0',
                        applicationLegalese:
                            'Platform pembelajaran digital untuk guru dan siswa.',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: () => _confirmLogout(context, ref),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  minimumSize: const Size.fromHeight(52),
                  side: const BorderSide(color: Color(0xFFFECACA)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                icon: const Icon(Icons.logout_rounded),
                label: const Text('Keluar dari Akun'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _openAccountPage(BuildContext context, {required String title}) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: Text(
          '${user.name}\n${user.email}\n\n${user.role == UserRole.student ? 'Perubahan data akun siswa dikelola oleh administrator sekolah.' : 'Pengelolaan akun guru dilakukan langsung melalui profil GuruSpace.'}',
        ),
      ),
    );
  }

  Future<void> _openAdPrivacy(BuildContext context) async {
    final shown = await SpotlightAdmobGate.showPrivacyOptionsIfRequired();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          shown
              ? 'Pilihan privasi iklan berhasil diperbarui.'
              : 'Tidak ada pilihan privasi iklan yang perlu diubah saat ini.',
        ),
      ),
    );
  }

  Future<void> _openPrivacyPolicy(BuildContext context) async {
    final path = user.role == UserRole.student
        ? '/privacy/siswa'
        : '/privacy/guru';
    final uri = Uri.parse(AppConfig.baseUrl).resolve(path);
    var opened = false;
    try {
      opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      opened = false;
    }
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kebijakan privasi belum dapat dibuka.')),
      );
    }
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Keluar dari akun?'),
        content: const Text(
          'Anda perlu login kembali untuk menggunakan GuruSpace.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(authControllerProvider.notifier).logout();
    }
  }
}

class _ProfileBadge extends StatelessWidget {
  const _ProfileBadge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .14),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: Colors.white24),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.white),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      minTileHeight: 58,
      leading: Icon(icon, color: AppColors.blue),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    );
  }
}
