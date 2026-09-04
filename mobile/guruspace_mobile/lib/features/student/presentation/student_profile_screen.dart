import 'dart:io';
import 'dart:typed_data';

import 'package:crop_your_image/crop_your_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/network/api_exception.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/shared/presentation/notifications_screen.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_models.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/spotlight_admob_slide.dart';
import 'package:guruspace_mobile/features/student/presentation/student_mading_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_spotlight_screen.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

class StudentProfileScreen extends ConsumerStatefulWidget {
  const StudentProfileScreen({
    super.key,
    required this.user,
    this.showBackButton = false,
    this.onUserChanged,
  });

  final AppUser user;
  final bool showBackButton;
  final ValueChanged<AppUser>? onUserChanged;

  @override
  ConsumerState<StudentProfileScreen> createState() =>
      _StudentProfileScreenState();
}

class _StudentProfileScreenState extends ConsumerState<StudentProfileScreen> {
  late String? _avatarUrl;
  String? _localAvatarPath;
  Uint8List? _localAvatarBytes;
  bool _uploadingAvatar = false;

  @override
  void initState() {
    super.initState();
    _avatarUrl = widget.user.avatarUrl;
  }

  @override
  void didUpdateWidget(covariant StudentProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.id != widget.user.id) {
      _avatarUrl = widget.user.avatarUrl;
      _localAvatarPath = null;
      _localAvatarBytes = null;
      _uploadingAvatar = false;
      return;
    }
    if (oldWidget.user.avatarUrl != widget.user.avatarUrl ||
        !identical(oldWidget.user.avatarBytes, widget.user.avatarBytes)) {
      _avatarUrl = widget.user.avatarUrl;
      _localAvatarPath = null;
      _localAvatarBytes = widget.user.avatarBytes;
    }
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(studentDashboardProvider);
    final works = ref.watch(studentWorksProvider);
    return ColoredBox(
      color: AppColors.canvas,
      child: dashboard.when(
        loading: () => const LoadingView(label: 'Menyiapkan profil...'),
        error: (error, _) => ErrorView(
          message: '$error',
          onRetry: () => ref.invalidate(studentDashboardProvider),
        ),
        data: (data) => _StudentProfileContent(
          user: widget.user.copyWith(avatarUrl: _avatarUrl),
          data: data,
          works: works,
          showBackButton: widget.showBackButton,
          avatarUploading: _uploadingAvatar,
          localAvatarPath: _localAvatarPath,
          avatarBytes: _localAvatarBytes ?? widget.user.avatarBytes,
          onChangePhoto: _pickAvatar,
          onChangePassword: () => _showChangePassword(context),
          onPrivacyPolicy: () => _openPrivacyPolicy(context),
          onAdPrivacy: () => _showAdPrivacy(context),
          onLogout: () => _confirmLogout(context),
          onRetryWorks: () => ref.invalidate(studentWorksProvider),
        ),
      ),
    );
  }

  Future<void> _pickAvatar() async {
    if (_uploadingAvatar) return;
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp'],
      allowMultiple: false,
      withData: false,
    );
    final file = result?.files.singleOrNull;
    final path = file?.path;
    if (!mounted || file == null || path == null) return;
    if (file.size > 3 * 1024 * 1024) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ukuran foto maksimal 3 MB.')),
      );
      return;
    }
    final sourceBytes = await File(path).readAsBytes();
    if (!mounted) return;
    final croppedBytes = await showDialog<Uint8List>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _AvatarCropDialog(image: sourceBytes),
    );
    if (!mounted || croppedBytes == null || croppedBytes.isEmpty) return;
    setState(() => _uploadingAvatar = true);
    File? temporaryCrop;
    try {
      final temporaryDirectory = await getTemporaryDirectory();
      temporaryCrop = File(
        '${temporaryDirectory.path}${Platform.pathSeparator}genpro-avatar-${DateTime.now().microsecondsSinceEpoch}.jpg',
      );
      await temporaryCrop.writeAsBytes(croppedBytes, flush: true);
      final avatarUrl = await ref
          .read(authRepositoryProvider)
          .uploadStudentAvatar(
            filePath: temporaryCrop.path,
            fileName: 'avatar.jpg',
          );
      if (!mounted) return;
      setState(() {
        _avatarUrl = avatarUrl;
        _localAvatarPath = null;
        _localAvatarBytes = croppedBytes;
      });
      ref
          .read(authControllerProvider.notifier)
          .updateAvatarUrl(avatarUrl, avatarBytes: croppedBytes);
      widget.onUserChanged?.call(
        widget.user.copyWith(avatarUrl: avatarUrl, avatarBytes: croppedBytes),
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Foto profil berhasil diperbarui.')),
      );
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Foto profil belum dapat disimpan.')),
        );
      }
    } finally {
      try {
        await temporaryCrop?.delete();
      } catch (_) {
        // Temporary crop cleanup is best effort and never masks upload result.
      }
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  Future<void> _showChangePassword(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StudentChangePasswordSheet(
        onSubmit: ({required currentPassword, required newPassword}) => ref
            .read(authRepositoryProvider)
            .changePassword(
              currentPassword: currentPassword,
              newPassword: newPassword,
            ),
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Keluar dari akun?'),
        content: const Text(
          'Anda perlu login kembali untuk menggunakan GenPro.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            key: const Key('student-profile-confirm-logout'),
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

  Future<void> _showAdPrivacy(BuildContext context) async {
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
    final uri = Uri.parse(AppConfig.baseUrl).resolve('/privacy/siswa');
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
}

class _StudentProfileContent extends StatelessWidget {
  const _StudentProfileContent({
    required this.user,
    required this.data,
    required this.works,
    required this.showBackButton,
    required this.avatarUploading,
    required this.localAvatarPath,
    required this.avatarBytes,
    required this.onChangePhoto,
    required this.onChangePassword,
    required this.onPrivacyPolicy,
    required this.onAdPrivacy,
    required this.onLogout,
    required this.onRetryWorks,
  });

  final AppUser user;
  final StudentDashboard data;
  final AsyncValue<StudentWorks> works;
  final bool showBackButton;
  final bool avatarUploading;
  final String? localAvatarPath;
  final Uint8List? avatarBytes;
  final VoidCallback onChangePhoto;
  final VoidCallback onChangePassword;
  final VoidCallback onPrivacyPolicy;
  final VoidCallback onAdPrivacy;
  final VoidCallback onLogout;
  final VoidCallback onRetryWorks;

  @override
  Widget build(BuildContext context) {
    final badges = _profileBadges(data);
    final attendance = data.attendancePercent;

    return CustomScrollView(
      key: const Key('student-profile-scroll'),
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.bottomCenter,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 40),
                    child: _IdentityHero(
                      user: user,
                      data: data,
                      showBackButton: showBackButton,
                      avatarUploading: avatarUploading,
                      localAvatarPath: localAvatarPath,
                      avatarBytes: avatarBytes,
                      onChangePhoto: onChangePhoto,
                    ),
                  ),
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 0,
                    child: _StatsStrip(
                      attendanceLabel: attendance == null
                          ? '—'
                          : '$attendance%',
                      followerLabel: '${data.followerCount}',
                      schoolLabel: data.schoolName,
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (badges.isNotEmpty) ...[
                      const _SectionLabel(title: 'Pencapaian'),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 86,
                        child: ListView.separated(
                          key: const Key('student-profile-badges'),
                          scrollDirection: Axis.horizontal,
                          itemCount: badges.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 10),
                          itemBuilder: (context, index) =>
                              _BadgeChip(badge: badges[index]),
                        ),
                      ),
                      const SizedBox(height: 18),
                    ],
                    const _SectionLabel(title: 'Karya'),
                    const SizedBox(height: 10),
                    _StudentWorksShowcase(
                      user: user,
                      works: works,
                      onRetry: onRetryWorks,
                    ),
                    const SizedBox(height: 22),
                    const _SectionLabel(title: 'Tentang saya'),
                    const SizedBox(height: 10),
                    _AboutCard(
                      key: const Key('student-profile-personal-info'),
                      rows: {
                        'Nama': data.name,
                        'Email': user.email,
                        'Kelas': data.className,
                        'Wali kelas': data.teacherName,
                        'Sekolah': data.schoolName,
                        'Peran': 'Siswa',
                      },
                    ),
                    const SizedBox(height: 22),
                    const _SectionLabel(title: 'Akun'),
                    const SizedBox(height: 10),
                    _AccountActions(
                      onChangePassword: onChangePassword,
                      onPrivacyPolicy: onPrivacyPolicy,
                      onAdPrivacy: onAdPrivacy,
                      onLogout: onLogout,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StudentWorksShowcase extends StatelessWidget {
  const _StudentWorksShowcase({
    required this.user,
    required this.works,
    required this.onRetry,
  });

  final AppUser user;
  final AsyncValue<StudentWorks> works;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('student-profile-works'),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF0B5A26), Color(0xFF007A33)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(24),
      boxShadow: const [
        BoxShadow(
          color: Color(0x33007A33),
          blurRadius: 24,
          offset: Offset(0, 12),
        ),
      ],
    ),
    child: works.when(
      loading: () => const SizedBox(
        height: 190,
        child: Center(child: CircularProgressIndicator(color: Colors.white)),
      ),
      error: (_, _) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              color: Colors.white70,
              size: 34,
            ),
            const SizedBox(height: 10),
            const Text(
              'Karya belum dapat dimuat',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
              child: const Text('Coba lagi'),
            ),
          ],
        ),
      ),
      data: (data) => Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(24),
        clipBehavior: Clip.antiAlias,
        child: _WorksShowcaseData(user: user, data: data),
      ),
    ),
  );
}

