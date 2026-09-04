import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/notifications/push_notification_service.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/core/widgets/dashboard_components.dart';
import 'package:guruspace_mobile/core/widgets/dashboard_popup_ad.dart';
import 'package:guruspace_mobile/core/widgets/mobile_banner_carousel.dart';
import 'package:guruspace_mobile/core/widgets/mobile_web_shell.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';
import 'package:guruspace_mobile/features/dashboard/domain/app_display_models.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/shared/presentation/notifications_screen.dart';
import 'package:guruspace_mobile/features/shared/presentation/live_class_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_assignments_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_learning_detail_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_mading_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_profile_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_quiz_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_reading_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_spotlight_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_creator_profile_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_inbox_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_tka_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/tka_attempt_screen.dart';

class StudentApp extends StatefulWidget {
  const StudentApp({super.key, required this.user});
  final AppUser user;

  @override
  State<StudentApp> createState() => _StudentAppState();
}

class _StudentAppState extends State<StudentApp> {
  int _index = 0;
  String? _spotlightInitialPostId;
  late AppUser _activeUser;

  static const _titles = <String>[
    'Beranda',
    'Mading',
    'Tugas',
    'Zona Kreasi',
    'Profil',
  ];

  @override
  void initState() {
    super.initState();
    _activeUser = widget.user;
  }

  @override
  void didUpdateWidget(covariant StudentApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.id != widget.user.id) {
      _index = 0;
      _spotlightInitialPostId = null;
      _activeUser = widget.user;
      return;
    }
    if (oldWidget.user != widget.user) {
      _activeUser = widget.user;
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _StudentHomeScreen(
        user: _activeUser,
        onAllFeatures: _showMenu,
        onMading: () => setState(() => _index = 1),
        onSpotlight: () => _openSpotlight(),
        onSpotlightItem: (id) => _openSpotlight(id),
        onProfile: () => setState(() => _index = 4),
      ),
      StudentMadingScreen(
        onNotifications: () => _openStudentPage(
          context,
          'Notifikasi',
          const NotificationsScreen(embedded: true),
        ),
      ),
      StudentAssignmentsScreen(onBack: () => setState(() => _index = 0)),
      StudentSpotlightScreen(
        user: _activeUser,
        active: _index == 3,
        initialPostId: _spotlightInitialPostId,
        onNotifications: () => _openStudentPage(
          context,
          'Notifikasi',
          const NotificationsScreen(embedded: true),
        ),
      ),
      StudentProfileScreen(user: _activeUser, onUserChanged: _updateActiveUser),
    ];
    return PopScope(
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _index != 0) setState(() => _index = 0);
      },
      child: DashboardPopupAdHost(
        child: Scaffold(
          backgroundColor: Colors.white,
          appBar:
              _index == 0 ||
                  _index == 1 ||
                  _index == 2 ||
                  _index == 3 ||
                  _index == 4
              ? null
              : _StudentTopBar(
                  title: _titles[_index],
                  onBack: () => setState(() => _index = 0),
                  onNotifications: () => _openStudentPage(
                    context,
                    'Notifikasi',
                    const NotificationsScreen(embedded: true),
                  ),
                  onMenu: _showMenu,
                ),
          body: IndexedStack(index: _index, children: pages),
          bottomNavigationBar: MobileWebBottomNav(
            index: _index,
            style: MobileBottomNavStyle.student,
            onChanged: (value) => setState(() {
              if (value == 3) _spotlightInitialPostId = null;
              _index = value;
            }),
            items: const [
              WebBottomNavItem(
                label: 'Beranda',
                icon: Icons.home_outlined,
                activeIcon: Icons.home_rounded,
              ),
              WebBottomNavItem(
                label: 'Mading',
                icon: Icons.newspaper_outlined,
                activeIcon: Icons.newspaper_rounded,
              ),
              WebBottomNavItem(
                label: 'Tugas',
                icon: Icons.task_alt_rounded,
                activeIcon: Icons.task_alt_rounded,
                primary: true,
              ),
              WebBottomNavItem(
                label: 'Zona Kreasi',
                icon: Icons.palette_outlined,
                activeIcon: Icons.palette_rounded,
              ),
              WebBottomNavItem(
                label: 'Profil',
                icon: Icons.person_outline_rounded,
                activeIcon: Icons.person_rounded,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _updateActiveUser(AppUser user) {
    if (mounted) setState(() => _activeUser = user);
  }

  void _openSpotlight([String? postId]) {
    setState(() {
      _spotlightInitialPostId = postId;
      _index = 3;
    });
  }

  void _showMenu() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => _StudentMenuSheet(
        user: _activeUser,
        onTab: (value) {
          Navigator.pop(sheetContext);
          switch (value) {
            case 0:
              setState(() => _index = 0);
              return;
            case 1:
              _pushStudentFeaturePage(
                context,
                const StudentAssignmentsScreen(),
              );
              return;
            case 2:
              _openStudentPage(context, 'PJJ', const _StudentPjjScreen());
              return;
            case 3:
              _openStudentPage(
                context,
                'Notifikasi',
                const NotificationsScreen(embedded: true),
              );
              return;
            case 4:
              _openStudentPage(
                context,
                'Profil Siswa',
                StudentProfileScreen(
                  user: _activeUser,
                  showBackButton: true,
                  onUserChanged: _updateActiveUser,
                ),
              );
              return;
          }
        },
      ),
    );
  }
}

class _StudentTopBar extends ConsumerWidget implements PreferredSizeWidget {
  const _StudentTopBar({
    required this.title,
    required this.onBack,
    required this.onNotifications,
    required this.onMenu,
  });

  final String title;
  final VoidCallback onBack;
  final VoidCallback onNotifications;
  final VoidCallback onMenu;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadCount = ref
        .watch(studentUnreadNotificationsProvider)
        .asData
        ?.value;
    return AppBar(
      toolbarHeight: 64,
      backgroundColor: const Color(0xFF1464F4),
      foregroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      titleSpacing: 16,
      title: Text(title),
      leading: IconButton(
        key: const Key('student-home-back'),
        tooltip: 'Kembali ke beranda',
        onPressed: onBack,
        icon: const Icon(Icons.arrow_back_rounded),
      ),
      actions: [
        IconButton(
          tooltip: 'Pemberitahuan',
          onPressed: onNotifications,
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              const Icon(Icons.notifications_none_rounded),
              if ((unreadCount ?? 0) > 0)
                Positioned(
                  right: -1,
                  top: -1,
                  child: Container(
                    key: const Key('student-topbar-notification-badge'),
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: AppColors.danger,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                  ),
                ),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Semua fitur',
          onPressed: onMenu,
          icon: const Icon(Icons.grid_view_rounded),
        ),
        const SizedBox(width: 6),
      ],
    );
  }
}

void _openStudentPage(BuildContext context, String title, Widget page) {
  Navigator.push<void>(
    context,
    MaterialPageRoute(
      builder: (_) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: page,
      ),
    ),
  );
}

void _pushStudentFeaturePage(BuildContext context, Widget page) {
  Navigator.push<void>(context, MaterialPageRoute(builder: (_) => page));
}

class _StudentHomeScreen extends ConsumerWidget {
  const _StudentHomeScreen({
    required this.user,
    required this.onAllFeatures,
    required this.onMading,
    required this.onSpotlight,
    required this.onSpotlightItem,
    required this.onProfile,
  });

