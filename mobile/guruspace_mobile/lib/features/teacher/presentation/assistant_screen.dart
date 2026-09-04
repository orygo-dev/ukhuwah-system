import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/shared/presentation/native_data_screen.dart';
import 'package:guruspace_mobile/features/teacher/domain/assistant_models.dart';
import 'package:path_provider/path_provider.dart';

final assistantBootstrapProvider = FutureProvider<AssistantBootstrap>((
  ref,
) async {
  ref.watch(authenticatedUserIdProvider);
  final json = await ref
      .watch(apiClientProvider)
      .getJson('/api/mobile/v1/teacher/assistant');
  return AssistantBootstrap.fromJson(json);
});

enum _AssistantPhase { idle, thinking, recommendations }

class TeacherAssistantScreen extends ConsumerStatefulWidget {
  const TeacherAssistantScreen({super.key, this.initialToolSlug});

  final String? initialToolSlug;

  @override
  ConsumerState<TeacherAssistantScreen> createState() =>
      _TeacherAssistantScreenState();
}

class _TeacherAssistantScreenState
    extends ConsumerState<TeacherAssistantScreen> {
  AssistantWorkflow? _workflow;
  _AssistantPhase _phase = _AssistantPhase.idle;
  int _thinkingStep = 0;
  final Set<String> _selected = {};
  final ScrollController _scrollController = ScrollController();
  Timer? _thinkingTimer;
  Timer? _openingActionTimer;
  bool _showOpeningActions = false;
  bool _openedInitialTool = false;

  static const _openingQuestion =
      'Halo Bapak/Ibu Guru. Hari ini ingin saya bantu menyiapkan apa?';
  static const _openingDescription =
      'Pilih salah satu tombol di bawah. Saya akan cek dokumen yang sudah ada, menyusun rekomendasi, lalu menghitung kredit sebelum generator dibuka.';

  static const _thinkingSteps = [
    'Membaca workflow yang dipilih',
    'Mengecek dokumen yang sudah tersedia',
    'Menganalisis prioritas dan urutan',
    'Menyusun rekomendasi aman',
  ];

  static const _thinkingMessages = [
    'Saya membaca kebutuhan workflow dan dokumen yang relevan.',
    'Saya mengecek arsip dokumen Bapak/Ibu yang sudah dibuat atau masih draft.',
    'Saya menimbang urutan terbaik agar generator dipakai dengan konteks yang tepat.',
    'Saya menyusun rekomendasi dan rencana biaya yang aman sebelum generate.',
  ];

  @override
  void dispose() {
    _thinkingTimer?.cancel();
    _openingActionTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  void _completeOpeningAnimation() {
    if (_showOpeningActions) return;
    _openingActionTimer?.cancel();
    _openingActionTimer = Timer(const Duration(milliseconds: 280), () {
      if (!mounted) return;
      setState(() => _showOpeningActions = true);
      _followConversation(animated: true);
    });
  }

  void _chooseWorkflow(AssistantWorkflow workflow) {
    _thinkingTimer?.cancel();
    setState(() {
      _workflow = workflow;
      _phase = _AssistantPhase.thinking;
      _thinkingStep = 0;
      _selected.clear();
    });
    _followConversation(animated: true);
    _thinkingTimer = Timer.periodic(const Duration(milliseconds: 1150), (
      timer,
    ) {
      if (!mounted) return;
      if (_thinkingStep >= _thinkingSteps.length - 1) {
        timer.cancel();
        Future<void>.delayed(const Duration(milliseconds: 650), () {
          if (mounted) {
            setState(() => _phase = _AssistantPhase.recommendations);
            _followConversation(animated: true);
          }
        });
      } else {
        setState(() => _thinkingStep++);
        _followConversation(animated: true);
      }
    });
  }

  void _followConversation({bool animated = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      final target = _scrollController.position.maxScrollExtent;
      if (animated) {
        _scrollController.animateTo(
          target,
          duration: const Duration(milliseconds: 360),
          curve: Curves.easeOutCubic,
        );
      } else {
        _scrollController.jumpTo(target);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(assistantBootstrapProvider);
    return async.when(
      loading: () => const LoadingView(label: 'Menyiapkan AI Assistant...'),
      error: (error, _) => ErrorView(
        message: '$error',
        onRetry: () => ref.invalidate(assistantBootstrapProvider),
      ),
      data: (data) => data.canUse
          ? _buildAssistant(data)
          : _LockedAssistant(onRetry: () {}),
    );
  }

  Widget _buildAssistant(AssistantBootstrap data) {
    final initialToolSlug = widget.initialToolSlug;
    if (!_openedInitialTool && initialToolSlug?.isNotEmpty == true) {
      _openedInitialTool = true;
      AssistantTool? initialTool;
      for (final tool in data.tools) {
        if (tool.slug == initialToolSlug) initialTool = tool;
      }
      if (initialTool == null) {
        for (final workflow in data.workflows) {
          for (final item in workflow.items) {
            if (item.tool.slug == initialToolSlug) initialTool = item.tool;
          }
        }
      }
      if (initialTool != null) {
        final tool = initialTool;
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => _openGenerator(data, tool),
        );
      }
    }
    final documents = {
      for (final document in data.documents) document.toolSlug: document,
    };
    final rows = _workflow?.items ?? const <AssistantWorkflowItem>[];
    final recommendations = rows
        .where((item) => documents[item.tool.slug]?.status != 'FINAL')
        .toList();
    final completedRows = rows
        .where((item) => documents[item.tool.slug]?.status == 'FINAL')
        .toList();
    final completed = completedRows.length;
    final selectedRows = recommendations
        .where((item) => _selected.contains(item.tool.slug))
        .toList();
    final totalCost = selectedRows.fold<int>(
      0,
      (sum, item) => sum + item.tool.creditCost,
    );

    return Container(
      color: const Color(0xFFEEF5FF),
      child: Column(
        children: [
          _AssistantHeader(credits: data.credits),
          Expanded(
            child: ListView(
              key: const Key('assistant-conversation-list'),
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(10, 12, 10, 110),
              children: [
                _AssistantBubble(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _AssistantTypewriterText(
                        text: _openingQuestion,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: AppColors.navy,
                        ),
                        onProgress: _followConversation,
                        onComplete: _completeOpeningAnimation,
                      ),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 320),
                        switchInCurve: Curves.easeOutCubic,
                        child: _showOpeningActions
                            ? Column(
                                key: const ValueKey('workflow-actions'),
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 5),
                                  const Text(
                                    _openingDescription,
                                    style: TextStyle(
                                      fontSize: 12,
                                      height: 1.55,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  GridView.builder(
                                    shrinkWrap: true,
                                    physics:
                                        const NeverScrollableScrollPhysics(),
                                    itemCount: data.workflows.length,
                                    gridDelegate:
                                        const SliverGridDelegateWithFixedCrossAxisCount(
                                          crossAxisCount: 2,
                                          mainAxisExtent: 112,
                                          crossAxisSpacing: 8,
                                          mainAxisSpacing: 8,
                                        ),
                                    itemBuilder: (context, index) {
                                      final workflow = data.workflows[index];
                                      return _WorkflowButton(
                                        workflow: workflow,
                                        active: workflow.id == _workflow?.id,
                                        index: index,
                                        onTap: () => _chooseWorkflow(workflow),
                                      );
                                    },
                                  ),
                                ],
                              )
                            : const _TypingPreparation(
                                key: ValueKey('typing-preparation'),
                              ),
                      ),
                    ],
                  ),
                ),
                if (_workflow != null) ...[
                  const SizedBox(height: 12),
                  _UserBubble(
                    title: _workflow!.title,
                    description: _workflow!.goal,
                  ),
                ],
                if (_phase == _AssistantPhase.thinking) ...[
                  const SizedBox(height: 12),
                  _AssistantBubble(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.3,
                              ),
                            ),
                            SizedBox(width: 9),
                            Expanded(
                              child: Text(
                                'Saya sedang menganalisis...',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 250),
                          child: _AssistantTypewriterText(
                            key: ValueKey(_thinkingStep),
                            text: _thinkingMessages[_thinkingStep],
                            characterDelay: const Duration(milliseconds: 10),
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 11.5,
                              height: 1.45,
                              fontWeight: FontWeight.w600,
                            ),
                            onProgress: _followConversation,
                            onComplete: () =>
                                _followConversation(animated: true),
                          ),
                        ),
                        const SizedBox(height: 4),
                        ...List.generate(
                          _thinkingSteps.length,
                          (index) => _ThinkingRow(
                            label: _thinkingSteps[index],
                            done: index < _thinkingStep,
                            active: index == _thinkingStep,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (_phase == _AssistantPhase.recommendations) ...[
                  const SizedBox(height: 12),
                  _AssistantBubble(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _AssistantTypewriterText(
                          text:
                              'Ini hasil pengecekan saya untuk ${_workflow!.title}.',
                          characterDelay: const Duration(milliseconds: 16),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                          ),
                          onProgress: _followConversation,
                          onComplete: () => _followConversation(animated: true),
                        ),
                        const SizedBox(height: 11),
                        Row(
                          children: [
                            Expanded(
                              child: _AssistantStat(
                                label: 'Sudah ada',
                                value: '$completed',
                                color: AppColors.success,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: _AssistantStat(
                                label: 'Rekomendasi',
                                value: '${recommendations.length}',
                                color: AppColors.blue,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: _AssistantStat(
                                label: 'Kredit',
                                value: '${data.credits}',
                                color: AppColors.navy,
                              ),
                            ),
                          ],
                        ),
                        if (recommendations.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          const Text(
                            'PILIH DOKUMEN YANG INGIN DIBUAT',
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: .7,
                            ),
                          ),
                          const SizedBox(height: 7),
                          ...recommendations.asMap().entries.map((entry) {
                            final item = entry.value;
                            final selected = _selected.contains(item.tool.slug);
                            return _RecommendationTile(
                              item: item,
                              priority: entry.key == 0,
                              selected: selected,
                              onTap: () {
                                setState(
                                  () => selected
                                      ? _selected.remove(item.tool.slug)
                                      : _selected.add(item.tool.slug),
                                );
                                _followConversation(animated: true);
                              },
                            );
                          }),
                        ],
                        if (completedRows.isNotEmpty) ...[
                          const SizedBox(height: 11),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'DOKUMEN YANG SUDAH ADA',
                                  style: TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: .6,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: completedRows
                                      .map(
                                        (item) => ActionChip(
                                          avatar: const Icon(
                                            Icons.check_circle_outline_rounded,
                                            size: 15,
                                            color: AppColors.success,
                                          ),
                                          label: Text(item.tool.name),
                                          onPressed: () => openNativeDataScreen(
                                            context,
                                            title: 'Dokumen Saya',
                                            description:
                                                'Dokumen yang sudah dibuat melalui AI Assistant.',
                                            icon: Icons.description_outlined,
                                            endpoint: '/api/documents',
                                            listKeys: const ['documents'],
                                          ),
                                        ),
                                      )
                                      .toList(),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  _CostBubble(
                    rows: selectedRows,
                    credits: data.credits,
                    total: totalCost,
                    onReset: () => setState(_selected.clear),
                    onContinue:
                        selectedRows.isNotEmpty && totalCost <= data.credits
                        ? () => _openGenerator(data, selectedRows.first.tool)
                        : null,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openGenerator(
    AssistantBootstrap data,
    AssistantTool tool,
  ) async {
    final generated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.white,
      builder: (_) => _GeneratorSheet(
        tool: tool,
        credits: data.credits,
        defaults: data.profileDefaults,
        dynamicOptions: data.dynamicOptions,
      ),
    );
    if (generated == true) {
      ref.invalidate(assistantBootstrapProvider);
      setState(() {
        _selected.remove(tool.slug);
        _phase = _AssistantPhase.recommendations;
      });
      _followConversation(animated: true);
    }
  }
}

class _AssistantHeader extends StatelessWidget {
  const _AssistantHeader({required this.credits});
  final int credits;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
    decoration: const BoxDecoration(
      gradient: LinearGradient(colors: [Color(0xFF0B5CFF), Color(0xFF1286E8)]),
    ),
    child: Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .18),
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: Colors.white24),
          ),
          child: const Icon(
            Icons.auto_awesome_rounded,
            color: Colors.white,
            size: 19,
          ),
        ),
        const SizedBox(width: 10),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'AI Assistant',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                'Bot workflow bertombol, tanpa prompt bebas',
                style: TextStyle(color: Colors.white70, fontSize: 10.5),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .14),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white24),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.monetization_on_rounded,
                color: Color(0xFFFDE68A),
                size: 16,
              ),
              const SizedBox(width: 5),
              Text(
                '$credits kredit',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _AssistantTypewriterText extends StatefulWidget {
  const _AssistantTypewriterText({
    super.key,
    required this.text,
    required this.style,
    this.characterDelay = const Duration(milliseconds: 24),
    this.onProgress,
    this.onComplete,
  });

  final String text;
  final TextStyle style;
  final Duration characterDelay;
  final VoidCallback? onProgress;
  final VoidCallback? onComplete;

  @override
  State<_AssistantTypewriterText> createState() =>
      _AssistantTypewriterTextState();
}

class _AssistantTypewriterTextState extends State<_AssistantTypewriterText> {
  Timer? _timer;
  int _visibleCharacters = 0;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void didUpdateWidget(covariant _AssistantTypewriterText oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.text != widget.text) _start();
  }

  void _start() {
    _timer?.cancel();
    _visibleCharacters = 0;
    if (widget.text.isEmpty) {
      widget.onComplete?.call();
      return;
    }
    _timer = Timer.periodic(widget.characterDelay, (timer) {
      if (!mounted) return;
      setState(() {
        _visibleCharacters = (_visibleCharacters + 1).clamp(
          0,
          widget.text.length,
        );
      });
      if (_visibleCharacters % 4 == 0 ||
          _visibleCharacters == widget.text.length) {
        widget.onProgress?.call();
      }
      if (_visibleCharacters >= widget.text.length) {
        timer.cancel();
        widget.onComplete?.call();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final complete = _visibleCharacters >= widget.text.length;
    return Text.rich(
      TextSpan(
        text: widget.text.substring(0, _visibleCharacters),
        children: [
          if (!complete)
            const WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: _TypingCursor(),
            ),
        ],
      ),
      style: widget.style,
    );
  }
}

class _TypingCursor extends StatefulWidget {
  const _TypingCursor();

  @override
  State<_TypingCursor> createState() => _TypingCursorState();
}

class _TypingCursorState extends State<_TypingCursor>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 680),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: _controller,
    child: Container(
      width: 2,
      height: 15,
      margin: const EdgeInsets.only(left: 3),
      decoration: BoxDecoration(
        color: AppColors.blue,
        borderRadius: BorderRadius.circular(2),
      ),
    ),
  );
}

class _TypingPreparation extends StatefulWidget {
  const _TypingPreparation({super.key});

  @override
  State<_TypingPreparation> createState() => _TypingPreparationState();
}

class _TypingPreparationState extends State<_TypingPreparation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: Row(
      children: [
        ...List.generate(
          3,
          (index) => AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              final phase = (_controller.value * 3 - index).clamp(0.0, 1.0);
              final lift = 1 - (phase * 2 - 1).abs();
              return Transform.translate(
                offset: Offset(0, -3 * lift),
                child: child,
              );
            },
            child: Container(
              width: 6,
              height: 6,
              margin: const EdgeInsets.only(right: 4),
              decoration: const BoxDecoration(
                color: AppColors.blue,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
        const SizedBox(width: 3),
        const Text(
          'menyiapkan pilihan...',
          style: TextStyle(
            color: AppColors.muted,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _AssistantBubble extends StatelessWidget {
  const _AssistantBubble({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: 32,
        height: 32,
        decoration: const BoxDecoration(
          color: AppColors.blue,
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.auto_awesome_rounded,
          color: Colors.white,
          size: 15,
        ),
      ),
      const SizedBox(width: 9),
      Expanded(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: const BorderRadius.only(
              topRight: Radius.circular(18),
              bottomLeft: Radius.circular(18),
              bottomRight: Radius.circular(18),
              topLeft: Radius.circular(4),
            ),
            border: Border.all(color: const Color(0xFFDBEAFE)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D0F172A),
                blurRadius: 8,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: child,
        ),
      ),
    ],
  );
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.title, required this.description});
  final String title;
  final String description;
  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerRight,
    child: Container(
      constraints: const BoxConstraints(maxWidth: 310),
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: AppColors.blue,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(18),
          bottomLeft: Radius.circular(18),
          bottomRight: Radius.circular(18),
          topRight: Radius.circular(4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            description,
            style: const TextStyle(
              color: Color(0xFFDBEAFE),
              fontSize: 11,
              height: 1.4,
            ),
          ),
        ],
      ),
    ),
  );
}