class _WorksShowcaseData extends StatelessWidget {
  const _WorksShowcaseData({required this.user, required this.data});

  final AppUser user;
  final StudentWorks data;

  @override
  Widget build(BuildContext context) {
    final previews = <_WorkPreview>[
      ...data.mading.map(_WorkPreview.mading),
      ...data.spotlight.map(_WorkPreview.spotlight),
    ]..sort((a, b) => b.date.compareTo(a.date));
    return InkWell(
      key: const Key('student-profile-open-works'),
      onTap: () => Navigator.of(context).push<void>(
        MaterialPageRoute(builder: (_) => StudentWorksScreen(user: user)),
      ),
      borderRadius: BorderRadius.circular(24),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: const Icon(Icons.palette_rounded, color: Colors.white),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Portofolio Karya',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Mading dan Zona Kreasi yang sudah kamu buat',
                        style: TextStyle(
                          color: Color(0xFFC6EBC9),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_rounded, color: Colors.white),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _WorkCount(label: 'Mading', count: data.mading.length),
                const SizedBox(width: 8),
                _WorkCount(label: 'Zona Kreasi', count: data.spotlight.length),
                const SizedBox(width: 8),
                _WorkCount(label: 'Total', count: data.total),
              ],
            ),
            const SizedBox(height: 14),
            if (previews.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Text(
                  'Belum ada karya. Karya pertamamu akan tampil di sini.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFFE8F6EA), fontSize: 12),
                ),
              )
            else
              SizedBox(
                height: 118,
                child: ListView.separated(
                  physics: const BouncingScrollPhysics(),
                  scrollDirection: Axis.horizontal,
                  itemCount: previews.length > 5 ? 5 : previews.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 9),
                  itemBuilder: (_, index) => _WorkPreviewTile(
                    key: ValueKey('profile-work-${previews[index].id}'),
                    item: previews[index],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _WorkCount extends StatelessWidget {
  const _WorkCount({required this.label, required this.count});

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: .12)),
      ),
      child: Column(
        children: [
          Text(
            '$count',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: Color(0xFFC6EBC9), fontSize: 10),
          ),
        ],
      ),
    ),
  );
}