  final AppUser user;
  final VoidCallback onAllFeatures;
  final VoidCallback onMading;
  final VoidCallback onSpotlight;
  final ValueChanged<String> onSpotlightItem;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(studentDashboardProvider);
    return async.when(
      loading: () => const SafeArea(
        child: LoadingView(label: 'Menyiapkan ruang belajar...'),
      ),
      error: (error, _) => SafeArea(
        child: '$error'.toLowerCase().contains('terhubung')
            ? _StudentUnlinkedState(
                onRetry: () => ref.invalidate(studentDashboardProvider),
              )
            : ErrorView(
                message: '$error',
                onRetry: () => ref.invalidate(studentDashboardProvider),
              ),
      ),
      data: (data) {
        final topInset = MediaQuery.paddingOf(context).top;
        final appDisplay = ref.watch(mobileAppDisplayProvider).asData?.value;
        return RefreshIndicator(
          onRefresh: () async {
            await Future.wait<Object?>([
              ref.refresh(studentDashboardProvider.future),
              ref.refresh(mobileAppDisplayProvider.future),
            ]);
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: _PinnedStudentHomeHeaderDelegate(
                  topInset: topInset,
                  child: _StudentHomeHeader(
                    branding: ref
                        .watch(mobileAppDisplayProvider)
                        .asData
                        ?.value
                        .branding,
                    onNotifications: () => _openStudentPage(
                      context,
                      'Notifikasi',
                      const NotificationsScreen(embedded: true),
                    ),
                    onInbox: () => Navigator.push<void>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const StudentInboxScreen(),
                      ),
                    ),
                    onProfile: onProfile,
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 6, 18, 30),
                sliver: SliverList.list(
                  children: [
                    StudentProfileHero(
                      name: data.name,
                      className: data.className,
                      schoolName: data.schoolName,
                      teacherName: data.teacherName,
                      attendancePercent: data.attendancePercent,
                      followerCount: data.followerCount,
                      avatarUrl: user.avatarUrl?.trim().isNotEmpty == true
                          ? _mediaUrl(user.avatarUrl!)
                          : null,
                      avatarBytes: user.avatarBytes,
                      onProfile: onProfile,
                    ),
                    const SizedBox(height: 18),
                    _SectionLabel(title: 'Menu Cepat', onTap: onAllFeatures),
                    const SizedBox(height: 2),
                    QuickMenuGrid(
                      title: 'Menu Cepat',
                      dense: true,
                      frameless: true,
                      items: [
                        QuickMenuItem(
                          label: 'Absensi',
                          icon: Icons.event_available_rounded,
                          color: const Color(0xFF2858F5),
                          assetPath: 'assets/icons/menu/absensi.png',
                          iconUrl: _quickMenuIconUrl(appDisplay, 'attendance'),
                          onTap: () => _openStudentPage(
                            context,
                            'Absensi',
                            const _StudentAttendanceScreen(),
                          ),
                        ),
                        QuickMenuItem(
                          label: 'Tugas',
                          icon: Icons.assignment_turned_in_rounded,
                          color: const Color(0xFF20A84B),
                          assetPath: 'assets/icons/menu/tugas.png',
                          iconUrl: _quickMenuIconUrl(appDisplay, 'assignments'),
                          onTap: () => _pushStudentFeaturePage(
                            context,
                            const StudentAssignmentsScreen(),
                          ),
                        ),
                        QuickMenuItem(
                          label: 'Quiz',
                          icon: Icons.quiz_rounded,
                          color: const Color(0xFFE0477E),
                          assetPath: 'assets/icons/menu/quiz.png',
                          iconUrl: _quickMenuIconUrl(appDisplay, 'quiz'),
                          onTap: () => _pushStudentFeaturePage(
                            context,
                            const StudentQuizScreen(),
                          ),
                        ),
                        QuickMenuItem(
                          label: 'PJJ',
                          icon: Icons.video_camera_front_rounded,
                          color: const Color(0xFF6840E8),
                          assetPath: 'assets/icons/menu/pjj.png',
                          iconUrl: _quickMenuIconUrl(appDisplay, 'pjj'),
                          onTap: () => _openStudentPage(
                            context,
                            'PJJ',
                            const _StudentPjjScreen(),
                          ),
                        ),
                        QuickMenuItem(
                          label: 'TKA',
                          icon: Icons.psychology_outlined,
                          color: const Color(0xFFF07A22),
                          assetPath: 'assets/icons/menu/tka.png',
                          iconUrl: _quickMenuIconUrl(appDisplay, 'tka'),
                          onTap: () => _pushStudentFeaturePage(
                            context,
                            const StudentTkaScreen(),
                          ),
                        ),
                        QuickMenuItem(
                          label: 'Zona Baca',
                          icon: Icons.auto_stories_rounded,
                          color: const Color(0xFF0A9B76),
                          assetPath: 'assets/icons/menu/zona_baca.png',
                          iconUrl: _quickMenuIconUrl(appDisplay, 'reading'),
                          onTap: () => _pushStudentFeaturePage(
                            context,
                            const StudentReadingScreen(),
                          ),
                        ),
                        QuickMenuItem(
                          label: 'Zona Kreasi',
                          icon: Icons.smart_display_rounded,
                          color: const Color(0xFFDB3A24),
                          assetPath: 'assets/icons/menu/zona_kreasi.png',
                          iconUrl: _quickMenuIconUrl(appDisplay, 'creations'),
                          onTap: onSpotlight,
                        ),
                        QuickMenuItem(
                          label: 'Mading',
                          icon: Icons.newspaper_rounded,
                          color: const Color(0xFF1475C9),
                          assetPath: 'assets/icons/menu/mading.png',
                          iconUrl: _quickMenuIconUrl(appDisplay, 'board'),
                          onTap: onMading,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    ref
                        .watch(mobileBannerProvider)
                        .when(
                          loading: () =>
                              const _StudentCampaignBanner(display: null),
                          error: (_, _) =>
                              const _StudentCampaignBanner(display: null),
                          data: (display) =>
                              _StudentCampaignBanner(display: display),
                        ),
                    const SizedBox(height: 18),
                    _SectionLabel(
                      title: 'Zona Kreasi Terbaru',
                      onTap: onSpotlight,
                    ),
                    const SizedBox(height: 8),
                    _SpotlightStrip(
                      items: data.spotlight,
                      onOpen: onSpotlightItem,
                      onAuthorOpen: (studentId) =>
                          openStudentCreatorProfile(context, studentId),
                    ),
                    const SizedBox(height: 18),
                    _SectionLabel(title: 'Mading Terbaru', onTap: onMading),
                    const SizedBox(height: 8),
                    _MadingThumbnailGallery(
                      items: data.boardPosts,
                      onOpenAll: onMading,
                      onAuthorOpen: (studentId) =>
                          openStudentCreatorProfile(context, studentId),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _StudentHomeHeader extends ConsumerWidget {
  const _StudentHomeHeader({
    required this.branding,
    required this.onNotifications,
    required this.onInbox,
    required this.onProfile,
  });

  final MobileBrandingDisplay? branding;
  final VoidCallback onNotifications;
  final VoidCallback onInbox;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadCount = ref
        .watch(studentUnreadNotificationsProvider)
        .asData
        ?.value;
    return Container(
      key: const Key('student-home-header'),
      height: 68,
      padding: const EdgeInsets.fromLTRB(14, 9, 9, 9),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .96),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE4EBF7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x120C3B84),
            blurRadius: 22,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(child: _StudentHeaderLogo(branding: branding)),
          _StudentInboxHeaderAction(onTap: onInbox),
          const SizedBox(width: 6),
          _StudentHeaderAction(
            key: const Key('student-header-notifications'),
            tooltip: 'Notifikasi',
            icon: Icons.notifications_none_rounded,
            showBadge: (unreadCount ?? 0) > 0,
            onTap: onNotifications,
          ),
          const SizedBox(width: 6),
          _StudentHeaderAction(
            key: const Key('student-header-profile'),
            tooltip: 'Profil',
            icon: Icons.person_outline_rounded,
            onTap: onProfile,
          ),
        ],
      ),
    );
  }
}

class _PinnedStudentHomeHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _PinnedStudentHomeHeaderDelegate({
    required this.topInset,
    required this.child,
  });

  final double topInset;
  final Widget child;

  static const _headerHeight = 68.0;
  static const _topGap = 8.0;
  static const _bottomGap = 8.0;

  @override
  double get minExtent => topInset + _topGap + _headerHeight + _bottomGap;

  @override
  double get maxExtent => minExtent;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Material(
      color: Colors.white,
      elevation: overlapsContent ? 1.5 : 0,
      shadowColor: const Color(0x330C3B84),
      child: Padding(
        padding: EdgeInsets.fromLTRB(18, topInset + _topGap, 18, _bottomGap),
        child: child,
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _PinnedStudentHomeHeaderDelegate oldDelegate) {
    return topInset != oldDelegate.topInset || child != oldDelegate.child;
  }
}

class _StudentHeaderLogo extends StatelessWidget {
  const _StudentHeaderLogo({required this.branding});

  final MobileBrandingDisplay? branding;

  @override
  Widget build(BuildContext context) {
    final logoUrl = branding?.logoUrl.trim() ?? '';
    final fallback = Image.asset(
      'assets/images/native_splash_logo.png',
      fit: BoxFit.contain,
      alignment: Alignment.centerLeft,
      filterQuality: FilterQuality.high,
    );
    return Align(
      alignment: Alignment.centerLeft,
      child: SizedBox(
        height: 42,
        width: 142,
        child: logoUrl.isEmpty
            ? fallback
            : Image.network(
                _mediaUrl(logoUrl),
                fit: BoxFit.contain,
                alignment: Alignment.centerLeft,
                filterQuality: FilterQuality.high,
                errorBuilder: (_, _, _) => fallback,
              ),
      ),
    );
  }
}

class _StudentHeaderAction extends StatelessWidget {
  const _StudentHeaderAction({
    super.key,
    required this.tooltip,
    required this.icon,
    required this.onTap,
    this.showBadge = false,
    this.badgeCount,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback onTap;
  final bool showBadge;
  final int? badgeCount;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xFFF0F5FF),
    borderRadius: BorderRadius.circular(15),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(15),
      child: Tooltip(
        message: tooltip,
        child: SizedBox.square(
          dimension: 46,
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              Icon(icon, color: const Color(0xFF164FC4), size: 24),
              if (showBadge)
                Positioned(
                  right: badgeCount == null ? 10 : 4,
                  top: badgeCount == null ? 9 : 3,
                  child: Container(
                    key: Key(
                      tooltip == 'Inbox'
                          ? 'student-header-inbox-badge'
                          : 'student-header-notification-badge',
                    ),
                    constraints: BoxConstraints(
                      minWidth: badgeCount == null ? 8 : 18,
                      minHeight: badgeCount == null ? 8 : 18,
                    ),
                    padding: badgeCount == null
                        ? EdgeInsets.zero
                        : const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF4D62),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: badgeCount == null
                        ? null
                        : Text(
                            badgeCount! > 99 ? '99+' : '$badgeCount',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                  ),
                ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _StudentInboxHeaderAction extends ConsumerStatefulWidget {
  const _StudentInboxHeaderAction({required this.onTap});
  final VoidCallback onTap;

  @override
  ConsumerState<_StudentInboxHeaderAction> createState() =>
      _StudentInboxHeaderActionState();
}

class _StudentInboxHeaderActionState
    extends ConsumerState<_StudentInboxHeaderAction>
    with WidgetsBindingObserver {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    PushNotificationService.inboxRevision.addListener(_refreshFromPush);
    _start();
  }

  void _refreshFromPush() {
    if (mounted) ref.read(studentSocialRefreshProvider.notifier).state++;
  }

  void _start() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) ref.read(studentSocialRefreshProvider.notifier).state++;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(studentSocialRefreshProvider.notifier).state++;
      _start();
    } else {
      _timer?.cancel();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    PushNotificationService.inboxRevision.removeListener(_refreshFromPush);
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final count = ref.watch(studentSocialUnreadProvider).asData?.value ?? 0;
    return _StudentHeaderAction(
      key: const Key('student-header-inbox'),
      tooltip: 'Inbox',
      icon: Icons.forum_outlined,
      showBadge: count > 0,
      badgeCount: count > 0 ? count : null,
      onTap: widget.onTap,
    );
  }
}

// Kept for older embedded home integrations.
// ignore: unused_element
class _StudentGreeting extends StatelessWidget {
  const _StudentGreeting({required this.name, required this.avatarUrl});
  final String name;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Halo, ${name.split(' ').first} 👋',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -.4,
                ),
              ),
              const SizedBox(height: 3),
              const Text(
                'Selamat belajar hari ini!',
                style: TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
          ),
        ),
        Container(
          width: 47,
          height: 47,
          padding: const EdgeInsets.all(2.5),
          decoration: const BoxDecoration(
            color: Color(0xFFDCE7FF),
            shape: BoxShape.circle,
          ),
          child: ClipOval(
            child: avatarUrl != null && avatarUrl!.trim().isNotEmpty
                ? Image.network(
                    _mediaUrl(avatarUrl!),
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => _AvatarFallback(name: name),
                  )
                : _AvatarFallback(name: name),
          ),
        ),
      ],
    ),
  );
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback({required this.name});
  final String name;
  @override
  Widget build(BuildContext context) => Container(
    alignment: Alignment.center,
    decoration: const BoxDecoration(
      gradient: LinearGradient(colors: [Color(0xFF78A8FF), Color(0xFF1F5FEA)]),
    ),
    child: Text(
      name.isEmpty ? 'S' : name[0].toUpperCase(),
      style: const TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.w900,
        fontSize: 18,
      ),
    ),
  );
}

