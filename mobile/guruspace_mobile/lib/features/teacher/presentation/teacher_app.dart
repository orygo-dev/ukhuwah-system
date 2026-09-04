import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/core/widgets/dashboard_components.dart';
import 'package:guruspace_mobile/core/widgets/mobile_web_shell.dart';
import 'package:guruspace_mobile/core/widgets/mobile_banner_carousel.dart';
import 'package:guruspace_mobile/core/widgets/dashboard_popup_ad.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/shared/presentation/live_class_screen.dart';
import 'package:guruspace_mobile/features/shared/presentation/native_data_screen.dart';
import 'package:guruspace_mobile/features/shared/presentation/notifications_screen.dart';
import 'package:guruspace_mobile/features/shared/presentation/profile_screen.dart';
import 'package:guruspace_mobile/features/teacher/presentation/assistant_screen.dart';
import 'package:guruspace_mobile/features/teacher/presentation/teacher_student_accounts_screen.dart';
import 'package:guruspace_mobile/features/teacher/presentation/teacher_content_review_screen.dart';
import 'package:guruspace_mobile/features/teacher/presentation/teacher_spotlight_reports_screen.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/teacher_spotlight_screen.dart';

class TeacherApp extends StatefulWidget {
  const TeacherApp({super.key, required this.user});
  final AppUser user;

  @override
  State<TeacherApp> createState() => _TeacherAppState();
}

class _TeacherAppState extends State<TeacherApp> {
  int _index = 0;

  @override
  void didUpdateWidget(covariant TeacherApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.id != widget.user.id) _index = 0;
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _TeacherHomeScreen(user: widget.user),
      TeacherSpotlightScreen(
        user: widget.user,
        onBack: () => setState(() => _index = 0),
      ),
      const TeacherAssistantScreen(),
      const _TeacherMessagesScreen(),
    ];
    return DashboardPopupAdHost(
      child: Scaffold(
        appBar: _index == 1
            ? null
            : MobileWebHeader(
                onNotifications: () => Navigator.push<void>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const NotificationsScreen(),
                  ),
                ),
              ),
        body: IndexedStack(index: _index, children: pages),
        bottomNavigationBar: _index == 1
            ? null
            : MobileWebBottomNav(
                index: _index,
                onChanged: (value) {
                  if (value == 4) {
                    _showMenu();
                    return;
                  }
                  setState(() => _index = value);
                },
                items: const [
                  WebBottomNavItem(label: 'Beranda', icon: Icons.home_outlined),
                  WebBottomNavItem(
                    label: 'Zona Kreasi',
                    icon: Icons.play_circle_outline_rounded,
                  ),
                  WebBottomNavItem(
                    label: 'Assistant',
                    icon: Icons.auto_awesome_rounded,
                    primary: true,
                  ),
                  WebBottomNavItem(
                    label: 'Pesan',
                    icon: Icons.chat_bubble_outline_rounded,
                  ),
                  WebBottomNavItem(
                    label: 'Menu',
                    icon: Icons.grid_view_rounded,
                  ),
                ],
              ),
      ),
    );
  }

  void _showMenu() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TeacherMenuSheet(user: widget.user),
    );
  }
}