class _WorkPreview {
  const _WorkPreview({
    required this.id,
    required this.title,
    required this.date,
    required this.kind,
    this.imageUrl,
  });

  factory _WorkPreview.mading(StudentBoardItem item) => _WorkPreview(
    id: item.id,
    title: item.title,
    date: item.publishedAt,
    kind: 'Mading',
    imageUrl: item.imageUrl,
  );

  factory _WorkPreview.spotlight(StudentSpotlightItem item) => _WorkPreview(
    id: item.id,
    title: item.caption,
    date: item.publishedAt,
    kind: 'Zona Kreasi',
    imageUrl:
        item.thumbnailUrl ??
        (isSpotlightImageUrl(item.videoUrl) ? item.videoUrl : null),
  );

  final String id;
  final String title;
  final DateTime date;
  final String kind;
  final String? imageUrl;
}

class _WorkPreviewTile extends StatelessWidget {
  const _WorkPreviewTile({super.key, required this.item});

  final _WorkPreview item;

  @override
  Widget build(BuildContext context) => Container(
    width: 102,
    decoration: BoxDecoration(
      color: const Color(0xFF0B5A26),
      borderRadius: BorderRadius.circular(15),
      border: Border.all(color: Colors.white.withValues(alpha: .14)),
    ),
    clipBehavior: Clip.antiAlias,
    child: Stack(
      fit: StackFit.expand,
      children: [
        _WorkImage(url: item.imageUrl, kind: item.kind),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Colors.transparent, Color(0xE600102D)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
        Positioned(
          left: 8,
          right: 8,
          bottom: 8,
          child: Text(
            item.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              height: 1.15,
            ),
          ),
        ),
      ],
    ),
  );
}