class _StudentCampaignBanner extends StatelessWidget {
  const _StudentCampaignBanner({required this.display});
  final MobileBannerDisplay? display;

  static const _fallbackDisplay = MobileBannerDisplay(
    autoPlayMs: 4800,
    slides: [
      AppBannerSlide(
        id: 'student-literacy',
        mediaUrl: 'assets/images/student_home_banner.png',
        type: 'image',
      ),
      AppBannerSlide(
        id: 'student-science',
        mediaUrl: 'assets/images/student_home_banner_science.png',
        type: 'image',
      ),
      AppBannerSlide(
        id: 'student-creative',
        mediaUrl: 'assets/images/student_home_banner_creative.png',
        type: 'image',
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final effective = display?.slides.isNotEmpty == true
        ? display!
        : _fallbackDisplay;
    return MobileBannerCarousel(display: effective);
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title, this.onTap});
  final String title;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(
          title,
          style: const TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w900,
            letterSpacing: -.2,
          ),
        ),
      ),
      TextButton(
        onPressed: onTap,
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          minimumSize: const Size(0, 32),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: const Text(
          'Lihat Semua',
          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800),
        ),
      ),
    ],
  );
}

class _MadingThumbnailGallery extends StatefulWidget {
  const _MadingThumbnailGallery({
    required this.items,
    required this.onOpenAll,
    required this.onAuthorOpen,
  });

