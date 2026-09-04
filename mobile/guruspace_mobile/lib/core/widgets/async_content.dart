import 'package:flutter/material.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';

class LoadingView extends StatefulWidget {
  const LoadingView({super.key, this.label = 'Memuat data...'});
  final String label;

  @override
  State<LoadingView> createState() => _LoadingViewState();
}

class _LoadingViewState extends State<LoadingView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Padding(
        padding: const EdgeInsets.all(AppSpacing.page),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _SkeletonBlock(
              height: 138,
              opacity: .45 + (_controller.value * .35),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _SkeletonBlock(
                    height: 82,
                    opacity: .35 + (_controller.value * .3),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _SkeletonBlock(
                    height: 82,
                    opacity: .35 + (_controller.value * .3),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(widget.label, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.height, required this.opacity});
  final double height;
  final double opacity;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    height: height,
    decoration: BoxDecoration(
      color: AppColors.blueSoft.withValues(alpha: opacity),
      borderRadius: BorderRadius.circular(AppRadii.large),
      border: Border.all(color: AppColors.border),
    ),
  );
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.section),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(26),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 62,
                  height: 62,
                  decoration: const BoxDecoration(
                    color: AppColors.blueSoft,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.cloud_off_rounded,
                    size: 30,
                    color: AppColors.blue,
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  'Data belum dapat dimuat',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Coba Lagi'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
