class SpotlightAdsConfig {
  const SpotlightAdsConfig({
    required this.enabled,
    required this.androidAdUnitId,
    required this.everyNPosts,
  });

  static const disabled = SpotlightAdsConfig(
    enabled: false,
    androidAdUnitId: '',
    everyNPosts: 6,
  );

  final bool enabled;
  final String androidAdUnitId;
  final int everyNPosts;

  factory SpotlightAdsConfig.fromJson(Map<String, dynamic> json) {
    final unitId = json['androidAdUnitId']?.toString().trim() ?? '';
    final requestedFrequency = (json['everyNPosts'] as num?)?.toInt() ?? 6;
    final frequency = requestedFrequency.clamp(3, 20);
    final validUnit = RegExp(r'^ca-app-pub-\d{16}/\d{10}$').hasMatch(unitId);
    return SpotlightAdsConfig(
      enabled:
          json['enabled'] == true && json['ageTreatment'] == 2 && validUnit,
      androidAdUnitId: validUnit ? unitId : '',
      everyNPosts: frequency,
    );
  }
}

class SpotlightFeedEntry<T> {
  const SpotlightFeedEntry.post(this.post, this.id) : isAd = false;
  const SpotlightFeedEntry.ad(this.id) : post = null, isAd = true;

  final String id;
  final T? post;
  final bool isAd;
}

List<SpotlightFeedEntry<T>> buildSpotlightFeedEntries<T>(
  List<T> posts, {
  required String Function(T post) idOf,
  required SpotlightAdsConfig config,
}) {
  if (!config.enabled || posts.isEmpty) {
    return posts
        .map((post) => SpotlightFeedEntry<T>.post(post, 'post:${idOf(post)}'))
        .toList(growable: false);
  }

  final entries = <SpotlightFeedEntry<T>>[];
  for (var index = 0; index < posts.length; index += 1) {
    final post = posts[index];
    entries.add(SpotlightFeedEntry<T>.post(post, 'post:${idOf(post)}'));
    if ((index + 1) % config.everyNPosts == 0) {
      entries.add(SpotlightFeedEntry<T>.ad('ad:${index + 1}'));
    }
  }
  return entries;
}