  final List<StudentBoardItem> items;
  final VoidCallback onOpenAll;
  final ValueChanged<String?> onAuthorOpen;

  @override
  State<_MadingThumbnailGallery> createState() =>
      _MadingThumbnailGalleryState();
}

class _MadingThumbnailGalleryState extends State<_MadingThumbnailGallery> {
  @override
  Widget build(BuildContext context) {
    final visible = widget.items
        .where((item) => !_isAnnouncementCategory(item.category))
        .take(6)
        .toList();
    if (visible.isEmpty) {
      return _MadingHomeEmpty(onTap: widget.onOpenAll);
    }
    return SizedBox(
      key: const Key('student-home-mading-thumbnails'),
      height: 220,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        itemCount: visible.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, index) => SizedBox(
          width: 178,
          child: StudentHomeMadingPreview(
            item: visible[index],
            onTap: widget.onOpenAll,
            onAuthorTap: visible[index].studentId?.trim().isNotEmpty == true
                ? () => widget.onAuthorOpen(visible[index].studentId)
                : null,
          ),
        ),
      ),
    );
  }
}

class StudentHomeMadingPreview extends StatelessWidget {
  const StudentHomeMadingPreview({
    super.key,
    required this.item,
    required this.onTap,
    this.onAuthorTap,
  });
  final StudentBoardItem item;
  final VoidCallback? onTap;
  final VoidCallback? onAuthorTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE5EAF3)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x10132D57),
                blurRadius: 20,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(19),
                    ),
                    child: SizedBox(
                      width: double.infinity,
                      height: 112,
                      child: item.imageUrl?.trim().isNotEmpty == true
                          ? Image.network(
                              _mediaUrl(item.imageUrl!),
                              fit: BoxFit.cover,
                              gaplessPlayback: true,
                              errorBuilder: (_, _, _) =>
                                  _MadingArt(category: item.category),
                            )
                          : _MadingArt(category: item.category),
                    ),
                  ),
                  Positioned(
                    left: 10,
                    bottom: 9,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xEFFFFFFF),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        item.category.toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF1857C9),
                          fontSize: 8,
                          letterSpacing: .3,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 11),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.navy,
                          fontSize: 12.5,
                          height: 1.25,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const Spacer(),
                      GestureDetector(
                        key: const Key('student-home-mading-author-action'),
                        behavior: HitTestBehavior.opaque,
                        onTap: onAuthorTap,
                        child: Row(
                          children: [
                            Container(
                              width: 23,
                              height: 23,
                              clipBehavior: Clip.antiAlias,
                              alignment: Alignment.center,
                              decoration: const BoxDecoration(
                                color: Color(0xFFE8F0FF),
                                shape: BoxShape.circle,
                              ),
                              child:
                                  item.authorAvatarUrl?.trim().isNotEmpty ==
                                      true
                                  ? Image.network(
                                      _mediaUrl(item.authorAvatarUrl!),
                                      key: const Key(
                                        'student-home-mading-author-avatar',
                                      ),
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, _, _) =>
                                          _MadingInitial(author: item.author),
                                    )
                                  : _MadingInitial(author: item.author),
                            ),
                            const SizedBox(width: 7),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.author,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Color(0xFF53627A),
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  Text(
                                    item.schoolName,
                                    key: const Key(
                                      'student-home-mading-school',
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: AppColors.muted,
                                      fontSize: 8,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(
                              Icons.arrow_forward_rounded,
                              size: 15,
                              color: Color(0xFF2A63D7),
                            ),
                          ],
                        ),
                      ),
                    ],
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

class _MadingInitial extends StatelessWidget {
  const _MadingInitial({required this.author});

  final String author;

  @override
  Widget build(BuildContext context) => Center(
    child: Text(
      author.trim().isEmpty ? 'S' : author.trim()[0].toUpperCase(),
      style: const TextStyle(
        color: Color(0xFF2862D7),
        fontSize: 9,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

class _MadingArt extends StatelessWidget {
  const _MadingArt({required this.category});
  final String category;

  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        colors: [Color(0xFF173D7A), Color(0xFF4E8EF7)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ),
    child: Icon(
      category.toLowerCase().contains('event')
          ? Icons.event_rounded
          : Icons.auto_stories_rounded,
      color: Colors.white,
      size: 38,
    ),
  );
}

class _MadingHomeEmpty extends StatelessWidget {
  const _MadingHomeEmpty({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    key: const Key('student-home-mading-empty'),
    color: const Color(0xFFF5F8FE),
    borderRadius: BorderRadius.circular(20),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: const Color(0xFFE1EBFF),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.auto_stories_rounded,
                color: Color(0xFF2862D7),
              ),
            ),
            const SizedBox(width: 13),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Belum ada karya mading terbaru',
                    style: TextStyle(
                      color: AppColors.navy,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Buka Mading untuk melihat atau mengirim karya siswa.',
                    style: TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF2862D7)),
          ],
        ),
      ),
    ),
  );
}

bool _isAnnouncementCategory(String value) =>
    value.trim().toLowerCase().contains('pengumuman');

class _SpotlightStrip extends StatelessWidget {
  const _SpotlightStrip({
    required this.items,
    required this.onOpen,
    required this.onAuthorOpen,
  });
  final List<StudentSpotlightItem> items;
  final ValueChanged<String> onOpen;
  final ValueChanged<String?> onAuthorOpen;

