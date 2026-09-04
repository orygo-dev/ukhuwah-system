import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/spotlight/data/spotlight_repository.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_models.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/teacher_spotlight_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_app.dart';
import 'package:guruspace_mobile/features/student/presentation/student_mading_screen.dart';

void main() {
  test('mading model membawa nama dan foto profil author', () {
    final item = StudentBoardItem.fromJson({
      'id': 'board-1',
      'title': 'Karya Hari Ini',
      'category': 'Artikel Siswa',
      'content': 'Isi karya',
      'createdAt': '2026-08-29T08:00:00.000Z',
      'student': {
        'name': 'Alya Putri',
        'user': {'avatarUrl': '/uploads/avatars/alya.webp'},
      },
      'author': {
        'name': 'Alya Putri',
        'avatarUrl': '/uploads/avatars/alya.webp',
      },
      'classRoom': {
        'school': {'name': 'SMA Negeri 1 Bandung'},
      },
      '_count': {'likes': 7, 'comments': 3},
      'viewCount': 41,
      'likes': [
        {'id': 'like-1'},
      ],
      'bookmarks': [
        {'id': 'bookmark-1'},
      ],
      'isOwner': true,
      'reportedByMe': true,
    });

    expect(item.author, 'Alya Putri');
    expect(item.authorAvatarUrl, '/uploads/avatars/alya.webp');
    expect(item.schoolName, 'SMA Negeri 1 Bandung');
    expect(item.likeCount, 7);
    expect(item.commentCount, 3);
    expect(item.viewCount, 41);
    expect(item.likedByMe, isTrue);
    expect(item.bookmarkedByMe, isTrue);
    expect(item.isOwner, isTrue);
    expect(item.reportedByMe, isTrue);
  });

  test('state interaksi mading dapat diperbarui tanpa mengubah konten', () {
    final item = StudentBoardItem(
      id: 'board-1',
      title: 'Karya Hari Ini',
      category: 'Artikel Siswa',
      content: 'Isi karya',
      author: 'Alya Putri',
      schoolName: 'SMA Negeri 1 Bandung',
      publishedAt: DateTime.utc(2026, 8, 29),
    );
    final updated = item.copyWith(
      likedByMe: true,
      likeCount: 1,
      commentCount: 2,
      viewCount: 9,
      bookmarkedByMe: true,
    );

    expect(updated.title, item.title);
    expect(updated.schoolName, 'SMA Negeri 1 Bandung');
    expect(updated.likedByMe, isTrue);
    expect(updated.likeCount, 1);
    expect(updated.commentCount, 2);
    expect(updated.viewCount, 9);
    expect(updated.bookmarkedByMe, isTrue);
  });

  test('Zona Kreasi model membawa foto profil dan sekolah siswa', () {
    final item = StudentSpotlightItem.fromJson({
      'id': 'spotlight-1',
      'caption': 'Eksperimen sains',
      'videoUrl': '/uploads/spotlight/demo.mp4',
      'createdAt': '2026-08-29T08:00:00.000Z',
      'student': {
        'name': 'Alya Putri',
        'user': {'avatarUrl': '/uploads/avatars/alya.webp'},
      },
      'classRoom': {
        'school': {'name': 'SMA Negeri 1 Bandung'},
      },
    });

    expect(item.author, 'Alya Putri');
    expect(item.authorAvatarUrl, '/uploads/avatars/alya.webp');
    expect(item.schoolName, 'SMA Negeri 1 Bandung');
  });

  test('Zona Kreasi lama tidak menampilkan placeholder sekolah palsu', () {
    final legacy = StudentSpotlightItem.fromJson({
      'id': 'spotlight-legacy',
      'caption': 'Konten lama',
      'videoUrl': '/uploads/spotlight/legacy.mp4',
      'student': {'name': 'Alya Putri'},
    });
    final normalized = StudentSpotlightItem.fromJson({
      'id': 'spotlight-normalized',
      'caption': 'Konten baru',
      'videoUrl': '/uploads/spotlight/new.mp4',
      'student': {'name': 'Alya Putri'},
      'schoolName': 'SMA Negeri 1 Bandung',
    });

    expect(legacy.schoolName, isNull);
    expect(normalized.schoolName, 'SMA Negeri 1 Bandung');
  });

  testWidgets('preview Zona Kreasi menampilkan sekolah di bawah author', (
    tester,
  ) async {
    final post = SpotlightPost(
      id: 'spotlight-school',
      caption: 'Karya siswa pilihan sekolah.',
      videoUrl: '/uploads/spotlight/karya.webp',
      viewCount: 12,
      createdAt: DateTime.now(),
      author: const SpotlightAuthor(
        id: 'student-1',
        name: 'Alya Putri',
        schoolName: 'SMA Negeri 1 Bandung',
      ),
      likeCount: 2,
      commentCount: 0,
      likedByMe: false,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SpotlightReelSlide(
            post: post,
            repository: const SpotlightRepository.preview(),
            isActive: true,
            shouldLoad: true,
            isAuthor: false,
            initializeVideo: false,
            mediaPlaceholder: const ColoredBox(color: Colors.black),
            onDelete: () {},
            onCommentCountChanged: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('Alya Putri'), findsOneWidget);
    expect(find.text('SMA Negeri 1 Bandung'), findsOneWidget);
    expect(find.byKey(const Key('spotlight-author-school')), findsOneWidget);
  });

  testWidgets(
    'daftar Zona Kreasi beranda hanya menampilkan author dan sekolah',
    (tester) async {
      final item = StudentSpotlightItem(
        id: 'spotlight-home',
        caption: 'Judul dan deskripsi ini tidak boleh tampil',
        videoUrl: '/uploads/spotlight/karya.webp',
        author: 'Alya Putri',
        schoolName: 'SMA Negeri 1 Bandung',
        publishedAt: DateTime.now(),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 112,
              height: 190,
              child: StudentHomeSpotlightPreview(
                item: item,
                index: 0,
                onTap: () {},
              ),
            ),
          ),
        ),
      );

      expect(find.text('Alya Putri'), findsOneWidget);
      expect(find.text('SMA Negeri 1 Bandung'), findsOneWidget);
      expect(find.text(item.caption), findsNothing);
      expect(
        find.byKey(const Key('student-home-spotlight-school')),
        findsOneWidget,
      );
    },
  );

  test('gambar mading lokal menggunakan endpoint media aplikasi', () {
    expect(
      resolveAppMediaUrl(
        'https://cdn.example.dev/uploads/mading/post.webp',
        baseUrl: 'https://guruspaceai.cloud',
      ),
      'https://guruspaceai.cloud/api/media/mading/post.webp',
    );
  });

  testWidgets('like kartu mading memperbarui item tanpa mengganti feed', (
    tester,
  ) async {
    final response = Completer<({bool liked, int count})>();
    StudentBoardItem? changed;
    final item = StudentBoardItem(
      id: 'board-1',
      title: 'Karya Hari Ini',
      category: 'Artikel Siswa',
      content: 'Isi artikel yang sudah dipublikasikan.',
      author: 'Alya Putri',
      schoolName: 'SMA Negeri 1 Bandung',
      publishedAt: DateTime.now(),
    );

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: StudentMadingPostCard(
              item: item,
              onTap: () {},
              onChanged: (value) => changed = value,
              onLike: (liked) => response.future,
            ),
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('student-mading-card-author')), findsOneWidget);
    expect(find.text('Alya Putri'), findsOneWidget);
    expect(find.text('SMA Negeri 1 Bandung'), findsOneWidget);
    expect(find.textContaining('ARTIKEL SISWA'), findsOneWidget);
    expect(find.byType(InkWell), findsNothing);
    expect(find.byType(InkResponse), findsNothing);

    await tester.tap(find.byKey(const Key('student-mading-card-like')));
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Alya Putri'), findsOneWidget);
    expect(find.text('1'), findsOneWidget);

    response.complete((liked: true, count: 1));
    await tester.pump();
    expect(changed?.likedByMe, isTrue);
    expect(changed?.likeCount, 1);
  });

  testWidgets('daftar mading menggunakan masonry grid dan menampilkan view', (
    tester,
  ) async {
    final items = List.generate(
      4,
      (index) => StudentBoardItem(
        id: 'board-$index',
        title: 'Karya $index',
        category: 'Artikel Siswa',
        content: 'Isi karya siswa nomor $index.',
        author: 'Siswa $index',
        schoolName: 'SMA Negeri 1 Bandung',
        publishedAt: DateTime.now(),
        viewCount: index + 10,
      ),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [studentMadingProvider.overrideWith((_) async => items)],
        child: MaterialApp(
          home: Scaffold(body: StudentMadingScreen(onNotifications: () {})),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('student-mading-header')), findsNothing);
    expect(find.byKey(const Key('student-mading-filters')), findsOneWidget);
    expect(find.byKey(const Key('student-mading-search')), findsNothing);
    expect(find.byKey(const Key('student-mading-notifications')), findsNothing);
    expect(find.byType(CustomScrollView), findsOneWidget);
    expect(find.byType(SliverMasonryGrid), findsOneWidget);
    expect(find.byKey(const Key('student-mading-card-views')), findsWidgets);
  });

  testWidgets('kartu mading beranda menampilkan sekolah author', (
    tester,
  ) async {
    final item = StudentBoardItem(
      id: 'board-home',
      title: 'Karya Beranda',
      category: 'Artikel Siswa',
      content: 'Isi karya siswa.',
      author: 'Alya Putri',
      schoolName: 'SMA Negeri 1 Bandung',
      publishedAt: DateTime.now(),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 178,
            height: 220,
            child: StudentHomeMadingPreview(item: item, onTap: () {}),
          ),
        ),
      ),
    );

    expect(find.text('Alya Putri'), findsOneWidget);
    expect(find.text('SMA Negeri 1 Bandung'), findsOneWidget);
    expect(find.byKey(const Key('student-home-mading-school')), findsOneWidget);
  });

  testWidgets('visual daftar mading bergaya pinterest', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final now = DateTime.now();
    final items = List.generate(
      6,
      (index) => StudentBoardItem(
        id: 'visual-$index',
        title: [
          'Eksperimen Sains Sederhana',
          'Festival Literasi Sekolah',
          'Karya Seni dari Barang Bekas',
          'Cerita Pendek Hari Ini',
          'Pengumuman Kegiatan Kelas',
          'Tips Belajar Lebih Fokus',
        ][index],
        category: index.isEven ? 'Artikel Siswa' : 'Event',
        content: 'Karya pilihan siswa untuk mading digital sekolah.',
        author: 'Siswa ${index + 1}',
        schoolName: 'SMA Negeri 1 Bandung',
        publishedAt: now.subtract(Duration(hours: index + 1)),
        likeCount: 12 + index,
        commentCount: 3 + index,
        viewCount: 80 + (index * 11),
      ),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [studentMadingProvider.overrideWith((_) async => items)],
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          home: Scaffold(body: StudentMadingScreen(onNotifications: () {})),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(StudentMadingScreen),
      matchesGoldenFile('goldens/student_mading_pinterest.png'),
    );
  });

  testWidgets('halaman detail mempertahankan seluruh isi dan dapat di-scroll', (
    tester,
  ) async {
    final content =
        '${List.filled(80, 'Paragraf mading lengkap. ').join()}SELESAI';
    final item = StudentBoardItem(
      id: 'board-long',
      title: 'Artikel Panjang',
      category: 'Artikel Siswa',
      content: content,
      author: 'Alya Putri',
      schoolName: 'SMA Negeri 1 Bandung',
      publishedAt: DateTime.now(),
    );

    var commentLoads = 0;
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: StudentMadingDetailScreen(
            item: item,
            onView: () async => item.viewCount,
            onLoadComments: () async {
              commentLoads++;
              return (comments: <StudentBoardComment>[], count: 0);
            },
          ),
        ),
      ),
    );
    await tester.pump();

    final text = tester.widget<SelectableText>(
      find.byKey(const Key('student-mading-detail-content')),
    );
    expect(text.data, content);
    expect(text.maxLines, isNull);
    expect(
      find.byKey(const Key('student-mading-detail-scroll')),
      findsOneWidget,
    );
    expect(find.byType(AppBar), findsNothing);
    expect(
      find.byKey(const Key('student-mading-detail-school')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('student-mading-comments-panel')),
      findsNothing,
    );
    expect(find.byKey(const Key('student-mading-comment-field')), findsNothing);
    expect(commentLoads, 0);

    final commentButton = find.byKey(
      const Key('student-mading-detail-comments'),
    );
    await tester.scrollUntilVisible(
      commentButton,
      500,
      scrollable: find
          .descendant(
            of: find.byKey(const Key('student-mading-detail-scroll')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
    await tester.tap(commentButton);
    await tester.pumpAndSettle();

    expect(commentLoads, 1);
    expect(
      find.byKey(const Key('student-mading-comments-panel')),
      findsOneWidget,
    );
    final commentField = tester.widget<TextField>(
      find.byKey(const Key('student-mading-comment-field')),
    );
    expect(commentField.focusNode?.hasFocus, isTrue);
  });

  testWidgets('gambar detail tampil utuh dan view bertambah saat dibuka', (
    tester,
  ) async {
    final item = StudentBoardItem(
      id: 'board-image',
      title: 'Poster Utuh',
      category: 'Event',
      content: 'Konten poster yang ditampilkan tanpa pemotongan.',
      author: 'Alya Putri',
      schoolName: 'SMA Negeri 1 Bandung',
      publishedAt: DateTime.now(),
      imageUrl: 'https://example.test/uploads/mading/poster.webp',
      viewCount: 12,
    );

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: StudentMadingDetailScreen(item: item, onView: () async => 13),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    final image = tester.widget<Image>(
      find.byKey(const Key('student-mading-detail-image')),
    );
    expect(image.fit, BoxFit.fitWidth);
    expect(find.byType(AspectRatio), findsNothing);
    expect(
      find.byKey(const Key('student-mading-detail-views')),
      findsOneWidget,
    );
    expect(find.text('13'), findsOneWidget);
  });

  testWidgets('visual preview tanpa header dan komentar sesuai permintaan', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final item = StudentBoardItem(
      id: 'board-preview',
      title: 'Karya Siswa Pilihan Minggu Ini',
      category: 'Artikel Siswa',
      content:
          'Karya ini menceritakan proses siswa mengubah barang bekas menjadi media belajar yang bermanfaat.',
      author: 'Alya Putri',
      schoolName: 'SMA Negeri 1 Bandung',
      publishedAt: DateTime.now().subtract(const Duration(hours: 2)),
      likeCount: 18,
      commentCount: 2,
      viewCount: 126,
      isOwner: true,
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          home: StudentMadingDetailScreen(
            item: item,
            onView: () async => 127,
            onLoadComments: () async =>
                (comments: <StudentBoardComment>[], count: 2),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(StudentMadingDetailScreen),
      matchesGoldenFile('goldens/student_mading_detail_closed.png'),
    );

    await tester.tap(find.byKey(const Key('student-mading-detail-comments')));
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(StudentMadingDetailScreen),
      matchesGoldenFile('goldens/student_mading_detail_comments.png'),
    );
  });

  testWidgets('composer mading memakai Publik GenPro sebagai default', (
    tester,
  ) async {
    StudentMadingDraft? submitted;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StudentMadingComposerSheet(
            onSubmit: (draft) async {
              submitted = draft;
              return 'Berhasil';
            },
          ),
        ),
      ),
    );

    final visibility = tester.widget<DropdownButtonFormField<String>>(
      find.byKey(const Key('student-mading-visibility')),
    );
    expect(visibility.initialValue, 'GLOBAL');
    expect(find.text('Publik GenPro'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('student-mading-title')),
      'Karya publik',
    );
    await tester.enterText(
      find.byKey(const Key('student-mading-content')),
      'Isi karya publik yang panjangnya lebih dari dua puluh karakter.',
    );
    await tester.ensureVisible(find.byKey(const Key('student-mading-submit')));
    await tester.tap(find.byKey(const Key('student-mading-submit')));
    await tester.pumpAndSettle();
    expect(submitted?.visibility, 'GLOBAL');
  });

  testWidgets('pengguna dapat melaporkan mading orang lain satu kali', (
    tester,
  ) async {
    var reportCalls = 0;
    String? reason;
    final item = StudentBoardItem(
      id: 'board-report',
      title: 'Konten untuk diperiksa',
      category: 'Artikel Siswa',
      content: 'Isi konten yang dapat dilaporkan oleh pengguna lain.',
      author: 'Siswa Sekolah Lain',
      schoolName: 'SMA Negeri 2 Bandung',
      publishedAt: DateTime.now(),
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: StudentMadingDetailScreen(
            item: item,
            onView: () async => 1,
            onReport: (value, details) async {
              reportCalls++;
              reason = value;
              return 'Laporan diterima.';
            },
          ),
        ),
      ),
    );
    await tester.pump();

    final moreButton = find.byKey(const Key('student-mading-detail-more'));
    await tester.tap(moreButton);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Laporkan konten'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const Key('student-mading-report-sheet')),
      findsOneWidget,
    );
    await tester.tap(find.text('Konten tidak pantas'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('student-mading-report-submit')));
    await tester.pumpAndSettle();

    expect(reportCalls, 1);
    expect(reason, 'INAPPROPRIATE');
    await tester.tap(moreButton);
    await tester.pumpAndSettle();
    expect(find.text('Sudah dilaporkan'), findsOneWidget);
    await tester.tap(find.text('Sudah dilaporkan'));
    await tester.pumpAndSettle();
    expect(reportCalls, 1);
    expect(find.byKey(const Key('student-mading-report-sheet')), findsNothing);
  });

  testWidgets('tombol lapor tidak tersedia pada mading milik sendiri', (
    tester,
  ) async {
    final item = StudentBoardItem(
      id: 'board-own',
      title: 'Karya sendiri',
      category: 'Artikel Siswa',
      content: 'Isi karya sendiri yang tidak boleh dilaporkan sendiri.',
      author: 'Alya Putri',
      publishedAt: DateTime.now(),
      isOwner: true,
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: StudentMadingDetailScreen(item: item, onView: () async => 1),
        ),
      ),
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('student-mading-detail-more')));
    await tester.pumpAndSettle();
    expect(find.text('Laporkan konten'), findsNothing);
    expect(find.text('Hapus konten'), findsOneWidget);
  });

  testWidgets('author dapat menghapus mading melalui menu tiga titik', (
    tester,
  ) async {
    var deleteCalls = 0;
    final item = StudentBoardItem(
      id: 'board-delete',
      title: 'Karya yang akan dihapus',
      category: 'Artikel Siswa',
      content: 'Isi karya sendiri yang dapat dihapus oleh author.',
      author: 'Alya Putri',
      publishedAt: DateTime.now(),
      isOwner: true,
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: FilledButton(
                  onPressed: () => Navigator.push<bool>(
                    context,
                    MaterialPageRoute(
                      builder: (_) => StudentMadingDetailScreen(
                        item: item,
                        onView: () async => 1,
                        onDelete: () async => deleteCalls++,
                      ),
                    ),
                  ),
                  child: const Text('Buka preview'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Buka preview'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('student-mading-detail-more')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hapus konten'));
    await tester.pumpAndSettle();
    expect(find.text('Hapus mading?'), findsOneWidget);
    await tester.tap(find.byKey(const Key('student-mading-delete-confirm')));
    await tester.pumpAndSettle();

    expect(deleteCalls, 1);
    expect(find.text('Buka preview'), findsOneWidget);
  });
}
