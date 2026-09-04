import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/core/widgets/dashboard_components.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';

class StudentLearningDetailScreen extends ConsumerStatefulWidget {
  const StudentLearningDetailScreen({super.key, required this.item});

  final LearningItem item;

  @override
  ConsumerState<StudentLearningDetailScreen> createState() =>
      _StudentLearningDetailScreenState();
}

class _StudentLearningDetailScreenState
    extends ConsumerState<StudentLearningDetailScreen> {
  final _answerController = TextEditingController();
  final Map<String, int> _answers = {};
  final Map<String, dynamic> _assignmentAnswers = {};
  Map<String, dynamic>? _detail;
  bool _loading = true;
  bool _submitting = false;
  bool _dirty = false;
  int _questionIndex = 0;
  int _loadGeneration = 0;
  String? _error;

  String get _kind => switch (widget.item.kind) {
    'Kuis' => 'quiz',
    'Ujian' => 'exam',
    _ => 'assignment',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _answerController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final generation = ++_loadGeneration;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await ref
          .read(apiClientProvider)
          .getJson('/api/mobile/v1/student/learning/$_kind/${widget.item.id}');
      if (!mounted || generation != _loadGeneration) return;
      final submission = detail['submission'] as Map?;
      final attempt = detail['attempt'] as Map?;
      _assignmentAnswers.clear();
      _answers.clear();
      if (submission != null) {
        _answerController.text = submission['answer']?.toString() ?? '';
        for (final answer in (submission['answers'] as List? ?? const [])) {
          if (answer is Map && answer['questionId'] != null) {
            _assignmentAnswers[answer['questionId'].toString()] =
                answer['response'];
          }
        }
      }
      if (attempt != null) {
        for (final answer in (attempt['answers'] as List? ?? const [])) {
          if (answer is Map) {
            _answers[answer['questionId'].toString()] =
                (answer['selectedOptionIndex'] as num?)?.toInt() ?? 0;
          }
        }
      }
      setState(() => _detail = detail);
    } catch (error) {
      if (mounted && generation == _loadGeneration) {
        setState(() => _error = '$error');
      }
    } finally {
      if (mounted && generation == _loadGeneration) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _submit() async {
    final questions = (_detail?['questions'] as List? ?? const [])
        .whereType<Map>()
        .toList();
    final activity = _detail?['activity'] as Map? ?? const {};
    final structuredAssignment =
        _kind == 'assignment' && activity['mode'] == 'QUESTION_SET';
    if (_kind == 'assignment' &&
        !structuredAssignment &&
        _answerController.text.trim().isEmpty) {
      _message('Jawaban tugas wajib diisi.');
      return;
    }
    if (structuredAssignment) {
      final missingIndex = questions.indexWhere((question) {
        if (question['required'] != true) return false;
        final value = _assignmentAnswers[question['id'].toString()];
        return !_hasAnswer(value);
      });
      if (missingIndex >= 0) {
        setState(() => _questionIndex = missingIndex);
        _message('Soal wajib nomor ${missingIndex + 1} belum dijawab.');
        return;
      }
    }
    if (_kind != 'assignment' && _answers.length != questions.length) {
      _message('Semua soal wajib dijawab.');
      return;
    }

    if (_kind == 'assignment') {
      final confirmed = await _showSubmissionReview(
        questions: questions,
        structured: structuredAssignment,
      );
      if (!confirmed) return;
    }

    await _sendSubmission(questions, structuredAssignment);
  }

  bool _hasAnswer(dynamic value) =>
      value != null &&
      (value is! String || value.trim().isNotEmpty) &&
      (value is! List || value.isNotEmpty);

  Future<bool> _showSubmissionReview({
    required List<Map> questions,
    required bool structured,
  }) async {
    final answered = structured
        ? questions
              .where(
                (question) =>
                    _hasAnswer(_assignmentAnswers[question['id'].toString()]),
              )
              .length
        : (_answerController.text.trim().isEmpty ? 0 : 1);
    final total = structured ? questions.length : 1;
    final existing = _detail?['submission'] != null;
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            icon: Container(
              width: 56,
              height: 56,
              decoration: const BoxDecoration(
                color: AppColors.blueSoft,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.fact_check_rounded,
                color: AppColors.blue,
                size: 28,
              ),
            ),
            title: Text(existing ? 'Kumpulkan revisi?' : 'Kumpulkan tugas?'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$answered dari $total ${structured ? 'soal' : 'jawaban'} telah diisi.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.muted, height: 1.5),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Pastikan jawaban sudah benar sebelum dikirim. Kebijakan revisi mengikuti pengaturan guru.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF92400E),
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Periksa lagi'),
              ),
              FilledButton.icon(
                onPressed: () => Navigator.pop(dialogContext, true),
                icon: const Icon(Icons.send_rounded, size: 18),
                label: Text(existing ? 'Kirim revisi' : 'Ya, kumpulkan'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _sendSubmission(
    List<Map> questions,
    bool structuredAssignment,
  ) async {
    setState(() => _submitting = true);
    try {
      if (_kind == 'assignment') {
        final submission = _detail?['submission'] as Map?;
        await ref
            .read(apiClientProvider)
            .postJson(
              '/api/student/assignments/${widget.item.id}/submission',
              data: structuredAssignment
                  ? {
                      'version': submission?['version'],
                      'answers': questions
                          .map(
                            (question) => {
                              'questionId': question['id'].toString(),
                              'response':
                                  _assignmentAnswers[question['id'].toString()],
                            },
                          )
                          .toList(),
                    }
                  : {
                      'answer': _answerController.text.trim(),
                      'version': submission?['version'],
                    },
            );
      } else {
        await ref
            .read(apiClientProvider)
            .postJson(
              '/api/student/${_kind == 'quiz' ? 'quizzes' : 'exams'}/${widget.item.id}/attempt',
              data: {
                'answers': questions
                    .map(
                      (question) => {
                        'questionId': question['id'].toString(),
                        'selectedOptionIndex':
                            _answers[question['id'].toString()],
                      },
                    )
                    .toList(),
              },
            );
      }
      _message(
        _kind == 'assignment'
            ? 'Tugas berhasil dikumpulkan.'
            : 'Jawaban berhasil dikirim.',
      );
      _dirty = false;
      await _load();
    } catch (error) {
      _message('$error');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _message(String value) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(value)));
  }

  @override
  Widget build(BuildContext context) {
    final activity = _detail?['activity'] as Map?;
    final structuredAssignment =
        _kind == 'assignment' && activity?['mode'] == 'QUESTION_SET';
    return PopScope(
      canPop: !_dirty || _isFinal,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Keluar dari tugas?'),
            content: const Text(
              'Jawaban yang belum dikumpulkan akan hilang dari perangkat ini.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Tetap mengerjakan'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Keluar'),
              ),
            ],
          ),
        );
        if (leave != true || !context.mounted) return;
        setState(() => _dirty = false);
        Navigator.pop(context);
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF4F7FC),
        appBar: AppBar(
          backgroundColor: Colors.white,
          foregroundColor: AppColors.navy,
          title: Text(
            _kind == 'assignment' ? 'Detail Tugas' : widget.item.title,
          ),
          actions: _kind == 'assignment'
              ? [
                  Container(
                    margin: const EdgeInsets.only(right: 12),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 11,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.blueSoft,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.assignment_turned_in_rounded,
                          color: AppColors.blue,
                          size: 17,
                        ),
                        SizedBox(width: 6),
                        Text(
                          'TUGAS',
                          style: TextStyle(
                            color: AppColors.blue,
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                ]
              : null,
        ),
        body: _loading
            ? const LoadingView(label: 'Memuat aktivitas...')
            : _error != null
            ? ErrorView(message: _error!, onRetry: _load)
            : _buildContent(),
        bottomNavigationBar: _loading || _error != null || _isFinal
            ? null
            : structuredAssignment
            ? _buildStructuredActionBar()
            : SafeArea(
                minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.send_rounded),
                  label: Text(
                    _kind == 'assignment' ? 'Kumpulkan Tugas' : 'Kirim Jawaban',
                  ),
                ),
              ),
      ),
    );
  }

  Widget _buildStructuredActionBar() {
    final questions = (_detail?['questions'] as List? ?? const [])
        .whereType<Map>()
        .toList();
    if (questions.isEmpty) return const SizedBox.shrink();
    final index = _questionIndex.clamp(0, questions.length - 1);
    final last = index == questions.length - 1;
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        10,
        16,
        10 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Color(0x12101D3A),
            blurRadius: 18,
            offset: Offset(0, -6),
          ),
        ],
      ),
      child: Row(
        children: [
          if (index > 0) ...[
            SizedBox(
              width: 52,
              child: OutlinedButton(
                onPressed: () => setState(() => _questionIndex--),
                child: const Icon(Icons.arrow_back_rounded),
              ),
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: FilledButton.icon(
              key: Key(last ? 'assignment-review-submit' : 'assignment-next'),
              onPressed: _submitting
                  ? null
                  : last
                  ? _submit
                  : () => setState(() => _questionIndex++),
              icon: _submitting
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Icon(last ? Icons.fact_check_rounded : Icons.arrow_forward),
              label: Text(last ? 'Review & Kumpulkan' : 'Soal Selanjutnya'),
            ),
          ),
        ],
      ),
    );
  }

  bool get _isFinal {
    final submission = _detail?['submission'] as Map?;
    final attempt = _detail?['attempt'] as Map?;
    final activity = _detail?['activity'] as Map?;
    final submissionAnswers = (submission?['answers'] as List? ?? const []);
    final autoGraded =
        submissionAnswers.isNotEmpty &&
        submissionAnswers.every(
          (answer) => answer is Map && answer['autoGraded'] == true,
        );
    return (submission?['status'] == 'GRADED' &&
            !(activity?['allowResubmit'] == true && autoGraded)) ||
        (submission != null &&
            submission['status'] != 'RETURNED' &&
            activity?['allowResubmit'] == false) ||
        (activity?['acceptsSubmission'] == false) ||
        attempt != null;
  }

  Widget _buildContent() {
    final activity = Map<String, dynamic>.from(
      _detail?['activity'] as Map? ?? const {},
    );
    final attempt = _detail?['attempt'] as Map?;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 110),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: AppGradients.brand,
            borderRadius: BorderRadius.circular(24),
            boxShadow: AppShadows.floating,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 11,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .16),
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: Text(
                      activity['subject']?.toString() ?? widget.item.subject,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const Spacer(),
                  const Icon(
                    Icons.auto_stories_rounded,
                    color: Colors.white70,
                    size: 26,
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Text(
                activity['title']?.toString() ?? widget.item.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 23,
                  fontWeight: FontWeight.w900,
                  height: 1.25,
                ),
              ),
              if (activity['description']?.toString().trim().isNotEmpty ==
                  true) ...[
                const SizedBox(height: 9),
                Text(
                  activity['description'].toString(),
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFFE8F6EA),
                    fontSize: 13,
                    height: 1.5,
                  ),
                ),
              ],
              const SizedBox(height: 17),
              Row(
                children: [
                  const Icon(
                    Icons.person_outline_rounded,
                    color: Colors.white70,
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      activity['teacherName']?.toString() ?? 'Guru pengampu',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (activity['maxScore'] != null)
                    Text(
                      '${activity['maxScore']} poin',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        if (attempt != null) ...[
          const SizedBox(height: 14),
          Card(
            color: const Color(0xFFECFDF5),
            child: ListTile(
              leading: const Icon(
                Icons.verified_rounded,
                color: AppColors.success,
              ),
              title: const Text('Sudah dikerjakan'),
              subtitle: Text(
                'Nilai: ${(attempt['score'] as num?)?.toStringAsFixed(1) ?? '-'}',
              ),
            ),
          ),
        ],
        const SizedBox(height: 18),
        if (_kind == 'assignment' && activity['dueAt'] != null) ...[
          Card(
            color: activity['acceptsSubmission'] == false
                ? const Color(0xFFFEF2F2)
                : activity['isLate'] == true
                ? const Color(0xFFFFFBEB)
                : const Color(0xFFE8F6EA),
            child: ListTile(
              leading: const Icon(Icons.schedule_rounded),
              title: Text(_formatDeadline(activity['dueAt'].toString())),
              subtitle: Text(
                activity['acceptsSubmission'] == false
                    ? 'Pengumpulan sudah ditutup.'
                    : activity['isLate'] == true
                    ? 'Masih diterima dan akan ditandai terlambat.'
                    : 'Batas pengumpulan menggunakan Waktu Indonesia Barat.',
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (_kind == 'assignment') _buildAssignment() else _buildQuestions(),
      ],
    );
  }

  Widget _buildAssignment() {
    final submission = _detail?['submission'] as Map?;
    final activity = _detail?['activity'] as Map? ?? const {};
    if (activity['mode'] == 'QUESTION_SET') {
      return _buildStructuredAssignment(activity, submission);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Jawaban Tugas',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _answerController,
          readOnly: submission?['status'] == 'GRADED',
          minLines: 7,
          maxLines: 14,
          decoration: const InputDecoration(
            hintText: 'Tuliskan jawaban dengan lengkap...',
            alignLabelWithHint: true,
          ),
          onChanged: (_) => _dirty = true,
        ),
        if (submission?['feedback'] != null) ...[
          const SizedBox(height: 14),
          Card(
            child: ListTile(
              title: const Text('Umpan Balik Guru'),
              subtitle: Text(submission!['feedback'].toString()),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildStructuredAssignment(Map activity, Map? submission) {
    final questions = (_detail?['questions'] as List? ?? const [])
        .whereType<Map>()
        .toList();
    final submissionAnswers = (submission?['answers'] as List? ?? const []);
    final autoGraded =
        submissionAnswers.isNotEmpty &&
        submissionAnswers.every(
          (answer) => answer is Map && answer['autoGraded'] == true,
        );
    final locked =
        (submission?['status'] == 'GRADED' &&
            !(activity['allowResubmit'] == true && autoGraded)) ||
        (submission != null &&
            submission['status'] != 'RETURNED' &&
            activity['allowResubmit'] == false);
    if (questions.isEmpty) {
      return const EmptyCard(
        icon: Icons.assignment_outlined,
        title: 'Soal belum tersedia',
        message: 'Guru belum menambahkan soal pada tugas ini.',
      );
    }
    final index = _questionIndex.clamp(0, questions.length - 1);
    final question = questions[index];
    final answeredCount = questions
        .where((item) => _hasAnswer(_assignmentAnswers[item['id'].toString()]))
        .length;
    final requiredCount = questions
        .where((item) => item['required'] == true)
        .length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: AppColors.blueSoft,
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: const Icon(
                      Icons.checklist_rounded,
                      color: AppColors.blue,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Progres pengerjaan',
                          style: TextStyle(
                            color: AppColors.navy,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '$answeredCount dari ${questions.length} soal terjawab · $requiredCount wajib',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${((answeredCount / questions.length) * 100).round()}%',
                    style: const TextStyle(
                      color: AppColors.blue,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 13),
              LinearProgressIndicator(
                value: answeredCount / questions.length,
                minHeight: 7,
                borderRadius: BorderRadius.circular(10),
                backgroundColor: const Color(0xFFE8EEF8),
                color: AppColors.blue,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 42,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: questions.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, questionIndex) {
              final item = questions[questionIndex];
              final answered = _hasAnswer(
                _assignmentAnswers[item['id'].toString()],
              );
              final selected = questionIndex == index;
              return Semantics(
                label:
                    'Soal ${questionIndex + 1}${answered ? ', sudah dijawab' : ', belum dijawab'}',
                button: true,
                child: InkWell(
                  key: Key('assignment-question-${questionIndex + 1}'),
                  onTap: () => setState(() => _questionIndex = questionIndex),
                  borderRadius: BorderRadius.circular(12),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: 42,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: selected
                          ? AppColors.blue
                          : answered
                          ? const Color(0xFFECFDF5)
                          : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: selected
                            ? AppColors.blue
                            : answered
                            ? AppColors.success
                            : AppColors.border,
                      ),
                    ),
                    child: Text(
                      '${questionIndex + 1}',
                      style: TextStyle(
                        color: selected
                            ? Colors.white
                            : answered
                            ? AppColors.success
                            : AppColors.muted,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 14),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 220),
          child: _AssignmentQuestionCard(
            key: ValueKey(question['id']),
            index: index,
            question: question,
            value: _assignmentAnswers[question['id'].toString()],
            result: submissionAnswers.whereType<Map>().cast<Map>().firstWhere(
              (answer) =>
                  answer['questionId']?.toString() == question['id'].toString(),
              orElse: () => const {},
            ),
            enabled: !locked,
            onChanged: (value) => setState(() {
              _assignmentAnswers[question['id'].toString()] = value;
              _dirty = true;
            }),
          ),
        ),
        const SizedBox(height: 12),
        if (submission?['score'] != null)
          Card(
            color: const Color(0xFFE8F6EA),
            child: ListTile(
              leading: const Icon(
                Icons.verified_rounded,
                color: AppColors.blue,
              ),
              title: Text(
                'Nilai ${submission!['score']} / ${activity['maxScore'] ?? 100}',
              ),
              subtitle: submission['feedback'] == null
                  ? null
                  : Text(submission['feedback'].toString()),
            ),
          ),
      ],
    );
  }

  Widget _buildQuestions() {
    final questions = (_detail?['questions'] as List? ?? const [])
        .whereType<Map>()
        .toList();
    if (questions.isEmpty) {
      return const EmptyCard(
        icon: Icons.quiz_outlined,
        title: 'Belum ada soal',
        message: 'Soal akan tampil setelah diterbitkan guru.',
      );
    }
    final index = _questionIndex.clamp(0, questions.length - 1);
    final question = questions[index];
    final accent = _kind == 'exam' ? AppColors.danger : AppColors.violet;
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: LinearProgressIndicator(
                value: (index + 1) / questions.length,
                minHeight: 6,
                borderRadius: BorderRadius.circular(8),
                color: accent,
              ),
            ),
            const SizedBox(width: 12),
            Text(
              '${index + 1} / ${questions.length}',
              style: TextStyle(color: accent, fontWeight: FontWeight.w900),
            ),
          ],
        ),
        const SizedBox(height: 14),
        _QuestionCard(
          index: index,
          question: question,
          selected: _answers[question['id'].toString()],
          enabled: !_isFinal,
          onChanged: (value) =>
              setState(() => _answers[question['id'].toString()] = value),
        ),
        if (!_isFinal)
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: index == 0
                      ? null
                      : () => setState(() => _questionIndex--),
                  icon: const Icon(Icons.chevron_left_rounded),
                  label: const Text('Sebelumnya'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: accent),
                  onPressed: index == questions.length - 1
                      ? null
                      : () => setState(() => _questionIndex++),
                  child: const Text('Selanjutnya'),
                ),
              ),
            ],
          ),
      ],
    );
  }
}

