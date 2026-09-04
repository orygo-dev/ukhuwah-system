import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';

class StudentPortalHero extends StatelessWidget {
  const StudentPortalHero({
    super.key,
    required this.name,
    required this.className,
    required this.schoolName,
    required this.teacherName,
  });
  final String name;
  final String className;
  final String schoolName;
  final String teacherName;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: const Color(0xFFDBEAFE)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x140F4C81),
            blurRadius: 30,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.blueSoft,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'PORTAL SISWA',
                    style: TextStyle(
                      color: AppColors.blue,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.1,
                    ),
                  ),
                ),
                const SizedBox(height: 13),
                Text(
                  'Halo, $name',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 7),
                const Text(
                  'Pantau tugas, ikuti pembelajaran, dan lihat perkembangan belajarmu dalam satu ruang.',
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: [
                    _HeroPill(icon: Icons.school_outlined, label: className),
                    const _HeroPill(
                      icon: Icons.calendar_month_outlined,
                      label: 'Tahun aktif',
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF2563EB), Color(0xFF06B6D4)],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'SEKOLAH',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  schoolName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 13),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .15),
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.co_present_outlined,
                        color: Colors.white,
                        size: 20,
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Text(
                          'Guru pendamping · $teacherName',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: AppColors.border),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.blue),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
}

class StudentIdentityCard extends StatelessWidget {
  const StudentIdentityCard({
    super.key,
    required this.name,
    required this.className,
    required this.schoolName,
    required this.teacherName,
    this.attendancePercent,
    this.onTap,
  });

  final String name;
  final String className;
  final String schoolName;
  final String teacherName;
  final int? attendancePercent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.hero),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF0F5FF), Colors.white],
          ),
          borderRadius: BorderRadius.circular(AppRadii.hero),
          border: Border.all(color: const Color(0xFFDDE7F6)),
          boxShadow: AppShadows.card,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  width: 58,
                  height: 58,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color(0xFFDDE7FF),
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    _initials(name),
                    style: const TextStyle(
                      color: AppColors.blue,
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        schoolName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.mutedLight,
                ),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _StudentIdentityItem(
                    icon: Icons.school_outlined,
                    label: 'Kelas',
                    value: className,
                    color: AppColors.blue,
                  ),
                ),
                const _IdentityDivider(),
                Expanded(
                  flex: 2,
                  child: _StudentIdentityItem(
                    icon: Icons.person_outline_rounded,
                    label: 'Wali kelas',
                    value: teacherName,
                    color: AppColors.violet,
                  ),
                ),
                if (attendancePercent != null) ...[
                  const _IdentityDivider(),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Hadir',
                        style: TextStyle(
                          color: AppColors.muted,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '$attendancePercent%',
                        style: const TextStyle(
                          color: AppColors.success,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    ),
  );

  String _initials(String value) {
    final words = value.trim().split(RegExp(r'\s+')).where((e) => e.isNotEmpty);
    return words.take(2).map((word) => word[0].toUpperCase()).join();
  }
}

class _IdentityDivider extends StatelessWidget {
  const _IdentityDivider();

  @override
  Widget build(BuildContext context) => Container(
    width: 1,
    height: 44,
    margin: const EdgeInsets.symmetric(horizontal: 9),
    color: AppColors.border,
  );
}

