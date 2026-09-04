import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/features/dashboard/data/dashboard_repository.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_share.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/student/presentation/student_creator_profile_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_spotlight_screen.dart';

void main() {
  const user = AppUser(
    id: 'u1',
    email: 'test@example.test',
    name: 'Siswa',
    role: UserRole.student,
  );
  Future<void> openFeed(
    WidgetTester tester, {
    bool owner = true,
    FakeSpotlightApi? api,
    bool preview = true,
    List<Map<String, dynamic>>? spotlight,
  }) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final dashboard = StudentDashboard.fromJson({
      'student': {
        'name': 'Siswa',
        'classRoom': {
          'name': 'Kelas',
          'school': {'id': 'school-1', 'name': 'Sekolah Satu'},
        },
      },
      'summary': <String, dynamic>{},
      'spotlight':
          spotlight ??
          [
            {
              'id': 'post1',
              'caption': 'Karya siswa untuk pengujian',
              'videoUrl': '',
              'isOwner': owner,
              'student': {'id': 'student-1', 'name': 'Siswa'},
            },
          ],
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          studentDashboardProvider.overrideWith((ref) async => dashboard),
          if (api != null)
            dashboardRepositoryProvider.overrideWithValue(
              DashboardRepository(api),
            ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: StudentSpotlightScreen(
              user: user,
              active: false,
              initialPostId: preview ? 'post1' : null,
              onNotifications: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('Zona Kreasi opens as poster grid then keeps Reels preview', (
    tester,
  ) async {
    await openFeed(tester, preview: false);
    expect(find.byKey(const Key('student-spotlight-grid')), findsOneWidget);
    expect(find.byKey(const Key('student-spotlight-reels')), findsNothing);
    expect(
      find.byKey(const Key('student-spotlight-card-post1')),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const Key('student-spotlight-card-post1')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('student-spotlight-reels')), findsOneWidget);
    expect(find.byKey(const Key('spotlight-more-actions')), findsOneWidget);
    expect(find.text('Karya siswa untuk pengujian'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student-spotlight-grid')), findsOneWidget);
  });

  testWidgets('grid uses category header without page title or description', (
    tester,
  ) async {
    await openFeed(tester, preview: false);

    expect(
      find.byKey(const Key('student-spotlight-categories')),
      findsOneWidget,
    );
    expect(find.text('Untukmu'), findsOneWidget);
    expect(find.text('Sekolahku'), findsOneWidget);
    expect(find.text('Terbaru'), findsOneWidget);
    expect(find.text('Mengikuti'), findsOneWidget);
    expect(find.text('Zona Kreasi'), findsNothing);
    expect(find.text('Jelajahi karya kreatif pilihan siswa'), findsNothing);
    await expectLater(
      find.byKey(const Key('student-spotlight-controls')),
      matchesGoldenFile('goldens/student_spotlight_category_dock.png'),
    );
    tester.view.physicalSize = const Size(320, 700);
    await tester.pumpAndSettle();
    expect(
      find.byKey(const Key('student-spotlight-category-following')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Sekolahku only shows creators from the same school', (
    tester,
  ) async {
    await openFeed(
      tester,
      preview: false,
      spotlight: [
        {
          'id': 'same-school',
          'caption': 'Karya sekolah sendiri',
          'videoUrl': '',
          'student': {'id': 'student-1', 'name': 'Teman'},
          'classRoom': {
            'school': {'id': 'school-1', 'name': 'Sekolah Satu'},
          },
        },
        {
          'id': 'other-school',
          'caption': 'Karya sekolah lain',
          'videoUrl': '',
          'student': {'id': 'student-2', 'name': 'Siswa Lain'},
          'classRoom': {
            'school': {'id': 'school-2', 'name': 'Sekolah Dua'},
          },
        },
      ],
    );

    await tester.tap(
      find.byKey(const Key('student-spotlight-category-school')),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('student-spotlight-card-same-school')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('student-spotlight-card-other-school')),
      findsNothing,
    );
  });

  testWidgets(
    'Mengikuti only shows followed creators and can recover when empty',
    (tester) async {
      await openFeed(
        tester,
        preview: false,
        spotlight: [
          {
            'id': 'followed',
            'caption': 'Karya kreator diikuti',
            'videoUrl': '',
            'isFollowing': true,
            'student': {'id': 'student-1', 'name': 'Diikuti'},
          },
          {
            'id': 'other',
            'caption': 'Karya kreator lain',
            'videoUrl': '',
            'student': {'id': 'student-2', 'name': 'Lain'},
          },
        ],
      );

      final followingFilter = find.byKey(
        const Key('student-spotlight-category-following'),
      );
      await tester.ensureVisible(followingFilter);
      await tester.pumpAndSettle();
      await tester.tap(followingFilter);
      await tester.pumpAndSettle();
      expect(
        find.byKey(const Key('student-spotlight-card-followed')),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('student-spotlight-card-other')),
        findsNothing,
      );

      final forYouFilter = find.byKey(
        const Key('student-spotlight-category-forYou'),
      );
      await tester.ensureVisible(forYouFilter);
      await tester.pumpAndSettle();
      await tester.tap(forYouFilter);
      await tester.pumpAndSettle();
      expect(
        find.byKey(const Key('student-spotlight-card-other')),
        findsOneWidget,
      );
    },
  );

  testWidgets('Terbaru sorts by publication time instead of popularity', (
    tester,
  ) async {
    await openFeed(
      tester,
      preview: false,
      spotlight: [
        {
          'id': 'popular',
          'caption': 'Populer lama',
          'videoUrl': '',
          'publishedAt': '2026-08-01T00:00:00.000Z',
          '_count': {'likes': 99},
          'student': {'id': 'student-1', 'name': 'Populer'},
        },
        {
          'id': 'newest',
          'caption': 'Konten terbaru',
          'videoUrl': '',
          'publishedAt': '2026-08-31T00:00:00.000Z',
          '_count': {'likes': 1},
          'student': {'id': 'student-2', 'name': 'Terbaru'},
        },
      ],
    );

    final popular = find.byKey(const Key('student-spotlight-card-popular'));
    final newest = find.byKey(const Key('student-spotlight-card-newest'));
    expect(
      tester.getTopLeft(popular).dx,
      lessThan(tester.getTopLeft(newest).dx),
    );

    await tester.tap(
      find.byKey(const Key('student-spotlight-category-latest')),
    );
    await tester.pumpAndSettle();
    expect(
      tester.getTopLeft(newest).dx,
      lessThan(tester.getTopLeft(popular).dx),
    );
  });

  testWidgets('Mengikuti empty state returns safely to Untukmu', (
    tester,
  ) async {
    await openFeed(tester, preview: false);
    final followingFilter = find.byKey(
      const Key('student-spotlight-category-following'),
    );
    await tester.ensureVisible(followingFilter);
    await tester.pumpAndSettle();
    await tester.tap(followingFilter);
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('student-spotlight-following-empty')),
      findsOneWidget,
    );
    await tester.tap(find.text('Lihat Untukmu'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student-spotlight-grid')), findsOneWidget);
  });

  testWidgets('author action opens creator profile without opening preview', (
    tester,
  ) async {
    await openFeed(tester, preview: false);
    await tester.tap(find.byKey(const Key('student-spotlight-author-post1')));
    await tester.pumpAndSettle();

    expect(find.byType(StudentCreatorProfileScreen), findsOneWidget);
    expect(find.byKey(const Key('student-spotlight-reels')), findsNothing);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student-spotlight-grid')), findsOneWidget);
  });

  testWidgets('preview fills available area without branded header', (
    tester,
  ) async {
    await openFeed(tester);
    expect(find.byKey(const Key('student-spotlight-header')), findsNothing);
    expect(
      tester.getTopLeft(find.byKey(const Key('student-spotlight-reels'))).dy,
      0,
    );
    expect(find.byKey(const Key('student-spotlight-create')), findsOneWidget);
  });

  testWidgets('owner can open delete confirmation; cancellation keeps post', (
    tester,
  ) async {
    await openFeed(tester);
    await tester.tap(find.byKey(const Key('spotlight-more-actions')));
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hapus konten'));
    await tester.pumpAndSettle();
    expect(find.text('Hapus Zona Kreasi?'), findsOneWidget);
    await tester.tap(find.text('Batal'));
    await tester.pumpAndSettle();
    expect(find.text('Karya siswa untuk pengujian'), findsOneWidget);
  });

  testWidgets('share opens native sheet with student link, not clipboard', (
    tester,
  ) async {
    final shares = <MethodCall>[];
    final clipboard = <MethodCall>[];
    const channel = MethodChannel('dev.fluttercommunity.plus/share');
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
      call,
    ) async {
      shares.add(call);
      return 'dev.fluttercommunity.plus/share/dismissed';
    });
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') clipboard.add(call);
        return null;
      },
    );
    addTearDown(() {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      );
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      );
    });
    await openFeed(tester);
    await tester.tap(find.text('Bagikan'));
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    expect(clipboard, isEmpty);
    expect(shares, hasLength(1));
    expect(
      (shares.single.arguments as Map)['text'],
      contains('/spotlight/student/post1'),
    );
  });

  test('teacher and student share destinations cannot collide', () {
    expect(
      spotlightShareUrl(SpotlightKind.teacher, 'p1'),
      endsWith('/spotlight/teacher/p1'),
    );
    expect(
      spotlightShareUrl(SpotlightKind.student, 'p1'),
      endsWith('/spotlight/student/p1'),
    );
  });

  testWidgets('non-owner has report and copy, never delete', (tester) async {
    await openFeed(tester, owner: false);
    await tester.tap(find.byKey(const Key('spotlight-more-actions')));
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    expect(find.text('Hapus konten'), findsNothing);
    expect(find.text('Laporkan konten'), findsOneWidget);
    expect(find.text('Salin tautan'), findsOneWidget);
  });

  for (final fail in [false, true]) {
    testWidgets(
      'delete ${fail ? 'failure retains post and permits retry' : 'success removes post even if cached feed is stale'}',
      (tester) async {
        final api = FakeSpotlightApi()..fail = fail;
        await openFeed(tester, api: api);
        await tester.tap(find.byKey(const Key('spotlight-more-actions')));
        await tester.pump(const Duration(milliseconds: 350));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Hapus konten'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Hapus', skipOffstage: true));
        await tester.pumpAndSettle();
        expect(api.deletions, ['/api/student/spotlight-submissions/post1']);
        expect(
          find.text('Karya siswa untuk pengujian'),
          fail ? findsOneWidget : findsNothing,
        );
        expect(
          find.text(
            fail
                ? 'Konten belum berhasil dihapus. Silakan coba lagi.'
                : 'Zona Kreasi berhasil dihapus.',
          ),
          findsOneWidget,
        );
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('grid only exposes categories without header actions', (
    tester,
  ) async {
    await openFeed(tester, preview: false);
    expect(
      find.byKey(const Key('student-spotlight-categories')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('student-spotlight-search')), findsNothing);
    expect(
      find.byKey(const Key('student-spotlight-notifications')),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'native share failure is visible and explicit copy remains available',
    (tester) async {
      await openFeed(tester);
      const channel = MethodChannel('dev.fluttercommunity.plus/share');
      String? copied;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        (_) async => throw PlatformException(code: 'unavailable'),
      );
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            copied = (call.arguments as Map)['text'] as String;
          }
          return null;
        },
      );
      addTearDown(() {
        tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          channel,
          null,
        );
        tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        );
      });
      await tester.tap(find.text('Bagikan'));
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Tidak dapat membuka menu Bagikan'),
        findsOneWidget,
      );
      expect(copied, isNull);
      await tester.tap(find.byKey(const Key('spotlight-more-actions')));
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Salin tautan'));
      await tester.pumpAndSettle();
      expect(copied, endsWith('/spotlight/student/post1'));
    },
  );

  testWidgets(
    'native sharing is single-flight and safely completes after screen disposal',
    (tester) async {
      await openFeed(tester);
      const channel = MethodChannel('dev.fluttercommunity.plus/share');
      final completed = Completer<String>();
      var calls = 0;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
        _,
      ) {
        calls++;
        return completed.future;
      });
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          channel,
          null,
        ),
      );
      for (var i = 0; i < 2; i++) {
        await tester.tap(find.text('Bagikan'));
        await tester.pump(const Duration(milliseconds: 350));
      }
      expect(calls, 1);
      await tester.pumpWidget(const SizedBox());
      completed.complete('dev.fluttercommunity.plus/share/dismissed');
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );
}

class FakeSpotlightApi implements ApiClient {
  bool fail = false;
  final deletions = <String>[];
  @override
  Future<Map<String, dynamic>> deleteJson(String path, {Object? data}) async {
    deletions.add(path);
    if (fail) throw StateError('simulated network failure');
    return {'ok': true};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
