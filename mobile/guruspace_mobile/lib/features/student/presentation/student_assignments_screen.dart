import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/ads/mobile_ad_config.dart';
import 'package:guruspace_mobile/core/ads/student_admob_banner.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/student/presentation/student_learning_detail_screen.dart';

enum _AssignmentFilter { all, upcoming, submitted, overdue }

class StudentAssignmentsScreen extends ConsumerStatefulWidget {
  const StudentAssignmentsScreen({super.key, this.onBack});

  final VoidCallback? onBack;

  @override
  ConsumerState<StudentAssignmentsScreen> createState() =>
      _StudentAssignmentsScreenState();
}

class _StudentAssignmentsScreenState
    extends ConsumerState<StudentAssignmentsScreen> {
  _AssignmentFilter _filter = _AssignmentFilter.all;
  String? _subject;

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(studentDashboardProvider);
    return Scaffold(
      key: const Key('student-assignments-page'),
      backgroundColor: const Color(0xFFF5FAF6),
      appBar: _LearningPageBar(
        title: 'Tugas',
        onBack: widget.onBack,
        onRefresh: () => ref.invalidate(studentDashboardProvider),
      ),
      body: dashboard.when(
        loading: () => const LoadingView(label: 'Menyiapkan tugas...'),
        error: (error, _) => ErrorView(
          message: '$error',
          onRetry: () => ref.invalidate(studentDashboardProvider),
        ),
        data: _buildContent,
      ),
    );
  }

  Widget _buildContent(StudentDashboard data) {
    final now = DateTime.now();
    final subjects =
        data.assignments.map((item) => item.subject).toSet().toList()..sort();
    final upcoming = data.assignments
        .where((item) => !item.completed && !_isOverdue(item, now))
        .length;
    final submitted = data.assignments.where((item) => item.completed).length;
    final overdue = data.assignments
        .where((item) => !item.completed && _isOverdue(item, now))
        .length;
    final visible =
        data.assignments.where((item) {
          if (_subject != null && item.subject != _subject) return false;
          return switch (_filter) {
            _AssignmentFilter.all => true,
            _AssignmentFilter.upcoming =>
              !item.completed && !_isOverdue(item, now),
            _AssignmentFilter.submitted => item.completed,
            _AssignmentFilter.overdue =>
              !item.completed && _isOverdue(item, now),
          };
        }).toList()..sort((a, b) {
          if (a.completed != b.completed) return a.completed ? 1 : -1;
          if (a.dueAt == null) return 1;
          if (b.dueAt == null) return -1;
          return a.dueAt!.compareTo(b.dueAt!);
        });

    return RefreshIndicator(
      onRefresh: () => ref.refresh(studentDashboardProvider.future),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 118),
        children: [
          _AssignmentSummary(
            upcoming: upcoming,
            submitted: submitted,
            overdue: overdue,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _FilterChip(
                        label: 'Semua',
                        selected: _filter == _AssignmentFilter.all,
                        onTap: () =>
                            setState(() => _filter = _AssignmentFilter.all),
                      ),
                      _FilterChip(
                        label: 'Akan datang',
                        selected: _filter == _AssignmentFilter.upcoming,
                        onTap: () => setState(
                          () => _filter = _AssignmentFilter.upcoming,
                        ),
                      ),
                      _FilterChip(
                        label: 'Dikumpulkan',
                        selected: _filter == _AssignmentFilter.submitted,
                        onTap: () => setState(
                          () => _filter = _AssignmentFilter.submitted,
                        ),
                      ),
                      _FilterChip(
                        label: 'Terlambat',
                        selected: _filter == _AssignmentFilter.overdue,
                        onTap: () =>
                            setState(() => _filter = _AssignmentFilter.overdue),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              PopupMenuButton<String?>(
                tooltip: 'Filter mata pelajaran',
                initialValue: _subject,
                onSelected: (value) => setState(() => _subject = value),
                itemBuilder: (_) => [
                  const PopupMenuItem(value: null, child: Text('Semua mapel')),
                  ...subjects.map(
                    (subject) =>
                        PopupMenuItem(value: subject, child: Text(subject)),
                  ),
                ],
                child: Container(
                  height: 42,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(color: const Color(0xFFD7E8D9)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.tune_rounded, size: 18),
                      if (_subject != null) ...[
                        const SizedBox(width: 6),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 72),
                          child: Text(
                            _subject!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Daftar Tugas',
                  style: TextStyle(
                    color: AppColors.navy,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Text(
                '${visible.length} tugas',
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (visible.isEmpty)
            const _AssignmentEmpty()
          else
            ..._buildGroupedTasks(visible, now),
        ],
      ),
    );
  }

  List<Widget> _buildGroupedTasks(List<LearningItem> items, DateTime now) {
    String? lastGroup;
    final widgets = <Widget>[];
    var organicCount = 0;
    for (final item in items) {
      final group = _groupLabel(item, now);
      if (group != lastGroup) {
        if (widgets.isNotEmpty) widgets.add(const SizedBox(height: 12));
        widgets.add(_DateGroupLabel(label: group));
        widgets.add(const SizedBox(height: 7));
        lastGroup = group;
      }
      widgets.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _AssignmentRow(
            item: item,
            overdue: !item.completed && _isOverdue(item, now),
            onTap: () => _openDetail(item),
          ),
        ),
      );
      organicCount += 1;
      if (organicCount == 4) {
        widgets.add(
          const StudentAdmobBanner(
            placement: StudentAdmobPlacement.assignmentsBanner,
          ),
        );
      }
    }
    if (organicCount >= 2 && organicCount < 4) {
      widgets.add(
        const StudentAdmobBanner(
          placement: StudentAdmobPlacement.assignmentsBanner,
        ),
      );
    }
    return widgets;
  }

  Future<void> _openDetail(LearningItem item) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => StudentLearningDetailScreen(item: item),
      ),
    );
    ref.invalidate(studentDashboardProvider);
  }
}

