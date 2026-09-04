import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/ads/mobile_ad_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_ads.dart';
import 'package:guruspace_mobile/features/student/presentation/student_mading_screen.dart';

void main() {
  const unitPrefix = 'ca-app-pub-1234567890123456/';

  test('placement config fails closed and only accepts teen-treated units', () {
    expect(MobileAdConfig.fromJson(const {}).enabled, isFalse);
    expect(
      MobileAdConfig.fromJson({
        'enabled': true,
        'ageTreatment': 1,
        'student': {'readingBanner': '${unitPrefix}1000000001'},
      }).enabled,
      isFalse,
    );

    final config = MobileAdConfig.fromJson({
      'enabled': true,
      'ageTreatment': 2,
      'madingEveryNPosts': 2,
      'student': {
        'readingBanner': '${unitPrefix}1000000001',
        'madingBanner': 'invalid',
        'madingNative': '${unitPrefix}1000000002',
      },
    });
    expect(config.enabled, isTrue);
    expect(
      config.unitFor(StudentAdmobPlacement.readingBanner),
      '${unitPrefix}1000000001',
    );
    expect(config.unitFor(StudentAdmobPlacement.madingBanner), isEmpty);
    expect(config.madingEveryNPosts, 4);
  });

  test('Mading native entries preserve every organic post', () {
    final posts = List.generate(11, (index) => 'post-${index + 1}');
    final entries = buildSpotlightFeedEntries(
      posts,
      idOf: (post) => post,
      config: const SpotlightAdsConfig(
        enabled: true,
        androidAdUnitId: '${unitPrefix}1000000002',
        everyNPosts: 5,
      ),
    );
    expect(entries.where((entry) => entry.isAd).length, 2);
    expect(
      entries.where((entry) => !entry.isAd).map((entry) => entry.post),
      posts,
    );
  });

  test('banner and native widgets own timeout and disposal lifecycle', () {
    final banner = File(
      'lib/core/ads/student_admob_banner.dart',
    ).readAsStringSync();
    final mading = File(
      'lib/features/student/presentation/student_mading_screen.dart',
    ).readAsStringSync();

    expect(banner, contains('SpotlightAdmobGate.prepare()'));
    expect(banner, contains('Timer(const Duration(seconds: 20)'));
    expect(banner, contains('unawaited(ad.dispose())'));
    expect(banner, contains('_androidBannerTestAdUnitId'));
    expect(mading, contains("scrollDirection: Axis.vertical"));
    expect(mading, contains('SpotlightAdmobSlide'));
    expect(mading, contains('StudentAdmobPlacement.madingBanner'));
  });

  test('all requested student list pages contain their dedicated banner', () {
    final sources = {
      'student_reading_screen.dart': StudentAdmobPlacement.readingBanner,
      'student_mading_screen.dart': StudentAdmobPlacement.madingBanner,
      'student_assignments_screen.dart':
          StudentAdmobPlacement.assignmentsBanner,
      'student_quiz_screen.dart': StudentAdmobPlacement.quizBanner,
    };
    for (final entry in sources.entries) {
      final source = File(
        'lib/features/student/presentation/${entry.key}',
      ).readAsStringSync();
      expect(source, contains('StudentAdmobBanner'));
      expect(source, contains('StudentAdmobPlacement.${entry.value.name}'));
    }
  });

  testWidgets(
    'Mading preview is vertical, scrollable, and keeps organic flow',
    (tester) async {
      final items = List.generate(
        3,
        (index) => StudentBoardItem(
          id: 'post-$index',
          title: 'Karya ${index + 1}',
          category: 'Artikel Siswa',
          content: 'Isi karya ${index + 1}',
          author: 'Siswa ${index + 1}',
          schoolName: 'SMA GenPro',
          publishedAt: DateTime(2026, 9, 1),
        ),
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            mobileAdConfigProvider.overrideWith(
              (_) async => MobileAdConfig.disabled,
            ),
          ],
          child: MaterialApp(
            home: StudentMadingPreviewScreen(
              items: items,
              initialPostId: 'post-0',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final pageView = tester.widget<PageView>(
        find.byKey(const Key('student-mading-reels-pages')),
      );
      expect(pageView.scrollDirection, Axis.vertical);
      expect(find.text('Karya 1'), findsOneWidget);
      await tester.drag(
        find.byKey(const Key('student-mading-reels-pages')),
        const Offset(0, -700),
      );
      await tester.pumpAndSettle();
      expect(find.text('Karya 2'), findsOneWidget);
    },
  );
}