class _WorkflowButton extends StatelessWidget {
  const _WorkflowButton({
    required this.workflow,
    required this.active,
    required this.index,
    required this.onTap,
  });
  final AssistantWorkflow workflow;
  final bool active;
  final int index;
  final VoidCallback onTap;
  static const tones = [
    Color(0xFFEFF6FF),
    Color(0xFFECFDF5),
    Color(0xFFF5F3FF),
    Color(0xFFFFFBEB),
    Color(0xFFFFF1F2),
    Color(0xFFECFEFF),
  ];
  @override
  Widget build(BuildContext context) => Material(
    color: active ? AppColors.blue : tones[index % tones.length],
    borderRadius: BorderRadius.circular(17),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(17),
      child: Container(
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          border: Border.all(
            color: active ? const Color(0xFF93C5FD) : const Color(0xFFDBEAFE),
          ),
          borderRadius: BorderRadius.circular(17),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    workflow.title,
                    maxLines: 2,
                    style: TextStyle(
                      color: active ? Colors.white : AppColors.navy,
                      fontSize: 12,
                      height: 1.2,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                Icon(
                  Icons.arrow_forward_rounded,
                  size: 16,
                  color: active ? Colors.white : AppColors.blue,
                ),
              ],
            ),
            const Spacer(),
            Text(
              workflow.description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: active ? const Color(0xFFDBEAFE) : AppColors.muted,
                fontSize: 10.5,
                height: 1.35,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ThinkingRow extends StatelessWidget {
  const _ThinkingRow({
    required this.label,
    required this.done,
    required this.active,
  });
  final String label;
  final bool done;
  final bool active;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 6),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
    decoration: BoxDecoration(
      color: done
          ? const Color(0xFFECFDF5)
          : active
          ? AppColors.blueSoft
          : const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(
        color: done
            ? const Color(0xFFD1FAE5)
            : active
            ? const Color(0xFFBFDBFE)
            : AppColors.border,
      ),
    ),
    child: Row(
      children: [
        Icon(
          done
              ? Icons.check_rounded
              : active
              ? Icons.sync_rounded
              : Icons.circle_outlined,
          size: 16,
          color: done
              ? AppColors.success
              : active
              ? AppColors.blue
              : AppColors.muted,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    ),
  );
}

class _AssistantStat extends StatelessWidget {
  const _AssistantStat({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(9),
    decoration: BoxDecoration(
      color: const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          maxLines: 1,
          style: const TextStyle(
            color: AppColors.muted,
            fontSize: 9.5,
            fontWeight: FontWeight.w700,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    ),
  );
}

class _RecommendationTile extends StatelessWidget {
  const _RecommendationTile({
    required this.item,
    required this.priority,
    required this.selected,
    required this.onTap,
  });
  final AssistantWorkflowItem item;
  final bool priority;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 7),
    child: Material(
      color: selected ? AppColors.blueSoft : Colors.white,
      borderRadius: BorderRadius.circular(17),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(17),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            border: Border.all(
              color: selected ? const Color(0xFF93C5FD) : AppColors.border,
            ),
            borderRadius: BorderRadius.circular(17),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 21,
                height: 21,
                decoration: BoxDecoration(
                  color: selected ? AppColors.blue : Colors.white,
                  borderRadius: BorderRadius.circular(7),
                  border: Border.all(
                    color: selected ? AppColors.blue : const Color(0xFFCBD5E1),
                  ),
                ),
                child: selected
                    ? const Icon(
                        Icons.check_rounded,
                        color: Colors.white,
                        size: 14,
                      )
                    : null,
              ),
              const SizedBox(width: 9),
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.blueSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.description_outlined,
                  color: AppColors.blue,
                  size: 18,
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 5,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          item.tool.name,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        if (priority)
                          const _MiniBadge(
                            label: 'Prioritas',
                            color: AppColors.blue,
                          ),
                        _MiniBadge(
                          label: '${item.tool.creditCost} kredit',
                          color: AppColors.warning,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.note,
                      style: const TextStyle(
                        fontSize: 10.5,
                        height: 1.4,
                        color: AppColors.muted,
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

class _MiniBadge extends StatelessWidget {
  const _MiniBadge({required this.label, required this.color});
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text(
      label,
      style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w900),
    ),
  );
}

class _CostBubble extends StatelessWidget {
  const _CostBubble({
    required this.rows,
    required this.credits,
    required this.total,
    required this.onReset,
    required this.onContinue,
  });
  final List<AssistantWorkflowItem> rows;
  final int credits;
  final int total;
  final VoidCallback onReset;
  final VoidCallback? onContinue;
  @override
  Widget build(BuildContext context) => _AssistantBubble(
    child: rows.isEmpty
        ? const Text(
            'Pilih minimal satu rekomendasi. Setelah itu saya tampilkan total biaya dan tombol lanjut ke generator.',
            style: TextStyle(fontSize: 12, height: 1.5),
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Berikut estimasi biaya sebelum generator dijalankan.',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 9),
              ...rows.asMap().entries.map(
                (entry) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${entry.key + 1}. ${entry.value.tool.name}',
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text(
                        '${entry.value.tool.creditCost} kredit',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Container(
                margin: const EdgeInsets.symmetric(vertical: 7),
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: AppColors.blueSoft,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFDBEAFE)),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Total biaya',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Text(
                          '$total kredit',
                          style: const TextStyle(
                            color: AppColors.blue,
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Sisa setelah generate',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.muted,
                            ),
                          ),
                        ),
                        Text(
                          total <= credits
                              ? '${credits - total} kredit'
                              : 'Kredit tidak cukup',
                          style: TextStyle(
                            color: total <= credits
                                ? AppColors.success
                                : AppColors.danger,
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: onContinue,
                  icon: const Icon(Icons.arrow_forward_rounded),
                  label: const Text('Lanjutkan ke Generator'),
                ),
              ),
              TextButton(onPressed: onReset, child: const Text('Ubah pilihan')),
              const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.lock_outline_rounded,
                    size: 14,
                    color: AppColors.muted,
                  ),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Kredit belum dipotong di Assistant. Kredit dipotong setelah tombol Generate ditekan.',
                      style: TextStyle(
                        fontSize: 10,
                        height: 1.4,
                        color: AppColors.muted,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
  );
}

class _LockedAssistant extends StatelessWidget {
  const _LockedAssistant({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: AppColors.blue,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.auto_awesome_rounded, color: Colors.white),
          ),
          const SizedBox(height: 14),
          const Text(
            'AI Assistant belum aktif di paket Anda',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 7),
          const Text(
            'Upgrade paket untuk memakai workflow assistant dan generator dokumen.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}

class _GeneratorSheet extends ConsumerStatefulWidget {
  const _GeneratorSheet({
    required this.tool,
    required this.credits,
    required this.defaults,
    required this.dynamicOptions,
  });
  final AssistantTool tool;
  final int credits;
  final Map<String, String> defaults;
  final Map<String, Map<String, List<AssistantOption>>> dynamicOptions;
  @override
  ConsumerState<_GeneratorSheet> createState() => _GeneratorSheetState();
}

class _GeneratorSheetState extends ConsumerState<_GeneratorSheet> {
  late final Map<String, String> _values = {...widget.defaults};
  int _step = 0;
  bool _generating = false;
  String? _exporting;
  String? _error;
  Map<String, dynamic>? _result;

  AssistantFormStep get current => widget.tool.steps[_step];
  bool get valid => current.fields
      .where((field) => field.required)
      .every((field) => (_values[field.name] ?? '').trim().isNotEmpty);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.tool.name),
        actions: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close_rounded),
          ),
        ],
      ),
      body: _result == null ? _buildForm() : _buildResult(),
    );
  }

