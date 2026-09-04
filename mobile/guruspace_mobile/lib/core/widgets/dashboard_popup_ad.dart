import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/features/dashboard/domain/app_display_models.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

class DashboardPopupAdHost extends ConsumerStatefulWidget {
  const DashboardPopupAdHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<DashboardPopupAdHost> createState() =>
      _DashboardPopupAdHostState();
}

class _DashboardPopupAdHostState extends ConsumerState<DashboardPopupAdHost> {
  String? _dismissedCampaign;

  @override
  Widget build(BuildContext context) {
    final popup = ref.watch(mobilePopupProvider).valueOrNull;
    final showPopup =
        popup != null &&
        popup.enabled &&
        popup.slides.isNotEmpty &&
        popup.campaignSignature != _dismissedCampaign;

    return Stack(
      children: [
        widget.child,
        if (showPopup)
          Positioned.fill(
            child: _PopupOverlay(
              display: popup,
              onDismiss: () =>
                  setState(() => _dismissedCampaign = popup.campaignSignature),
            ),
          ),
      ],
    );
  }
}

class _PopupOverlay extends StatefulWidget {
  const _PopupOverlay({required this.display, required this.onDismiss});

  final MobilePopupDisplay display;
  final VoidCallback onDismiss;

  @override
  State<_PopupOverlay> createState() => _PopupOverlayState();
}

class _PopupOverlayState extends State<_PopupOverlay> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final slide = widget.display.slides[_index];
    final size = MediaQuery.sizeOf(context);
    return Material(
      color: Colors.black.withValues(alpha: .75),
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: size.width * .94,
                maxHeight: size.height * .86,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(22),
                child: ColoredBox(
                  color: const Color(0xFF020617),
                  child: Stack(
                    children: [
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Flexible(
                            child: GestureDetector(
                              onTap: () => _openLink(slide.linkUrl),
                              child: _PopupMedia(
                                key: ValueKey(slide.id),
                                slide: slide,
                              ),
                            ),
                          ),
                          if (slide.title?.trim().isNotEmpty == true ||
                              widget.display.slides.length > 1)
                            Container(
                              padding: const EdgeInsets.fromLTRB(
                                16,
                                12,
                                12,
                                12,
                              ),
                              decoration: const BoxDecoration(
                                color: Color(0xFF020617),
                                border: Border(
                                  top: BorderSide(color: Color(0x1AFFFFFF)),
                                ),
                              ),
                              child: Row(
                                children: [
                                  if (slide.title?.trim().isNotEmpty == true)
                                    Expanded(
                                      child: Text(
                                        slide.title!,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    )
                                  else
                                    const Spacer(),
                                  if (widget.display.slides.length > 1) ...[
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: List.generate(
                                        widget.display.slides.length,
                                        (index) => GestureDetector(
                                          onTap: () =>
                                              setState(() => _index = index),
                                          child: AnimatedContainer(
                                            duration: const Duration(
                                              milliseconds: 200,
                                            ),
                                            width: index == _index ? 16 : 6,
                                            height: 6,
                                            margin: const EdgeInsets.symmetric(
                                              horizontal: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: index == _index
                                                  ? Colors.white
                                                  : Colors.white38,
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                  ],
                                  FilledButton(
                                    onPressed: widget.onDismiss,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: Colors.white,
                                      foregroundColor: const Color(0xFF0F172A),
                                      minimumSize: const Size(0, 34),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                      ),
                                    ),
                                    child: const Text('Tutup'),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                      Positioned(
                        top: 10,
                        right: 10,
                        child: IconButton(
                          tooltip: 'Tutup popup',
                          onPressed: widget.onDismiss,
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.black.withValues(
                              alpha: .65,
                            ),
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Colors.white30),
                          ),
                          icon: const Icon(Icons.close_rounded),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openLink(String? value) async {
    final raw = value?.trim() ?? '';
    if (raw.isEmpty) return;
    final uri = safeExternalUri(raw);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
    widget.onDismiss();
  }
}

class _PopupMedia extends StatefulWidget {
  const _PopupMedia({super.key, required this.slide});

  final AppBannerSlide slide;

  @override
  State<_PopupMedia> createState() => _PopupMediaState();
}

class _PopupMediaState extends State<_PopupMedia> {
  VideoPlayerController? _controller;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_initialize());
  }

  Future<void> _initialize() async {
    if (widget.slide.type != 'video') return;
    final generation = ++_generation;
    final controller = VideoPlayerController.networkUrl(
      Uri.parse(_absoluteUrl(widget.slide.mediaUrl)),
    );
    _controller = controller;
    try {
      await controller.initialize();
      await controller.setVolume(0);
      await controller.play();
      if (!mounted || generation != _generation || _controller != controller) {
        await controller.dispose();
        return;
      }
      setState(() {});
    } catch (_) {
      if (mounted && generation == _generation) setState(() {});
    }
  }

  @override
  void dispose() {
    _generation++;
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.slide.type == 'video') {
      final controller = _controller;
      if (controller?.value.isInitialized == true) {
        return AspectRatio(
          aspectRatio: controller!.value.aspectRatio,
          child: VideoPlayer(controller),
        );
      }
      return const SizedBox(
        width: 280,
        height: 280,
        child: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }

    return Image.network(
      _absoluteUrl(widget.slide.mediaUrl),
      fit: BoxFit.contain,
      errorBuilder: (_, _, _) => const SizedBox(
        width: 280,
        height: 280,
        child: Center(
          child: Icon(
            Icons.broken_image_outlined,
            color: Colors.white70,
            size: 40,
          ),
        ),
      ),
    );
  }

  String _absoluteUrl(String value) {
    final uri = Uri.tryParse(value);
    if (uri?.hasScheme == true) return value;
    return Uri.parse(AppConfig.baseUrl).resolve(value).toString();
  }
}
