import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/ads/mobile_ad_config.dart';
import 'package:guruspace_mobile/core/ads/student_admob_banner.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/student/presentation/student_learning_detail_screen.dart';

class StudentQuizScreen extends ConsumerStatefulWidget {
  const StudentQuizScreen({super.key});

  @override
  ConsumerState<StudentQuizScreen> createState() => _StudentQuizScreenState();
}

class _StudentQuizScreenState extends ConsumerState<StudentQuizScreen> {
  String? _subject;

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(studentDashboardProvider);
    return Scaffold(
      key: const Key('student-quiz-page'),
      backgroundColor: const Color(0xFFF8F8FE),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: const BackButton(),
        title: const Text(
          'Quiz',
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
        loading: () => const LoadingView(label: 'Menyiapkan quiz...'),
        error: (error, _) => ErrorView(
          message: '$error',
          onRetry: () => ref.invalidate(studentDashboardProvider),
        ),
        data: _buildContent,
      ),
    );
  }

  Widget _buildContent(StudentDashboard data) {
    final subjects = data.quizzes.map((item) => item.subject).toSet().toList()
      ..sort();
    final available = data.quizzes
        .where((item) => !item.completed)
        .where((item) => _subject == null || item.subject == _subject)
        .toList();
    final results = data.quizzes.where((item) => item.completed).toList()
      ..sort((a, b) => (b.score ?? -1).compareTo(a.score ?? -1));
    final completedWithScore = results
        .where((item) => item.score != null)
        .toList();
    final average = completedWithScore.isEmpty
        ? null
        : completedWithScore.fold<double>(0, (sum, item) => sum + item.score!) /
              completedWithScore.length;
    final featured = available.isEmpty ? null : available.first;

    return RefreshIndicator(
      onRefresh: () => ref.refresh(studentDashboardProvider.future),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
        children: [
          _QuizHero(
            name: data.name.split(' ').first,
            quizCount: data.quizzes.length,
            average: average,
            completed: results.length,
          ),
          if (featured != null) ...[
            const SizedBox(height: 16),
            _FeaturedQuiz(item: featured, onTap: () => _openQuiz(featured)),
          ],
          const SizedBox(height: 16),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _SubjectChip(
                  label: 'Semua',
                  selected: _subject == null,
                  onTap: () => setState(() => _subject = null),
                ),
                ...subjects.map(
                  (subject) => _SubjectChip(
                    label: subject,
                    selected: _subject == subject,
                    onTap: () => setState(() => _subject = subject),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _SectionTitle(title: 'Quiz Tersedia', count: available.length),
          const SizedBox(height: 9),
          if (available.isEmpty)
            const _QuizEmpty()
          else
            ...available.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _QuizRow(item: item, onTap: () => _openQuiz(item)),
              ),
            ),
          if (available.isNotEmpty)
            const StudentAdmobBanner(
              placement: StudentAdmobPlacement.quizBanner,
            ),
          if (results.isNotEmpty) ...[
            const SizedBox(height: 18),
            _SectionTitle(title: 'Hasil Terbaru', count: results.length),
            const SizedBox(height: 9),
            ...results
                .take(5)
                .map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _QuizResultRow(
                      item: item,
                      onTap: () => _openQuiz(item),
                    ),
                  ),
                ),
          ],
        ],
      ),
    );
  }

  Future<void> _openQuiz(LearningItem item) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => StudentLearningDetailScreen(item: item),
      ),
    );
    ref.invalidate(studentDashboardProvider);
  }
}

class _QuizHero extends StatelessWidget {
  const _QuizHero({
    required this.name,
    required this.quizCount,
    required this.average,
    required this.completed,
  });

  final String name;
  final int quizCount;
  final double? average;
  final int completed;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: const Color(0xFFE8F6EA),
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: const Color(0xFFD9DDFC)),
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
                    'Hai, $name! 👋',
                    style: const TextStyle(
                      color: AppColors.navy,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Uji pemahamanmu dan tingkatkan hasil terbaikmu.',
                    style: TextStyle(color: Color(0xFF5E6F5E), height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.emoji_events_rounded,
                color: Color(0xFFF59E0B),
                size: 38,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              _HeroMetric(label: 'Quiz', value: '$quizCount'),
              const _MetricDivider(),
              _HeroMetric(
                label: 'Rata-rata',
                value: average == null
                    ? '–'
                    : '${average!.toStringAsFixed(0)}%',
              ),
              const _MetricDivider(),
              _HeroMetric(label: 'Selesai', value: '$completed'),
            ],
          ),
        ),
      ],
    ),
  );
}