bool _isOverdue(LearningItem item, DateTime now) =>
    item.dueAt != null && item.dueAt!.isBefore(now);

String _groupLabel(LearningItem item, DateTime now) {
  if (item.completed) return 'Sudah dikumpulkan';
  if (_isOverdue(item, now)) return 'Terlambat';
  if (item.dueAt == null) return 'Tanpa batas waktu';
  final local = item.dueAt!.toLocal();
  final today = DateTime(now.year, now.month, now.day);
  final target = DateTime(local.year, local.month, local.day);
  final days = target.difference(today).inDays;
  if (days == 0) return 'Hari ini';
  if (days == 1) return 'Besok';
  return DateFormat('EEEE, d MMMM', 'id_ID').format(local);
}

class _LearningPageBar extends StatelessWidget implements PreferredSizeWidget {
  const _LearningPageBar({
    required this.title,
    required this.onRefresh,
    this.onBack,
  });

  final String title;
  final VoidCallback onRefresh;
  final VoidCallback? onBack;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) => AppBar(
    backgroundColor: Colors.white,
    surfaceTintColor: Colors.white,
    elevation: 0,
    scrolledUnderElevation: 1,
    shadowColor: const Color(0x1A0F2747),
    leading: IconButton(
      tooltip: 'Kembali',
      onPressed: onBack ?? () => Navigator.maybePop(context),
      icon: const Icon(Icons.arrow_back_rounded),
    ),
    title: Text(
      title,
      style: const TextStyle(
        color: AppColors.navy,
        fontSize: 21,
        fontWeight: FontWeight.w900,
      ),
    ),
    actions: [
      IconButton(
        tooltip: 'Segarkan',
        onPressed: onRefresh,
        icon: const Icon(Icons.refresh_rounded),
      ),
      const SizedBox(width: 6),
    ],
  );
}

class _AssignmentSummary extends StatelessWidget {
  const _AssignmentSummary({
    required this.upcoming,
    required this.submitted,
    required this.overdue,
  });

  final int upcoming;
  final int submitted;
  final int overdue;