  @override
  Widget build(BuildContext context) {
    final visible = items.take(5).toList();
    if (visible.isEmpty) {
      return Material(
        key: const Key('student-home-spotlight-empty'),
        color: const Color(0xFF151A24),
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(20),
          child: const SizedBox(
            height: 116,
            child: Padding(
              padding: EdgeInsets.all(17),
              child: Row(
                children: [
                  Icon(
                    Icons.video_collection_outlined,
                    color: Color(0xFF8CB3FF),
                    size: 38,
                  ),
                  SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Belum ada Zona Kreasi terbaru',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Konten siswa yang telah diterbitkan akan tampil di sini.',
                          style: TextStyle(
                            color: Color(0xFFAFB8C8),
                            fontSize: 11,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    return SizedBox(
      key: const Key('student-home-spotlight-list'),
      height: 190,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        itemCount: visible.length,
        separatorBuilder: (_, _) => const SizedBox(width: 9),
        itemBuilder: (context, index) {
          final item = visible[index];
          return SizedBox(
            width: 112,
            child: StudentHomeSpotlightPreview(
              item: item,
              index: index,
              onTap: () => onOpen(item.id),
              onAuthorTap: item.studentId?.trim().isNotEmpty == true
                  ? () => onAuthorOpen(item.studentId)
                  : null,
            ),
          );
        },
      ),
    );
  }
}

class StudentHomeSpotlightPreview extends StatelessWidget {
  const StudentHomeSpotlightPreview({
    super.key,
    required this.item,
    required this.index,
    required this.onTap,
    this.onAuthorTap,
  });
  final StudentSpotlightItem item;
  final int index;
  final VoidCallback onTap;
  final VoidCallback? onAuthorTap;

  @override
  Widget build(BuildContext context) {
    const gradients = [
      [Color(0xFF223D63), Color(0xFFF7A621)],
      [Color(0xFF6C3C25), Color(0xFF48A6B4)],
      [Color(0xFF263945), Color(0xFFB4683B)],
    ];
    final mediaImage = item.thumbnailUrl?.trim().isNotEmpty == true
        ? item.thumbnailUrl
        : _isSpotlightImageUrl(item.videoUrl)
        ? item.videoUrl
        : null;
    final imagePost = _isSpotlightImageUrl(item.videoUrl);
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('student-home-spotlight-${item.id}'),
        onTap: onTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (mediaImage != null)
              Image.network(
                _mediaUrl(mediaImage),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) =>
                    _SpotlightPlaceholder(colors: gradients[index % 3]),
              )
            else
              _SpotlightPlaceholder(colors: gradients[index % 3]),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0xA8000000)],
                ),
              ),
            ),
            Positioned(
              left: 9,
              top: 9,
              child: Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(
                  color: Color(0x8A000000),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: Colors.white,
                  size: 16,
                ),
              ),
            ),
            if (!imagePost)
              Center(
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0x9E000000),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              ),
            Positioned(
              left: 10,
              right: 8,
              bottom: 9,
              child: GestureDetector(
                key: const Key('student-home-spotlight-author-action'),
                behavior: HitTestBehavior.opaque,
                onTap: onAuthorTap,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.author,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (item.schoolName?.trim().isNotEmpty == true) ...[
                      const SizedBox(height: 2),
                      Text(
                        item.schoolName!.trim(),
                        key: const Key('student-home-spotlight-school'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFFD4DEEC),
                          fontSize: 8.5,
                          height: 1.2,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

bool _isSpotlightImageUrl(String value) {
  final path = Uri.tryParse(value)?.path.toLowerCase() ?? value.toLowerCase();
  return path.endsWith('.jpg') ||
      path.endsWith('.jpeg') ||
      path.endsWith('.png') ||
      path.endsWith('.webp');
}

class _SpotlightPlaceholder extends StatelessWidget {
  const _SpotlightPlaceholder({required this.colors});
  final List<Color> colors;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: colors,
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ),
    child: const Center(
      child: Icon(Icons.videocam_rounded, color: Color(0xBFFFFFFF), size: 38),
    ),
  );
}

String _mediaUrl(String value) => resolveAppMediaUrl(value);

String? _quickMenuIconUrl(MobileAppDisplay? display, String key) {
  final value = display?.quickMenuIcons.urlFor(key) ?? '';
  return value.isEmpty ? null : _mediaUrl(value);
}

class _StudentUnlinkedState extends StatelessWidget {
  const _StudentUnlinkedState({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 132,
            height: 132,
            decoration: const BoxDecoration(
              color: AppColors.blueSoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.link_off_rounded,
              color: AppColors.blue,
              size: 58,
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Akun belum terhubung',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          const Text(
            'Akun Anda belum terhubung dengan data sekolah. Silakan hubungi pihak sekolah atau coba lagi.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, height: 1.5),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline_rounded, color: AppColors.blue),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Pastikan email atau data yang Anda gunakan sudah terdaftar di sistem sekolah.',
                    style: TextStyle(fontSize: 12, color: AppColors.navy),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          FilledButton(
            onPressed: onRetry,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
            ),
            child: const Text('Coba lagi'),
          ),
        ],
      ),
    ),
  );
}

// Kept for the legacy embedded dashboard used by downstream integrations.
// ignore: unused_element
class _StudentDashboardHero extends StatelessWidget {
  const _StudentDashboardHero({
    required this.name,
    required this.className,
    required this.schoolName,
    required this.progress,
  });

  final String name;
  final String className;
  final String schoolName;
  final int progress;

  @override
  Widget build(BuildContext context) {
    final safeProgress = progress.clamp(0, 100);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: const BoxDecoration(
              color: Color(0xFFE5EDFF),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              name.trim().isEmpty ? 'S' : name.trim()[0].toUpperCase(),
              style: const TextStyle(
                color: AppColors.blue,
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Selamat pagi,',
                  style: TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.navy,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -.4,
                  ),
                ),
                const SizedBox(height: 5),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    _StudentHeroBadge(label: className),
                    if (schoolName.isNotEmpty)
                      _StudentHeroBadge(label: schoolName, muted: true),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          SizedBox.square(
            dimension: 66,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: safeProgress / 100,
                  strokeWidth: 7,
                  backgroundColor: const Color(0xFFE8EEF7),
                  color: AppColors.blue,
                  strokeCap: StrokeCap.round,
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$safeProgress%',
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const Text(
                      'progres',
                      style: TextStyle(color: AppColors.muted, fontSize: 8),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StudentHeroBadge extends StatelessWidget {
  const _StudentHeroBadge({required this.label, this.muted = false});
  final String label;
  final bool muted;

  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(maxWidth: 150),
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: muted ? AppColors.surfaceMuted : AppColors.blueSoft,
      borderRadius: BorderRadius.circular(7),
    ),
    child: Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: muted ? AppColors.muted : AppColors.blue,
        fontSize: 10,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

// ignore: unused_element
class _StudentStatStrip extends StatelessWidget {
  const _StudentStatStrip({
    required this.pendingAssignments,
    required this.attendancePercent,
    required this.averageScore,
    required this.onAttendance,
    required this.onGrades,
  });

  final int pendingAssignments;
  final int? attendancePercent;
  final double? averageScore;
  final VoidCallback onAttendance;
  final VoidCallback onGrades;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: _StudentStatCard(
          icon: Icons.assignment_outlined,
          label: 'Tugas',
          value: '$pendingAssignments',
          helper: 'Menunggu',
          color: AppColors.blue,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _StudentStatCard(
          icon: Icons.event_available_outlined,
          label: 'Kehadiran',
          value: attendancePercent == null ? '–' : '$attendancePercent%',
          helper: 'Bulan ini',
          color: AppColors.success,
          onTap: onAttendance,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _StudentStatCard(
          icon: Icons.star_rounded,
          label: 'Nilai',
          value: averageScore?.toStringAsFixed(1).replaceAll('.', ',') ?? '–',
          helper: 'Rata-rata',
          color: AppColors.warning,
          onTap: onGrades,
        ),
      ),
    ],
  );
}

class _StudentStatCard extends StatelessWidget {
  const _StudentStatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.helper,
    required this.color,
    this.onTap,
  });
  final IconData icon;
  final String label;
  final String value;
  final String helper;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 5),
            Text(
              label,
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
            ),
            Text(
              value,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
            ),
            Text(
              helper,
              style: const TextStyle(color: AppColors.muted, fontSize: 9),
            ),
          ],
        ),
      ),
    ),
  );
}