class _HeroMetric extends StatelessWidget {
  const _HeroMetric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: Color(0xFF5B3FD6),
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

class _MetricDivider extends StatelessWidget {
  const _MetricDivider();
  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 34, color: const Color(0xFFE5E7F0));
}

class _FeaturedQuiz extends StatelessWidget {
  const _FeaturedQuiz({required this.item, required this.onTap});
  final LearningItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(17),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFD8D4FE)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0D312E81),
          blurRadius: 18,
          offset: Offset(0, 8),
        ),
      ],
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.stars_rounded, color: Color(0xFF6D4BE8), size: 18),
                  SizedBox(width: 5),
                  Text(
                    'Quiz unggulan',
                    style: TextStyle(
                      color: Color(0xFF6D4BE8),
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                item.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.navy,
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                item.subject,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${item.totalQuestions ?? 0} soal',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: onTap,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF6242D9),
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    child: const Text('Mulai Quiz'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Container(
          width: 80,
          height: 92,
          decoration: BoxDecoration(
            color: const Color(0xFFF2EFFF),
            borderRadius: BorderRadius.circular(18),
          ),
          child: const Icon(
            Icons.psychology_alt_rounded,
            color: Color(0xFF6D4BE8),
            size: 45,
          ),
        ),
      ],
    ),
  );
}

class _SubjectChip extends StatelessWidget {
  const _SubjectChip({
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
      selectedColor: const Color(0xFF6242D9),
      backgroundColor: Colors.white,
      side: BorderSide(
        color: selected ? const Color(0xFF6242D9) : const Color(0xFFD7E8D9),
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.count});
  final String title;
  final int count;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(
          title,
          style: const TextStyle(
            color: AppColors.navy,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
      Text(
        '$count item',
        style: const TextStyle(
          color: AppColors.muted,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _QuizRow extends StatelessWidget {
  const _QuizRow({required this.item, required this.onTap});
  final LearningItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(17),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(17),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: const Color(0xFFD7E8D9)),
        ),
        child: Row(
          children: [
            Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                color: const Color(0xFFE8F6EA),
                borderRadius: BorderRadius.circular(15),
              ),
              child: Icon(
                _quizIcon(item.subject),
                color: const Color(0xFF5B46D1),
                size: 29,
              ),
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
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.subject,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 5),
                  _Meta(
                    icon: Icons.list_alt_rounded,
                    text: '${item.totalQuestions ?? 0} soal',
                  ),
                ],
              ),
            ),
            OutlinedButton(
              onPressed: onTap,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF6242D9),
                visualDensity: VisualDensity.compact,
              ),
              child: const Text('Mulai'),
            ),
          ],
        ),
      ),
    ),
  );
}

class _QuizResultRow extends StatelessWidget {
  const _QuizResultRow({required this.item, required this.onTap});
  final LearningItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final score = item.score;
    final color = score == null
        ? AppColors.muted
        : score >= 75
        ? const Color(0xFF059669)
        : const Color(0xFFF59E0B);
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFD7E8D9)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.fact_check_outlined, color: color),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.subject,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'Skor',
                    style: TextStyle(color: AppColors.muted, fontSize: 10),
                  ),
                  Text(
                    score?.toStringAsFixed(0) ?? '–',
                    style: TextStyle(
                      color: color,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 14, color: AppColors.muted),
      const SizedBox(width: 4),
      Text(
        text,
        style: const TextStyle(
          color: AppColors.muted,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    ],
  );
}

IconData _quizIcon(String subject) {
  final value = subject.toLowerCase();
  if (value.contains('mat')) return Icons.functions_rounded;
  if (value.contains('ipa') || value.contains('bio')) {
    return Icons.biotech_rounded;
  }
  if (value.contains('bahasa')) return Icons.translate_rounded;
  if (value.contains('sejarah')) return Icons.account_balance_rounded;
  return Icons.quiz_rounded;
}

class _QuizEmpty extends StatelessWidget {
  const _QuizEmpty();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 46, horizontal: 20),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(19),
      border: Border.all(color: const Color(0xFFD7E8D9)),
    ),
    child: const Column(
      children: [
        Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 42),
        SizedBox(height: 10),
        Text(
          'Semua quiz sudah selesai',
          style: TextStyle(color: AppColors.navy, fontWeight: FontWeight.w900),
        ),
        SizedBox(height: 5),
        Text(
          'Quiz baru dari guru akan tampil di sini.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted),
        ),
      ],
    ),
  );
}