  @override
  Widget build(BuildContext context) {
    final total = upcoming + submitted + overdue;
    final progress = total == 0 ? 0.0 : submitted / total;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: AppGradients.brand,
        borderRadius: BorderRadius.circular(24),
        boxShadow: AppShadows.floating,
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .16),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.assignment_turned_in_rounded,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ruang Tugas',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Selesaikan tugasmu tepat waktu',
                      style: TextStyle(color: Color(0xFFE8F6EA), fontSize: 11),
                    ),
                  ],
                ),
              ),
              Text(
                '${(progress * 100).round()}%',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 15),
          LinearProgressIndicator(
            value: progress,
            minHeight: 6,
            borderRadius: BorderRadius.circular(10),
            backgroundColor: Colors.white24,
            color: Colors.white,
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 13),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white24),
            ),
            child: Row(
              children: [
                _SummaryValue(label: 'Aktif', value: upcoming),
                const _SummaryDivider(),
                _SummaryValue(label: 'Selesai', value: submitted),
                const _SummaryDivider(),
                _SummaryValue(label: 'Terlambat', value: overdue),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryValue extends StatelessWidget {
  const _SummaryValue({required this.label, required this.value});
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          '$value',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 25,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFFE8F6EA),
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _SummaryDivider extends StatelessWidget {
  const _SummaryDivider();
  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 39, color: Colors.white24);
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 7),
    child: ChoiceChip(
      label: Text(label),
      selected: selected,
      showCheckmark: false,
      onSelected: (_) => onTap(),
      selectedColor: AppColors.blue,
      backgroundColor: Colors.white,
      side: BorderSide(
        color: selected ? AppColors.blue : const Color(0xFFD7E8D9),
      ),
      labelStyle: TextStyle(
        color: selected ? Colors.white : const Color(0xFF5E6F5E),
        fontSize: 12,
        fontWeight: FontWeight.w800,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}

class _DateGroupLabel extends StatelessWidget {
  const _DateGroupLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Text(
    label,
    style: const TextStyle(
      color: Color(0xFF5E6F5E),
      fontSize: 12,
      fontWeight: FontWeight.w800,
    ),
  );
}

class _AssignmentRow extends StatelessWidget {
  const _AssignmentRow({
    required this.item,
    required this.overdue,
    required this.onTap,
  });
  final LearningItem item;
  final bool overdue;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = overdue
        ? const Color(0xFFDC2626)
        : item.completed
        ? const Color(0xFF059669)
        : AppColors.blue;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFD7E8D9)),
          ),
          child: Row(
            children: [
              Container(
                width: 47,
                height: 47,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(_subjectIcon(item.subject), color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.subject,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (item.dueAt != null) ...[
                      const SizedBox(height: 5),
                      Text(
                        '${overdue ? 'Lewat' : 'Batas'} ${DateFormat('d MMM, HH:mm', 'id_ID').format(item.dueAt!.toLocal())}',
                        style: TextStyle(
                          color: overdue ? color : const Color(0xFFB45309),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  item.completed
                      ? 'Lihat'
                      : overdue
                      ? 'Kumpulkan'
                      : 'Kerjakan',
                  style: TextStyle(
                    color: color,
                    fontSize: 11,
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
}

IconData _subjectIcon(String subject) {
  final value = subject.toLowerCase();
  if (value.contains('mat')) return Icons.functions_rounded;
  if (value.contains('bio') || value.contains('ipa')) {
    return Icons.biotech_rounded;
  }
  if (value.contains('bahasa')) return Icons.translate_rounded;
  if (value.contains('sejarah')) return Icons.account_balance_rounded;
  return Icons.assignment_outlined;
}

class _AssignmentEmpty extends StatelessWidget {
  const _AssignmentEmpty();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 52, horizontal: 24),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFD7E8D9)),
    ),
    child: const Column(
      children: [
        Icon(Icons.task_alt_rounded, color: Color(0xFF16A34A), size: 44),
        SizedBox(height: 12),
        Text(
          'Tidak ada tugas di kategori ini',
          style: TextStyle(color: AppColors.navy, fontWeight: FontWeight.w900),
        ),
        SizedBox(height: 5),
        Text(
          'Coba pilih filter lain untuk melihat tugasmu.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted),
        ),
      ],
    ),
  );
}
