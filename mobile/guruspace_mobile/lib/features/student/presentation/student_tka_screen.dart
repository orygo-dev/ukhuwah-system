import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/student/presentation/tka_attempt_screen.dart';

class StudentTkaScreen extends ConsumerStatefulWidget {
  const StudentTkaScreen({super.key});

  @override
  ConsumerState<StudentTkaScreen> createState() => _StudentTkaScreenState();
}

class _StudentTkaScreenState extends ConsumerState<StudentTkaScreen> {
  String? _subject;
  final Set<String> _openingPackages = <String>{};

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(studentDashboardProvider);
    return Scaffold(
      key: const Key('student-tka-page'),
      backgroundColor: const Color(0xFFFFFAF5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: const BackButton(),
        title: const Text(
          'Simulasi TKA',
          style: TextStyle(
            color: AppColors.navy,
            fontSize: 21,
            fontWeight: FontWeight.w900,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Segarkan',
            onPressed: () => ref.invalidate(studentDashboardProvider),
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: dashboard.when(
        loading: () => const LoadingView(label: 'Menyiapkan simulasi TKA...'),
        error: (error, _) => ErrorView(
          message: '$error',
          onRetry: () => ref.invalidate(studentDashboardProvider),
        ),
        data: _buildContent,
      ),
    );
  }

  Widget _buildContent(StudentDashboard data) {
    final packages = data.tkaPackages;
    final subjects = packages.map((item) => item.subject).toSet().toList()
      ..sort();
    final visible = packages
        .where((item) => _subject == null || item.subject == _subject)
        .toList();
    final submitted = packages
        .where((item) => item.status == 'SUBMITTED')
        .toList();
    final scored = submitted.where((item) => item.score != null).toList();
    final bestScore = scored.isEmpty
        ? null
        : scored
              .map((item) => item.score!)
              .reduce((current, score) => score > current ? score : current);

    return RefreshIndicator(
      onRefresh: () => ref.refresh(studentDashboardProvider.future),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
        children: [
          _TkaHero(
            name: data.name.split(' ').first,
            packageCount: packages.length,
            completedCount: submitted.length,
            bestScore: bestScore,
          ),
          const SizedBox(height: 18),
          const _PreparationCard(),
          if (subjects.length > 1) ...[
            const SizedBox(height: 18),
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _TkaFilterChip(
                    label: 'Semua',
                    selected: _subject == null,
                    onTap: () => setState(() => _subject = null),
                  ),
                  ...subjects.map(
                    (subject) => _TkaFilterChip(
                      label: subject,
                      selected: _subject == subject,
                      onTap: () => setState(() => _subject = subject),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Paket TKA',
                  style: TextStyle(
                    color: AppColors.navy,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Text(
                '${visible.length} paket',
                style: const TextStyle(
                  color: Color(0xFF758399),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (visible.isEmpty)
            const _TkaEmptyState()
          else
            ...visible.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _TkaPackageCard(
                  item: item,
                  opening: _openingPackages.contains(item.id),
                  onTap: () => _openPackage(item),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _openPackage(TkaPackageItem item) async {
    if (_openingPackages.contains(item.id)) return;
    setState(() => _openingPackages.add(item.id));
    try {
      final attemptId =
          item.attemptId ??
          await ref.read(dashboardRepositoryProvider).startTka(item.id);
      if (!mounted || attemptId.isEmpty) return;
      await Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder: (_) => TkaAttemptScreen(attemptId: attemptId),
        ),
      );
      ref.invalidate(studentDashboardProvider);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _openingPackages.remove(item.id));
    }
  }
}

class _TkaHero extends StatelessWidget {
  const _TkaHero({
    required this.name,
    required this.packageCount,
    required this.completedCount,
    required this.bestScore,
  });

  final String name;
  final int packageCount;
  final int completedCount;
  final double? bestScore;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFFFF8A34), Color(0xFFF05A24)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(24),
      boxShadow: const [
        BoxShadow(
          color: Color(0x33E85A1C),
          blurRadius: 24,
          offset: Offset(0, 10),
        ),
      ],
    ),
    child: Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Siap berlatih, $name?',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Latih kemampuan akademikmu dengan simulasi yang terukur.',
                    style: TextStyle(
                      color: Color(0xFFFFE8D9),
                      height: 1.4,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .18),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: .3)),
              ),
              child: const Icon(
                Icons.psychology_rounded,
                color: Colors.white,
                size: 38,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .96),
            borderRadius: BorderRadius.circular(17),
          ),
          child: Row(
            children: [
              _TkaMetric(label: 'Paket', value: '$packageCount'),
              const _TkaMetricDivider(),
              _TkaMetric(label: 'Selesai', value: '$completedCount'),
              const _TkaMetricDivider(),
              _TkaMetric(
                label: 'Nilai terbaik',
                value: bestScore == null ? '–' : bestScore!.toStringAsFixed(0),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _TkaMetric extends StatelessWidget {
  const _TkaMetric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: Color(0xFFE95C20),
            fontSize: 20,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          maxLines: 1,
          style: const TextStyle(
            color: Color(0xFF7A665D),
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _TkaMetricDivider extends StatelessWidget {
  const _TkaMetricDivider();

  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 32, color: const Color(0xFFF1DDD2));
}

class _PreparationCard extends StatelessWidget {
  const _PreparationCard();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(15),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFFF1E4DA)),
    ),
    child: const Row(
      children: [
        _PreparationIcon(),
        SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Persiapkan sebelum mulai',
                style: TextStyle(
                  color: AppColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              SizedBox(height: 4),
              Text(
                'Pastikan koneksi stabil dan sediakan waktu sesuai durasi paket.',
                style: TextStyle(
                  color: Color(0xFF69778B),
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _PreparationIcon extends StatelessWidget {
  const _PreparationIcon();

  @override
  Widget build(BuildContext context) => Container(
    width: 44,
    height: 44,
    decoration: BoxDecoration(
      color: const Color(0xFFFFEEE3),
      borderRadius: BorderRadius.circular(14),
    ),
    child: const Icon(Icons.tips_and_updates_rounded, color: Color(0xFFF06A27)),
  );
}

class _TkaPackageCard extends StatelessWidget {
  const _TkaPackageCard({
    required this.item,
    required this.opening,
    required this.onTap,
  });

  final TkaPackageItem item;
  final bool opening;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final submitted = item.status == 'SUBMITTED';
    final continuing = item.attemptId != null && !submitted;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF0E5DC)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A7C3B16),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEEE3),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: const Icon(
                  Icons.fact_check_rounded,
                  color: Color(0xFFF06A27),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      item.subject,
                      style: const TextStyle(
                        color: Color(0xFFF06A27),
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              if (submitted)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F8EF),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: const Text(
                    'Selesai',
                    style: TextStyle(
                      color: Color(0xFF16844A),
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _PackageInfo(
                icon: Icons.help_outline_rounded,
                label: '${item.questionCount} soal',
              ),
              const SizedBox(width: 16),
              _PackageInfo(
                icon: Icons.schedule_rounded,
                label: '${item.durationMinutes} menit',
              ),
              if (submitted && item.score != null) ...[
                const SizedBox(width: 16),
                _PackageInfo(
                  icon: Icons.emoji_events_outlined,
                  label: 'Nilai ${item.score!.toStringAsFixed(0)}',
                ),
              ],
            ],
          ),
          const SizedBox(height: 15),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: opening ? null : onTap,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFF06A27),
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(0xFFF4C9B1),
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: opening
                  ? const SizedBox.square(
                      dimension: 17,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Icon(
                      submitted
                          ? Icons.bar_chart_rounded
                          : continuing
                          ? Icons.play_circle_outline_rounded
                          : Icons.play_arrow_rounded,
                    ),
              label: Text(
                opening
                    ? 'Menyiapkan...'
                    : submitted
                    ? 'Lihat Hasil'
                    : continuing
                    ? 'Lanjutkan Simulasi'
                    : 'Mulai Simulasi',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PackageInfo extends StatelessWidget {
  const _PackageInfo({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 16, color: const Color(0xFF8A7468)),
      const SizedBox(width: 5),
      Text(
        label,
        style: const TextStyle(
          color: Color(0xFF6C7788),
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _TkaFilterChip extends StatelessWidget {
  const _TkaFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      showCheckmark: false,
      selectedColor: const Color(0xFFFFE4D3),
      backgroundColor: Colors.white,
      side: BorderSide(
        color: selected ? const Color(0xFFF07A36) : const Color(0xFFEAE1DA),
      ),
      labelStyle: TextStyle(
        color: selected ? const Color(0xFFC94B13) : const Color(0xFF647286),
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class _TkaEmptyState extends StatelessWidget {
  const _TkaEmptyState();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 34),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFF0E5DC)),
    ),
    child: const Column(
      children: [
        Icon(Icons.psychology_outlined, color: Color(0xFFF07A36), size: 46),
        SizedBox(height: 12),
        Text(
          'Belum ada paket TKA',
          style: TextStyle(
            color: AppColors.navy,
            fontSize: 16,
            fontWeight: FontWeight.w900,
          ),
        ),
        SizedBox(height: 6),
        Text(
          'Paket simulasi yang tersedia dari sekolah akan tampil di halaman ini.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFF718096), height: 1.4),
        ),
      ],
    ),
  );
}
