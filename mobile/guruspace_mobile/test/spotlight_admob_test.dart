import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_ads.dart';

void main() {
  test(
    'configuration fails closed unless unit and teen treatment are valid',
    () {
      expect(SpotlightAdsConfig.fromJson(const {}).enabled, isFalse);
      expect(
        SpotlightAdsConfig.fromJson(const {
          'enabled': true,
          'androidAdUnitId': 'ca-app-pub-123/456',
          'everyNPosts': 1,
          'ageTreatment': 2,
        }).enabled,
        isFalse,
      );
      final valid = SpotlightAdsConfig.fromJson(const {
        'enabled': true,
        'androidAdUnitId': 'ca-app-pub-1234567890123456/1234567890',
        'everyNPosts': 4,
        'ageTreatment': 2,
      });
      expect(valid.enabled, isTrue);
      expect(valid.everyNPosts, 4);
    },
  );

  test('ads are inserted without replacing or reordering organic posts', () {
    final posts = List.generate(9, (index) => 'post-${index + 1}');
    const config = SpotlightAdsConfig(
      enabled: true,
      androidAdUnitId: 'ca-app-pub-1234567890123456/1234567890',
      everyNPosts: 4,
    );
    final entries = buildSpotlightFeedEntries(
      posts,
      idOf: (post) => post,
      config: config,
    );

    expect(entries.map((entry) => entry.isAd ? 'ad' : entry.post).toList(), [
      'post-1',
      'post-2',
      'post-3',
      'post-4',
      'ad',
      'post-5',
      'post-6',
      'post-7',
      'post-8',
      'ad',
      'post-9',
    ]);
    expect(
      entries.where((entry) => !entry.isAd).map((entry) => entry.post),
      posts,
    );
  });

  test('frequency is clamped and disabled mode remains exactly organic', () {
    final low = SpotlightAdsConfig.fromJson(const {
      'enabled': true,
      'androidAdUnitId': 'ca-app-pub-1234567890123456/1234567890',
      'everyNPosts': -100,
      'ageTreatment': 2,
    });
    expect(low.everyNPosts, 3);

    final posts = ['a', 'b', 'c'];
    final entries = buildSpotlightFeedEntries(
      posts,
      idOf: (post) => post,
      config: SpotlightAdsConfig.disabled,
    );
    expect(entries.map((entry) => entry.post), posts);
    expect(entries.any((entry) => entry.isAd), isFalse);
  });

  test(
    'native ad lifecycle has timeout, retry, cleanup, and privacy entry',
    () {
      final source = File(
        'lib/features/spotlight/presentation/spotlight_admob_slide.dart',
      ).readAsStringSync();
      final studentProfile = File(
        'lib/features/student/presentation/student_profile_screen.dart',
      ).readAsStringSync();
      final teacherProfile = File(
        'lib/features/shared/presentation/profile_screen.dart',
      ).readAsStringSync();

      expect(source, contains("_preparing = null"));
      expect(source, contains("Timer(const Duration(seconds: 20)"));
      expect(source, contains("unawaited(ad.dispose())"));
      expect(source, contains("showPrivacyOptionsIfRequired"));
      expect(studentProfile, contains("student-profile-ad-privacy"));
      expect(studentProfile, contains("student-profile-privacy-policy"));
      expect(studentProfile, contains("/privacy/siswa"));
      expect(teacherProfile, contains("label: 'Privasi iklan'"));
      expect(teacherProfile, contains("label: 'Kebijakan privasi'"));
      expect(teacherProfile, contains("/privacy/guru"));
    },
  );
}