class StudentWorksScreen extends ConsumerWidget {
  const StudentWorksScreen({super.key, required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final works = ref.watch(studentWorksProvider);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        key: const Key('student-works-screen'),
        backgroundColor: AppColors.canvas,
        appBar: AppBar(
          title: const Text('Karya Saya'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Mading'),
              Tab(text: 'Zona Kreasi'),
            ],
          ),
        ),
        body: works.when(
          loading: () => const LoadingView(label: 'Menyiapkan karya...'),
          error: (error, _) => ErrorView(
            message: '$error',
            onRetry: () => ref.invalidate(studentWorksProvider),
          ),
          data: (data) => TabBarView(
            children: [
              _MadingWorksGrid(items: data.mading),
              _SpotlightWorksGrid(user: user, items: data.spotlight),
            ],
          ),
        ),
      ),
    );
  }
}

class _MadingWorksGrid extends ConsumerWidget {
  const _MadingWorksGrid({required this.items});

  final List<StudentBoardItem> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (items.isEmpty) {
      return const _WorksEmpty(
        icon: Icons.auto_stories_outlined,
        message: 'Belum ada karya mading.',
      );
    }
    return MasonryGridView.count(
      key: const Key('student-works-mading-grid'),
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 32),
      crossAxisCount: 2,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      itemCount: items.length,
      itemBuilder: (_, index) {
        final item = items[index];
        return _PortfolioCard(
          key: ValueKey('student-work-mading-${item.id}'),
          title: item.title,
          kind: 'Mading',
          status: item.status,
          imageUrl: item.imageUrl,
          height: index.isEven ? 230 : 260,
          onTap: () async {
            if (!_isPublished(item.status)) {
              _showWorkStatus(context, item.status, item.reviewNote);
              return;
            }
            final deleted = await Navigator.of(context).push<bool>(
              MaterialPageRoute(
                builder: (_) => StudentMadingDetailScreen(item: item),
              ),
            );
            if (deleted == true) ref.invalidate(studentWorksProvider);
          },
        );
      },
    );
  }
}

class _SpotlightWorksGrid extends ConsumerWidget {
  const _SpotlightWorksGrid({required this.user, required this.items});

  final AppUser user;
  final List<StudentSpotlightItem> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (items.isEmpty) {
      return const _WorksEmpty(
        icon: Icons.play_circle_outline_rounded,
        message: 'Belum ada karya Zona Kreasi.',
      );
    }
    final published = items.where((item) => _isPublished(item.status)).toList();
    return MasonryGridView.count(
      key: const Key('student-works-spotlight-grid'),
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 32),
      crossAxisCount: 2,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      itemCount: items.length,
      itemBuilder: (_, index) {
        final item = items[index];
        final imageUrl =
            item.thumbnailUrl ??
            (isSpotlightImageUrl(item.videoUrl) ? item.videoUrl : null);
        return _PortfolioCard(
          key: ValueKey('student-work-spotlight-${item.id}'),
          title: item.caption,
          kind: 'Zona Kreasi',
          status: item.status,
          imageUrl: imageUrl,
          height: index.isEven ? 270 : 238,
          onTap: () async {
            if (!_isPublished(item.status)) {
              _showWorkStatus(context, item.status, item.reviewNote);
              return;
            }
            await Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) => Scaffold(
                  backgroundColor: Colors.black,
                  body: StudentSpotlightScreen(
                    user: user,
                    itemsOverride: published,
                    initialPostId: item.id,
                    onNotifications: () => Navigator.of(context).push<void>(
                      MaterialPageRoute(
                        builder: (_) => const NotificationsPage(),
                      ),
                    ),
                  ),
                ),
              ),
            );
            ref.invalidate(studentWorksProvider);
          },
        );
      },
    );
  }
}