@Deprecated('Use the current student dashboard')
class LegacyStudentHomeScreen extends ConsumerWidget {
  const LegacyStudentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(studentDashboardProvider);
    return async.when(
      loading: () => const SafeArea(
        child: LoadingView(label: 'Menyiapkan ruang belajar...'),
      ),
      error: (error, _) => SafeArea(
        child: ErrorView(
          message: '$error',
          onRetry: () => ref.invalidate(studentDashboardProvider),
        ),
      ),
      data: (data) => RefreshIndicator(
        onRefresh: () => ref.refresh(studentDashboardProvider.future),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
              sliver: SliverList.list(
                children: [
                  StudentIdentityCard(
                    name: data.name,
                    className: data.className,
                    schoolName: data.schoolName,
                    teacherName: data.teacherName,
                    attendancePercent: data.attendancePercent,
                  ),
                  Consumer(
                    builder: (context, ref, _) => ref
                        .watch(mobileBannerProvider)
                        .when(
                          loading: () => const SizedBox.shrink(),
                          error: (_, _) => const SizedBox.shrink(),
                          data: (display) => display.slides.isEmpty
                              ? const SizedBox.shrink()
                              : Padding(
                                  padding: const EdgeInsets.only(top: 18),
                                  child: MobileBannerCarousel(display: display),
                                ),
                        ),
                  ),
                  const SizedBox(height: 18),
                  InsightStrip(
                    items: [
                      InsightMetric(
                        label: 'Tugas aktif',
                        value: '${data.pendingAssignments}',
                        icon: Icons.assignment_outlined,
                        color: AppColors.blue,
                      ),
                      InsightMetric(
                        label: 'Kehadiran',
                        value: data.attendancePercent == null
                            ? '–'
                            : '${data.attendancePercent}%',
                        icon: Icons.event_available_outlined,
                        color: AppColors.success,
                      ),
                      InsightMetric(
                        label: 'Nilai rata-rata',
                        value: data.averageScore?.toStringAsFixed(1) ?? '–',
                        icon: Icons.bar_chart_rounded,
                        color: AppColors.warning,
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const SectionHeading(title: 'Akses Cepat'),
                  const SizedBox(height: 10),
                  QuickAccessRail(
                    items: [
                      QuickMenuItem(
                        label: 'PJJ',
                        icon: Icons.video_camera_front_outlined,
                        color: AppColors.blue,
                        onTap: () => _openStudentPage(
                          context,
                          'PJJ',
                          const _StudentPjjScreen(),
                        ),
                      ),
                      QuickMenuItem(
                        label: 'TKA',
                        icon: Icons.psychology_outlined,
                        color: AppColors.cyan,
                        onTap: () => _pushStudentFeaturePage(
                          context,
                          const StudentTkaScreen(),
                        ),
                      ),
                      QuickMenuItem(
                        label: 'Zona Baca',
                        icon: Icons.auto_stories_outlined,
                        color: AppColors.success,
                        onTap: () => _pushStudentFeaturePage(
                          context,
                          const StudentReadingScreen(),
                        ),
                      ),
                      QuickMenuItem(
                        label: 'Nilai',
                        icon: Icons.bar_chart_rounded,
                        color: AppColors.violet,
                        onTap: () => _openStudentPage(
                          context,
                          'Nilai',
                          const _StudentGradesScreen(),
                        ),
                      ),
                    ],
                  ),
                  if (data.pjj.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    const SectionHeading(
                      title: 'Kelas PJJ Mendatang',
                      subtitle: 'Masuk sesuai jadwal yang ditentukan guru.',
                    ),
                    const SizedBox(height: 10),
                    _PjjCard(item: data.pjj.first),
                  ],
                  const SizedBox(height: 24),
                  const SectionHeading(
                    title: 'Yang Akan Datang',
                    action: 'Lihat semua',
                  ),
                  const SizedBox(height: 10),
                  ...[...data.assignments, ...data.quizzes, ...data.exams]
                      .take(3)
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _LearningCard(item: item),
                        ),
                      ),
                  if (data.assignments.isEmpty &&
                      data.quizzes.isEmpty &&
                      data.exams.isEmpty)
                    const EmptyCard(
                      icon: Icons.task_alt_rounded,
                      title: 'Semua tugas selesai',
                      message: 'Belum ada tugas baru dari guru.',
                    ),
                  if (data.reading.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    const SectionHeading(
                      title: 'Lanjutkan Membaca',
                      subtitle: 'Progres Zona Baca tersimpan otomatis.',
                    ),
                    const SizedBox(height: 10),
                    _ReadingCard(item: data.reading.first),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StudentLearningScreen extends ConsumerStatefulWidget {
  const _StudentLearningScreen({this.initialTab = 2});
  final int initialTab;

  @override
  ConsumerState<_StudentLearningScreen> createState() =>
      _StudentLearningScreenState();
}

class _StudentLearningScreenState
    extends ConsumerState<_StudentLearningScreen> {
  late int _tab;

  @override
  void initState() {
    super.initState();
    _tab = widget.initialTab;
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(studentDashboardProvider);
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Pilih jenis evaluasi',
                  style: TextStyle(
                    color: AppColors.muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: SegmentedButton<int>(
                    segments: const [
                      ButtonSegment(value: 2, label: Text('Ujian')),
                      ButtonSegment(value: 3, label: Text('TKA')),
                    ],
                    selected: {_tab},
                    showSelectedIcon: false,
                    onSelectionChanged: (value) =>
                        setState(() => _tab = value.first),
                  ),
                ),
              ],
            ),
          ),
        ),
        async.when(
          loading: () => const SliverFillRemaining(child: LoadingView()),
          error: (error, _) => SliverFillRemaining(
            child: ErrorView(
              message: '$error',
              onRetry: () => ref.invalidate(studentDashboardProvider),
            ),
          ),
          data: (data) {
            if (_tab == 2) return _LearningList(items: data.exams);
            return _TkaList(items: data.tkaPackages);
          },
        ),
      ],
    );
  }
}

class _LearningList extends StatelessWidget {
  const _LearningList({required this.items});
  final List<LearningItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SliverFillRemaining(
        child: Center(child: Text('Belum ada aktivitas belajar.')),
      );
    }
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
      sliver: SliverList.separated(
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (_, index) => _LearningCard(item: items[index]),
      ),
    );
  }
}

class _LearningCard extends StatelessWidget {
  const _LearningCard({required this.item});
  final LearningItem item;

