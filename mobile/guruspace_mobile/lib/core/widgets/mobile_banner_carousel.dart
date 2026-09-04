import 'dart:async';

import 'package:flutter/material.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/features/dashboard/domain/app_display_models.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

class MobileBannerCarousel extends StatefulWidget {
  const MobileBannerCarousel({super.key, required this.display});
  final MobileBannerDisplay display;

  @override
  State<MobileBannerCarousel> createState() => _MobileBannerCarouselState();
}

class _MobileBannerCarouselState extends State<MobileBannerCarousel> {
  late final PageController _controller;
  Timer? _timer;
  static const int _virtualPageBase = 10000;
  late int _page;

  @override
  void initState() {
    super.initState();
    _page = _initialPageFor(widget.display.slides.length);
    _controller = PageController(viewportFraction: .84, initialPage: _page);
    _startTimer();
  }

  @override
  void didUpdateWidget(covariant MobileBannerCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.display.autoPlayMs != widget.display.autoPlayMs ||
        oldWidget.display.slides.length != widget.display.slides.length) {
      _page = _initialPageFor(widget.display.slides.length);
      if (_controller.hasClients) _controller.jumpToPage(_page);
      _startTimer();
    }
  }

  void _startTimer() {
    _timer?.cancel();
    if (widget.display.slides.length < 2) return;
    _timer = Timer.periodic(
      Duration(milliseconds: widget.display.autoPlayMs.clamp(2500, 20000)),
      (_) {
        if (!_controller.hasClients) return;
        final next = _page + 1;
        _controller.animateToPage(
          next,
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeOutCubic,
        );
      },
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.display.slides.isEmpty) return const SizedBox.shrink();
    final multi = widget.display.slides.length > 1;
    final activeIndex = _page % widget.display.slides.length;
    return Column(
      children: [
        LayoutBuilder(
          builder: (context, constraints) => SizedBox(
            height: constraints.maxWidth * .84 / 2,
            child: PageView.builder(
              controller: _controller,
              itemCount: multi ? null : 1,
              onPageChanged: (value) => setState(() => _page = value),
              itemBuilder: (context, pageIndex) {
                final slide = widget
                    .display
                    .slides[pageIndex % widget.display.slides.length];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: GestureDetector(
                    onTap: () => _openLink(slide.linkUrl),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFE8F6EA)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x120F4C81),
                            blurRadius: 10,
                            offset: Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(17),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            _SlideMedia(slide: slide),
                            if (slide.title?.trim().isNotEmpty == true)
                              Positioned(
                                left: 0,
                                right: 0,
                                bottom: 0,
                                child: Container(
                                  padding: const EdgeInsets.fromLTRB(
                                    12,
                                    28,
                                    12,
                                    10,
                                  ),
                                  decoration: const BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        Colors.transparent,
                                        Color(0x99000000),
                                      ],
                                    ),
                                  ),
                                  child: Text(
                                    slide.title!,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
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
              },
            ),
          ),
        ),
        if (widget.display.slides.length > 1) ...[
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              widget.display.slides.length,
              (i) => Semantics(
                button: true,
                label: 'Banner ${i + 1}${i == activeIndex ? ', aktif' : ''}',
                child: GestureDetector(
                  onTap: () {
                    final target = _page - activeIndex + i;
                    _controller.animateToPage(
                      target,
                      duration: const Duration(milliseconds: 500),
                      curve: Curves.easeOutCubic,
                    );
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    width: i == activeIndex ? 20 : 6,
                    height: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: i == activeIndex
                          ? AppColors.blue
                          : const Color(0xFFA7D4B0),
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  String _absoluteUrl(String value) {
    final uri = Uri.tryParse(value);
    if (uri?.hasScheme == true) return value;
    return Uri.parse(AppConfig.baseUrl).resolve(value).toString();
  }

  Future<void> _openLink(String? value) async {
    final raw = value?.trim() ?? '';
    if (raw.isEmpty) return;
    final uri = safeExternalUri(_absoluteUrl(raw));
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  int _initialPageFor(int slideCount) {
    if (slideCount < 2) return 0;
    return _virtualPageBase - (_virtualPageBase % slideCount);
  }
}

class _SlideMedia extends StatefulWidget {
  const _SlideMedia({required this.slide});
  final AppBannerSlide slide;

  @override
  State<_SlideMedia> createState() => _SlideMediaState();
}

class _SlideMediaState extends State<_SlideMedia> {
  VideoPlayerController? _video;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_initializeVideo());
  }

  @override
  void didUpdateWidget(covariant _SlideMedia oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.slide.mediaUrl != widget.slide.mediaUrl ||
        oldWidget.slide.type != widget.slide.type) {
      unawaited(_replaceVideo());
    }
  }

  Future<void> _replaceVideo() async {
    _generation++;
    final previous = _video;
    _video = null;
    await previous?.dispose();
    if (mounted) await _initializeVideo();
  }

  Future<void> _initializeVideo() async {
    if (widget.slide.type != 'video') return;
    final generation = ++_generation;
    final controller = VideoPlayerController.networkUrl(
      Uri.parse(_absoluteUrl(widget.slide.mediaUrl)),
    );
    _video = controller;
    try {
      await controller.initialize();
      await controller.setLooping(true);
      await controller.setVolume(0);
      await controller.play();
      if (!mounted || generation != _generation || _video != controller) {
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
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.slide.type == 'video') {
      final controller = _video;
      if (controller?.value.isInitialized == true) {
        return FittedBox(
          fit: BoxFit.cover,
          clipBehavior: Clip.hardEdge,
          child: SizedBox(
            width: controller!.value.size.width,
            height: controller.value.size.height,
            child: VideoPlayer(controller),
          ),
        );
      }
      return Container(
        color: AppColors.blueSoft,
        alignment: Alignment.center,
        child: const CircularProgressIndicator(strokeWidth: 2),
      );
    }
    if (widget.slide.mediaUrl.startsWith('assets/')) {
      return Image.asset(widget.slide.mediaUrl, fit: BoxFit.cover);
    }
    return Image.network(
      _absoluteUrl(widget.slide.mediaUrl),
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => Container(
        color: AppColors.blueSoft,
        alignment: Alignment.center,
        child: const Icon(
          Icons.image_not_supported_outlined,
          color: AppColors.muted,
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
