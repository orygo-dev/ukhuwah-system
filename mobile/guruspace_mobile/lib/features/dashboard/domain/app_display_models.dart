class MobileBrandingDisplay {
  const MobileBrandingDisplay({
    required this.appName,
    required this.logoUrl,
    required this.authLogoUrl,
  });

  final String appName;
  final String logoUrl;
  final String authLogoUrl;

  String get loginLogoUrl =>
      authLogoUrl.trim().isNotEmpty ? authLogoUrl.trim() : logoUrl.trim();

  factory MobileBrandingDisplay.fromJson(Map<String, dynamic> json) {
    final branding = Map<String, dynamic>.from(
      json['branding'] as Map? ?? const {},
    );
    return MobileBrandingDisplay(
      appName: branding['appName']?.toString().trim().isNotEmpty == true
          ? branding['appName'].toString().trim()
          : 'GuruSpace',
      logoUrl: branding['logoUrl']?.toString() ?? '',
      authLogoUrl: branding['authLogoUrl']?.toString() ?? '',
    );
  }
}

class MobileSplashDisplay {
  const MobileSplashDisplay({
    required this.enabled,
    required this.logoUrl,
    required this.backgroundUrl,
    required this.durationMs,
  });

  final bool enabled;
  final String logoUrl;
  final String backgroundUrl;
  final int durationMs;

  factory MobileSplashDisplay.fromJson(Map<String, dynamic> json) {
    final splash = Map<String, dynamic>.from(
      json['splash'] as Map? ?? const {},
    );
    return MobileSplashDisplay(
      enabled: splash['enabled'] != false,
      logoUrl: splash['logoUrl']?.toString() ?? '',
      backgroundUrl: splash['backgroundUrl']?.toString() ?? '',
      durationMs: (splash['durationMs'] as num?)?.toInt() ?? 1800,
    );
  }
}

class AppBannerSlide {
  const AppBannerSlide({
    required this.id,
    required this.mediaUrl,
    required this.type,
    this.title,
    this.linkUrl,
  });

  final String id;
  final String mediaUrl;
  final String type;
  final String? title;
  final String? linkUrl;

  factory AppBannerSlide.fromJson(Map<String, dynamic> json) => AppBannerSlide(
    id: json['id']?.toString() ?? '',
    mediaUrl: json['mediaUrl']?.toString() ?? '',
    type: json['type']?.toString() ?? 'image',
    title: json['title']?.toString(),
    linkUrl: json['linkUrl']?.toString(),
  );
}

class MobileBannerDisplay {
  const MobileBannerDisplay({required this.autoPlayMs, required this.slides});

  final int autoPlayMs;
  final List<AppBannerSlide> slides;

  factory MobileBannerDisplay.fromJson(Map<String, dynamic> json) {
    final banners = Map<String, dynamic>.from(json['banners'] as Map? ?? {});
    final enabled = banners['enabled'] == true;
    final rawSlides = banners['slides'];
    return MobileBannerDisplay(
      autoPlayMs: (banners['autoPlayMs'] as num?)?.toInt() ?? 5000,
      slides: enabled && rawSlides is List
          ? rawSlides
                .whereType<Map>()
                .map(
                  (item) =>
                      AppBannerSlide.fromJson(Map<String, dynamic>.from(item)),
                )
                .where(
                  (item) =>
                      item.mediaUrl.isNotEmpty &&
                      (item.type == 'image' || item.type == 'video'),
                )
                .toList()
          : const [],
    );
  }
}

class MobilePopupDisplay {
  const MobilePopupDisplay({
    required this.enabled,
    required this.revision,
    required this.slides,
  });

  final bool enabled;
  final String revision;
  final List<AppBannerSlide> slides;

  String get campaignSignature => [
    revision,
    ...slides.map(
      (slide) =>
          '${slide.id}|${slide.type}|${slide.mediaUrl}|${slide.linkUrl ?? ''}|${slide.title ?? ''}',
    ),
  ].join('::');

  factory MobilePopupDisplay.fromJson(Map<String, dynamic> json) {
    final popup = Map<String, dynamic>.from(json['popup'] as Map? ?? {});
    final rawSlides = popup['slides'];
    final slides = rawSlides is List
        ? rawSlides
              .whereType<Map>()
              .map(
                (item) =>
                    AppBannerSlide.fromJson(Map<String, dynamic>.from(item)),
              )
              .where(
                (item) =>
                    item.mediaUrl.isNotEmpty &&
                    (item.type == 'image' || item.type == 'video'),
              )
              .toList()
        : const <AppBannerSlide>[];
    return MobilePopupDisplay(
      enabled: popup['enabled'] == true,
      revision: popup['revision']?.toString() ?? 'legacy',
      slides: slides,
    );
  }
}

class MobileQuickMenuIcons {
  const MobileQuickMenuIcons({required this.revision, required this.icons});

  static const keys = <String>{
    'attendance',
    'assignments',
    'quiz',
    'pjj',
    'tka',
    'reading',
    'creations',
    'board',
  };

  final String revision;
  final Map<String, String> icons;

  String urlFor(String key) {
    final raw = icons[key]?.trim() ?? '';
    if (raw.isEmpty) return '';
    final uri = Uri.tryParse(raw);
    if (uri == null) return '';
    return uri
        .replace(queryParameters: {...uri.queryParameters, 'v': revision})
        .toString();
  }

  factory MobileQuickMenuIcons.fromJson(Map<String, dynamic> json) {
    final config = Map<String, dynamic>.from(
      json['quickMenuIcons'] as Map? ?? const {},
    );
    final rawIcons = Map<String, dynamic>.from(
      config['icons'] as Map? ?? const {},
    );
    return MobileQuickMenuIcons(
      revision: config['revision']?.toString().trim().isNotEmpty == true
          ? config['revision'].toString().trim()
          : 'initial',
      icons: {
        for (final key in keys) key: rawIcons[key]?.toString().trim() ?? '',
      },
    );
  }
}

class MobileAppDisplay {
  const MobileAppDisplay({
    required this.branding,
    required this.splash,
    required this.banners,
    required this.popup,
    required this.quickMenuIcons,
  });

  final MobileBrandingDisplay branding;
  final MobileSplashDisplay splash;
  final MobileBannerDisplay banners;
  final MobilePopupDisplay popup;
  final MobileQuickMenuIcons quickMenuIcons;

  factory MobileAppDisplay.fromJson(Map<String, dynamic> json) =>
      MobileAppDisplay(
        branding: MobileBrandingDisplay.fromJson(json),
        splash: MobileSplashDisplay.fromJson(json),
        banners: MobileBannerDisplay.fromJson(json),
        popup: MobilePopupDisplay.fromJson(json),
        quickMenuIcons: MobileQuickMenuIcons.fromJson(json),
      );
}
