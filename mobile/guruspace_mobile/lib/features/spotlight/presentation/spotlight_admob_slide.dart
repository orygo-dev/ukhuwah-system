import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

const _androidNativeTestAdUnitId = 'ca-app-pub-3940256099942544/2247696110';

class SpotlightAdmobGate {
  SpotlightAdmobGate._();

  static Future<bool>? _preparing;
  static Future<void>? _initializing;

  static Future<bool> prepare() {
    final active = _preparing;
    if (active != null) return active;
    final next = _prepareOnce();
    _preparing = next;
    return next.then((ready) {
      // A transient consent/network failure may recover later in this session.
      if (!ready) _preparing = null;
      return ready;
    }, onError: (Object error, StackTrace stackTrace) {
      _preparing = null;
      return false;
    });
  }

  static Future<bool> _prepareOnce() async {
    final consent = ConsentInformation.instance;
    final updated = Completer<bool>();
    consent.requestConsentInfoUpdate(
      ConsentRequestParameters(),
      () => updated.complete(true),
      (_) => updated.complete(false),
    );
    final updateSucceeded = await updated.future.timeout(
      const Duration(seconds: 12),
      onTimeout: () => false,
    );

    if (updateSucceeded) {
      final formFinished = Completer<void>();
      ConsentForm.loadAndShowConsentFormIfRequired((_) {
        if (!formFinished.isCompleted) formFinished.complete();
      });
      await formFinished.future.timeout(
        const Duration(seconds: 30),
        onTimeout: () {},
      );
    }
    if (!await consent.canRequestAds()) return false;
    await _initializeSdk();
    return true;
  }

  static Future<void> _initializeSdk() async {
    _initializing ??= () async {
      await MobileAds.instance.updateRequestConfiguration(
        RequestConfiguration(
          ageRestrictedTreatment: AgeRestrictedTreatment.teen,
          maxAdContentRating: MaxAdContentRating.pg,
        ),
      );
      await MobileAds.instance.initialize();
    }();
    await _initializing;
  }

  static Future<bool> showPrivacyOptionsIfRequired() async {
    await prepare();
    final requirement = await ConsentInformation.instance
        .getPrivacyOptionsRequirementStatus();
    if (requirement != PrivacyOptionsRequirementStatus.required) return false;
    final finished = Completer<bool>();
    ConsentForm.showPrivacyOptionsForm((error) {
      if (!finished.isCompleted) finished.complete(error == null);
    });
    return finished.future.timeout(
      const Duration(seconds: 30),
      onTimeout: () => false,
    );
  }
}

class SpotlightAdmobSlide extends StatefulWidget {
  const SpotlightAdmobSlide({
    super.key,
    required this.adUnitId,
    required this.onUnavailable,
  });

  final String adUnitId;
  final VoidCallback onUnavailable;

  @override
  State<SpotlightAdmobSlide> createState() => _SpotlightAdmobSlideState();
}

class _SpotlightAdmobSlideState extends State<SpotlightAdmobSlide> {
  NativeAd? _ad;
  bool _loaded = false;
  bool _disposed = false;
  bool _failureReported = false;
  Timer? _loadTimeout;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      if (!await SpotlightAdmobGate.prepare() || _disposed) {
        _reportUnavailable();
        return;
      }
      final ad = NativeAd(
        adUnitId: kDebugMode ? _androidNativeTestAdUnitId : widget.adUnitId,
        request: const AdRequest(),
        nativeTemplateStyle: NativeTemplateStyle(
          templateType: TemplateType.medium,
          mainBackgroundColor: const Color(0xFF111827),
          primaryTextStyle: NativeTemplateTextStyle(
            textColor: Colors.white,
            backgroundColor: const Color(0xFF111827),
          ),
          secondaryTextStyle: NativeTemplateTextStyle(
            textColor: const Color(0xFFD1D5DB),
            backgroundColor: const Color(0xFF111827),
          ),
          tertiaryTextStyle: NativeTemplateTextStyle(
            textColor: const Color(0xFF9CA3AF),
            backgroundColor: const Color(0xFF111827),
          ),
          callToActionTextStyle: NativeTemplateTextStyle(
            textColor: Colors.white,
            backgroundColor: const Color(0xFF2563EB),
            size: 16,
          ),
        ),
        listener: NativeAdListener(
          onAdLoaded: (loadedAd) {
            _loadTimeout?.cancel();
            _loadTimeout = null;
            if (_disposed) {
              unawaited(loadedAd.dispose());
              return;
            }
            setState(() => _loaded = true);
          },
          onAdFailedToLoad: (failedAd, _) {
            _loadTimeout?.cancel();
            _loadTimeout = null;
            if (identical(_ad, failedAd)) _ad = null;
            unawaited(failedAd.dispose());
            if (!_disposed) _reportUnavailable();
          },
        ),
      );
      _ad = ad;
      _loadTimeout = Timer(const Duration(seconds: 20), () {
        if (_disposed || _loaded || !identical(_ad, ad)) return;
        _ad = null;
        unawaited(ad.dispose());
        _reportUnavailable();
      });
      await ad.load();
    } catch (_) {
      _loadTimeout?.cancel();
      _loadTimeout = null;
      final ad = _ad;
      _ad = null;
      if (ad != null) unawaited(ad.dispose());
      if (!_disposed) _reportUnavailable();
    }
  }

  void _reportUnavailable() {
    if (_failureReported) return;
    _failureReported = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_disposed) widget.onUnavailable();
    });
  }

  @override
  void dispose() {
    _disposed = true;
    _loadTimeout?.cancel();
    _loadTimeout = null;
    final ad = _ad;
    _ad = null;
    if (ad != null) unawaited(ad.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Colors.black,
      child: SafeArea(
        child: Center(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: !_loaded || _ad == null
                ? const CircularProgressIndicator(color: Colors.white)
                : Padding(
                    padding: const EdgeInsets.fromLTRB(16, 72, 16, 24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'Iklan',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        ConstrainedBox(
                          constraints: const BoxConstraints(
                            minWidth: 300,
                            maxWidth: 450,
                            minHeight: 350,
                            maxHeight: 420,
                          ),
                          child: AdWidget(ad: _ad!),
                        ),
                      ],
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