  @override
  Widget build(BuildContext context) {
    final color = switch (item.kind) {
      'Kuis' => const Color(0xFF7C3AED),
      'Ujian' => AppColors.danger,
      _ => AppColors.blue,
    };
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => Navigator.push<void>(
          context,
          MaterialPageRoute(
            builder: (_) => StudentLearningDetailScreen(item: item),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(Icons.description_outlined, color: color),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          item.kind,
                          style: TextStyle(
                            color: color,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (item.completed) ...[
                          const SizedBox(width: 7),
                          const Icon(
                            Icons.check_circle_rounded,
                            color: AppColors.success,
                            size: 15,
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.dueAt == null
                          ? item.subject
                          : '${item.subject} • ${DateFormat('d MMM yyyy', 'id_ID').format(item.dueAt!.toLocal())}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
        ),
      ),
    );
  }
}

class _TkaList extends ConsumerWidget {
  const _TkaList({required this.items});
  final List<TkaPackageItem> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (items.isEmpty) {
      return const SliverFillRemaining(
        child: Center(child: Text('Belum ada paket TKA.')),
      );
    }
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
      sliver: SliverList.separated(
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final item = items[index];
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const CircleAvatar(
                        backgroundColor: Color(0xFFDBEAFE),
                        child: Icon(
                          Icons.fact_check_outlined,
                          color: AppColors.blue,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          item.title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(
                    '${item.subject} • ${item.questionCount} soal • ${item.durationMinutes} menit',
                  ),
                  const SizedBox(height: 14),
                  FilledButton.tonalIcon(
                    onPressed: () async {
                      try {
                        final attemptId =
                            item.attemptId ??
                            await ref
                                .read(dashboardRepositoryProvider)
                                .startTka(item.id);
                        if (context.mounted && attemptId.isNotEmpty) {
                          await Navigator.push<void>(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  TkaAttemptScreen(attemptId: attemptId),
                            ),
                          );
                          ref.invalidate(studentDashboardProvider);
                        }
                      } catch (error) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(
                            context,
                          ).showSnackBar(SnackBar(content: Text('$error')));
                        }
                      }
                    },
                    icon: Icon(
                      item.status == 'SUBMITTED'
                          ? Icons.bar_chart_rounded
                          : Icons.play_arrow_rounded,
                    ),
                    label: Text(
                      item.status == 'SUBMITTED'
                          ? 'Lihat Hasil ${item.score?.toStringAsFixed(0) ?? ''}'
                          : 'Mulai Simulasi',
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ReadingCard extends StatelessWidget {
  const _ReadingCard({required this.item});
  final ReadingProgressItem item;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 66,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.blue, AppColors.cyan],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.auto_stories_rounded,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.category,
                    style: const TextStyle(
                      color: AppColors.blue,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 9),
                  Row(
                    children: [
                      Expanded(
                        child: LinearProgressIndicator(
                          value: item.progress / 100,
                          minHeight: 7,
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        '${item.progress}%',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StudentPjjScreen extends ConsumerWidget {
  const _StudentPjjScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(studentDashboardProvider);
    return CustomScrollView(
      slivers: [
        const SliverPadding(
          padding: EdgeInsets.fromLTRB(16, 18, 16, 14),
          sliver: SliverToBoxAdapter(
            child: PageIntro(
              eyebrow: 'Kelas Virtual',
              title: 'Pembelajaran Jarak Jauh',
              description:
                  'Masuk ke ruang belajar langsung bersama guru sesuai jadwal.',
              icon: Icons.video_camera_front_outlined,
            ),
          ),
        ),
        async.when(
          loading: () => const SliverFillRemaining(child: LoadingView()),
          error: (error, _) => SliverFillRemaining(
            child: ErrorView(
              message: '$error',
              onRetry: () => ref.invalidate(studentDashboardProvider),
            ),
          ),
          data: (data) => data.pjj.isEmpty
              ? const SliverFillRemaining(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: EmptyCard(
                      icon: Icons.video_camera_front_outlined,
                      title: 'Belum ada jadwal PJJ',
                      message: 'Jadwal dari guru akan tampil di sini.',
                    ),
                  ),
                )
              : SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverList.separated(
                    itemCount: data.pjj.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (_, index) => _PjjCard(item: data.pjj[index]),
                  ),
                ),
        ),
      ],
    );
  }
}

class _PjjCard extends StatelessWidget {
  // ignore: unused_element_parameter
  const _PjjCard({required this.item, this.compact = false});
  final PjjSessionItem item;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat(
      'EEEE, d MMM • HH:mm',
      'id_ID',
    ).format(item.start.toLocal());
    if (compact) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.blueSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.video_camera_front_rounded,
                  color: AppColors.blue,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.subject,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      date,
                      style: const TextStyle(
                        color: AppColors.blue,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              FilledButton(
                onPressed: () => Navigator.push<void>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => _StudentPjjLobbyScreen(item: item),
                  ),
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(74, 38),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                ),
                child: const Text('Gabung', style: TextStyle(fontSize: 11)),
              ),
            ],
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(18),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.blueSoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.live_tv_rounded,
                  color: AppColors.blue,
                  size: 20,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: item.status == 'LIVE'
                      ? const Color(0xFFECFDF5)
                      : const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  item.status == 'LIVE' ? 'Sedang berlangsung' : 'Terjadwal',
                  style: TextStyle(
                    color: item.status == 'LIVE'
                        ? AppColors.success
                        : AppColors.warning,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            item.title,
            style: const TextStyle(
              color: AppColors.navy,
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 3),
          Text(item.subject, style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 14),
          Text(
            date,
            style: const TextStyle(
              color: AppColors.navy,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (item.teacherName != null)
            Text(
              'Guru: ${item.teacherName}',
              style: const TextStyle(color: AppColors.muted),
            ),
          const SizedBox(height: 16),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.blue,
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(48),
            ),
            onPressed: () {
              final opensAt = item.start.subtract(const Duration(minutes: 30));
              if (DateTime.now().isBefore(opensAt)) {
                showDialog<void>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Kelas belum dibuka'),
                    content: Text(
                      'Ruang dapat dimasuki 30 menit sebelum jadwal, yaitu ${DateFormat('d MMM yyyy, HH:mm', 'id_ID').format(opensAt.toLocal())}.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Mengerti'),
                      ),
                    ],
                  ),
                );
                return;
              }
              Navigator.push<void>(
                context,
                MaterialPageRoute(
                  builder: (_) => _StudentPjjLobbyScreen(item: item),
                ),
              );
            },
            icon: const Icon(Icons.video_call_rounded),
            label: Text(
              item.status == 'LIVE' ? 'Masuk Sekarang' : 'Masuk kelas',
            ),
          ),
        ],
      ),
    );
  }
}

class _StudentPjjLobbyScreen extends StatefulWidget {
  const _StudentPjjLobbyScreen({required this.item});
  final PjjSessionItem item;

  @override
  State<_StudentPjjLobbyScreen> createState() => _StudentPjjLobbyScreenState();
}

class _StudentPjjLobbyScreenState extends State<_StudentPjjLobbyScreen> {
  bool _camera = true;
  bool _microphone = true;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Siap bergabung?')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          widget.item.subject,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 3),
        Text(widget.item.title, style: const TextStyle(color: AppColors.muted)),
        const SizedBox(height: 16),
        AspectRatio(
          aspectRatio: 4 / 3,
          child: Container(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFE8F0FF), Color(0xFFF4F8FF)],
              ),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.border),
            ),
            clipBehavior: Clip.antiAlias,
            child: PjjCameraPreview(enabled: _camera),
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: Column(
            children: [
              SwitchListTile(
                secondary: const Icon(
                  Icons.videocam_outlined,
                  color: AppColors.blue,
                ),
                title: const Text(
                  'Kamera',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(_camera ? 'Depan' : 'Nonaktif'),
                value: _camera,
                onChanged: (value) => setState(() => _camera = value),
              ),
              const Divider(),
              SwitchListTile(
                secondary: const Icon(
                  Icons.mic_none_rounded,
                  color: AppColors.blue,
                ),
                title: const Text(
                  'Mikrofon',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(_microphone ? 'Aktif' : 'Nonaktif'),
                value: _microphone,
                onChanged: (value) => setState(() => _microphone = value),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.network_check_rounded, color: AppColors.muted, size: 18),
            SizedBox(width: 6),
            Flexible(
              child: Text(
                'Kualitas jaringan diukur setelah bergabung',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ),
          ],
        ),
      ],
    ),
    bottomNavigationBar: SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: FilledButton(
        onPressed: () => Navigator.pushReplacement<void, void>(
          context,
          MaterialPageRoute(
            builder: (_) => LiveClassScreen(
              liveSessionId: widget.item.id,
              initialCamera: _camera,
              initialMicrophone: _microphone,
            ),
          ),
        ),
        child: const Text('Gabung sekarang'),
      ),
    ),
  );
}