class _PortfolioCard extends StatelessWidget {
  const _PortfolioCard({
    super.key,
    required this.title,
    required this.kind,
    required this.status,
    required this.height,
    required this.onTap,
    this.imageUrl,
  });

  final String title;
  final String kind;
  final String status;
  final String? imageUrl;
  final double height;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(20),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: SizedBox(
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            _WorkImage(url: imageUrl, kind: kind),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.transparent, Color(0xF2071836)],
                  stops: [.35, 1],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
            Positioned(
              top: 10,
              left: 10,
              child: _WorkStatusBadge(status: status),
            ),
            Positioned(
              left: 13,
              right: 13,
              bottom: 13,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    kind,
                    style: const TextStyle(
                      color: Color(0xFFC6EBC9),
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      height: 1.18,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _WorkImage extends StatelessWidget {
  const _WorkImage({required this.url, required this.kind});

  final String? url;
  final String kind;

  @override
  Widget build(BuildContext context) {
    final value = url?.trim() ?? '';
    if (value.isNotEmpty) {
      return Image.network(
        _mediaUrl(value),
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => _WorkPlaceholder(kind: kind),
      );
    }
    return _WorkPlaceholder(kind: kind);
  }
}

class _WorkPlaceholder extends StatelessWidget {
  const _WorkPlaceholder({required this.kind});

  final String kind;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        colors: [Color(0xFF007A33), Color(0xFF0B5A26)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ),
    child: Center(
      child: Icon(
        kind == 'Mading'
            ? Icons.auto_stories_rounded
            : Icons.play_circle_fill_rounded,
        color: Colors.white54,
        size: 44,
      ),
    ),
  );
}

class _WorkStatusBadge extends StatelessWidget {
  const _WorkStatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final published = _isPublished(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: published ? const Color(0xDD0C9B65) : const Color(0xDDF59E0B),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        _workStatusLabel(status),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _WorksEmpty extends StatelessWidget {
  const _WorksEmpty({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 54, color: AppColors.muted),
          const SizedBox(height: 12),
          Text(message, style: const TextStyle(color: AppColors.muted)),
        ],
      ),
    ),
  );
}

bool _isPublished(String status) => status == 'PUBLISHED';

String _workStatusLabel(String status) => switch (status) {
  'PUBLISHED' => 'Tayang',
  'PENDING_REVIEW' => 'Ditinjau',
  'REVISION_REQUESTED' => 'Perlu revisi',
  'REJECTED' => 'Ditolak',
  'ARCHIVED' => 'Diarsipkan',
  'DRAFT' => 'Draf',
  _ => 'Diproses',
};

void _showWorkStatus(BuildContext context, String status, String? reviewNote) {
  final note = reviewNote?.trim() ?? '';
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(
        note.isEmpty
            ? 'Karya berstatus ${_workStatusLabel(status)} dan belum dapat dipratinjau.'
            : '${_workStatusLabel(status)}: $note',
      ),
    ),
  );
}

class _IdentityHero extends StatelessWidget {
  const _IdentityHero({
    required this.user,
    required this.data,
    required this.showBackButton,
    required this.avatarUploading,
    required this.localAvatarPath,
    required this.avatarBytes,
    required this.onChangePhoto,
  });

  final AppUser user;
  final StudentDashboard data;
  final bool showBackButton;
  final bool avatarUploading;
  final String? localAvatarPath;
  final Uint8List? avatarBytes;
  final VoidCallback onChangePhoto;