  Widget _buildForm() => Column(
    children: [
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
        child: Row(
          children: List.generate(
            widget.tool.steps.length,
            (index) => Padding(
              padding: const EdgeInsets.only(right: 7),
              child: ChoiceChip(
                label: Text('${index + 1}. ${widget.tool.steps[index].label}'),
                selected: index == _step,
                onSelected: (_) => setState(() => _step = index),
              ),
            ),
          ),
        ),
      ),
      Expanded(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(current.label, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            const Text('Lengkapi data yang dibutuhkan sebelum generate.'),
            const SizedBox(height: 17),
            ...current.fields.map(_buildField),
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Text(
                  _error!,
                  style: const TextStyle(color: AppColors.danger),
                ),
              ),
            const SizedBox(height: 15),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Biaya',
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ),
                      Text(
                        '${widget.tool.creditCost} kredit',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                  const SizedBox(height: 7),
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Kredit tersedia',
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ),
                      Text(
                        '${widget.credits} kredit',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _step == 0 || _generating
                      ? null
                      : () => setState(() => _step--),
                  child: const Text('Kembali'),
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: FilledButton(
                  onPressed: !valid || _generating
                      ? null
                      : (_step == widget.tool.steps.length - 1
                            ? _generate
                            : () => setState(() => _step++)),
                  child: _generating
                      ? const SizedBox(
                          width: 19,
                          height: 19,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          _step == widget.tool.steps.length - 1
                              ? 'Generate (${widget.tool.creditCost})'
                              : 'Lanjut',
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );

  Widget _buildField(AssistantFormField field) {
    final options = _optionsFor(field);
    Widget input;
    if (field.type == 'select') {
      final value = _values[field.name];
      input = DropdownButtonFormField<String>(
        initialValue: options.any((option) => option.value == value)
            ? value
            : null,
        isExpanded: true,
        hint: const Text('Pilih...'),
        items: options
            .map(
              (option) => DropdownMenuItem(
                value: option.value,
                child: Text(option.label, overflow: TextOverflow.ellipsis),
              ),
            )
            .toList(),
        onChanged: (value) => _setValue(field, value ?? ''),
      );
    } else if (field.type == 'checkbox') {
      final selected = (_values[field.name] ?? '')
          .split('|')
          .where((item) => item.isNotEmpty)
          .toSet();
      input = Wrap(
        spacing: 7,
        runSpacing: 7,
        children: options
            .map(
              (option) => FilterChip(
                label: Text(option.label),
                selected: selected.contains(option.value),
                onSelected: (active) {
                  active
                      ? selected.add(option.value)
                      : selected.remove(option.value);
                  _setValue(field, selected.join('|'));
                },
              ),
            )
            .toList(),
      );
    } else {
      input = TextFormField(
        initialValue: _values[field.name],
        minLines: field.type == 'textarea' ? 4 : 1,
        maxLines: field.type == 'textarea' ? 7 : 1,
        keyboardType: field.type == 'number'
            ? TextInputType.number
            : TextInputType.text,
        decoration: InputDecoration(hintText: field.placeholder),
        onChanged: (value) => _setValue(field, value),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text.rich(
            TextSpan(
              text: field.label,
              children: [
                if (field.required)
                  const TextSpan(
                    text: ' *',
                    style: TextStyle(color: AppColors.danger),
                  ),
              ],
            ),
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 7),
          input,
        ],
      ),
    );
  }

  void _setValue(AssistantFormField field, String value) {
    setState(() {
      _values[field.name] = value;
      for (final step in widget.tool.steps) {
        for (final child in step.fields) {
          if (child.dependsOn == field.name) _values.remove(child.name);
        }
      }
    });
  }

  List<AssistantOption> _optionsFor(AssistantFormField field) {
    if (field.options.isNotEmpty) return field.options;
    final source = field.optionsSource;
    if (source == null) return const [];
    final groups = widget.dynamicOptions[source];
    if (groups == null) return const [];
    return groups[_values['jenjang']] ?? groups['default'] ?? const [];
  }

  Future<void> _generate() async {
    setState(() {
      _generating = true;
      _error = null;
    });
    try {
      final json = await ref
          .read(apiClientProvider)
          .postJson(
            '/api/generate',
            data: {'toolSlug': widget.tool.slug, 'data': _values},
            receiveTimeout: const Duration(minutes: 3),
          );
      final document = Map<String, dynamic>.from(
        json['document'] as Map? ?? {},
      );
      if (document['id'] == null || document['content'] == null) {
        throw Exception('Respons generator tidak lengkap.');
      }
      if (mounted) {
        setState(
          () => _result = {
            ...document,
            'isDemo': json['isDemo'] == true,
            'creditsRemaining': json['creditsRemaining'],
          },
        );
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Widget _buildResult() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFA7F3D0)),
        ),
        child: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: AppColors.success),
            SizedBox(width: 9),
            Expanded(
              child: Text(
                'Dokumen berhasil dibuat',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ],
        ),
      ),
      if (_result?['isDemo'] == true) ...[
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFBEB),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFFCD34D)),
          ),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.warning_amber_rounded,
                color: AppColors.warning,
                size: 20,
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Hasil ini menggunakan mode demo karena provider AI belum aktif.',
                  style: TextStyle(fontSize: 11.5, height: 1.4),
                ),
              ),
            ],
          ),
        ),
      ],
      const SizedBox(height: 14),
      Text(
        _result?['title']?.toString() ?? widget.tool.name,
        style: Theme.of(context).textTheme.headlineMedium,
      ),
      const SizedBox(height: 14),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: SelectableText(
            _result?['content']?.toString() ?? '',
            style: const TextStyle(height: 1.55),
          ),
        ),
      ),
      const SizedBox(height: 14),
      Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _exporting == null ? () => _export('pdf') : null,
              icon: _exporting == 'pdf'
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.picture_as_pdf_outlined, size: 18),
              label: const Text('PDF'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _exporting == null ? () => _export('docx') : null,
              icon: _exporting == 'docx'
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.description_outlined, size: 18),
              label: const Text('DOCX'),
            ),
          ),
        ],
      ),
      if (_error != null) ...[
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(11),
          decoration: BoxDecoration(
            color: const Color(0xFFFEF2F2),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFECACA)),
          ),
          child: Text(
            _error!,
            style: const TextStyle(color: AppColors.danger, fontSize: 11.5),
          ),
        ),
      ],
      const SizedBox(height: 8),
      FilledButton.icon(
        onPressed: () => Navigator.pop(context, true),
        icon: const Icon(Icons.check_rounded),
        label: const Text('Selesai & Lanjutkan Rekomendasi'),
      ),
    ],
  );

  Future<void> _export(String format) async {
    final id = _result?['id']?.toString() ?? '';
    if (id.isEmpty) return;
    setState(() {
      _exporting = format;
      _error = null;
    });
    try {
      final response = await ref
          .read(apiClientProvider)
          .dio
          .get<List<int>>(
            '/api/documents/$id/export',
            queryParameters: {'format': format},
            options: Options(responseType: ResponseType.bytes),
          );
      final bytes = response.data;
      if (bytes == null || bytes.isEmpty) {
        throw Exception('File hasil ekspor kosong.');
      }
      final directory =
          await getDownloadsDirectory() ??
          await getApplicationDocumentsDirectory();
      final rawTitle = _result?['title']?.toString() ?? 'dokumen-guruspace';
      final safeTitle = rawTitle
          .replaceAll(RegExp(r'[^\w\s-]'), '')
          .trim()
          .replaceAll(RegExp(r'\s+'), '-');
      final file = File(
        '${directory.path}${Platform.pathSeparator}'
        '${safeTitle.isEmpty ? 'dokumen-guruspace' : safeTitle}.$format',
      );
      await file.writeAsBytes(bytes, flush: true);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('File tersimpan: ${file.path}')));
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = null);
    }
  }
}
