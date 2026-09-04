import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Holds the completed GenPro mark while auth is still resolving.
class GenProSplashHold extends StatelessWidget {
  const GenProSplashHold({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      key: Key('genpro-splash-hold'),
      backgroundColor: Colors.white,
      body: Center(child: _SplashStage(progress: 1)),
    );
  }
}

/// Premium GenPro splash: G → full GenPro wordmark → accents → Login/Home.
class GenProSplashScreen extends StatefulWidget {
  const GenProSplashScreen({super.key, this.onFinished});

  static const duration = Duration(milliseconds: 3600);
  static const exitDuration = Duration(milliseconds: 280);

  static const gAsset = 'assets/branding/genpro_g_raw.png';
  static const wordmarkAsset = 'assets/branding/genpro_wordmark.png';
  static const raysAsset = 'assets/branding/genpro_rays.png';
  static const smileAsset = 'assets/branding/genpro_smile.png';

  /// Logo canvas aspect from regenerated branding assets (1024×433).
  static const logoAspect = 433 / 1024;

  /// G center X inside the logo canvas (measured).
  static const gCenterX = 137.5 / 1024;

  /// Horizontal clip covering G before enPro opens.
  static const gClipEnd = 0.26;

  final VoidCallback? onFinished;

  @override
  State<GenProSplashScreen> createState() => _GenProSplashScreenState();
}

class _GenProSplashScreenState extends State<GenProSplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _controller;
  late final AnimationController _exitController;
  bool _notified = false;
  bool _assetsReady = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: GenProSplashScreen.duration,
    );
    _exitController = AnimationController(
      vsync: this,
      duration: GenProSplashScreen.exitDuration,
    );
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) _beginExit();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _prepare());
  }

  Future<void> _prepare() async {
    if (!mounted) return;
    await Future.wait([
      precacheImage(const AssetImage(GenProSplashScreen.gAsset), context),
      precacheImage(const AssetImage(GenProSplashScreen.wordmarkAsset), context),
      precacheImage(const AssetImage(GenProSplashScreen.raysAsset), context),
      precacheImage(const AssetImage(GenProSplashScreen.smileAsset), context),
    ]);
    if (!mounted) return;
    setState(() => _assetsReady = true);
    await _controller.forward();
  }

  Future<void> _beginExit() async {
    if (_notified) return;
    await _exitController.forward();
    if (!mounted || _notified) return;
    _notified = true;
    widget.onFinished?.call();
  }

  @override
  void dispose() {
    _controller.dispose();
    _exitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('genpro-splash'),
      backgroundColor: Colors.white,
      body: AnimatedBuilder(
        animation: Listenable.merge([_controller, _exitController]),
        builder: (context, _) {
          return Opacity(
            opacity: (1 - _exitController.value).clamp(0.0, 1.0),
            child: Center(
              child: _SplashStage(
                progress: _assetsReady ? _controller.value : 0,
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SplashStage extends StatelessWidget {
  const _SplashStage({required this.progress});

  final double progress;

  static double _seg(
    double t,
    double begin,
    double end, [
    Curve curve = Curves.easeInOutCubic,
  ]) {
    if (t <= begin) return 0;
    if (t >= end) return 1;
    return curve.transform((t - begin) / (end - begin));
  }

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context);
    final logoWidth = math.min(screen.width * 0.78, 360.0);
    final logoHeight = logoWidth * GenProSplashScreen.logoAspect;

    // Timeline (3600ms)
    // G settle → hold → GenPro opens left→right (full letter height) →
    // rays → smile → settle
    final gIn = _seg(progress, 0.00, 0.14, Curves.easeOutCubic);
    final reveal = _seg(progress, 0.26, 0.58, Curves.easeInOutCubic);
    final ray1 = _seg(progress, 0.58, 0.65, Curves.easeOutCubic);
    final ray2 = _seg(progress, 0.63, 0.70, Curves.easeOutCubic);
    final ray3 = _seg(progress, 0.68, 0.76, Curves.easeOutCubic);
    final smile = _seg(progress, 0.72, 0.90, Curves.easeInOutCubic);
    final finish = _seg(progress, 0.90, 1.00, Curves.easeInOut);

    final gOpacity = gIn * (1 - _seg(progress, 0.32, 0.46, Curves.easeIn));
    final gScale = 0.93 + 0.07 * gIn;
    final showSoloG = gOpacity > 0.02;

    final composedOpacity = _seg(progress, 0.24, 0.36, Curves.easeOut);
    final clipEnd = GenProSplashScreen.gClipEnd +
        (1 - GenProSplashScreen.gClipEnd) * reveal;
    final gFocusShift =
        (0.5 - GenProSplashScreen.gCenterX) * logoWidth * (1 - reveal);

    final bounce = finish <= 0
        ? 1.0
        : 1 + 0.014 * math.sin(math.pi * finish.clamp(0.0, 1.0));

    final rayStrength =
        (ray1 * 0.34 + ray2 * 0.33 + ray3 * 0.33).clamp(0.0, 1.0);
    final rayScale = 0.90 + 0.10 * math.max(ray1, math.max(ray2, ray3));

    return SizedBox(
      width: logoWidth,
      height: math.max(logoHeight * 1.45, logoHeight + 48),
      child: Transform.scale(
        scale: bounce,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Opacity(
              opacity: composedOpacity,
              child: Transform.translate(
                offset: Offset(gFocusShift, 0),
                child: SizedBox(
                  width: logoWidth,
                  height: logoHeight,
                  child: ClipRect(
                    // Left → right only. Full vertical letterforms always visible.
                    clipper: _HorizontalRevealClipper(clipEnd),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.asset(
                          GenProSplashScreen.wordmarkAsset,
                          fit: BoxFit.contain,
                          alignment: Alignment.center,
                          filterQuality: FilterQuality.high,
                          gaplessPlayback: true,
                        ),
                        Opacity(
                          opacity: rayStrength,
                          child: Transform.scale(
                            scale: rayScale,
                            alignment: const Alignment(-0.74, -0.92),
                            child: Image.asset(
                              GenProSplashScreen.raysAsset,
                              fit: BoxFit.contain,
                              alignment: Alignment.center,
                              filterQuality: FilterQuality.high,
                              gaplessPlayback: true,
                            ),
                          ),
                        ),
                        ClipRect(
                          clipper: _HorizontalRevealClipper(smile),
                          child: Image.asset(
                            GenProSplashScreen.smileAsset,
                            fit: BoxFit.contain,
                            alignment: Alignment.center,
                            filterQuality: FilterQuality.high,
                            gaplessPlayback: true,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            if (showSoloG)
              Opacity(
                opacity: gOpacity.clamp(0.0, 1.0),
                child: Transform.scale(
                  scale: gScale,
                  child: Image.asset(
                    GenProSplashScreen.gAsset,
                    height: logoHeight * 0.62,
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.high,
                    gaplessPlayback: true,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _HorizontalRevealClipper extends CustomClipper<Rect> {
  _HorizontalRevealClipper(this.progress);

  final double progress;

  @override
  Rect getClip(Size size) => Rect.fromLTWH(
        0,
        0,
        size.width * progress.clamp(0.0, 1.0),
        size.height,
      );

  @override
  bool shouldReclip(covariant _HorizontalRevealClipper oldClipper) =>
      oldClipper.progress != progress;
}