class _StudentIdentityItem extends StatelessWidget {
  const _StudentIdentityItem({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: color.withValues(alpha: .1),
          borderRadius: BorderRadius.circular(AppRadii.small),
        ),
        child: Icon(icon, color: color, size: 18),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.navy,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

class TeacherProfileHero extends StatelessWidget {
  const TeacherProfileHero({
    super.key,
    required this.name,
    required this.schoolName,
    required this.classCount,
    required this.studentCount,
    required this.credits,
    this.avatarUrl,
    this.classNames = const [],
    this.onProfile,
    this.onTopUp,
    this.onHistory,
    this.membershipPlanName,
  });

  final String name;
  final String schoolName;
  final int classCount;
  final int studentCount;
  final int credits;
  final String? avatarUrl;
  final List<String> classNames;
  final VoidCallback? onProfile;
  final VoidCallback? onTopUp;
  final VoidCallback? onHistory;
  final String? membershipPlanName;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [Color(0xFF0B3697), Color(0xFF075BD8), Color(0xFF1479F2)],
        stops: [0, .52, 1],
      ),
      borderRadius: BorderRadius.circular(AppRadii.hero),
      boxShadow: const [
        BoxShadow(
          color: Color(0x33204AD5),
          blurRadius: 28,
          offset: Offset(0, 14),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                InkWell(
                  onTap: onProfile,
                  borderRadius: BorderRadius.circular(48),
                  child: Container(
                    width: 64,
                    height: 64,
                    clipBehavior: Clip.antiAlias,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .18),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2.5),
                    ),
                    child: avatarUrl?.trim().isNotEmpty == true
                        ? Image.network(
                            avatarUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) =>
                                _ProfileInitial(name: name),
                          )
                        : _ProfileInitial(name: name),
                  ),
                ),
                Positioned(
                  right: 0,
                  bottom: 1,
                  child: Container(
                    width: 15,
                    height: 15,
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2.5),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 2),
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -.35,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    classNames.isEmpty
                        ? 'Guru'
                        : 'Guru • ${classNames.length} kelas aktif',
                    style: const TextStyle(
                      color: Color(0xFFEAF2FF),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            if (membershipPlanName?.trim().isNotEmpty == true)
              Container(
                margin: const EdgeInsets.only(top: 2),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .14),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white24),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.workspace_premium_rounded,
                      size: 14,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 5),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 82),
                      child: Text(
                        membershipPlanName!.toLowerCase().contains('member')
                            ? membershipPlanName!
                            : 'Member $membershipPlanName',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _TeacherIdentityMeta(
                icon: Icons.account_balance_outlined,
                value: schoolName,
              ),
            ),
            Container(
              width: 1,
              height: 18,
              margin: const EdgeInsets.symmetric(horizontal: 10),
              color: Colors.white30,
            ),
            Expanded(
              child: _TeacherIdentityMeta(
                icon: Icons.groups_2_outlined,
                value: classNames.isEmpty
                    ? '$classCount kelas'
                    : classNames.take(2).join(', '),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Container(height: 1, color: Colors.white30),
        const SizedBox(height: 10),
        Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .14),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.account_balance_wallet_outlined,
                color: Colors.white,
                size: 20,
              ),
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Saldo Kredit',
                    style: TextStyle(
                      color: Color(0xFFD7E7FF),
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    _formatCredits(credits),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -.3,
                    ),
                  ),
                ],
              ),
            ),
            FilledButton(
              onPressed: onTopUp,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.blue,
                minimumSize: const Size(72, 36),
                padding: const EdgeInsets.symmetric(horizontal: 11),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(11),
                ),
              ),
              child: const Text('+ Top Up', style: TextStyle(fontSize: 10.5)),
            ),
            const SizedBox(width: 7),
            OutlinedButton(
              onPressed: onHistory,
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                minimumSize: const Size(72, 36),
                padding: const EdgeInsets.symmetric(horizontal: 9),
                side: const BorderSide(color: Colors.white70),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(11),
                ),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.history_rounded, size: 14),
                  SizedBox(width: 4),
                  Text('Riwayat', style: TextStyle(fontSize: 10)),
                ],
              ),
            ),
          ],
        ),
      ],
    ),
  );

  String _formatCredits(int value) {
    return value.toString().replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (_) => '.',
    );
  }
}

class StudentProfileHero extends StatelessWidget {
  const StudentProfileHero({
    super.key,
    required this.name,
    required this.className,
    required this.schoolName,
    required this.teacherName,
    required this.attendancePercent,
    required this.followerCount,
    this.avatarUrl,
    this.avatarBytes,
    this.onProfile,
  });