  @override
  Widget build(BuildContext context) {
    final classChip = data.teacherName.trim().isEmpty
        ? data.className
        : '${data.className} · ${data.teacherName}';

    return Container(
      key: const Key('student-profile-hero'),
      decoration: const BoxDecoration(gradient: AppGradients.brand),
      child: Stack(
        children: [
          Positioned(
            right: -40,
            top: -30,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: .08),
              ),
            ),
          ),
          Positioned(
            left: -50,
            bottom: 20,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: .06),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
              child: Column(
                children: [
                  SizedBox(
                    height: 44,
                    child: Row(
                      children: [
                        if (showBackButton)
                          BackButton(
                            color: Colors.white,
                            onPressed: () => Navigator.maybePop(context),
                          )
                        else
                          const SizedBox(width: 40),
                        const Expanded(
                          child: Text(
                            'Profil',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -.2,
                            ),
                          ),
                        ),
                        const SizedBox(
                          width: 40,
                          key: Key('student-profile-edit'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  _StudentProfileAvatar(
                    user: user,
                    name: data.name,
                    uploading: avatarUploading,
                    localAvatarPath: localAvatarPath,
                    avatarBytes: avatarBytes,
                    onTap: onChangePhoto,
                  ),
                  const SizedBox(height: 14),
                  Text(
                    data.name,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -.4,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .16),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: .22),
                      ),
                    ),
                    child: Text(
                      classChip,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFFF5FAF6),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    data.schoolName,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: .82),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsStrip extends StatelessWidget {
  const _StatsStrip({
    required this.attendanceLabel,
    required this.followerLabel,
    required this.schoolLabel,
  });

  final String attendanceLabel;
  final String followerLabel;
  final String schoolLabel;

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('student-profile-stats'),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: AppColors.border),
      boxShadow: AppShadows.card,
    ),
    child: Row(
      children: [
        Expanded(
          child: _StatCell(
            label: 'Kehadiran',
            value: attendanceLabel,
            icon: Icons.event_available_rounded,
            accent: AppColors.success,
          ),
        ),
        _StatDivider(),
        Expanded(
          child: _StatCell(
            label: 'Pengikut',
            value: followerLabel,
            icon: Icons.people_alt_rounded,
            accent: AppColors.blue,
          ),
        ),
        _StatDivider(),
        Expanded(
          child: _StatCell(
            label: 'Sekolah',
            value: schoolLabel,
            icon: Icons.apartment_rounded,
            accent: AppColors.cyan,
            compactValue: true,
          ),
        ),
      ],
    ),
  );
}

class _StatDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 42, color: const Color(0xFFD7E8D9));
}