class _StudentAttendanceScreen extends ConsumerWidget {
  const _StudentAttendanceScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(studentDashboardProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(studentDashboardProvider.future),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          const SliverPadding(
            padding: EdgeInsets.fromLTRB(16, 18, 16, 14),
            sliver: SliverToBoxAdapter(
              child: PageIntro(
                eyebrow: 'Rekap Kehadiran',
                title: 'Absensi siswa',
                description:
                    'Lihat ringkasan kehadiranmu pada periode belajar aktif.',
                icon: Icons.fact_check_outlined,
              ),
            ),
          ),
          async.when(
            loading: () => const SliverFillRemaining(child: LoadingView()),
            error: (error, _) => SliverFillRemaining(
              child: ErrorView(
                message: '$error',
                onRetry: () => ref.invalidate(studentDashboardProvider),
              ),
            ),
            data: (data) => SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              sliver: SliverList.list(
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Row(
                        children: [
                          Container(
                            width: 58,
                            height: 58,
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: const Icon(
                              Icons.event_available_outlined,
                              color: AppColors.success,
                              size: 29,
                            ),
                          ),
                          const SizedBox(width: 15),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Kehadiran bulan ini',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: AppColors.muted,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  data.attendancePercent == null
                                      ? 'Belum tersedia'
                                      : '${data.attendancePercent}%',
                                  style: const TextStyle(
                                    fontSize: 30,
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.navy,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  _AttendanceSummary(
                    present: data.attendanceCounts['PRESENT'] ?? 0,
                    excused: data.attendanceCounts['EXCUSED'] ?? 0,
                    sick: data.attendanceCounts['SICK'] ?? 0,
                    absent: data.attendanceCounts['ABSENT'] ?? 0,
                  ),
                  const SizedBox(height: 14),
                  const EmptyCard(
                    icon: Icons.calendar_month_outlined,
                    title: 'Riwayat kehadiran',
                    message:
                        'Rincian absensi harian dari sekolah akan tampil di bagian ini.',
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

class _AttendanceSummary extends StatelessWidget {
  const _AttendanceSummary({
    required this.present,
    required this.excused,
    required this.sick,
    required this.absent,
  });
  final int present;
  final int excused;
  final int sick;
  final int absent;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
      child: Row(
        children: [
          _AttendanceMetric(
            label: 'Hadir',
            value: present,
            color: AppColors.success,
          ),
          _AttendanceMetric(
            label: 'Izin',
            value: excused,
            color: AppColors.warning,
          ),
          _AttendanceMetric(label: 'Sakit', value: sick, color: AppColors.cyan),
          _AttendanceMetric(
            label: 'Alpa',
            value: absent,
            color: AppColors.danger,
          ),
        ],
      ),
    ),
  );
}

class _AttendanceMetric extends StatelessWidget {
  const _AttendanceMetric({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          '$value',
          style: TextStyle(
            color: color,
            fontSize: 20,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.muted,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _StudentGradesScreen extends ConsumerWidget {
  const _StudentGradesScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(studentDashboardProvider);
    return CustomScrollView(
      slivers: [
        const SliverPadding(
          padding: EdgeInsets.fromLTRB(16, 18, 16, 14),
          sliver: SliverToBoxAdapter(
            child: PageIntro(
              eyebrow: 'Hasil Belajar',
              title: 'Nilai siswa',
              description:
                  'Pantau capaian tugas, kuis, ujian, dan TKA secara ringkas.',
              icon: Icons.bar_chart_rounded,
            ),
          ),
        ),
        async.when(
          loading: () => const SliverFillRemaining(child: LoadingView()),
          error: (error, _) => SliverFillRemaining(
            child: ErrorView(
              message: '$error',
              onRetry: () => ref.invalidate(studentDashboardProvider),
            ),
          ),
          data: (data) {
            final scored = [
              ...data.assignments,
              ...data.quizzes,
              ...data.exams,
            ].where((item) => item.score != null).toList();
            return SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              sliver: SliverList.list(
                children: [
                  SizedBox(
                    height: 132,
                    child: Row(
                      children: [
                        Expanded(
                          child: StatTile(
                            label: 'Rata-rata',
                            value: data.averageScore?.toStringAsFixed(1) ?? '–',
                            icon: Icons.workspace_premium_outlined,
                            color: AppColors.warning,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: StatTile(
                            label: 'Sudah dinilai',
                            value: '${scored.length}',
                            icon: Icons.task_alt_rounded,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  const SectionHeading(title: 'Rincian nilai'),
                  const SizedBox(height: 10),
                  if (scored.isEmpty)
                    const EmptyCard(
                      icon: Icons.bar_chart_rounded,
                      title: 'Belum ada nilai',
                      message:
                          'Nilai yang sudah diterbitkan guru akan tampil di sini.',
                    )
                  else
                    ...scored.map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _LearningCard(item: item),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _StudentMenuSheet extends StatelessWidget {
  const _StudentMenuSheet({required this.user, required this.onTab});
  final AppUser user;
  final ValueChanged<int> onTab;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.only(top: 70),
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SingleChildScrollView(
          child: Column(
            children: [
              Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(5),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: const Color(0xFFDBEAFE),
                    child: Text(
                      user.name.isEmpty ? 'S' : user.name[0].toUpperCase(),
                      style: const TextStyle(
                        color: AppColors.blue,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.name,
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        const Text(
                          'Portal Siswa',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              QuickMenuGrid(
                title: 'Semua Fitur',
                items: [
                  QuickMenuItem(
                    label: 'Beranda',
                    icon: Icons.home_outlined,
                    color: AppColors.blue,
                    onTap: () => onTab(0),
                  ),
                  QuickMenuItem(
                    label: 'PJJ',
                    icon: Icons.video_camera_front_outlined,
                    color: AppColors.cyan,
                    onTap: () => onTab(2),
                  ),
                  QuickMenuItem(
                    label: 'Tugas',
                    icon: Icons.assignment_outlined,
                    color: AppColors.blue,
                    onTap: () => onTab(1),
                  ),
                  QuickMenuItem(
                    label: 'Kuis',
                    icon: Icons.quiz_outlined,
                    color: AppColors.violet,
                    onTap: () {
                      Navigator.pop(context);
                      _pushStudentFeaturePage(
                        context,
                        const StudentQuizScreen(),
                      );
                    },
                  ),
                  QuickMenuItem(
                    label: 'Ujian',
                    icon: Icons.fact_check_outlined,
                    color: AppColors.danger,
                    onTap: () {
                      Navigator.pop(context);
                      _openStudentPage(
                        context,
                        'Ujian',
                        const _StudentLearningScreen(initialTab: 2),
                      );
                    },
                  ),
                  QuickMenuItem(
                    label: 'TKA',
                    icon: Icons.psychology_outlined,
                    color: AppColors.cyan,
                    onTap: () {
                      Navigator.pop(context);
                      _pushStudentFeaturePage(
                        context,
                        const StudentTkaScreen(),
                      );
                    },
                  ),
                  QuickMenuItem(
                    label: 'Kehadiran',
                    icon: Icons.fact_check_outlined,
                    color: AppColors.success,
                    onTap: () {
                      Navigator.pop(context);
                      _openStudentPage(
                        context,
                        'Kehadiran',
                        const _StudentAttendanceScreen(),
                      );
                    },
                  ),
                  QuickMenuItem(
                    label: 'Nilai',
                    icon: Icons.bar_chart_rounded,
                    color: AppColors.warning,
                    onTap: () {
                      Navigator.pop(context);
                      _openStudentPage(
                        context,
                        'Nilai Siswa',
                        const _StudentGradesScreen(),
                      );
                    },
                  ),
                  QuickMenuItem(
                    label: 'Pemberitahuan',
                    icon: Icons.notifications_outlined,
                    color: const Color(0xFF7C3AED),
                    onTap: () => onTab(3),
                  ),
                  QuickMenuItem(
                    label: 'Profil',
                    icon: Icons.person_outline_rounded,
                    color: const Color(0xFF475569),
                    onTap: () => onTab(4),
                  ),
                  QuickMenuItem(
                    label: 'Zona Baca',
                    icon: Icons.auto_stories_outlined,
                    color: AppColors.success,
                    onTap: () {
                      Navigator.pop(context);
                      _pushStudentFeaturePage(
                        context,
                        const StudentReadingScreen(),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
