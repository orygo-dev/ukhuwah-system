import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/spotlight/data/spotlight_repository.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_models.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/teacher_spotlight_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_app.dart';
import 'package:guruspace_mobile/features/student/presentation/student_creator_profile_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_mading_screen.dart';

void main() {
  test('model karya membawa student id sebagai target profil', () {
    final mading = StudentBoardItem.fromJson({
      'id': 'mading-1',
      'title': 'Robot Sekolah',
      'category': 'Teknologi',
      'content': 'Karya siswa',
      'student': {'id': 'student-2', 'name': 'Alya'},
    });
    final spotlight = StudentSpotlightItem.fromJson({
      'id': 'kreasi-1',
      'caption': 'Eksperimen sains',
      'videoUrl': '/uploads/spotlight/demo.mp4',
      'student': {'id': 'student-2', 'name': 'Alya'},
    });

    expect(mading.studentId, 'student-2');
    expect(spotlight.studentId, 'student-2');
  });

  testWidgets('profil kreator hanya menampilkan identitas publik dan karya', (
    tester,
  ) async {
    await _pumpProfile(tester);

    expect(find.text('Profil Kreator'), findsOneWidget);
    expect(find.text('Alya Putri'), findsOneWidget);
    expect(find.text('SMA Negeri Demo'), findsOneWidget);
    expect(
      find.byKey(const Key('creator-profile-class')),
      findsOneWidget,
    );
    expect(find.text('XI IPA 1'), findsWidgets);
    expect(find.byKey(const Key('creator-mading-grid')), findsOneWidget);
    expect(find.text('Robot Penyiram Tanaman'), findsOneWidget);
    expect(find.textContaining('@'), findsNothing);
    expect(find.textContaining('NISN'), findsNothing);
    expect(find.textContaining('Telepon'), findsNothing);
    expect(find.byKey(const Key('creator-follow-button')), findsOneWidget);
    expect(find.byKey(const Key('creator-message-button')), findsOneWidget);
    expect(find.text('24'), findsOneWidget);

    await tester.tap(find.text('Zona Kreasi (2)'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('creator-spotlight-grid')), findsOneWidget);
    expect(find.text('Eksperimen sains sederhana'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('hero profil aman pada status bar dan skala teks Android', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          studentCreatorProfileProvider(
            'student-2',
          ).overrideWith((_) async => _profile),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const MediaQuery(
            data: MediaQueryData(
              size: Size(412, 915),
              padding: EdgeInsets.only(top: 36),
              textScaler: TextScaler.linear(1.15),
            ),
            child: StudentCreatorProfileScreen(studentId: 'student-2'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final hero = find.byKey(const Key('creator-profile-hero'));
    expect(hero, findsOneWidget);
    expect(tester.getSize(hero).height, greaterThan(362));
    expect(tester.takeException(), isNull);
  });

  testWidgets('kartu Mading membuka preview dan scroll ke karya berikutnya', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await _pumpProfile(tester);
    final card = find.byKey(const Key('creator-mading-card-mading-1'));
    await tester.ensureVisible(card);
    await tester.pumpAndSettle();
    await tester.tap(card);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('creator-mading-preview')), findsOneWidget);
    expect(
      find.byKey(const Key('creator-mading-preview-item-mading-1')),
      findsOneWidget,
    );
    await tester.drag(
      find.byKey(const Key('creator-mading-preview-scroll')),
      const Offset(0, -700),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Karya berikutnya'), findsOneWidget);
    expect(
      find.byKey(const Key('creator-mading-preview-item-mading-2')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('preview Zona Kreasi dapat digeser khusus karya kreator', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dashboardRepositoryProvider.overrideWith(
            (_) => throw UnimplementedError(),
          ),
        ],
        child: MaterialApp(
          home: CreatorSpotlightPreviewScreen(
            items: _profile.spotlight,
            initialIndex: 0,
            initializeMedia: false,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('creator-spotlight-preview')), findsOneWidget);
    expect(find.text('1 dari 2'), findsOneWidget);

    await tester.drag(
      find.byKey(const Key('creator-spotlight-preview-pages')),
      const Offset(0, -700),
    );
    await tester.pumpAndSettle();
    expect(find.text('2 dari 2'), findsOneWidget);
    expect(find.text('Karya tari tradisional'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('nama author Mading membuka profil siswa yang tepat', (
    tester,
  ) async {
    final item = _profile.mading.first;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          studentCreatorProfileProvider(
            'student-2',
          ).overrideWith((_) async => _profile),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: StudentMadingDetailScreen(
            item: item,
            onView: () async => item.viewCount,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('student-mading-detail-author')));
    await tester.pumpAndSettle();

    expect(find.text('Profil Kreator'), findsOneWidget);
    expect(find.byKey(const Key('creator-profile-name')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('author pada kartu beranda punya aksi terpisah dari konten', (
    tester,
  ) async {
    var madingOpened = 0;
    var madingAuthorOpened = 0;
    var spotlightOpened = 0;
    var spotlightAuthorOpened = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: Column(
            children: [
              SizedBox(
                width: 178,
                height: 220,
                child: StudentHomeMadingPreview(
                  item: _profile.mading.first,
                  onTap: () => madingOpened += 1,
                  onAuthorTap: () => madingAuthorOpened += 1,
                ),
              ),
              SizedBox(
                width: 112,
                height: 190,
                child: StudentHomeSpotlightPreview(
                  item: _profile.spotlight.first,
                  index: 0,
                  onTap: () => spotlightOpened += 1,
                  onAuthorTap: () => spotlightAuthorOpened += 1,
                ),
              ),
            ],
          ),
        ),
      ),
    );

    await tester.tap(
      find.byKey(const Key('student-home-mading-author-action')),
    );
    await tester.tap(
      find.byKey(const Key('student-home-spotlight-author-action')),
    );
    await tester.pump();

    expect(madingAuthorOpened, 1);
    expect(spotlightAuthorOpened, 1);
    expect(madingOpened, 0);
    expect(spotlightOpened, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets('author pada preview Zona Kreasi menjalankan navigasi profil', (
    tester,
  ) async {
    var opened = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SpotlightReelSlide(
            post: SpotlightPost(
              id: 'kreasi-1',
              caption: 'Eksperimen sains sederhana',
              videoUrl: '/uploads/spotlight/demo.mp4',
              viewCount: 8,
              createdAt: DateTime.utc(2026, 8, 30),
              author: const SpotlightAuthor(
                id: 'student-2',
                name: 'Alya Putri',
                schoolName: 'SMA Negeri Demo',
              ),
              likeCount: 2,
              commentCount: 0,
              likedByMe: false,
            ),
            repository: const SpotlightRepository.preview(),
            isActive: false,
            shouldLoad: false,
            isAuthor: false,
            initializeVideo: false,
            engagementEnabled: false,
            mediaPlaceholder: const ColoredBox(color: Colors.black),
            onAuthorTap: () => opened += 1,
            onDelete: () {},
            onCommentCountChanged: (_) {},
          ),
        ),
      ),
    );
    await tester.tap(find.byKey(const Key('spotlight-author-action')));
    await tester.pump();
    expect(opened, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('profil kreator sesuai visual referensi', (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await _pumpProfile(tester);
    await expectLater(
      find.byType(StudentCreatorProfileScreen),
      matchesGoldenFile('goldens/student_creator_profile.png'),
    );
  });
}

Future<void> _pumpProfile(WidgetTester tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        studentCreatorProfileProvider(
          'student-2',
        ).overrideWith((_) async => _profile),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const StudentCreatorProfileScreen(studentId: 'student-2'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

final _profile = StudentCreatorProfile(
  id: 'student-2',
  name: 'Alya Putri',
  schoolName: 'SMA Negeri Demo',
  className: 'XI IPA 1',
  social: const StudentCreatorSocial(
    followerCount: 24,
    followingCount: 11,
    isSelf: false,
    following: false,
    followsViewer: false,
    mutual: false,
    blocked: false,
    canMessage: false,
    enabled: true,
  ),
  mading: [
    StudentBoardItem(
      id: 'mading-1',
      title: 'Robot Penyiram Tanaman',
      category: 'Teknologi',
      content:
          'Karya teknologi siswa yang dirancang untuk membantu merawat tanaman sekolah. '
          'Robot ini menggunakan sensor kelembapan dan sistem penyiraman otomatis. '
          'Proyek dikembangkan melalui pengamatan, perancangan, pengujian, dan perbaikan berulang. '
          'Hasil akhirnya menunjukkan bahwa teknologi sederhana dapat memberi dampak nyata.',
      author: 'Alya Putri',
      studentId: 'student-2',
      schoolName: 'SMA Negeri Demo',
      publishedAt: DateTime.utc(2026, 8, 30),
      likeCount: 18,
      viewCount: 126,
    ),
    StudentBoardItem(
      id: 'mading-2',
      title: 'Poster Hemat Energi',
      category: 'Lingkungan',
      content: 'Poster kampanye siswa.',
      author: 'Alya Putri',
      studentId: 'student-2',
      schoolName: 'SMA Negeri Demo',
      publishedAt: DateTime.utc(2026, 8, 29),
      likeCount: 11,
      viewCount: 84,
    ),
  ],
  spotlight: [
    StudentSpotlightItem(
      id: 'kreasi-1',
      caption: 'Eksperimen sains sederhana',
      videoUrl: '/uploads/spotlight/demo.mp4',
      author: 'Alya Putri',
      studentId: 'student-2',
      schoolName: 'SMA Negeri Demo',
      publishedAt: DateTime.utc(2026, 8, 30),
      likeCount: 23,
    ),
    StudentSpotlightItem(
      id: 'kreasi-2',
      caption: 'Karya tari tradisional',
      videoUrl: '/uploads/spotlight/tari.mp4',
      author: 'Alya Putri',
      studentId: 'student-2',
      schoolName: 'SMA Negeri Demo',
      publishedAt: DateTime.utc(2026, 8, 29),
      likeCount: 17,
    ),
  ],
);