class _StatCell extends StatelessWidget {
  const _StatCell({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    this.compactValue = false,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accent;
  final bool compactValue;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Icon(icon, size: 18, color: accent),
      const SizedBox(height: 6),
      Text(
        value,
        textAlign: TextAlign.center,
        maxLines: compactValue ? 2 : 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: AppColors.navy,
          fontSize: compactValue ? 11 : 16,
          fontWeight: FontWeight.w900,
          height: 1.15,
          letterSpacing: compactValue ? -.1 : -.3,
        ),
      ),
      const SizedBox(height: 3),
      Text(
        label,
        style: const TextStyle(
          color: AppColors.muted,
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _AboutCard extends StatelessWidget {
  const _AboutCard({super.key, required this.rows});

  final Map<String, String> rows;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: AppColors.border),
      boxShadow: AppShadows.card,
    ),
    child: Column(
      children: [
        for (final entry in rows.entries)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 92,
                  child: Text(
                    entry.key,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    entry.value,
                    style: const TextStyle(
                      color: AppColors.navy,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}

class _AccountActions extends StatelessWidget {
  const _AccountActions({
    required this.onChangePassword,
    required this.onPrivacyPolicy,
    required this.onAdPrivacy,
    required this.onLogout,
  });

  final VoidCallback onChangePassword;
  final VoidCallback onPrivacyPolicy;
  final VoidCallback onAdPrivacy;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      _ActionTile(
        key: const Key('student-profile-change-password'),
        icon: Icons.lock_reset_rounded,
        label: 'Ganti password',
        onTap: onChangePassword,
      ),
      const SizedBox(height: 10),
      _ActionTile(
        key: const Key('student-profile-privacy-policy'),
        icon: Icons.policy_outlined,
        label: 'Kebijakan privasi',
        onTap: onPrivacyPolicy,
      ),
      const SizedBox(height: 10),
      _ActionTile(
        key: const Key('student-profile-ad-privacy'),
        icon: Icons.privacy_tip_outlined,
        label: 'Privasi iklan',
        onTap: onAdPrivacy,
      ),
      const SizedBox(height: 10),
      _ActionTile(
        key: const Key('student-profile-logout'),
        icon: Icons.logout_rounded,
        label: 'Keluar',
        danger: true,
        onTap: onLogout,
      ),
    ],
  );
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? AppColors.danger : AppColors.navy;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          height: 54,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: danger ? const Color(0xFFFADADF) : AppColors.border,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: danger ? const Color(0xFFFFF1F2) : AppColors.blueSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 18, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: color,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: color.withValues(alpha: .55),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Text(
    title,
    style: const TextStyle(
      color: AppColors.navy,
      fontSize: 14,
      fontWeight: FontWeight.w900,
      letterSpacing: -.2,
    ),
  );
}

class _BadgeChip extends StatelessWidget {
  const _BadgeChip({required this.badge});

  final _ProfileBadge badge;

  @override
  Widget build(BuildContext context) => Container(
    width: 168,
    padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: AppColors.border),
      boxShadow: AppShadows.card,
    ),
    child: Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: badge.color.withValues(alpha: .12),
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(badge.icon, color: badge.color, size: 22),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                badge.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                badge.subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 10.5,
                  height: 1.25,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _AvatarCropDialog extends StatefulWidget {
  const _AvatarCropDialog({required this.image});

  final Uint8List image;

  @override
  State<_AvatarCropDialog> createState() => _AvatarCropDialogState();
}

class _AvatarCropDialogState extends State<_AvatarCropDialog> {
  final _controller = CropController();
  bool _processing = false;

  void _crop() {
    if (_processing) return;
    setState(() => _processing = true);
    _controller.crop();
  }

  @override
  Widget build(BuildContext context) => Dialog(
    insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
    backgroundColor: const Color(0xFF0F2418),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Atur foto profil',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Geser dan zoom untuk memilih bagian foto yang digunakan.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFFA7D4B0), fontSize: 12),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 330,
            width: double.infinity,
            child: Crop(
              image: widget.image,
              controller: _controller,
              aspectRatio: 1,
              withCircleUi: true,
              maskColor: Colors.black54,
              onCropped: (result) {
                if (!mounted) return;
                switch (result) {
                  case CropSuccess(:final croppedImage):
                    Navigator.of(context).pop(croppedImage);
                  case CropFailure(:final cause):
                    setState(() => _processing = false);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Crop foto gagal: $cause')),
                    );
                }
              },
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: _processing ? null : () => Navigator.pop(context),
                  child: const Text('Batal'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: _processing ? null : _crop,
                  child: Text(_processing ? 'Memproses...' : 'Gunakan foto'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _StudentProfileAvatar extends StatelessWidget {
  const _StudentProfileAvatar({
    required this.user,
    required this.name,
    required this.uploading,
    required this.localAvatarPath,
    required this.onTap,
    this.avatarBytes,
  });

  final AppUser user;
  final String name;
  final bool uploading;
  final String? localAvatarPath;
  final Uint8List? avatarBytes;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final avatar = user.avatarUrl?.trim() ?? '';
    return Material(
      color: Colors.transparent,
      child: InkWell(
        key: const Key('student-profile-change-photo'),
        onTap: uploading ? null : onTap,
        borderRadius: BorderRadius.circular(56),
        child: SizedBox.square(
          dimension: 112,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 104,
                height: 104,
                padding: const EdgeInsets.all(3.5),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: .18),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: ClipOval(
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (localAvatarPath != null)
                        Image.file(
                          File(localAvatarPath!),
                          key: ValueKey('local-$localAvatarPath'),
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) =>
                              _ProfileAvatarFallback(name: name),
                        )
                      else if (avatarBytes != null)
                        Image.memory(
                          avatarBytes!,
                          key: const Key('student-profile-avatar-bytes'),
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) =>
                              _ProfileAvatarFallback(name: name),
                        )
                      else if (avatar.isEmpty)
                        _ProfileAvatarFallback(name: name)
                      else
                        Image.network(
                          _mediaUrl(avatar),
                          key: ValueKey('network-$avatar'),
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) =>
                              _ProfileAvatarFallback(name: name),
                        ),
                      if (uploading)
                        const ColoredBox(
                          color: Color(0x66001A4D),
                          child: Center(
                            child: SizedBox.square(
                              dimension: 26,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              Positioned(
                right: 4,
                bottom: 4,
                child: Container(
                  key: const Key('student-profile-camera-badge'),
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.blueBright,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2.5),
                  ),
                  child: const Icon(
                    Icons.photo_camera_rounded,
                    color: Colors.white,
                    size: 15,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class StudentChangePasswordSheet extends StatefulWidget {
  const StudentChangePasswordSheet({super.key, required this.onSubmit});

  final Future<String> Function({
    required String currentPassword,
    required String newPassword,
  })
  onSubmit;

  @override
  State<StudentChangePasswordSheet> createState() =>
      _StudentChangePasswordSheetState();
}

class _StudentChangePasswordSheetState
    extends State<StudentChangePasswordSheet> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _loading = false;
  bool _completed = false;
  String? _error;
  String? _message;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate() || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final message = await widget.onSubmit(
        currentPassword: _currentController.text,
        newPassword: _newController.text,
      );
      if (!mounted) return;
      setState(() {
        _completed = true;
        _message = message;
      });
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Password belum dapat diperbarui.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedPadding(
    duration: const Duration(milliseconds: 180),
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: Container(
      key: const Key('student-change-password-sheet'),
      padding: const EdgeInsets.fromLTRB(22, 12, 22, 26),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: const Color(0xFFD7E8D9),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const Icon(
              Icons.lock_reset_rounded,
              color: Color(0xFF007A33),
              size: 42,
            ),
            const SizedBox(height: 10),
            Text(
              _completed ? 'Password berhasil diubah' : 'Ganti Password',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 7),
            Text(
              _completed
                  ? (_message ?? 'Gunakan password baru pada login berikutnya.')
                  : 'Masukkan password saat ini dan buat password baru minimal 8 karakter.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, height: 1.4),
            ),
            const SizedBox(height: 20),
            if (_completed)
              FilledButton(
                key: const Key('student-change-password-done'),
                onPressed: () => Navigator.pop(context),
                child: const Text('Selesai'),
              )
            else
              Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      key: const Key('student-current-password'),
                      controller: _currentController,
                      obscureText: true,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Password saat ini',
                        prefixIcon: Icon(Icons.lock_outline_rounded),
                      ),
                      validator: (value) => (value?.length ?? 0) < 6
                          ? 'Masukkan password saat ini.'
                          : null,
                    ),
                    const SizedBox(height: 13),
                    TextFormField(
                      key: const Key('student-new-password'),
                      controller: _newController,
                      obscureText: true,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Password baru',
                        prefixIcon: Icon(Icons.password_rounded),
                      ),
                      validator: (value) => (value?.length ?? 0) < 8
                          ? 'Password baru minimal 8 karakter.'
                          : null,
                    ),
                    const SizedBox(height: 13),
                    TextFormField(
                      key: const Key('student-confirm-password'),
                      controller: _confirmController,
                      obscureText: true,
                      textInputAction: TextInputAction.done,
                      decoration: const InputDecoration(
                        labelText: 'Ulangi password baru',
                        prefixIcon: Icon(Icons.verified_user_outlined),
                      ),
                      validator: (value) => value == _newController.text
                          ? null
                          : 'Konfirmasi password tidak sama.',
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        style: const TextStyle(
                          color: AppColors.danger,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    FilledButton(
                      key: const Key('student-change-password-submit'),
                      onPressed: _loading ? null : _submit,
                      child: Text(
                        _loading ? 'Menyimpan...' : 'Simpan Password Baru',
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

class _ProfileAvatarFallback extends StatelessWidget {
  const _ProfileAvatarFallback({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: LinearGradient(colors: [Color(0xFF8DC63F), Color(0xFF007A33)]),
    ),
    child: Center(
      child: Text(
        name.isEmpty ? 'S' : name[0].toUpperCase(),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 36,
          fontWeight: FontWeight.w900,
        ),
      ),
    ),
  );
}

class _ProfileBadge {
  const _ProfileBadge({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
}

List<_ProfileBadge> _profileBadges(StudentDashboard data) {
  final items = <_ProfileBadge>[];
  final score = data.averageScore;
  if (score != null && score >= 80) {
    items.add(
      _ProfileBadge(
        title: 'Prestasi Akademik',
        subtitle: 'Rata-rata ${score.toStringAsFixed(score % 1 == 0 ? 0 : 1)}',
        icon: Icons.workspace_premium_rounded,
        color: const Color(0xFFFFA000),
      ),
    );
  }
  final attendance = data.attendancePercent;
  if (attendance != null && attendance >= 80) {
    items.add(
      _ProfileBadge(
        title: 'Kehadiran',
        subtitle: '$attendance% hadir',
        icon: Icons.event_available_rounded,
        color: const Color(0xFF16A36A),
      ),
    );
  }
  return items;
}

String _mediaUrl(String value) => resolveAppMediaUrl(value);