  final String name;
  final String className;
  final String schoolName;
  final String teacherName;
  final int? attendancePercent;
  final int followerCount;
  final String? avatarUrl;
  final Uint8List? avatarBytes;
  final VoidCallback? onProfile;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [Color(0xFF0B3697), Color(0xFF075BD8), Color(0xFF1479F2)],
        stops: [0, .52, 1],
      ),
      borderRadius: BorderRadius.circular(AppRadii.hero),
      boxShadow: const [
        BoxShadow(
          color: Color(0x33204AD5),
          blurRadius: 28,
          offset: Offset(0, 14),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                InkWell(
                  key: const Key('student-profile-avatar'),
                  onTap: onProfile,
                  borderRadius: BorderRadius.circular(48),
                  child: Container(
                    width: 64,
                    height: 64,
                    clipBehavior: Clip.antiAlias,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .18),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2.5),
                    ),
                    child: avatarBytes != null
                        ? Image.memory(
                            avatarBytes!,
                            key: const Key('student-home-avatar-preview'),
                            width: double.infinity,
                            height: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) =>
                                _ProfileInitial(name: name),
                          )
                        : avatarUrl?.trim().isNotEmpty == true
                        ? Image.network(
                            avatarUrl!,
                            key: ValueKey('student-home-avatar-$avatarUrl'),
                            width: double.infinity,
                            height: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) =>
                                _ProfileInitial(name: name),
                          )
                        : _ProfileInitial(name: name),
                  ),
                ),
                Positioned(
                  right: 0,
                  bottom: 1,
                  child: Container(
                    width: 15,
                    height: 15,
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2.5),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -.35,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Siswa • $className',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFFEAF2FF),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 11),
        Row(
          children: [
            Expanded(
              child: _TeacherIdentityMeta(
                icon: Icons.account_balance_outlined,
                value: schoolName,
              ),
            ),
            Container(
              width: 1,
              height: 18,
              margin: const EdgeInsets.symmetric(horizontal: 10),
              color: Colors.white30,
            ),
            Expanded(
              child: _TeacherIdentityMeta(
                icon: Icons.co_present_outlined,
                value: teacherName,
              ),
            ),
          ],
        ),
        const SizedBox(height: 11),
        Container(height: 1, color: Colors.white30),
        const SizedBox(height: 11),
        Row(
          children: [
            Expanded(
              child: _StudentHeroMetric(
                icon: Icons.event_available_outlined,
                label: 'Kehadiran',
                value: attendancePercent == null ? '–' : '$attendancePercent%',
              ),
            ),
            Container(width: 1, height: 28, color: Colors.white30),
            Expanded(
              child: _StudentHeroMetric(
                icon: Icons.people_alt_rounded,
                label: 'Pengikut',
                value: '$followerCount',
              ),
            ),
            Container(width: 1, height: 28, color: Colors.white30),
            Expanded(
              child: _StudentHeroMetric(
                icon: Icons.school_outlined,
                label: 'Kelas',
                value: className,
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class _StudentHeroMetric extends StatelessWidget {
  const _StudentHeroMetric({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 7),
    child: Column(
      children: [
        Icon(icon, size: 18, color: Colors.white),
        const SizedBox(height: 4),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Color(0xFFD7E7FF),
            fontSize: 9,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _TeacherIdentityMeta extends StatelessWidget {
  const _TeacherIdentityMeta({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 17, color: Colors.white),
      const SizedBox(width: 7),
      Expanded(
        child: Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    ],
  );
}

@Deprecated('Use TeacherProfileHero')
class LegacyTeacherProfileHero extends StatelessWidget {
  const LegacyTeacherProfileHero({
    super.key,
    required this.name,
    required this.schoolName,
    required this.classCount,
    required this.studentCount,
    required this.credits,
    this.avatarUrl,
    this.classNames = const [],
    this.onProfile,
    this.onTopUp,
    this.onHistory,
    this.membershipPlanName,
  });
  final String name;
  final String schoolName;
  final int classCount;
  final int studentCount;
  final int credits;
  final String? avatarUrl;
  final List<String> classNames;
  final VoidCallback? onProfile;
  final VoidCallback? onTopUp;
  final VoidCallback? onHistory;
  final String? membershipPlanName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: AppGradients.brand,
        borderRadius: BorderRadius.circular(AppRadii.hero),
        boxShadow: AppShadows.floating,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  InkWell(
                    onTap: onProfile,
                    borderRadius: BorderRadius.circular(AppRadii.medium),
                    child: Container(
                      width: 60,
                      height: 60,
                      clipBehavior: Clip.antiAlias,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .18),
                        borderRadius: BorderRadius.circular(AppRadii.medium),
                        border: Border.all(color: Colors.white30, width: 2),
                      ),
                      child: avatarUrl?.trim().isNotEmpty == true
                          ? Image.network(
                              avatarUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) =>
                                  _ProfileInitial(name: name),
                            )
                          : _ProfileInitial(name: name),
                    ),
                  ),
                  if (membershipPlanName?.trim().isNotEmpty == true)
                    Positioned(
                      right: -4,
                      bottom: -4,
                      child: Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          color: const Color(0xFF2563EB),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                        child: const Icon(
                          Icons.workspace_premium_rounded,
                          size: 12,
                          color: Colors.white,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (membershipPlanName?.trim().isNotEmpty == true) ...[
                      const SizedBox(height: 5),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: .15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white24),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.workspace_premium_rounded,
                              size: 12,
                              color: Colors.white,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              membershipPlanName!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 3),
                    Text(
                      [
                        schoolName,
                        if (classNames.isNotEmpty)
                          'Kelas ${classNames.take(2).join(', ')}${classNames.length > 2 ? ' +${classNames.length - 2}' : ''}',
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onProfile,
                icon: const Icon(
                  Icons.chevron_right_rounded,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(AppRadii.medium),
              border: Border.all(color: Colors.white24),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.monetization_on_outlined,
                  color: Color(0xFFBAE6FD),
                  size: 21,
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'KREDIT',
                        style: TextStyle(
                          color: Colors.white60,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: .8,
                        ),
                      ),
                      Text(
                        '$credits',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
                FilledButton.icon(
                  onPressed: onTopUp,
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.blue,
                    minimumSize: const Size(0, 34),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(9),
                    ),
                  ),
                  icon: const Icon(Icons.add_rounded, size: 16),
                  label: const Text('Top Up', style: TextStyle(fontSize: 11)),
                ),
                const SizedBox(width: 6),
                OutlinedButton.icon(
                  onPressed: onHistory,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 34),
                    padding: const EdgeInsets.symmetric(horizontal: 9),
                    side: const BorderSide(color: Colors.white30),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(9),
                    ),
                  ),
                  icon: const Icon(Icons.history_rounded, size: 15),
                  label: const Text('Riwayat', style: TextStyle(fontSize: 11)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileInitial extends StatelessWidget {
  const _ProfileInitial({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) => Center(
    child: Text(
      name.isEmpty ? 'G' : name[0].toUpperCase(),
      style: const TextStyle(
        color: Colors.white,
        fontSize: 20,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

class QuickMenuItem {
  const QuickMenuItem({
    required this.label,
    required this.icon,
    required this.color,
    this.assetPath,
    this.iconUrl,
    this.subtitle,
    this.onTap,
  });
  final String label;
  final IconData icon;
  final Color color;
  final String? assetPath;
  final String? iconUrl;
  final String? subtitle;
  final VoidCallback? onTap;
}

class _QuickMenuFallbackIcon extends StatelessWidget {
  const _QuickMenuFallbackIcon({required this.item, required this.iconSize});

  final QuickMenuItem item;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final assetPath = item.assetPath?.trim() ?? '';
    if (assetPath.isEmpty) {
      return Icon(item.icon, color: item.color, size: iconSize);
    }
    return Image.asset(
      assetPath,
      key: ValueKey('quick-menu-asset-${item.label}'),
      fit: BoxFit.cover,
      cacheWidth: 144,
      cacheHeight: 144,
      excludeFromSemantics: true,
      errorBuilder: (_, _, _) =>
          Icon(item.icon, color: item.color, size: iconSize),
    );
  }
}

class QuickAccessRail extends StatelessWidget {
  const QuickAccessRail({super.key, required this.items});
  final List<QuickMenuItem> items;

  @override
  Widget build(BuildContext context) => Row(
    children: List.generate(items.length, (index) {
      final item = items[index];
      return Expanded(
        child: Padding(
          padding: EdgeInsets.only(left: index == 0 ? 0 : 8),
          child: Material(
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadii.medium),
              side: const BorderSide(color: AppColors.border),
            ),
            child: InkWell(
              onTap: item.onTap,
              borderRadius: BorderRadius.circular(AppRadii.medium),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 7,
                  vertical: 12,
                ),
                child: Column(
                  children: [
                    Icon(item.icon, color: item.color, size: 23),
                    const SizedBox(height: 7),
                    Text(
                      item.label,
                      maxLines: 2,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 10.5,
                        height: 1.1,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }),
  );
}

class InsightMetric {
  const InsightMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.helper,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String? helper;
}

class InsightStrip extends StatelessWidget {
  const InsightStrip({super.key, required this.items, this.title, this.period});

  final List<InsightMetric> items;
  final String? title;
  final String? period;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: EdgeInsets.fromLTRB(0, title == null ? 18 : 14, 0, 18),
      child: Column(
        children: [
          if (title != null) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 14, 13),
              child: Row(
                children: [
                  const Icon(
                    Icons.trending_up_rounded,
                    size: 20,
                    color: AppColors.success,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title!,
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  if (period != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.border),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            period!,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 3),
                          const Icon(
                            Icons.expand_more_rounded,
                            size: 14,
                            color: AppColors.muted,
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            const SizedBox(height: 15),
          ],
          Row(
            children: List.generate(items.length, (index) {
              final item = items[index];
              return Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  decoration: BoxDecoration(
                    border: index == 0
                        ? null
                        : const Border(
                            left: BorderSide(color: AppColors.border),
                          ),
                  ),
                  child: Column(
                    children: [
                      Icon(item.icon, color: item.color, size: 21),
                      const SizedBox(height: 7),
                      Text(
                        item.value,
                        style: const TextStyle(
                          color: AppColors.navy,
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        item.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (item.helper != null)
                        Text(
                          item.helper!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: item.color,
                            fontSize: 8.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    ),
  );
}

class QuickMenuGrid extends StatelessWidget {
  const QuickMenuGrid({
    super.key,
    required this.items,
    this.title = 'Menu Utama',
    this.dense = false,
    this.frameless = false,
  });
  final String title;
  final List<QuickMenuItem> items;
  final bool dense;
  final bool frameless;

  @override
  Widget build(BuildContext context) {
    final extent = frameless ? 96.0 : (dense ? 88.0 : 104.0);
    final iconBox = dense ? 38.0 : 46.0;
    final iconSize = dense ? 19.0 : 23.0;
    final labelSize = frameless ? 10.2 : (dense ? 9.8 : 10.5);
    final cellPad = frameless ? 0.0 : (dense ? 2.0 : 3.0);
    final radius = dense ? 14.0 : 16.0;

    return Container(
      decoration: frameless
          ? null
          : BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadii.hero),
              border: Border.all(color: AppColors.border),
              boxShadow: AppShadows.card,
            ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: frameless ? 0 : (dense ? 8 : 10),
          vertical: frameless ? 0 : (dense ? 8 : 12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: items.length,
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 4,
                mainAxisExtent: extent,
                crossAxisSpacing: frameless ? 6 : 0,
                mainAxisSpacing: frameless ? 4 : 0,
              ),
              itemBuilder: (context, index) {
                final item = items[index];
                final usesAsset = item.assetPath?.isNotEmpty == true;
                final usesNetworkIcon = item.iconUrl?.trim().isNotEmpty == true;
                final usesImage = usesAsset || usesNetworkIcon;
                return Padding(
                  padding: EdgeInsets.all(cellPad),
                  child: Material(
                    color: frameless
                        ? Colors.transparent
                        : usesImage
                        ? Colors.white
                        : item.color.withValues(alpha: .045),
                    borderRadius: BorderRadius.circular(radius),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(radius),
                      onTap: item.onTap,
                      child: Container(
                        decoration: frameless
                            ? null
                            : BoxDecoration(
                                borderRadius: BorderRadius.circular(radius),
                                border: Border.all(
                                  color: usesImage
                                      ? const Color(0xFFE3EAF5)
                                      : item.color.withValues(alpha: .2),
                                ),
                              ),
                        child: Column(
                          mainAxisAlignment: frameless
                              ? MainAxisAlignment.start
                              : MainAxisAlignment.center,
                          children: [
                            Container(
                              width: usesImage && dense
                                  ? (frameless ? 64 : 48)
                                  : iconBox,
                              height: usesImage && dense
                                  ? (frameless ? 64 : 48)
                                  : iconBox,
                              decoration: BoxDecoration(
                                gradient: usesImage
                                    ? null
                                    : LinearGradient(
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                        colors: [
                                          Colors.white,
                                          item.color.withValues(alpha: .13),
                                        ],
                                      ),
                                borderRadius: BorderRadius.circular(
                                  dense ? 12 : 15,
                                ),
                                border: usesImage
                                    ? null
                                    : Border.all(
                                        color: item.color.withValues(alpha: .2),
                                      ),
                                boxShadow: usesImage
                                    ? null
                                    : [
                                        BoxShadow(
                                          color: item.color.withValues(
                                            alpha: .14,
                                          ),
                                          blurRadius: dense ? 8 : 11,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                              ),
                              child: usesImage
                                  ? ClipRRect(
                                      borderRadius: BorderRadius.circular(
                                        dense ? 12 : 15,
                                      ),
                                      child: usesNetworkIcon
                                          ? Image.network(
                                              item.iconUrl!,
                                              key: ValueKey(
                                                'quick-menu-network-${item.label}-${item.iconUrl}',
                                              ),
                                              fit: BoxFit.cover,
                                              cacheWidth: 144,
                                              cacheHeight: 144,
                                              excludeFromSemantics: true,
                                              errorBuilder: (_, _, _) =>
                                                  _QuickMenuFallbackIcon(
                                                    item: item,
                                                    iconSize: iconSize,
                                                  ),
                                            )
                                          : _QuickMenuFallbackIcon(
                                              item: item,
                                              iconSize: iconSize,
                                            ),
                                    )
                                  : Icon(
                                      item.icon,
                                      color: item.color,
                                      size: iconSize,
                                    ),
                            ),
                            SizedBox(height: frameless ? 3 : (dense ? 5 : 7)),
                            Text(
                              item.label,
                              maxLines: 2,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: labelSize,
                                height: 1.05,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            if (item.subtitle != null) ...[
                              const SizedBox(height: 3),
                              Text(
                                item.subtitle!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 8.2,
                                  height: 1,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.helper,
  });
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String? helper;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 21),
            ),
            const Spacer(),
            Text(
              value,
              style: const TextStyle(
                fontSize: 23,
                fontWeight: FontWeight.w900,
                color: AppColors.navy,
              ),
            ),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.muted,
              ),
            ),
            if (helper != null) ...[
              const SizedBox(height: 2),
              Text(
                helper!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 10, color: AppColors.muted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class SectionHeading extends StatelessWidget {
  const SectionHeading({
    super.key,
    required this.title,
    this.subtitle,
    this.action,
    this.onAction,
  });
  final String title;
  final String? subtitle;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              if (subtitle != null)
                Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!)),
      ],
    );
  }
}

class EmptyCard extends StatelessWidget {
  const EmptyCard({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(26),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: const BoxDecoration(
                  color: AppColors.blueSoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 28, color: AppColors.blue),
              ),
              const SizedBox(height: 14),
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
