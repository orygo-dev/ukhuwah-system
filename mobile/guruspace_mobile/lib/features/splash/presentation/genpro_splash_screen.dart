import 'package:flutter/material.dart';

const _splashBackground = Color(0xFFFFFFFF);
const _poweredByStyle = TextStyle(
  color: Color(0xFF5E6F5E),
  fontSize: 12,
  height: 1.2,
  letterSpacing: 1.4,
  fontWeight: FontWeight.w500,
);

/// Holds the completed UKHUWAH mark while auth is still resolving.
class GenProSplashHold extends StatelessWidget {
  const GenProSplashHold({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      key: Key('genpro-splash-hold'),
      backgroundColor: _splashBackground,
      body: _SplashLayout(progress: 1, showPoweredBy: true),
    );
  }
}

/// Native-matching UKHUWAH splash: logo fade-in, then Login/Home.
class GenProSplashScreen extends StatefulWidget {
  const GenProSplashScreen({super.key, this.onFinished});

  static const duration = Duration(milliseconds: 1400);
  static const exitDuration = Duration(milliseconds: 280);
  static const logoAsset = 'assets/images/native_splash_logo.png';
  static const poweredBy = "Powered by iBaenk's";

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
    await precacheImage(
      const AssetImage(GenProSplashScreen.logoAsset),
      context,
    );
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
      backgroundColor: _splashBackground,
      body: AnimatedBuilder(
        animation: Listenable.merge([_controller, _exitController]),
        builder: (context, _) {
          return Opacity(
            opacity: (1 - _exitController.value).clamp(0.0, 1.0),
            child: _SplashLayout(
              progress: _assetsReady ? _controller.value : 0,
              showPoweredBy: true,
            ),
          );
        },
      ),
    );
  }
}

class _SplashLayout extends StatelessWidget {
  const _SplashLayout({required this.progress, required this.showPoweredBy});

  final double progress;
  final bool showPoweredBy;

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context);
    final size = (screen.shortestSide * 0.72).clamp(240.0, 360.0);
    final opacity = Curves.easeOutCubic.transform(progress.clamp(0.0, 1.0));
    final scale = 0.94 + (0.06 * opacity);

    return SafeArea(
      child: Column(
        children: [
          Expanded(
            child: Center(
              child: Opacity(
                opacity: opacity,
                child: Transform.scale(
                  scale: scale,
                  child: Image.asset(
                    GenProSplashScreen.logoAsset,
                    width: size,
                    height: size,
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.high,
                    gaplessPlayback: true,
                  ),
                ),
              ),
            ),
          ),
          if (showPoweredBy)
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: Opacity(
                opacity: opacity,
                child: Text(
                  GenProSplashScreen.poweredBy,
                  key: const Key('splash-powered-by'),
                  textAlign: TextAlign.center,
                  style: _poweredByStyle,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