void _openTeacherPage(BuildContext context, String title, Widget page) {
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

class _TeacherHomeScreen extends ConsumerWidget {
  const _TeacherHomeScreen({required this.user});
  final AppUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(teacherDashboardProvider);
    return async.when(
      loading: () => const SafeArea(
        child: LoadingView(label: 'Menyiapkan ruang mengajar...'),
      ),
      error: (error, _) => SafeArea(
        child: ErrorView(
          message: '$error',
          onRetry: () => ref.invalidate(teacherDashboardProvider),
        ),
      ),
      data: (data) => RefreshIndicator(
        onRefresh: () => ref.refresh(teacherDashboardProvider.future),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
              sliver: SliverList.list(
                children: [
                  TeacherProfileHero(
                    name: data.name,
                    schoolName: data.schoolName,
                    classCount: data.activeClasses,
                    studentCount: data.activeStudents,
                    credits: user.creditsRemaining,
                    avatarUrl: user.avatarUrl,
                    classNames: data.classes.map((item) => item.name).toList(),
                    onProfile: () => Navigator.push<void>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ProfileScreen(user: user),
                      ),
                    ),
                    onTopUp: () => openNativeDataScreen(
                      context,
                      title: 'Top Up Kredit',
                      description: 'Pilih paket kredit untuk kebutuhan AI.',
                      icon: Icons.monetization_on_outlined,
                      endpoint: '/api/credit-packages',
                      listKeys: const ['packages'],
                    ),
                    onHistory: () => openNativeDataScreen(
                      context,
                      title: 'Riwayat Kredit',
                      description: 'Pantau saldo dan aktivitas kredit akun.',
                      icon: Icons.history_rounded,
                      endpoint: '/api/reward/me',
                    ),
                    membershipPlanName: user.membershipPlan?.name,
                  ),
                  const SizedBox(height: 18),
                  QuickMenuGrid(
                    items: [
                      QuickMenuItem(
                        label: 'Kelas',
                        subtitle: 'Kelola kelas',
                        icon: Icons.school_outlined,
                        color: AppColors.blue,
                        onTap: () => _openTeacherPage(
                          context,
                          'Kelas & Siswa',
                          const _TeacherClassesScreen(),
                        ),
                      ),
                      QuickMenuItem(
                        label: 'Jurnal',
                        subtitle: 'Jurnal mengajar',
                        icon: Icons.edit_note_rounded,
                        color: AppColors.success,
                        onTap: () => openNativeDataScreen(
                          context,
                          title: 'Jurnal',
                          description: 'Catat dan pantau jurnal pembelajaran.',
                          icon: Icons.edit_note_rounded,
                          endpoint: '/api/journals',
                          listKeys: const ['journals'],
                        ),
                      ),
                      QuickMenuItem(
                        label: 'Absensi',
                        subtitle: 'Absensi siswa',
                        icon: Icons.fact_check_outlined,
                        color: AppColors.cyan,
                        onTap: () => _openTeacherPage(
                          context,
                          'Absensi',
                          const _TeacherClassesScreen(),
                        ),
                      ),
                      QuickMenuItem(
                        label: 'Penilaian',
                        subtitle: 'Input nilai',
                        icon: Icons.grading_outlined,
                        color: const Color(0xFF7C3AED),
                        onTap: () => openNativeDataScreen(
                          context,
                          title: 'Penilaian',
                          description:
                              'Kelola asesmen dan hasil belajar siswa.',
                          icon: Icons.grading_outlined,
                          endpoint: '/api/grading/assessments',
                          listKeys: const ['assessments'],
                        ),
                      ),
                      QuickMenuItem(
                        label: 'Dokumen',
                        subtitle: 'Materi & file',
                        icon: Icons.description_outlined,
                        color: const Color(0xFF475569),
                        onTap: () => openNativeDataScreen(
                          context,
                          title: 'Dokumen',
                          description: 'Dokumen pembelajaran yang tersimpan.',
                          icon: Icons.description_outlined,
                          endpoint: '/api/documents',
                          listKeys: const ['documents'],
                        ),
                      ),
                      QuickMenuItem(
                        label: 'PJJ',
                        subtitle: 'Kelas online',
                        icon: Icons.video_camera_front_outlined,
                        color: const Color(0xFFEA580C),
                        onTap: () => _openTeacherPage(
                          context,
                          'Kelas PJJ',
                          const _TeacherActivityScreen(),
                        ),
                      ),
                    ],
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
                  const SizedBox(height: 24),
                  InsightStrip(
                    title: 'Insight Aktivitas',
                    period: '7 hari terakhir',
                    items: [
                      InsightMetric(
                        label: 'Materi',
                        value: '${data.activeClasses}',
                        helper: 'Dibagikan',
                        icon: Icons.menu_book_outlined,
                        color: AppColors.blue,
                      ),
                      InsightMetric(
                        label: 'Kehadiran',
                        value: data.attendancePercent == null
                            ? '–'
                            : '${data.attendancePercent}%',
                        helper: '7 hari',
                        icon: Icons.event_available_outlined,
                        color: AppColors.success,
                      ),
                      InsightMetric(
                        label: 'Dinilai',
                        value: '${data.pendingGrading}',
                        helper: 'Tugas',
                        icon: Icons.rate_review_outlined,
                        color: AppColors.warning,
                      ),
                      InsightMetric(
                        label: 'Siswa',
                        value: '${data.activeStudents}',
                        helper: 'Aktif',
                        icon: Icons.forum_outlined,
                        color: AppColors.violet,
                      ),
                    ],
                  ),
                  if (data.pjj.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const SectionHeading(title: 'PJJ Mendatang'),
                    const SizedBox(height: 10),
                    _TeacherPjjCard(item: data.pjj.first),
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

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          child: Column(
            children: [
              CircleAvatar(
                backgroundColor: color.withValues(alpha: .1),
                child: Icon(icon, color: color),
              ),
              const SizedBox(height: 9),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TeacherClassesScreen extends ConsumerWidget {
  const _TeacherClassesScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(teacherDashboardProvider);
    return CustomScrollView(
      slivers: [
        async.when(
          loading: () => const SliverFillRemaining(child: LoadingView()),
          error: (error, _) => SliverFillRemaining(
            child: ErrorView(
              message: '$error',
              onRetry: () => ref.invalidate(teacherDashboardProvider),
            ),
          ),
          data: (data) => data.classes.isEmpty
              ? const SliverFillRemaining(
                  child: Center(child: Text('Belum ada kelas aktif.')),
                )
              : SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
                  sliver: SliverList.separated(
                    itemCount: data.classes.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = data.classes[index];
                      return Card(
                        child: ListTile(
                          minTileHeight: 82,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          leading: CircleAvatar(
                            backgroundColor: const Color(0xFFE8F6EA),
                            child: Text(
                              item.name.isEmpty
                                  ? 'K'
                                  : item.name.substring(0, 1),
                              style: const TextStyle(
                                color: AppColors.blue,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          title: Text(
                            item.name,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Text(
                            '${item.level} • ${item.students} siswa • ${item.deliveryMode}',
                          ),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => item.teacherId == data.teacherId
                                  ? TeacherStudentAccountsScreen(
                                      classRoom: item,
                                      attendancePage: AttendanceEditorScreen(
                                        classRoom: item,
                                      ),
                                    )
                                  : AttendanceEditorScreen(classRoom: item),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

class AttendanceEditorScreen extends ConsumerStatefulWidget {
  const AttendanceEditorScreen({super.key, required this.classRoom});
  final TeacherClassItem classRoom;

  @override
  ConsumerState<AttendanceEditorScreen> createState() =>
      _AttendanceEditorScreenState();
}

class _AttendanceEditorScreenState
    extends ConsumerState<AttendanceEditorScreen> {
  Map<String, dynamic>? _session;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  final Map<String, String> _statuses = {};

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await ref
          .read(apiClientProvider)
          .postJson(
            '/api/attendance/sessions',
            data: {
              'classRoomId': widget.classRoom.id,
              'date': DateFormat('yyyy-MM-dd').format(DateTime.now()),
              'mapel': '',
              'jamKe': 0,
            },
          );
      final session = Map<String, dynamic>.from(json['session'] as Map);
      final records = (session['records'] as List? ?? const [])
          .whereType<Map>();
      _statuses
        ..clear()
        ..addEntries(
          records.map(
            (record) => MapEntry(
              record['studentId'].toString(),
              record['status']?.toString() ?? 'PRESENT',
            ),
          ),
        );
      if (!mounted) return;
      setState(() => _session = session);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_session == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(apiClientProvider).patchJson(
        '/api/attendance/sessions/${_session!['id']}',
        {
          'records': _statuses.entries
              .map((item) => {'studentId': item.key, 'status': item.value})
              .toList(),
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Absensi berhasil disimpan.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.classRoom.name)),
      body: _loading
          ? const LoadingView(label: 'Menyiapkan absensi...')
          : _error != null
          ? ErrorView(message: _error!, onRetry: _loadSession)
          : _buildRecords(),
      bottomNavigationBar: _session == null
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check_circle_outline_rounded),
                label: const Text('Simpan Absensi'),
              ),
            ),
    );
  }

  Widget _buildRecords() {
    final records = (_session!['records'] as List? ?? const [])
        .whereType<Map>()
        .toList();
    final counts = <String, int>{
      for (final value in ['PRESENT', 'EXCUSED', 'SICK', 'ABSENT']) value: 0,
    };
    for (final status in _statuses.values) {
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 110),
      children: [
        Row(
          children: [
            _CountChip(
              label: 'Hadir',
              value: counts['PRESENT']!,
              color: AppColors.success,
            ),
            _CountChip(
              label: 'Izin',
              value: counts['EXCUSED']!,
              color: AppColors.warning,
            ),
            _CountChip(
              label: 'Sakit',
              value: counts['SICK']!,
              color: AppColors.danger,
            ),
            _CountChip(
              label: 'Alpa',
              value: counts['ABSENT']!,
              color: AppColors.muted,
            ),
          ],
        ),
        const SizedBox(height: 14),
        ...records.map((record) {
          final student = Map<String, dynamic>.from(
            record['student'] as Map? ?? {},
          );
          final studentId = record['studentId'].toString();
          return Card(
            margin: const EdgeInsets.only(bottom: 9),
            child: ListTile(
              leading: CircleAvatar(
                child: Text(
                  student['name']?.toString().substring(0, 1).toUpperCase() ??
                      'S',
                ),
              ),
              title: Text(
                student['name']?.toString() ?? 'Siswa',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                student['nis']?.toString() ?? 'NIS belum tersedia',
              ),
              trailing: DropdownButton<String>(
                value: _statuses[studentId] ?? 'PRESENT',
                underline: const SizedBox.shrink(),
                items: const [
                  DropdownMenuItem(value: 'PRESENT', child: Text('Hadir')),
                  DropdownMenuItem(value: 'EXCUSED', child: Text('Izin')),
                  DropdownMenuItem(value: 'SICK', child: Text('Sakit')),
                  DropdownMenuItem(value: 'ABSENT', child: Text('Alpa')),
                ],
                onChanged: (value) =>
                    setState(() => _statuses[studentId] = value ?? 'PRESENT'),
              ),
            ),
          );
        }),
      ],
    );
  }
}

class _CountChip extends StatelessWidget {
  const _CountChip({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: .1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              '$value',
              style: TextStyle(fontWeight: FontWeight.w900, color: color),
            ),
            Text(label, style: const TextStyle(fontSize: 10)),
          ],
        ),
      ),
    );
  }
}

class _TeacherActivityScreen extends ConsumerWidget {
  const _TeacherActivityScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(teacherDashboardProvider);
    return CustomScrollView(
      slivers: [
        const SliverPadding(
          padding: EdgeInsets.fromLTRB(16, 18, 16, 14),
          sliver: SliverToBoxAdapter(
            child: PageIntro(
              eyebrow: 'Kelas Virtual',
              title: 'PJJ & aktivitas',
              description:
                  'Kelola jadwal pembelajaran langsung dan aktivitas kelas.',
              icon: Icons.video_camera_front_outlined,
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          sliver: SliverToBoxAdapter(
            child: Row(
              children: [
                Expanded(
                  child: _QuickAction(
                    icon: Icons.assignment_add,
                    label: 'Buat Tugas',
                    color: AppColors.cyan,
                    onTap: () => openNativeDataScreen(
                      context,
                      title: 'Tugas',
                      description: 'Kelola tugas untuk kelas aktif.',
                      icon: Icons.assignment_add,
                      endpoint: '/api/assignments',
                      listKeys: const ['assignments'],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _QuickAction(
                    icon: Icons.video_call_rounded,
                    label: 'Mulai PJJ',
                    color: AppColors.blue,
                    onTap: () => openNativeDataScreen(
                      context,
                      title: 'Kelola PJJ',
                      description: 'Jadwal dan sesi pembelajaran jarak jauh.',
                      icon: Icons.video_call_rounded,
                      endpoint: '/api/pjj/sessions',
                      listKeys: const ['sessions', 'classes'],
                    ),
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
              onRetry: () => ref.invalidate(teacherDashboardProvider),
            ),
          ),
          data: (data) => data.pjj.isEmpty
              ? const SliverFillRemaining(
                  child: Center(child: Text('Belum ada jadwal PJJ.')),
                )
              : SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
                  sliver: SliverList.separated(
                    itemCount: data.pjj.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, index) =>
                        _TeacherPjjCard(item: data.pjj[index]),
                  ),
                ),
        ),
      ],
    );
  }
}

class _TeacherPjjCard extends StatelessWidget {
  const _TeacherPjjCard({required this.item});
  final PjjSessionItem item;

  @override
  Widget build(BuildContext context) {
    final start = item.start.toLocal();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 54,
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: BoxDecoration(
                color: AppColors.blueSoft,
                borderRadius: BorderRadius.circular(AppRadii.medium),
              ),
              child: Column(
                children: [
                  Text(
                    DateFormat('EEE', 'id_ID').format(start).toUpperCase(),
                    style: const TextStyle(
                      color: AppColors.blue,
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    DateFormat('dd').format(start),
                    style: const TextStyle(
                      color: AppColors.navy,
                      fontSize: 21,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    DateFormat('MMM', 'id_ID').format(start),
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.status == 'LIVE' ? 'LIVE SEKARANG' : 'PJJ MENDATANG',
                    style: TextStyle(
                      color: item.status == 'LIVE'
                          ? AppColors.danger
                          : AppColors.blue,
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      letterSpacing: .5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${DateFormat('HH:mm').format(start)} · ${item.subject}${item.className == null ? '' : ' · ${item.className}'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            FilledButton(
              onPressed: () => Navigator.push<void>(
                context,
                MaterialPageRoute(
                  builder: (_) => LiveClassScreen(liveSessionId: item.id),
                ),
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size(0, 40),
                padding: const EdgeInsets.symmetric(horizontal: 12),
              ),
              child: Text(item.status == 'LIVE' ? 'Masuk' : 'Kelola'),
            ),
          ],
        ),
      ),
    );
  }
}

final conversationsProvider = FutureProvider<List<Map<String, dynamic>>>((
  ref,
) async {
  ref.watch(authenticatedUserIdProvider);
  final json = await ref
      .watch(apiClientProvider)
      .getJson('/api/chat/conversations');
  final data = json['conversations'];
  return data is List
      ? data
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList()
      : const [];
});

class _TeacherMessagesScreen extends ConsumerWidget {
  const _TeacherMessagesScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(conversationsProvider);
    return CustomScrollView(
      slivers: [
        const SliverPadding(
          padding: EdgeInsets.fromLTRB(16, 18, 16, 14),
          sliver: SliverToBoxAdapter(
            child: PageIntro(
              eyebrow: 'Komunikasi',
              title: 'Pesan',
              description: 'Terhubung dengan komunitas belajar GuruSpace.',
              icon: Icons.chat_bubble_outline_rounded,
            ),
          ),
        ),
        async.when(
          loading: () => const SliverFillRemaining(child: LoadingView()),
          error: (error, _) => SliverFillRemaining(
            child: ErrorView(
              message: '$error',
              onRetry: () => ref.invalidate(conversationsProvider),
            ),
          ),
          data: (items) => items.isEmpty
              ? const SliverFillRemaining(
                  child: Center(child: Text('Belum ada percakapan.')),
                )
              : SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
                  sliver: SliverList.separated(
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, index) {
                      final item = items[index];
                      return Card(
                        child: ListTile(
                          leading: const CircleAvatar(
                            backgroundColor: Color(0xFFE8F6EA),
                            child: Icon(
                              Icons.smart_toy_outlined,
                              color: AppColors.blue,
                            ),
                          ),
                          title: Text(
                            item['title']?.toString() ?? 'Percakapan GuruSpace',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Text(
                            item['updatedAt']?.toString() ?? '',
                            maxLines: 1,
                          ),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () => showModalBottomSheet<void>(
                            context: context,
                            builder: (_) => SafeArea(
                              child: Padding(
                                padding: const EdgeInsets.all(20),
                                child: Text(
                                  item['lastMessage']?.toString() ??
                                      'Belum ada isi percakapan.',
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

class TeacherMenuSheet extends ConsumerWidget {
  const TeacherMenuSheet({super.key, required this.user});

  final AppUser user;

  static const _menuColors = [
    Color(0xFF007A33),
    Color(0xFF39B54A),
    Color(0xFF16A34A),
    Color(0xFF7C3AED),
    Color(0xFFF59E0B),
    Color(0xFFF43F5E),
    Color(0xFF4F46E5),
  ];

  static const _generatorGroups = [
    _GeneratorMenuGroup(
      title: 'Perangkat Ajar',
      icon: Icons.menu_book_outlined,
      tools: [
        _GeneratorMenuTool('Modul Ajar / RPP', 'modul-ajar'),
        _GeneratorMenuTool('ATP', 'atp'),
        _GeneratorMenuTool('Bahan Ajar', 'bahan-ajar'),
        _GeneratorMenuTool('PROTA', 'prota'),
        _GeneratorMenuTool('PROMES', 'prosem'),
        _GeneratorMenuTool('LKPD', 'lkpd'),
        _GeneratorMenuTool('Silabus', 'silabus'),
      ],
    ),
    _GeneratorMenuGroup(
      title: 'Asesmen & Soal',
      icon: Icons.fact_check_outlined,
      tools: [
        _GeneratorMenuTool('Asesmen Diagnostik', 'asesmen-diagnostik'),
        _GeneratorMenuTool('Kisi-kisi Soal', 'kisi-kisi-soal'),
        _GeneratorMenuTool('Kartu Soal', 'kartu-soal'),
        _GeneratorMenuTool('Bank Soal', 'bank-soal'),
        _GeneratorMenuTool('Rubrik', 'rubrik'),
      ],
    ),
    _GeneratorMenuGroup(
      title: 'Tindak Lanjut Nilai',
      icon: Icons.school_outlined,
      tools: [
        _GeneratorMenuTool('Analisis Penilaian', 'analisis-penilaian'),
        _GeneratorMenuTool('Remedial & Pengayaan', 'remedial-pengayaan'),
        _GeneratorMenuTool('Narasi Rapor', 'narasi-rapor'),
      ],
    ),
    _GeneratorMenuGroup(
      title: 'Administrasi Kelas',
      icon: Icons.edit_note_rounded,
      tools: [_GeneratorMenuTool('Jurnal Mengajar', 'jurnal-mengajar')],
    ),
    _GeneratorMenuGroup(
      title: 'Surat & Administrasi',
      icon: Icons.description_outlined,
      tools: [_GeneratorMenuTool('Surat Dinas', 'surat-dinas')],
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    void openPage(String title, Widget page) {
      Navigator.pop(context);
      _openTeacherPage(context, title, page);
    }

    void openData({
      required String title,
      required String description,
      required IconData icon,
      required String endpoint,
      List<String> listKeys = const [],
    }) {
      Navigator.pop(context);
      openNativeDataScreen(
        context,
        title: title,
        description: description,
        icon: icon,
        endpoint: endpoint,
        listKeys: listKeys,
      );
    }

    void openAssistant([String? slug]) {
      openPage(
        slug == null ? 'AI Assistant' : 'Generator AI',
        TeacherAssistantScreen(initialToolSlug: slug),
      );
    }

    final learning = [
      _MenuSheetItem(
        'Kelas & Siswa',
        Icons.school_outlined,
        () => openPage('Kelas & Siswa', const _TeacherClassesScreen()),
      ),
      _MenuSheetItem(
        'Kelas PJJ',
        Icons.video_camera_front_outlined,
        () => openPage('Kelas PJJ', const _TeacherActivityScreen()),
      ),
      _MenuSheetItem(
        'Tugas / PR',
        Icons.assignment_outlined,
        () => openData(
          title: 'Tugas / PR',
          description: 'Kelola tugas untuk kelas aktif.',
          icon: Icons.assignment_outlined,
          endpoint: '/api/assignments',
          listKeys: const ['assignments'],
        ),
      ),
      _MenuSheetItem(
        'Ujian Online',
        Icons.fact_check_outlined,
        () => openData(
          title: 'Ujian Online',
          description: 'Kelola jadwal dan paket ujian.',
          icon: Icons.fact_check_outlined,
          endpoint: '/api/exams',
          listKeys: const ['exams'],
        ),
      ),
      _MenuSheetItem(
        'TKA',
        Icons.psychology_outlined,
        () => openData(
          title: 'TKA',
          description: 'Kelola paket dan bank soal TKA.',
          icon: Icons.psychology_outlined,
          endpoint: '/api/tka/packages',
          listKeys: const ['packages'],
        ),
      ),
      _MenuSheetItem(
        'Zona Baca',
        Icons.auto_stories_outlined,
        () => openData(
          title: 'Zona Baca',
          description: 'Koleksi perpustakaan digital sekolah.',
          icon: Icons.auto_stories_outlined,
          endpoint: '/api/reading/books',
          listKeys: const ['books'],
        ),
      ),
      _MenuSheetItem(
        'Mading Siswa',
        Icons.newspaper_outlined,
        () =>
            openPage('Review Mading Siswa', const TeacherContentReviewScreen()),
      ),
      _MenuSheetItem(
        'Jurnal Harian',
        Icons.edit_note_rounded,
        () => openData(
          title: 'Jurnal Harian',
          description: 'Catat dan pantau jurnal pembelajaran.',
          icon: Icons.edit_note_rounded,
          endpoint: '/api/journals',
          listKeys: const ['journals'],
        ),
      ),
      _MenuSheetItem(
        'Penilaian',
        Icons.grading_outlined,
        () => openData(
          title: 'Penilaian',
          description: 'Kelola asesmen dan hasil belajar siswa.',
          icon: Icons.grading_outlined,
          endpoint: '/api/grading/assessments',
          listKeys: const ['assessments'],
        ),
      ),
      _MenuSheetItem(
        'Dokumen Saya',
        Icons.description_outlined,
        () => openData(
          title: 'Dokumen Saya',
          description: 'Dokumen pembelajaran yang tersimpan.',
          icon: Icons.description_outlined,
          endpoint: '/api/documents',
          listKeys: const ['documents'],
        ),
      ),
      _MenuSheetItem(
        'Absensi',
        Icons.event_available_outlined,
        () => openData(
          title: 'Absensi',
          description: 'Kelola kehadiran siswa per kelas.',
          icon: Icons.event_available_outlined,
          endpoint: '/api/attendance/classes',
          listKeys: const ['classes'],
        ),
      ),
    ];

    final community = [
      _MenuSheetItem(
        'Zona Kreasi Siswa',
        Icons.smart_display_outlined,
        () => openPage(
          'Laporan Zona Kreasi Siswa',
          const TeacherSpotlightReportsScreen(),
        ),
      ),
      _MenuSheetItem(
        'Member',
        Icons.people_outline_rounded,
        () => openData(
          title: 'Member',
          description: 'Direktori komunitas guru GuruSpace.',
          icon: Icons.people_outline_rounded,
          endpoint: '/api/members',
          listKeys: const ['members'],
        ),
      ),
      _MenuSheetItem('Pemberitahuan', Icons.notifications_outlined, () {
        Navigator.pop(context);
        Navigator.push<void>(
          context,
          MaterialPageRoute(builder: (_) => const NotificationsScreen()),
        );
      }),
    ];

    final account = [
      _MenuSheetItem(
        'Dapatkan Kredit',
        Icons.card_giftcard_outlined,
        () => openData(
          title: 'Dapatkan Kredit',
          description: 'Reward dan aktivitas perolehan kredit.',
          icon: Icons.card_giftcard_outlined,
          endpoint: '/api/reward/me',
        ),
      ),
      _MenuSheetItem(
        'Top Up Kredit',
        Icons.monetization_on_outlined,
        () => openData(
          title: 'Top Up Kredit',
          description: 'Pilih paket kredit untuk kebutuhan AI.',
          icon: Icons.monetization_on_outlined,
          endpoint: '/api/credit-packages',
          listKeys: const ['packages'],
        ),
      ),
      _MenuSheetItem(
        'Paket Langganan',
        Icons.workspace_premium_outlined,
        () => openData(
          title: 'Paket Langganan',
          description: 'Lihat paket dan benefit keanggotaan.',
          icon: Icons.workspace_premium_outlined,
          endpoint: '/api/plans',
          listKeys: const ['plans'],
        ),
      ),
      _MenuSheetItem(
        'Dompet',
        Icons.account_balance_wallet_outlined,
        () => openData(
          title: 'Dompet',
          description: 'Saldo dan riwayat transaksi dompet.',
          icon: Icons.account_balance_wallet_outlined,
          endpoint: '/api/wallet/me',
          listKeys: const ['ledger', 'transactions'],
        ),
      ),
      _MenuSheetItem(
        'Afiliasi',
        Icons.handshake_outlined,
        () => openData(
          title: 'Afiliasi',
          description: 'Referral, komisi, dan pencairan afiliasi.',
          icon: Icons.handshake_outlined,
          endpoint: '/api/affiliate/me',
          listKeys: const ['referrals', 'commissions'],
        ),
      ),
      _MenuSheetItem('Pengaturan', Icons.settings_outlined, () {
        Navigator.pop(context);
        Navigator.push<void>(
          context,
          MaterialPageRoute(builder: (_) => ProfileScreen(user: user)),
        );
      }),
    ];

    return SafeArea(
      top: false,
      child: FractionallySizedBox(
        heightFactor: .92,
        alignment: Alignment.bottomCenter,
        child: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.white, Color(0xFFF7FAFF)],
              stops: [0, .42],
            ),
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: [
              BoxShadow(
                color: Color(0x2B0F172A),
                blurRadius: 36,
                offset: Offset(0, -14),
              ),
            ],
          ),
          child: Column(
            children: [
              const _MenuSheetHandle(),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 3, 12, 12),
                child: Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Menu',
                            style: TextStyle(
                              color: AppColors.navy,
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            'Semua fitur GuruSpace',
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.blueSoft,
                      ),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              _MenuProfileCard(
                user: user,
                onProfile: () {
                  Navigator.pop(context);
                  Navigator.push<void>(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ProfileScreen(user: user),
                    ),
                  );
                },
                onCredits: () => openData(
                  title: 'Top Up Kredit',
                  description: 'Pilih paket kredit untuk kebutuhan AI.',
                  icon: Icons.monetization_on_outlined,
                  endpoint: '/api/credit-packages',
                  listKeys: const ['packages'],
                ),
                onMembership: () => openData(
                  title: 'Paket Langganan',
                  description: 'Lihat paket dan benefit keanggotaan.',
                  icon: Icons.workspace_premium_outlined,
                  endpoint: '/api/plans',
                  listKeys: const ['plans'],
                ),
                onLogout: () async {
                  Navigator.pop(context);
                  await ref.read(authControllerProvider.notifier).logout();
                },
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 16, 12, 28),
                  children: [
                    _AnimatedMenuBlock(
                      delay: 40,
                      child: _MenuSection(
                        title: 'Utama',
                        featured: true,
                        items: [
                          _MenuSheetItem(
                            'Profil Guru',
                            Icons.person_outline_rounded,
                            () {
                              Navigator.pop(context);
                              Navigator.push<void>(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => ProfileScreen(user: user),
                                ),
                              );
                            },
                            AppColors.blue,
                          ),
                        ],
                      ),
                    ),
                    _AnimatedMenuBlock(
                      delay: 90,
                      child: _MenuSection(
                        title: 'AI Generator',
                        items: [
                          _MenuSheetItem(
                            'AI Assistant',
                            Icons.auto_awesome_rounded,
                            openAssistant,
                            _menuColors[0],
                          ),
                          ..._generatorGroups.asMap().entries.map(
                            (entry) => _MenuSheetItem(
                              entry.value.title,
                              entry.value.icon,
                              openAssistant,
                              _menuColors[(entry.key + 1) % _menuColors.length],
                            ),
                          ),
                          _MenuSheetItem(
                            'Cari Semua Generator',
                            Icons.search_rounded,
                            openAssistant,
                            _menuColors[6],
                          ),
                        ],
                      ),
                    ),
                    ..._generatorGroups.asMap().entries.map(
                      (entry) => _AnimatedMenuBlock(
                        delay: 140 + (entry.key * 35),
                        child: _GeneratorMenuPanel(
                          group: entry.value,
                          color:
                              _menuColors[(entry.key + 1) % _menuColors.length],
                          initiallyExpanded: entry.key == 0,
                          onTool: openAssistant,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    _AnimatedMenuBlock(
                      delay: 330,
                      child: _MenuSection(
                        title: 'Pembelajaran',
                        items: learning,
                      ),
                    ),
                    _AnimatedMenuBlock(
                      delay: 370,
                      child: _MenuSection(title: 'Komunitas', items: community),
                    ),
                    _AnimatedMenuBlock(
                      delay: 410,
                      child: _MenuSection(
                        title: 'Akun & Benefit',
                        items: account,
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
}

class _MenuSheetItem {
  const _MenuSheetItem(this.label, this.icon, this.onTap, [this.color]);

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;
}

class _GeneratorMenuGroup {
  const _GeneratorMenuGroup({
    required this.title,
    required this.icon,
    required this.tools,
  });

  final String title;
  final IconData icon;
  final List<_GeneratorMenuTool> tools;
}

class _GeneratorMenuTool {
  const _GeneratorMenuTool(this.label, this.slug);

  final String label;
  final String slug;
}

class _MenuSheetHandle extends StatelessWidget {
  const _MenuSheetHandle();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 9, bottom: 7),
    child: Container(
      width: 44,
      height: 5,
      decoration: BoxDecoration(
        color: AppColors.border,
        borderRadius: BorderRadius.circular(6),
      ),
    ),
  );
}

class _AnimatedMenuBlock extends StatelessWidget {
  const _AnimatedMenuBlock({required this.delay, required this.child});

  final int delay;
  final Widget child;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: 1),
    duration: Duration(milliseconds: 360 + delay),
    curve: Curves.easeOutCubic,
    builder: (context, value, child) => Opacity(
      opacity: value,
      child: Transform.translate(
        offset: Offset(0, 10 * (1 - value)),
        child: child,
      ),
    ),
    child: child,
  );
}

class _MenuProfileCard extends StatelessWidget {
  const _MenuProfileCard({
    required this.user,
    required this.onProfile,
    required this.onCredits,
    required this.onMembership,
    required this.onLogout,
  });

  final AppUser user;
  final VoidCallback onProfile;
  final VoidCallback onCredits;
  final VoidCallback onMembership;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: 1),
    duration: const Duration(milliseconds: 460),
    curve: Curves.easeOutCubic,
    builder: (context, value, child) => Opacity(
      opacity: value,
      child: Transform.translate(
        offset: Offset(0, 14 * (1 - value)),
        child: child,
      ),
    ),
    child: Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1557E8), Color(0xFF0A8FE8), Color(0xFF09C5DF)],
          stops: [0, .58, 1],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [
          BoxShadow(
            color: Color(0x3D087ACC),
            blurRadius: 26,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned(
            right: -32,
            top: -38,
            child: _ProfileGlow(size: 140),
          ),
          const Positioned(
            left: -34,
            bottom: -72,
            child: _ProfileGlow(size: 124),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                InkWell(
                  onTap: onProfile,
                  borderRadius: BorderRadius.circular(18),
                  child: Row(
                    children: [
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          CircleAvatar(
                            radius: 31,
                            backgroundColor: Colors.white24,
                            backgroundImage: user.avatarUrl?.isNotEmpty == true
                                ? NetworkImage(
                                    resolveAppMediaUrl(user.avatarUrl!),
                                  )
                                : null,
                            child: user.avatarUrl?.isNotEmpty == true
                                ? null
                                : Text(
                                    user.name.isEmpty
                                        ? 'G'
                                        : user.name[0].toUpperCase(),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 23,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                          ),
                          Positioned.fill(
                            child: Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 2.2,
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            right: -3,
                            top: -4,
                            child: Container(
                              width: 23,
                              height: 23,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x33000000),
                                    blurRadius: 6,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.workspace_premium_rounded,
                                color: AppColors.blue,
                                size: 14,
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
                              user.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -.2,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              user.email,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Color(0xFFDDF6FF),
                                fontSize: 10.5,
                              ),
                            ),
                            const SizedBox(height: 7),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 9,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0755C7),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: Colors.white24),
                              ),
                              child: const Text(
                                'Guru',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: Colors.white70,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 13),
                Row(
                  children: [
                    Expanded(
                      child: _HeroProfileAction(
                        icon: Icons.monetization_on_rounded,
                        label: '${user.creditsRemaining} kredit',
                        onTap: onCredits,
                      ),
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: _HeroProfileAction(
                        icon: Icons.diamond_outlined,
                        label: user.membershipPlan?.name ?? 'Paket member',
                        onTap: onMembership,
                      ),
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: _HeroProfileAction(
                        icon: Icons.logout_rounded,
                        label: 'Keluar',
                        danger: true,
                        onTap: onLogout,
                      ),
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

class _ProfileGlow extends StatelessWidget {
  const _ProfileGlow({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      gradient: RadialGradient(
        colors: [Colors.white.withValues(alpha: .16), Colors.transparent],
      ),
      border: Border.all(color: Colors.white12),
    ),
  );
}

class _HeroProfileAction extends StatelessWidget {
  const _HeroProfileAction({
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
  Widget build(BuildContext context) => Material(
    color: danger ? const Color(0xFFFFF7F7) : Colors.white,
    borderRadius: BorderRadius.circular(12),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 39,
        padding: const EdgeInsets.symmetric(horizontal: 7),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: danger ? const Color(0xFFFCA5A5) : Colors.white,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: danger ? AppColors.danger : AppColors.blue,
            ),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: danger ? AppColors.danger : AppColors.blue,
                  fontSize: 9.5,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

@Deprecated('Use the current profile hero')
class LegacyMenuProfileCard extends StatelessWidget {
  const LegacyMenuProfileCard({
    super.key,
    required this.user,
    required this.onProfile,
    required this.onCredits,
    required this.onMembership,
    required this.onLogout,
  });

  final AppUser user;
  final VoidCallback onProfile;
  final VoidCallback onCredits;
  final VoidCallback onMembership;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.symmetric(horizontal: 16),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFE8F6EA), Colors.white],
      ),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFFE8F6EA)),
      boxShadow: AppShadows.card,
    ),
    child: Column(
      children: [
        InkWell(
          onTap: onProfile,
          borderRadius: BorderRadius.circular(14),
          child: Row(
            children: [
              CircleAvatar(
                radius: 23,
                backgroundColor: AppColors.blue,
                backgroundImage: user.avatarUrl?.isNotEmpty == true
                    ? NetworkImage(resolveAppMediaUrl(user.avatarUrl!))
                    : null,
                child: user.avatarUrl?.isNotEmpty == true
                    ? null
                    : Text(
                        user.name.isEmpty ? 'G' : user.name[0].toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
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
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      user.email,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 10.5,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFE8F6EA)),
                ),
                child: const Text(
                  'Guru',
                  style: TextStyle(
                    color: AppColors.blue,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _ProfileMenuAction(
                icon: Icons.monetization_on_rounded,
                label: '${user.creditsRemaining} kredit',
                color: AppColors.warning,
                onTap: onCredits,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _ProfileMenuAction(
                icon: Icons.workspace_premium_rounded,
                label: user.membershipPlan?.name ?? 'Paket member',
                color: AppColors.blue,
                onTap: onMembership,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          height: 36,
          child: OutlinedButton.icon(
            onPressed: onLogout,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              backgroundColor: const Color(0xFFFEF2F2),
              side: const BorderSide(color: Color(0xFFFECACA)),
            ),
            icon: const Icon(Icons.logout_rounded, size: 17),
            label: const Text('Keluar'),
          ),
        ),
      ],
    ),
  );
}

class _ProfileMenuAction extends StatelessWidget {
  const _ProfileMenuAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(12),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE8F6EA)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 17, color: color),
            const SizedBox(width: 7),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.navy,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _MenuSection extends StatelessWidget {
  const _MenuSection({
    required this.title,
    required this.items,
    this.featured = false,
  });

  final String title;
  final List<_MenuSheetItem> items;
  final bool featured;

  static const _fallbackColors = [
    Color(0xFF007A33),
    Color(0xFF39B54A),
    Color(0xFF16A34A),
    Color(0xFF7C3AED),
    Color(0xFFF59E0B),
    Color(0xFFF43F5E),
  ];

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
          child: Row(
            children: [
              if (title == 'AI Generator') ...[
                const Icon(
                  Icons.auto_awesome_rounded,
                  size: 16,
                  color: AppColors.blue,
                ),
                const SizedBox(width: 6),
              ],
              Text(
                title,
                style: TextStyle(
                  color: title == 'AI Generator'
                      ? AppColors.navy
                      : AppColors.muted,
                  fontSize: title == 'AI Generator' ? 14 : 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: title == 'AI Generator' ? -.1 : .35,
                ),
              ),
            ],
          ),
        ),
        if (featured)
          ...items.map((item) => _FeaturedMenuRow(item: item))
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              mainAxisExtent: 98,
              crossAxisSpacing: 7,
              mainAxisSpacing: 7,
            ),
            itemBuilder: (context, index) {
              final item = items[index];
              final color =
                  item.color ?? _fallbackColors[index % _fallbackColors.length];
              return Material(
                color: color.withValues(alpha: .045),
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  onTap: item.onTap,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: color.withValues(alpha: .22)),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 43,
                          height: 43,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                Colors.white,
                                color.withValues(alpha: .12),
                              ],
                            ),
                            borderRadius: BorderRadius.circular(15),
                            border: Border.all(
                              color: color.withValues(alpha: .18),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: color.withValues(alpha: .12),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Icon(item.icon, size: 21, color: color),
                        ),
                        const SizedBox(height: 7),
                        Text(
                          item.label,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.navy,
                            fontSize: 9.3,
                            height: 1.08,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
      ],
    ),
  );
}

class _FeaturedMenuRow extends StatelessWidget {
  const _FeaturedMenuRow({required this.item});

  final _MenuSheetItem item;

  @override
  Widget build(BuildContext context) {
    final color = item.color ?? AppColors.blue;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(17),
      child: InkWell(
        onTap: item.onTap,
        borderRadius: BorderRadius.circular(17),
        child: Container(
          height: 66,
          padding: const EdgeInsets.symmetric(horizontal: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(17),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.card,
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(item.icon, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  item.label,
                  style: const TextStyle(
                    color: AppColors.navy,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.mutedLight,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GeneratorMenuPanel extends StatefulWidget {
  const _GeneratorMenuPanel({
    required this.group,
    required this.color,
    required this.initiallyExpanded,
    required this.onTool,
  });

  final _GeneratorMenuGroup group;
  final Color color;
  final bool initiallyExpanded;
  final ValueChanged<String> onTool;

  @override
  State<_GeneratorMenuPanel> createState() => _GeneratorMenuPanelState();
}

class _GeneratorMenuPanelState extends State<_GeneratorMenuPanel>
    with SingleTickerProviderStateMixin {
  late bool _expanded = widget.initiallyExpanded;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
    duration: const Duration(milliseconds: 280),
    margin: const EdgeInsets.only(bottom: 10),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [widget.color.withValues(alpha: .075), Colors.white],
      ),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: widget.color.withValues(alpha: .22)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(18),
            child: Padding(
              padding: const EdgeInsets.all(11),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: widget.color.withValues(alpha: .2),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: widget.color.withValues(alpha: .1),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Icon(
                      widget.group.icon,
                      size: 19,
                      color: widget.color,
                    ),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.group.title,
                          style: const TextStyle(
                            color: AppColors.navy,
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          '${widget.group.tools.length} generator tersedia',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: _expanded ? .5 : 0,
                    duration: const Duration(milliseconds: 240),
                    child: Icon(Icons.expand_more_rounded, color: widget.color),
                  ),
                ],
              ),
            ),
          ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
          child: _expanded
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(11, 0, 11, 11),
                  child: Wrap(
                    spacing: 7,
                    runSpacing: 7,
                    children: widget.group.tools.asMap().entries.map((entry) {
                      final tone =
                          TeacherMenuSheet._menuColors[entry.key %
                              TeacherMenuSheet._menuColors.length];
                      return ActionChip(
                        avatar: Icon(
                          Icons.description_outlined,
                          size: 15,
                          color: tone,
                        ),
                        label: Text(entry.value.label),
                        onPressed: () => widget.onTool(entry.value.slug),
                        backgroundColor: Colors.white,
                        side: BorderSide(color: tone.withValues(alpha: .18)),
                        elevation: 0,
                        pressElevation: 1,
                        labelStyle: const TextStyle(
                          color: AppColors.navy,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                        ),
                      );
                    }).toList(),
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    ),
  );
}

@Deprecated('Use the current teacher menu sheet')
class LegacyTeacherMenuSheet extends StatelessWidget {
  const LegacyTeacherMenuSheet({super.key, required this.user});
  final AppUser user;

  @override
  Widget build(BuildContext context) {
    void openPage(String title, Widget page) {
      Navigator.pop(context);
      _openTeacherPage(context, title, page);
    }

    void openData({
      required String title,
      required String description,
      required IconData icon,
      required String endpoint,
      List<String> listKeys = const [],
    }) {
      Navigator.pop(context);
      openNativeDataScreen(
        context,
        title: title,
        description: description,
        icon: icon,
        endpoint: endpoint,
        listKeys: listKeys,
      );
    }

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
                    backgroundColor: const Color(0xFFE8F6EA),
                    child: Text(
                      user.name.isEmpty ? 'G' : user.name[0].toUpperCase(),
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
                          'Akun Guru',
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
                title: 'Pembelajaran',
                items: [
                  QuickMenuItem(
                    label: 'Kelas',
                    icon: Icons.school_outlined,
                    color: AppColors.blue,
                    onTap: () =>
                        openPage('Kelas', const _TeacherClassesScreen()),
                  ),
                  QuickMenuItem(
                    label: 'PJJ',
                    icon: Icons.video_camera_front_outlined,
                    color: AppColors.cyan,
                    onTap: () =>
                        openPage('PJJ', const _TeacherActivityScreen()),
                  ),
                  QuickMenuItem(
                    label: 'Tugas',
                    icon: Icons.assignment_outlined,
                    color: AppColors.blue,
                    onTap: () => openData(
                      title: 'Tugas',
                      description: 'Kelola tugas untuk kelas aktif.',
                      icon: Icons.assignment_outlined,
                      endpoint: '/api/assignments',
                      listKeys: const ['assignments'],
                    ),
                  ),
                  QuickMenuItem(
                    label: 'Ujian',
                    icon: Icons.fact_check_outlined,
                    color: AppColors.warning,
                    onTap: () => openData(
                      title: 'Ujian',
                      description: 'Kelola jadwal dan paket ujian.',
                      icon: Icons.fact_check_outlined,
                      endpoint: '/api/exams',
                      listKeys: const ['exams'],
                    ),
                  ),
                  QuickMenuItem(
                    label: 'TKA',
                    icon: Icons.psychology_outlined,
                    color: Color(0xFF4F46E5),
                    onTap: () => openData(
                      title: 'TKA',
                      description: 'Kelola paket dan bank soal TKA.',
                      icon: Icons.psychology_outlined,
                      endpoint: '/api/tka/packages',
                      listKeys: const ['packages'],
                    ),
                  ),
                  QuickMenuItem(
                    label: 'Zona Baca',
                    icon: Icons.auto_stories_outlined,
                    color: AppColors.success,
                    onTap: () => openData(
                      title: 'Zona Baca',
                      description: 'Koleksi perpustakaan digital sekolah.',
                      icon: Icons.auto_stories_outlined,
                      endpoint: '/api/reading/books',
                      listKeys: const ['books'],
                    ),
                  ),
                  QuickMenuItem(
                    label: 'Mading',
                    icon: Icons.newspaper_outlined,
                    color: Color(0xFFEA580C),
                    onTap: () => openPage(
                      'Review Mading Siswa',
                      const TeacherContentReviewScreen(),
                    ),
                  ),
                  QuickMenuItem(
                    label: 'Notifikasi',
                    icon: Icons.notifications_outlined,
                    color: const Color(0xFFDB2777),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push<void>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const NotificationsScreen(),
                        ),
                      );
                    },
                  ),
                  QuickMenuItem(
                    label: 'Profil',
                    icon: Icons.person_outline_rounded,
                    color: const Color(0xFF475569),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push<void>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ProfileScreen(user: user),
                        ),
                      );
                    },
                  ),
                  QuickMenuItem(
                    label: 'Pengaturan',
                    icon: Icons.settings_outlined,
                    color: Color(0xFF64748B),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push<void>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ProfileScreen(user: user),
                        ),
                      );
                    },
                  ),
                  QuickMenuItem(
                    label: 'Dokumen',
                    icon: Icons.description_outlined,
                    color: Color(0xFF0F766E),
                    onTap: () => openData(
                      title: 'Dokumen',
                      description: 'Dokumen pembelajaran tersimpan.',
                      icon: Icons.description_outlined,
                      endpoint: '/api/documents',
                      listKeys: const ['documents'],
                    ),
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