class _AssignmentQuestionCard extends StatelessWidget {
  const _AssignmentQuestionCard({
    super.key,
    required this.index,
    required this.question,
    required this.value,
    required this.result,
    required this.enabled,
    required this.onChanged,
  });

  final int index;
  final Map question;
  final dynamic value;
  final Map result;
  final bool enabled;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    final type = question['type']?.toString() ?? 'ESSAY';
    final options = (question['options'] as List? ?? const [])
        .map(_AssignmentOption.fromJson)
        .toList();
    final questionId = question['id'].toString();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(17),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  '${index + 1}. ${question['prompt']}${question['required'] == true ? ' *' : ''}',
                  style: const TextStyle(
                    color: AppColors.navy,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    height: 1.4,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '${question['points']} poin',
                style: const TextStyle(
                  color: AppColors.blue,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          if (question['imageUrl']?.toString().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                resolveAppMediaUrl(question['imageUrl'].toString()),
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) =>
                    const Text('Gambar soal tidak dapat dimuat.'),
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (type == 'SINGLE_CHOICE' || type == 'TRUE_FALSE')
            RadioGroup<int>(
              groupValue: value is num ? (value as num).toInt() : null,
              onChanged: enabled
                  ? (selected) {
                      if (selected != null) onChanged(selected);
                    }
                  : (_) {},
              child: Column(
                children: List.generate(
                  options.length,
                  (optionIndex) => RadioListTile<int>(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: _AssignmentOptionView(option: options[optionIndex]),
                    value: optionIndex,
                    enabled: enabled,
                  ),
                ),
              ),
            )
          else if (type == 'MULTIPLE_CHOICE')
            ...List.generate(options.length, (optionIndex) {
              final selected = (value is List ? value : const [])
                  .map((item) => (item as num).toInt())
                  .toList();
              return CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: _AssignmentOptionView(option: options[optionIndex]),
                value: selected.contains(optionIndex),
                onChanged: enabled
                    ? (checked) => onChanged(
                        checked == true
                            ? [...selected, optionIndex]
                            : selected
                                  .where((item) => item != optionIndex)
                                  .toList(),
                      )
                    : null,
              );
            })
          else
            TextFormField(
              key: ValueKey('assignment-$questionId'),
              initialValue: value?.toString() ?? '',
              enabled: enabled,
              minLines: type == 'ESSAY' ? 5 : 1,
              maxLines: type == 'ESSAY' ? 10 : 2,
              decoration: InputDecoration(
                hintText: type == 'ESSAY'
                    ? 'Tuliskan jawaban lengkap...'
                    : 'Jawaban singkat',
              ),
              onChanged: onChanged,
            ),
          if (result.isNotEmpty && !enabled) ...[
            const SizedBox(height: 10),
            Text(
              'Nilai butir: ${result['score'] ?? 'Menunggu koreksi'} / ${question['points']}',
              style: const TextStyle(
                color: AppColors.blue,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (result['feedback'] != null &&
                result['feedback'].toString().trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Feedback: ${result['feedback']}',
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ),
            if (question['explanation'] != null &&
                question['explanation'].toString().trim().isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F6EA),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'Pembahasan: ${question['explanation']}',
                  style: const TextStyle(color: AppColors.blue, fontSize: 12),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _AssignmentOption {
  const _AssignmentOption({required this.text, this.imageUrl});
  final String text;
  final String? imageUrl;

  factory _AssignmentOption.fromJson(dynamic value) {
    if (value is String) return _AssignmentOption(text: value);
    if (value is Map) {
      final image = value['imageUrl']?.toString();
      return _AssignmentOption(
        text: value['text']?.toString() ?? '',
        imageUrl: image == null || image.isEmpty ? null : image,
      );
    }
    return const _AssignmentOption(text: '');
  }
}

class _AssignmentOptionView extends StatelessWidget {
  const _AssignmentOptionView({required this.option});
  final _AssignmentOption option;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (option.imageUrl != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                resolveAppMediaUrl(option.imageUrl!),
                height: 140,
                width: 220,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) =>
                    const Text('Gambar pilihan tidak dapat dimuat.'),
              ),
            ),
          ),
        if (option.text.isNotEmpty) Text(option.text),
      ],
    );
  }
}

