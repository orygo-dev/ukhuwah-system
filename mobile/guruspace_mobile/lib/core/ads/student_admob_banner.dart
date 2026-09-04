import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:guruspace_mobile/core/ads/mobile_ad_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/spotlight_admob_slide.dart';

const _androidBannerTestAdUnitId = 'ca-app-pub-3940256099942544/9214589741';

class StudentAdmobBanner extends ConsumerWidget {
  const StudentAdmobBanner({super.key, required this.placement});

  final StudentAdmobPlacement placement;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(mobileAdConfigProvider);
    return config.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (value) {
        final unitId = value.unitFor(placement);
        if (unitId.isEmpty) return const SizedBox.shrink();
        return LayoutBuilder(
          builder: (context, constraints) {
            final width = (constraints.maxWidth - 16).floor();
            if (width < 280) return const SizedBox.shrink();
            return _AdaptiveBannerSlot(
              key: ValueKey('admob-banner-${placement.name}-$width'),
              adUnitId: unitId,
              width: width,
              placement: placement,
            );
          },
        );
      },
    );
  }
}

class _AdaptiveBannerSlot extends StatefulWidget {
  const _AdaptiveBannerSlot({
    super.key,
    required this.adUnitId,
    required this.width,
    required this.placement,
  });

  final String adUnitId;
  final int width;
  final StudentAdmobPlacement placement;

  @override
  State<_AdaptiveBannerSlot> createState() => _AdaptiveBannerSlotState();
}

class _AdaptiveBannerSlotState extends State<_AdaptiveBannerSlot> {
  BannerAd? _ad;
  AdSize? _size;
  Timer? _timeout;
  bool _loaded = false;
  bool _unavailable = false;
  bool _disposed = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      if (!await SpotlightAdmobGate.prepare() || _disposed) {
        _hide();
        return;
      }
      final size = await AdSize.getLargeAnchoredAdaptiveBannerAdSize(
        widget.width,
      );
      if (size == null || _disposed) {
        _hide();
        return;
      }
      final ad = BannerAd(
        adUnitId: kDebugMode ? _androidBannerTestAdUnitId : widget.adUnitId,
        request: const AdRequest(),
        size: size,
        listener: BannerAdListener(
          onAdLoaded: (loadedAd) {
            _timeout?.cancel();
            _timeout = null;
            if (_disposed) {
              unawaited(loadedAd.dispose());
              return;
            }
            setState(() => _loaded = true);
          },
          onAdFailedToLoad: (failedAd, _) {
            _timeout?.cancel();
            _timeout = null;
            if (identical(_ad, failedAd)) _ad = null;
            unawaited(failedAd.dispose());
            _hide();
          },
        ),
      );
      if (_disposed) {
        unawaited(ad.dispose());
        return;
      }
      setState(() {
        _size = size;
        _ad = ad;
      });
      _timeout = Timer(const Duration(seconds: 20), () {
        if (_disposed || _loaded || !identical(_ad, ad)) return;
        _ad = null;
        unawaited(ad.dispose());
        _hide();
      });
      await ad.load();
    } catch (_) {
      final ad = _ad;
      _ad = null;
      if (ad != null) unawaited(ad.dispose());
      _hide();
    }
  }

  void _hide() {
    if (_disposed || _unavailable) return;
    setState(() => _unavailable = true);
  }

  @override
  void dispose() {
    _disposed = true;
    _timeout?.cancel();
    _timeout = null;
    final ad = _ad;
    _ad = null;
    if (ad != null) unawaited(ad.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_unavailable) return const SizedBox.shrink();
    final height = (_size?.height ?? 60).toDouble();
    return Semantics(
      label: 'Iklan',
      container: true,
      child: Container(
        key: ValueKey('student-admob-banner-${widget.placement.name}'),
        margin: const EdgeInsets.symmetric(vertical: 16),
        padding: const EdgeInsets.fromLTRB(8, 7, 8, 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF5FAF6),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFD7E8D9)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(left: 2, bottom: 5),
              child: Text(
                'Iklan',
                style: TextStyle(
                  color: Color(0xFF64748B),
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            SizedBox(
              width: widget.width.toDouble(),
              height: height,
              child: _loaded && _ad != null
                  ? AdWidget(ad: _ad!)
                  : const Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
