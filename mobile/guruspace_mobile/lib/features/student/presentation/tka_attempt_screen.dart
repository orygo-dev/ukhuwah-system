import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';

class TkaAttemptScreen extends ConsumerStatefulWidget {
  const TkaAttemptScreen({super.key, required this.attemptId});
  final String attemptId;

  @override
  ConsumerState<TkaAttemptScreen> createState() => _TkaAttemptScreenState();
}

class _TkaAttemptScreenState extends ConsumerState<TkaAttemptScreen> {
  late Future<TkaAttemptDetail> _future;
  Timer? _timer;
  TkaAttemptDetail? _detail;
  int _index = 0;
  bool _saving = false;
  bool _submitting = false;
  Duration _remaining = Duration.zero;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<TkaAttemptDetail> _load() async {
    _timer?.cancel();
    final value = await ref
        .read(dashboardRepositoryProvider)
        .getTkaAttempt(widget.attemptId);
    if (!mounted) return value;
    _detail = value;
    _updateRemaining();
    if (value.status == 'IN_PROGRESS') {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(_updateRemaining);
        if (_remaining == Duration.zero) {
          _timer?.cancel();
          _submit(expired: true);
        }
      });
    }
    return value;
  }

  void _updateRemaining() {
    final diff = _detail?.expiresAt.difference(DateTime.now()) ?? Duration.zero;
    _remaining = diff.isNegative ? Duration.zero : diff;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _select(TkaQuestionItem question, int option) async {
    if (_saving || _detail?.status != 'IN_PROGRESS') return;
    final current = _detail!.answers.putIfAbsent(question.id, () => <int>{});
    setState(() {
      if (question.type == 'MULTIPLE_CHOICE') {
        current.contains(option) ? current.remove(option) : current.add(option);
      } else {
        current
          ..clear()
          ..add(option);
      }
      _saving = true;
    });
    try {
      await ref
          .read(dashboardRepositoryProvider)
          .saveTkaAnswer(widget.attemptId, question.id, current);
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

  Future<void> _submit({bool expired = false}) async {
    if (_submitting || _detail?.status != 'IN_PROGRESS') return;
    if (!expired) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Kumpulkan jawaban?'),
          content: Text(
            '${_detail!.answers.length} dari ${_detail!.questions.length} soal telah dijawab. Setelah dikumpulkan jawaban tidak dapat diubah.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Periksa Lagi'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Kumpulkan'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }
    setState(() => _submitting = true);
    try {
      final result = await ref
          .read(dashboardRepositoryProvider)
          .submitTka(widget.attemptId);
      ref.invalidate(studentDashboardProvider);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          icon: const Icon(
            Icons.verified_rounded,
            color: AppColors.cyan,
            size: 48,
          ),
          title: const Text('Simulasi selesai'),
          content: Text(
            'Nilai ${((result['score'] as num?)?.toDouble() ?? 0).toStringAsFixed(0)}\n'
            '${result['correctCount'] ?? 0} dari ${result['totalQuestions'] ?? 0} jawaban benar.',
            textAlign: TextAlign.center,
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Selesai'),
            ),
          ],
        ),
      );
      if (mounted) Navigator.pop(context);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String get _timeLabel {
    final h = _remaining.inHours;
    final m = _remaining.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = _remaining.inSeconds.remainder(60).toString().padLeft(2, '0');
    return h > 0 ? '$h:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Simulasi TKA')),
      body: FutureBuilder<TkaAttemptDetail>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingView();
          }
          if (snapshot.hasError) {
            return ErrorView(
              message: '${snapshot.error}',
              onRetry: () => setState(() => _future = _load()),
            );
          }
          final detail = snapshot.requireData;
          if (detail.status != 'IN_PROGRESS') {
            return _ResultView(detail: detail);
          }
          if (detail.questions.isEmpty) {
            return const Center(child: Text('Paket ini belum memiliki soal.'));
          }
          final question = detail.questions[_index];
          final selected = detail.answers[question.id] ?? const <int>{};
          return SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              detail.title,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            Text(
                              '${detail.subject} • Soal ${_index + 1}/${detail.questions.length}',
                            ),
                          ],
                        ),
                      ),
                      Chip(
                        avatar: const Icon(Icons.timer_outlined, size: 18),
                        label: Text(_timeLabel),
                      ),
                    ],
                  ),
                ),
                LinearProgressIndicator(
                  value: (_index + 1) / detail.questions.length,
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (question.stimulus?.trim().isNotEmpty == true) ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8F6EA),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(question.stimulus!),
                        ),
                        const SizedBox(height: 16),
                      ],
                      Text(
                        question.prompt,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 18),
                      ...List.generate(question.options.length, (option) {
                        final active = selected.contains(option);
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () => _select(question, option),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: active
                                    ? const Color(0xFFE8F6EA)
                                    : Colors.white,
                                border: Border.all(
                                  color: active
                                      ? AppColors.blue
                                      : const Color(0xFFD7E8D9),
                                  width: active ? 2 : 1,
                                ),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 15,
                                    backgroundColor: active
                                        ? AppColors.blue
                                        : const Color(0xFFF1F5F9),
                                    foregroundColor: active
                                        ? Colors.white
                                        : AppColors.navy,
                                    child: Text(
                                      String.fromCharCode(65 + option),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(question.options[option]),
                                  ),
                                  if (active)
                                    const Icon(
                                      Icons.check_circle_rounded,
                                      color: AppColors.blue,
                                    ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      OutlinedButton(
                        onPressed: _index == 0
                            ? null
                            : () => setState(() => _index--),
                        child: const Text('Sebelumnya'),
                      ),
                      const Spacer(),
                      if (_saving)
                        const Padding(
                          padding: EdgeInsets.only(right: 12),
                          child: SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                      if (_index < detail.questions.length - 1)
                        FilledButton(
                          onPressed: () => setState(() => _index++),
                          child: const Text('Berikutnya'),
                        )
                      else
                        FilledButton.icon(
                          onPressed: _submitting ? null : _submit,
                          icon: const Icon(Icons.send_rounded),
                          label: const Text('Kumpulkan'),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ResultView extends StatelessWidget {
  const _ResultView({required this.detail});
  final TkaAttemptDetail detail;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.workspace_premium_rounded,
                color: AppColors.cyan,
                size: 64,
              ),
              const SizedBox(height: 12),
              Text(
                detail.title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              Text(
                detail.score?.toStringAsFixed(0) ?? '—',
                style: const TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.w900,
                  color: AppColors.blue,
                ),
              ),
              Text('${detail.correctCount} jawaban benar'),
            ],
          ),
        ),
      ),
    ),
  );
}