String _formatDeadline(String value) {
  final parsed = DateTime.tryParse(value)?.toLocal();
  if (parsed == null) return 'Deadline tidak valid';
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  final jakarta = parsed.toUtc().add(const Duration(hours: 7));
  return 'Deadline ${jakarta.day} ${months[jakarta.month - 1]} ${jakarta.year}, ${jakarta.hour.toString().padLeft(2, '0')}.${jakarta.minute.toString().padLeft(2, '0')} WIB';
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.index,
    required this.question,
    required this.selected,
    required this.enabled,
    required this.onChanged,
  });

  final int index;
  final Map question;
  final int? selected;
  final bool enabled;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final options = (question['options'] as List? ?? const [])
        .map((value) => value.toString())
        .toList();
    final correct = (question['correctOptionIndex'] as num?)?.toInt();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 16, 14, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${index + 1}. ${question['prompt'] ?? 'Pertanyaan'}',
              style: const TextStyle(fontWeight: FontWeight.w800, height: 1.45),
            ),
            const SizedBox(height: 8),
            for (
              var optionIndex = 0;
              optionIndex < options.length;
              optionIndex++
            )
              ListTile(
                dense: true,
                enabled: enabled,
                onTap: enabled ? () => onChanged(optionIndex) : null,
                leading: Icon(
                  selected == optionIndex
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded,
                  color: selected == optionIndex
                      ? AppColors.blue
                      : AppColors.muted,
                ),
                title: Text(options[optionIndex]),
                trailing: correct == null
                    ? null
                    : Icon(
                        correct == optionIndex
                            ? Icons.check_circle_rounded
                            : selected == optionIndex
                            ? Icons.cancel_rounded
                            : Icons.circle_outlined,
                        color: correct == optionIndex
                            ? AppColors.success
                            : selected == optionIndex
                            ? AppColors.danger
                            : AppColors.muted,
                      ),
              ),
            if (question['explanation'] != null)
              Padding(
                padding: const EdgeInsets.all(10),
                child: Text(
                  question['explanation'].toString(),
                  style: const TextStyle(color: AppColors.muted),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
