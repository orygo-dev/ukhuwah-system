import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/features/splash/presentation/genpro_splash_screen.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/widgets/app_logo.dart';
import 'package:guruspace_mobile/core/widgets/dashboard_popup_ad.dart';
import 'package:guruspace_mobile/core/widgets/dashboard_components.dart';
import 'package:guruspace_mobile/core/widgets/mobile_banner_carousel.dart';
import 'package:guruspace_mobile/core/widgets/mobile_web_shell.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';
import 'package:guruspace_mobile/features/auth/presentation/login_screen.dart';
import 'package:guruspace_mobile/features/dashboard/domain/app_display_models.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/shared/presentation/notifications_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_assignments_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_app.dart';
import 'package:guruspace_mobile/features/student/presentation/student_ebook_reader_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_mading_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_profile_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_quiz_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_reading_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_spotlight_screen.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_models.dart';
import 'package:guruspace_mobile/features/spotlight/data/spotlight_repository.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/teacher_spotlight_screen.dart';
import 'package:guruspace_mobile/features/teacher/domain/assistant_models.dart';
import 'package:guruspace_mobile/features/teacher/presentation/assistant_screen.dart';
import 'package:guruspace_mobile/features/teacher/presentation/teacher_app.dart';
import 'package:guruspace_mobile/features/teacher/presentation/teacher_student_accounts_screen.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('id_ID');
  });

  test(
    'tema aplikasi memakai Plus Jakarta Sans lokal pada semua weight',
    () async {
      expect(
        AppTheme.light.textTheme.bodyMedium?.fontFamily,
        'PlusJakartaSans',
      );
      for (final weight in const [
        'Regular',
        'Medium',
        'SemiBold',
        'Bold',
        'ExtraBold',
      ]) {
        final data = await rootBundle.load(
          'assets/fonts/plus_jakarta_sans/PlusJakartaSans-$weight.ttf',
        );
        expect(data.lengthInBytes, greaterThan(100000));
      }
    },
  );

  test('data Zona Kreasi API dipetakan untuk feed Reels', () {
    final post = SpotlightPost.fromJson({
      'id': 'spot-1',
      'caption': 'Praktik baik pembelajaran berdiferensiasi.',
      'videoUrl': 'https://cdn.guruspace.id/video.mp4',
      'thumbnailUrl': 'https://cdn.guruspace.id/thumb.jpg',
      'viewCount': 214,
      'createdAt': '2026-07-31T01:00:00.000Z',
      'author': {
        'id': 'teacher-1',
        'name': 'Rina Puspitasari',
        'avatarUrl': null,
      },
      'likeCount': 37,
      'commentCount': 9,
      'likedByMe': true,
    });

    expect(post.id, 'spot-1');
    expect(post.author.name, 'Rina Puspitasari');
    expect(post.viewCount, 214);
    expect(post.likeCount, 37);
    expect(post.commentCount, 9);
    expect(post.likedByMe, isTrue);
    expect(post.createdAt.toUtc().year, 2026);
    expect(isSpotlightImageUrl(post.videoUrl), isFalse);
    expect(isSpotlightImageUrl('/uploads/spotlight/karya-siswa.webp'), isTrue);
  });

  test('URL media /uploads diarahkan ke origin aplikasi', () {
    expect(
      resolveAppMediaUrl(
        'https://cdn.example.r2.dev/uploads/notifications/a.png',
        baseUrl: 'https://guruspaceai.cloud',
      ),
      'https://guruspaceai.cloud/api/media/notifications/a.png',
    );
    expect(
      resolveAppMediaUrl(
        '/uploads/reading/document/bumi.pdf',
        baseUrl: 'https://guruspaceai.cloud',
      ),
      'https://guruspaceai.cloud/api/media/reading/document/bumi.pdf',
    );
    expect(
      resolveAppMediaUrl(
        '/api/media/notifications/a.png',
        baseUrl: 'https://guruspaceai.cloud',
      ),
      'https://guruspaceai.cloud/api/media/notifications/a.png',
    );
    expect(
      resolveAppMediaUrl(
        'https://cdn.example.r2.dev/uploads/avatars/user-1.png',
        baseUrl: 'https://guruspaceai.cloud',
      ),
      'https://guruspaceai.cloud/api/media/avatars/user-1.png',
    );
    expect(
      resolveAppMediaUrl(
        '/uploads/avatars/user-1.png',
        baseUrl: 'https://guruspaceai.cloud',
      ),
      'https://guruspaceai.cloud/api/media/avatars/user-1.png',
    );
    expect(
      resolveAppMediaUrl(
        'https://drive.google.com/file/d/abc',
        baseUrl: 'https://guruspaceai.cloud',
      ),
      'https://drive.google.com/file/d/abc',
    );
  });

  test('URL sensitif hanya menerima HTTPS dan origin GenPro yang benar', () {
    expect(
      validatedAppBaseUri(value: 'https://guruspaceai.cloud').host,
      'guruspaceai.cloud',
    );
    expect(
      () => validatedAppBaseUri(value: 'http://guruspaceai.cloud'),
      throwsFormatException,
    );
    expect(safeExternalUri('javascript:alert(1)'), isNull);
    expect(safeExternalUri('intent://evil.example'), isNull);
    expect(safeExternalUri('https://user@evil.example'), isNull);
    expect(
      safeExternalUri(
        '/bantuan',
        baseUrl: 'https://guruspaceai.cloud',
      )?.toString(),
      'https://guruspaceai.cloud/bantuan',
    );
    expect(
      isSameOriginAppUri(
        Uri.parse('https://guruspaceai.cloud/api/media/a.png'),
        baseUrl: 'https://guruspaceai.cloud',
      ),
      isTrue,
    );
    expect(
      isSameOriginAppUri(
        Uri.parse('https://guruspaceai.cloud.evil.example/a'),
        baseUrl: 'https://guruspaceai.cloud',
      ),
      isFalse,
    );
  });

  testWidgets('splash UKHUWAH selesai lalu exit', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    var finished = false;
    await tester.pumpWidget(
      MaterialApp(home: GenProSplashScreen(onFinished: () => finished = true)),
    );
    await tester.pump();
    expect(find.byKey(const Key('genpro-splash')), findsOneWidget);
    expect(
      tester.widget<Scaffold>(find.byType(Scaffold)).backgroundColor,
      const Color(0xFFFFFFFF),
    );
    expect(find.byKey(const Key('splash-powered-by')), findsOneWidget);
    expect(find.text("Powered by iBaenk's"), findsOneWidget);

    final splashContext = tester.element(
      find.byKey(const Key('genpro-splash')),
    );
    await tester.runAsync(
      () => precacheImage(
        const AssetImage(GenProSplashScreen.logoAsset),
        splashContext,
      ),
    );
    await tester.pump();
    await tester.pump(GenProSplashScreen.duration);
    await tester.pump(GenProSplashScreen.duration);
    await tester.pump(GenProSplashScreen.exitDuration);
    await tester.pump(GenProSplashScreen.exitDuration);
    await tester.pump();
    expect(finished, isTrue);
    expect(tester.takeException(), isNull);
  });

  test('role API dipetakan dengan benar', () {
    expect(UserRole.fromApi('STUDENT'), UserRole.student);
    expect(UserRole.fromApi('TEACHER'), UserRole.teacher);
    expect(UserRole.fromApi('INVALID'), UserRole.unknown);
  });

  test('locale Indonesia dan banner server dipetakan dengan benar', () async {
    await initializeDateFormatting('id_ID');
    expect(DateFormat('E', 'id_ID').format(DateTime(2026, 7, 30)), isNotEmpty);

    final display = MobileBannerDisplay.fromJson({
      'banners': {
        'enabled': true,
        'autoPlayMs': 4200,
        'slides': [
          {
            'id': 'banner-1',
            'type': 'image',
            'mediaUrl': '/uploads/banner.jpg',
            'title': 'Informasi GuruSpace',
          },
        ],
      },
    });
    expect(display.autoPlayMs, 4200);
    expect(display.slides.single.title, 'Informasi GuruSpace');

    final branding = MobileBrandingDisplay.fromJson({
      'branding': {
        'appName': 'GuruSpace Kalsel',
        'logoUrl': '/uploads/logo-app.png',
        'authLogoUrl': '/uploads/logo-login.png',
      },
    });
    expect(branding.appName, 'GuruSpace Kalsel');
    expect(branding.loginLogoUrl, '/uploads/logo-login.png');
  });

  test('status member dan konfigurasi popup dipetakan dari API', () {
    final user = AppUser.fromJson({
      'id': 'guru-1',
      'email': 'guru@example.com',
      'name': 'Guru Demo',
      'role': 'TEACHER',
      'membershipPlan': {
        'name': 'Guru Pro',
        'slug': 'guru-pro',
        'status': 'active',
        'isActive': true,
      },
    });
    final popup = MobilePopupDisplay.fromJson({
      'popup': {
        'enabled': true,
        'revision': 'promo-juli',
        'slides': [
          {'id': 'promo-1', 'type': 'video', 'mediaUrl': '/uploads/promo.mp4'},
        ],
      },
    });

    expect(user.membershipPlan?.name, 'Guru Pro');
    expect(popup.enabled, isTrue);
    expect(popup.slides.single.type, 'video');
    expect(popup.campaignSignature, contains('promo-juli'));
  });

  test('ikon menu cepat memakai revision dan mengabaikan key asing', () {
    final display = MobileAppDisplay.fromJson({
      'quickMenuIcons': {
        'revision': 'menu-v2',
        'icons': {
          'attendance': '/uploads/app-display/quick-menu-icon/absensi.png',
          'unknown': 'https://evil.example/icon.png',
        },
      },
    });

    expect(
      display.quickMenuIcons.urlFor('attendance'),
      '/uploads/app-display/quick-menu-icon/absensi.png?v=menu-v2',
    );
    expect(display.quickMenuIcons.urlFor('assignments'), isEmpty);
    expect(display.quickMenuIcons.icons.containsKey('unknown'), isFalse);
  });

  testWidgets('ikon menu cepat kembali ke aset lokal saat jaringan gagal', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: QuickMenuGrid(
            dense: true,
            frameless: true,
            items: const [
              QuickMenuItem(
                label: 'Absensi',
                icon: Icons.event_available_rounded,
                color: AppColors.blue,
                assetPath: 'assets/icons/menu/absensi.png',
                iconUrl: 'https://invalid.example/icon.png?v=test',
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('quick-menu-asset-Absensi')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('logo UKHUWAH tampil pada design system', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(body: Center(child: AppLogo())),
      ),
    );

    expect(find.text('UKHUWAH'), findsOneWidget);
  });

  testWidgets('shell siswa memakai identitas dan navigasi komersial', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          appBar: const MobileWebHeader(showMenu: true),
          body: const SingleChildScrollView(
            padding: EdgeInsets.all(16),
            child: StudentIdentityCard(
              name: 'Siswa Demo',
              className: 'XII IPA 1',
              schoolName: 'SMA Negeri Demo',
              teacherName: 'Guru Demo',
              attendancePercent: 96,
            ),
          ),
          bottomNavigationBar: MobileWebBottomNav(
            index: 0,
            onChanged: (_) {},
            items: const [
              WebBottomNavItem(label: 'Beranda', icon: Icons.home_outlined),
              WebBottomNavItem(
                label: 'PJJ',
                icon: Icons.video_camera_front_outlined,
              ),
              WebBottomNavItem(
                label: 'Belajar',
                icon: Icons.menu_book_outlined,
              ),
              WebBottomNavItem(
                label: 'Kehadiran',
                icon: Icons.person_pin_circle_outlined,
              ),
              WebBottomNavItem(label: 'Nilai', icon: Icons.bar_chart_rounded),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Siswa Demo'), findsOneWidget);
    expect(find.text('96%'), findsOneWidget);
    expect(find.text('Beranda'), findsOneWidget);
    expect(find.text('Nilai'), findsOneWidget);
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/student_mobile_shell.png'),
    );
  });

  testWidgets('dashboard siswa mengikuti papan acuan Flutter', (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final dashboard = StudentDashboard.fromJson({
      'student': {
        'name': 'Nabila',
        'classRoom': {
          'name': 'XI IPA 1',
          'school': {'id': 'school-bandung', 'name': 'SMA Negeri 1 Bandung'},
          'teacher': {'name': 'Pak Budi'},
        },
      },
      'summary': {
        'pendingAssignments': 5,
        'attendancePercent': 93,
        'averageScore': 86.7,
        'followerCount': 128,
      },
      'assignments': [
        {
          'id': 'assignment-1',
          'title': 'Persamaan Kuadrat',
          'mapel': 'Matematika',
          'dueDate': '2026-08-24T23:59:00.000Z',
          'submissions': [],
        },
      ],
      'quizzes': [],
      'exams': [],
      'attendance': [
        {
          'status': 'PRESENT',
          '_count': {'_all': 20},
        },
      ],
      'upcomingPjj': [
        {
          'id': 'pjj-1',
          'title': 'Sistem Persamaan Linear',
          'subject': 'Matematika',
          'scheduledStart': '2099-08-24T09:00:00.000Z',
          'scheduledEnd': '2099-08-24T10:30:00.000Z',
          'status': 'SCHEDULED',
          'createdBy': {'name': 'Pak Budi'},
        },
      ],
      'tkaPackages': [
        {
          'id': 'tka-1',
          'title': 'Simulasi TKA Numerasi',
          'subject': {'name': 'Matematika'},
          'durationMinutes': 60,
          '_count': {'questions': 30},
          'attempts': [],
        },
      ],
      'reading': [],
      'boardPosts': [
        {
          'id': 'board-2',
          'title': 'Robot Penyiram Tanaman Karya Siswa',
          'category': 'Artikel Siswa',
          'content': 'Karya inovasi siswa untuk lingkungan sekolah.',
          'publishedAt': '2026-08-24T08:30:00.000Z',
          'student': {'name': 'Nabila'},
          'classRoom': {
            'school': {'id': 'school-bandung', 'name': 'SMA Negeri 1 Bandung'},
          },
        },
        {
          'id': 'board-1',
          'title': 'Libur Hari Raya Idul Adha',
          'category': 'Pengumuman',
          'content': 'Informasi kegiatan sekolah.',
          'publishedAt': '2026-08-24T06:30:00.000Z',
          'author': {'name': 'SMA Negeri 1 Bandung'},
        },
      ],
      'spotlight': [
        {
          'id': 'spotlight-1',
          'caption': 'Eksperimen sains',
          'videoUrl': '/uploads/spotlight-1.mp4',
          'publishedAt': '2026-08-24T07:00:00.000Z',
          'student': {'name': 'Nabila'},
        },
        {
          'id': 'spotlight-2',
          'caption': 'Latihan basket',
          'videoUrl': '/uploads/spotlight-2.mp4',
          'publishedAt': '2026-08-24T07:00:00.000Z',
          'student': {'name': 'Raka'},
        },
        {
          'id': 'spotlight-3',
          'caption': 'Karya seni kelas',
          'videoUrl': '/uploads/spotlight-3.mp4',
          'publishedAt': '2026-08-24T07:00:00.000Z',
          'student': {'name': 'Aulia'},
        },
      ],
    });
    const user = AppUser(
      id: 'student-1',
      email: 'nabila@student.sch.id',
      name: 'Nabila',
      role: UserRole.student,
    );
    final popup = MobilePopupDisplay.fromJson({
      'popup': {'enabled': false, 'slides': []},
    });
    final banner = MobileBannerDisplay.fromJson({
      'banners': {'enabled': false, 'slides': []},
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          studentDashboardProvider.overrideWith((ref) async => dashboard),
          studentMadingProvider.overrideWith(
            (ref) async => dashboard.boardPosts,
          ),
          mobilePopupProvider.overrideWith((ref) async => popup),
          mobileBannerProvider.overrideWith((ref) async => banner),
        ],
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          home: const StudentApp(user: user),
        ),
      ),
    );
    await tester.pump();
    final studentContext = tester.element(find.byType(StudentApp));
    await tester.runAsync(() async {
      await precacheImage(
        const AssetImage('assets/images/student_home_banner.png'),
        studentContext,
      );
      await precacheImage(
        const AssetImage('assets/images/student_home_banner_science.png'),
        studentContext,
      );
      await precacheImage(
        const AssetImage('assets/images/student_home_banner_creative.png'),
        studentContext,
      );
    });
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.byType(StudentProfileHero), findsOneWidget);
    expect(find.byKey(const Key('student-home-header')), findsOneWidget);
    expect(
      find.byKey(const Key('student-header-notifications')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('student-header-profile')), findsOneWidget);
    expect(find.byKey(const Key('student-profile-button')), findsNothing);
    expect(find.text('Siswa • XI IPA 1'), findsOneWidget);
    expect(find.text('128'), findsOneWidget);
    expect(find.text('Pengikut'), findsOneWidget);
    expect(find.text('93%'), findsOneWidget);
    expect(find.byType(MobileBannerCarousel), findsOneWidget);
    expect(find.byType(QuickMenuGrid), findsOneWidget);
    expect(
      tester.widget<QuickMenuGrid>(find.byType(QuickMenuGrid)).frameless,
      isTrue,
    );
    expect(find.byType(PageView), findsOneWidget);
    expect(find.text('Festival Literasi Sekolah'), findsNothing);
    expect(
      find.descendant(
        of: find.byType(QuickMenuGrid),
        matching: find.text('Quiz'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(QuickMenuGrid),
        matching: find.text('Jadwal'),
      ),
      findsNothing,
    );
    expect(find.text('Zona Kreasi'), findsWidgets);
    expect(find.text('Zona Kreasi Terbaru'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(QuickMenuGrid),
        matching: find.text('PJJ'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(QuickMenuGrid),
        matching: find.text('TKA'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(QuickMenuGrid),
        matching: find.text('Notifikasi'),
      ),
      findsNothing,
    );
    expect(
      tester.getTopLeft(find.byType(MobileBannerCarousel)).dy,
      greaterThan(tester.getTopLeft(find.byType(QuickMenuGrid)).dy),
    );
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('goldens/student_dashboard_reference.png'),
    );

    await tester.tap(
      find.descendant(
        of: find.byType(QuickMenuGrid),
        matching: find.text('Quiz'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student-quiz-page')), findsOneWidget);
    expect(find.text('Quiz Tersedia'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();

    await tester.tap(
      find.descendant(
        of: find.byType(QuickMenuGrid),
        matching: find.text('TKA'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student-tka-page')), findsOneWidget);
    expect(find.text('Simulasi TKA'), findsOneWidget);
    expect(find.text('Simulasi TKA Numerasi'), findsOneWidget);
    expect(find.text('30 soal'), findsOneWidget);
    expect(find.text('60 menit'), findsOneWidget);
    expect(find.text('Mulai Simulasi'), findsOneWidget);
    expect(find.text('Pilih jenis evaluasi'), findsNothing);
    expect(find.byType(SegmentedButton<int>), findsNothing);
    await expectLater(
      find.byKey(const Key('student-tka-page')),
      matchesGoldenFile('goldens/student_tka_page.png'),
    );
    await tester.pageBack();
    await tester.pumpAndSettle();

    await tester.drag(
      find.byType(CustomScrollView).first,
      const Offset(0, -280),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const Key('student-home-spotlight-spotlight-2')),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.byKey(const Key('student-spotlight-header')), findsNothing);
    final spotlightPageView = tester.widget<PageView>(
      find.byKey(const Key('student-spotlight-reels')),
    );
    expect(spotlightPageView.controller?.page, moreOrLessEquals(1));
    await tester.fling(
      find.byKey(const Key('student-spotlight-reels')),
      const Offset(0, -700),
      1600,
    );
    await tester.pump(const Duration(seconds: 1));
    expect(spotlightPageView.controller?.page, greaterThan(1.8));
    await tester.tap(find.byKey(const Key('student-bottom-beranda')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.byKey(const Key('student-home-header')), findsOneWidget);
    expect(find.byType(StudentProfileHero), findsOneWidget);

    await tester.drag(
      find.byType(CustomScrollView).first,
      const Offset(0, -320),
    );
    await tester.pumpAndSettle();
    expect(find.text('Mading Terbaru'), findsOneWidget);
    expect(
      find.byKey(const Key('student-home-mading-thumbnails')),
      findsOneWidget,
    );
    expect(find.text('Robot Penyiram Tanaman Karya Siswa'), findsOneWidget);
    expect(find.byKey(const Key('student-home-mading-school')), findsOneWidget);
    expect(find.text('SMA Negeri 1 Bandung'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const Key('student-home-mading-thumbnails')),
        matching: find.text('Libur Hari Raya Idul Adha'),
      ),
      findsNothing,
    );
    await expectLater(
      find.byKey(const Key('student-home-mading-thumbnails')),
      matchesGoldenFile('goldens/student_home_mading_latest.png'),
    );
    await tester.drag(
      find.byType(CustomScrollView).first,
      const Offset(0, 600),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('student-header-profile')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student-profile-hero')), findsOneWidget);
    expect(find.text('SMA Negeri 1 Bandung'), findsWidgets);
    expect(find.byType(BackButton), findsNothing);
    expect(find.byKey(const Key('student-bottom-profil')), findsOneWidget);
    await tester.tap(find.byKey(const Key('student-bottom-beranda')));
    await tester.pumpAndSettle();
    expect(find.byType(StudentProfileHero), findsOneWidget);

    await tester.tap(find.byKey(const Key('student-header-notifications')));
    await tester.pumpAndSettle();
    expect(find.byType(NotificationsScreen), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student-home-header')), findsOneWidget);

    expect(find.byKey(const Key('student-bottom-tugas')), findsOneWidget);
    for (final label in const [
      'Absensi',
      'Tugas',
      'Quiz',
      'PJJ',
      'TKA',
      'Zona Baca',
      'Zona Kreasi',
      'Mading',
    ]) {
      expect(find.byKey(ValueKey('quick-menu-asset-$label')), findsOneWidget);
    }
    expect(find.byKey(const Key('student-bottom-profil')), findsOneWidget);
    expect(find.byKey(const Key('student-bottom-zona-baca')), findsNothing);
    await tester.tap(find.byKey(const Key('student-bottom-tugas')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student-assignments-page')), findsOneWidget);
    expect(find.text('Persamaan Kuadrat'), findsOneWidget);
    await tester.tap(find.byTooltip('Kembali'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('student-bottom-profil')));
    await tester.pumpAndSettle();
    expect(find.text('SMA Negeri 1 Bandung'), findsWidgets);
    expect(find.text('Profil'), findsWidgets);
    expect(find.text('Tentang saya'), findsOneWidget);
    expect(find.byKey(const Key('student-profile-stats')), findsOneWidget);
    expect(
      find.byKey(const Key('student-profile-personal-info')),
      findsOneWidget,
    );
    expect(find.text('nabila@student.sch.id'), findsOneWidget);
    expect(find.text('Kehadiran'), findsWidgets);
    expect(find.text('Pengikut'), findsOneWidget);
    expect(find.text('Akun'), findsOneWidget);
    expect(find.text('Ganti password'), findsOneWidget);
    expect(find.text('Keluar'), findsOneWidget);
    expect(find.byKey(const Key('student-profile-edit')), findsOneWidget);
    expect(
      find.byKey(const Key('student-profile-change-photo')),
      findsOneWidget,
    );
    final changePhotoRect = tester.getRect(
      find.byKey(const Key('student-profile-change-photo')),
    );
    final cameraBadgeCenter = tester.getCenter(
      find.byKey(const Key('student-profile-camera-badge')),
    );
    expect(changePhotoRect.contains(cameraBadgeCenter), isTrue);
    expect(
      find.byKey(const Key('student-profile-change-password')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('student-profile-privacy-policy')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('student-profile-ad-privacy')), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('goldens/student_profile_reference.png'),
    );

    final updatedAvatarBytes = base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    );
    tester
        .widget<StudentProfileScreen>(find.byType(StudentProfileScreen))
        .onUserChanged
        ?.call(
          user.copyWith(
            avatarUrl: 'https://guruspaceai.cloud/uploads/avatars/new.png',
            avatarBytes: updatedAvatarBytes,
          ),
        );
    await tester.pump();

    final replacementAvatarBytes = Uint8List.fromList(updatedAvatarBytes);
    tester
        .widget<StudentProfileScreen>(find.byType(StudentProfileScreen))
        .onUserChanged
        ?.call(
          user.copyWith(
            avatarUrl: 'https://guruspaceai.cloud/uploads/avatars/new.png',
            avatarBytes: replacementAvatarBytes,
          ),
        );
    await tester.pump();
    final refreshedProfileAvatar = tester.widget<Image>(
      find.byKey(const Key('student-profile-avatar-bytes')),
    );
    expect(
      (refreshedProfileAvatar.image as MemoryImage).bytes,
      same(replacementAvatarBytes),
    );

    expect(find.textContaining('Email'), findsWidgets);
    expect(find.text('nabila@student.sch.id'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const Key('student-profile-logout')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('student-profile-logout')));
    await tester.pumpAndSettle();
    expect(find.text('Keluar dari akun?'), findsOneWidget);
    await tester.tap(find.text('Batal'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('student-bottom-beranda')));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const Key('student-home-avatar-preview')),
      findsOneWidget,
    );
    final dashboardAvatar = tester.widget<Image>(
      find.byKey(const Key('student-home-avatar-preview')),
    );
    expect(dashboardAvatar.width, double.infinity);
    expect(dashboardAvatar.height, double.infinity);
    expect(dashboardAvatar.image, isA<MemoryImage>());
    expect(
      (dashboardAvatar.image as MemoryImage).bytes,
      same(replacementAvatarBytes),
    );

    await tester.tap(find.byKey(const Key('student-bottom-profil')));
    await tester.pumpAndSettle();
    final profileAvatar = tester.widget<Image>(
      find.byKey(const Key('student-profile-avatar-bytes')),
    );
    expect(profileAvatar.image, isA<MemoryImage>());
    expect(
      (profileAvatar.image as MemoryImage).bytes,
      same(replacementAvatarBytes),
    );
    await tester.tap(find.byKey(const Key('student-bottom-beranda')));
    await tester.pumpAndSettle();

    await tester.tap(
      find.descendant(
        of: find.byType(MobileWebBottomNav),
        matching: find.byIcon(Icons.newspaper_outlined),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student-mading-header')), findsNothing);
    expect(find.byKey(const Key('student-mading-filters')), findsOneWidget);
    expect(find.byKey(const Key('student-mading-create')), findsOneWidget);
    expect(find.text('Semua'), findsOneWidget);
    expect(find.text('Sekolahku'), findsOneWidget);
    expect(find.text('Pengumuman'), findsWidgets);
    expect(find.text('Libur Hari Raya Idul Adha'), findsOneWidget);
    expect(find.byKey(const Key('student-home-back')), findsNothing);
    final selectedCategory = tester.widget<ChoiceChip>(
      find.ancestor(of: find.text('Semua'), matching: find.byType(ChoiceChip)),
    );
    expect(selectedCategory.selected, isTrue);
    expect(selectedCategory.selectedColor, const Color(0xFFDCEAFF));
    await tester.tap(find.text('Sekolahku'));
    await tester.pumpAndSettle();
    expect(find.text('Robot Penyiram Tanaman Karya Siswa'), findsOneWidget);
    expect(find.text('Libur Hari Raya Idul Adha'), findsNothing);
    await tester.tap(find.text('Semua'));
    await tester.pumpAndSettle();
    expect(
      tester.getSize(find.byKey(const Key('student-mading-create'))).width,
      lessThanOrEqualTo(54),
    );
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('goldens/student_mading_reference.png'),
    );
    expect(find.byKey(const Key('student-mading-search')), findsNothing);
    expect(find.byKey(const Key('student-mading-notifications')), findsNothing);
    expect(find.text('Libur Hari Raya Idul Adha'), findsOneWidget);
    await tester.tap(find.byKey(const Key('student-bottom-beranda')));
    await tester.pumpAndSettle();
    expect(find.byType(StudentProfileHero), findsOneWidget);

    await tester.tap(find.byKey(const Key('student-bottom-zona-kreasi')));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.byKey(const Key('student-spotlight-header')), findsNothing);
    expect(find.byKey(const Key('student-home-back')), findsNothing);
    expect(find.byKey(const Key('student-spotlight-grid')), findsOneWidget);
    expect(find.byKey(const Key('student-spotlight-reels')), findsNothing);
    await tester.tap(find.byKey(const Key('student-bottom-beranda')));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.byType(StudentProfileHero), findsOneWidget);

    await tester.tap(find.byKey(const Key('student-bottom-tugas')));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.byKey(const Key('student-assignments-page')), findsOneWidget);
    expect(find.text('Persamaan Kuadrat'), findsOneWidget);

    await tester.tap(find.byKey(const Key('student-bottom-beranda')));
    await tester.pump(const Duration(milliseconds: 500));
    final pjjMenu = find.descendant(
      of: find.byType(QuickMenuGrid),
      matching: find.text('PJJ'),
    );
    await tester.ensureVisible(pjjMenu);
    tester
        .widget<InkWell>(
          find.ancestor(of: pjjMenu, matching: find.byType(InkWell)).first,
        )
        .onTap!();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Pembelajaran Jarak Jauh'), findsWidgets);
    expect(find.text('Sistem Persamaan Linear'), findsOneWidget);
    final joinClassButton = find.widgetWithText(FilledButton, 'Masuk kelas');
    expect(joinClassButton, findsOneWidget);
    await tester.ensureVisible(joinClassButton);
    await tester.tap(joinClassButton);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Kelas belum dibuka'), findsOneWidget);
    expect(find.text('Mengerti'), findsOneWidget);
    await tester.tap(find.text('Mengerti'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('goldens/student_pjj_reference.png'),
    );
  });

  testWidgets('navigasi guru menonjolkan Assistant', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          bottomNavigationBar: MobileWebBottomNav(
            index: 2,
            onChanged: (_) {},
            items: const [
              WebBottomNavItem(label: 'Beranda', icon: Icons.home_outlined),
              WebBottomNavItem(
                label: 'Zona Kreasi',
                icon: Icons.play_circle_outline_rounded,
              ),
              WebBottomNavItem(
                label: 'Assistant',
                icon: Icons.auto_awesome_rounded,
                primary: true,
              ),
              WebBottomNavItem(
                label: 'Pesan',
                icon: Icons.chat_bubble_outline_rounded,
              ),
              WebBottomNavItem(label: 'Menu', icon: Icons.grid_view_rounded),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Assistant'), findsOneWidget);
    expect(find.text('Zona Kreasi'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('card guru menampilkan badge member dari sesi', (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: TeacherProfileHero(
              name: 'Rina Puspitasari',
              schoolName: 'SMA Negeri 1 Banjarmasin',
              classCount: 2,
              studentCount: 60,
              credits: 125000,
              classNames: const ['X IPA 1', 'XI IPA 2'],
              membershipPlanName: 'Platinum',
              onTopUp: () {},
              onHistory: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Member Platinum'), findsOneWidget);
    expect(find.text('125.000'), findsOneWidget);
    expect(find.byIcon(Icons.workspace_premium_rounded), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/teacher_profile_member_card.png'),
    );
  });

  testWidgets('dashboard guru mengikuti komposisi mockup komersial', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const menus = [
      QuickMenuItem(
        label: 'Kelas',
        subtitle: 'Kelola kelas',
        icon: Icons.school_outlined,
        color: AppColors.blue,
      ),
      QuickMenuItem(
        label: 'Jurnal',
        subtitle: 'Jurnal mengajar',
        icon: Icons.menu_book_outlined,
        color: AppColors.blue,
      ),
      QuickMenuItem(
        label: 'Absensi',
        subtitle: 'Absensi siswa',
        icon: Icons.fact_check_outlined,
        color: AppColors.success,
      ),
      QuickMenuItem(
        label: 'Penilaian',
        subtitle: 'Input nilai',
        icon: Icons.assignment_turned_in_outlined,
        color: AppColors.blue,
      ),
      QuickMenuItem(
        label: 'Dokumen',
        subtitle: 'Materi & file',
        icon: Icons.folder_outlined,
        color: AppColors.blue,
      ),
      QuickMenuItem(
        label: 'PJJ',
        subtitle: 'Kelas online',
        icon: Icons.video_camera_front_outlined,
        color: AppColors.blue,
      ),
    ];

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          appBar: const MobileWebHeader(notificationCount: 3),
          body: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 100),
              child: Column(
                children: [
                  TeacherProfileHero(
                    name: 'Rina Puspitasari',
                    schoolName: 'SMA Negeri 1 Banjarmasin',
                    classCount: 2,
                    studentCount: 60,
                    credits: 125000,
                    classNames: const ['X IPA 1', 'XI IPA 2'],
                    membershipPlanName: 'Platinum',
                    onTopUp: () {},
                    onHistory: () {},
                  ),
                  const SizedBox(height: 18),
                  const QuickMenuGrid(items: menus),
                  const SizedBox(height: 24),
                  const InsightStrip(
                    title: 'Insight Aktivitas',
                    period: '7 hari terakhir',
                    items: [
                      InsightMetric(
                        label: 'Materi',
                        value: '12',
                        helper: 'Dibagikan',
                        icon: Icons.menu_book_outlined,
                        color: AppColors.blue,
                      ),
                      InsightMetric(
                        label: 'Kehadiran',
                        value: '95%',
                        helper: '7 hari',
                        icon: Icons.event_available_outlined,
                        color: AppColors.success,
                      ),
                      InsightMetric(
                        label: 'Dinilai',
                        value: '28',
                        helper: 'Tugas',
                        icon: Icons.rate_review_outlined,
                        color: AppColors.warning,
                      ),
                      InsightMetric(
                        label: 'Siswa',
                        value: '60',
                        helper: 'Aktif',
                        icon: Icons.forum_outlined,
                        color: AppColors.violet,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          bottomNavigationBar: MobileWebBottomNav(
            index: 0,
            onChanged: (_) {},
            items: const [
              WebBottomNavItem(label: 'Beranda', icon: Icons.home_outlined),
              WebBottomNavItem(
                label: 'Zona Kreasi',
                icon: Icons.play_circle_outline_rounded,
              ),
              WebBottomNavItem(
                label: 'Assistant',
                icon: Icons.auto_awesome_rounded,
                primary: true,
              ),
              WebBottomNavItem(
                label: 'Pesan',
                icon: Icons.chat_bubble_outline_rounded,
              ),
              WebBottomNavItem(label: 'Menu', icon: Icons.grid_view_rounded),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Rina Puspitasari'), findsOneWidget);
    expect(find.text('Insight Aktivitas'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/teacher_commercial_dashboard.png'),
    );
  });

  testWidgets('banner autoplay berlanjut tanpa animasi balik', (tester) async {
    final display = MobileBannerDisplay.fromJson({
      'banners': {
        'enabled': true,
        'autoPlayMs': 2500,
        'slides': [
          {
            'id': 'banner-1',
            'type': 'image',
            'mediaUrl': 'https://example.invalid/banner-1.jpg',
          },
          {
            'id': 'banner-2',
            'type': 'image',
            'mediaUrl': 'https://example.invalid/banner-2.jpg',
          },
        ],
      },
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: MobileBannerCarousel(display: display)),
      ),
    );

    expect(find.bySemanticsLabel('Banner 1, aktif'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 2500));
    await tester.pump(const Duration(milliseconds: 550));
    expect(find.bySemanticsLabel('Banner 2, aktif'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('popup ads tampil dan dapat ditutup', (tester) async {
    final popup = MobilePopupDisplay.fromJson({
      'popup': {
        'enabled': true,
        'revision': 'promo-test',
        'slides': [
          {
            'id': 'promo-1',
            'type': 'image',
            'mediaUrl': 'https://example.invalid/promo.jpg',
            'title': 'Promo GuruSpace',
          },
        ],
      },
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: [mobilePopupProvider.overrideWith((ref) async => popup)],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const DashboardPopupAdHost(
            child: Scaffold(body: Text('Dashboard')),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Promo GuruSpace'), findsOneWidget);
    await tester.tap(find.text('Tutup'));
    await tester.pump();
    expect(find.text('Promo GuruSpace'), findsNothing);
    expect(find.text('Dashboard'), findsOneWidget);
  });

  testWidgets('Assistant mobile menjalankan workflow bertombol', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    AssistantWorkflow workflow(String id, String title) => AssistantWorkflow(
      id: id,
      title: title,
      description: 'Dokumen dan rekomendasi untuk kebutuhan guru.',
      goal: 'Siapkan perangkat pembelajaran secara terarah.',
      items: const [
        AssistantWorkflowItem(
          note: 'Dokumen prioritas untuk workflow ini.',
          required: true,
          tool: AssistantTool(
            slug: 'modul-ajar',
            name: 'Modul Ajar / RPP',
            description: 'Dokumen siap pakai.',
            creditCost: 2,
            steps: [],
          ),
        ),
      ],
    );

    final bootstrap = AssistantBootstrap(
      canUse: true,
      credits: 25,
      profileDefaults: const {},
      documents: const [],
      dynamicOptions: const {},
      tools: const [],
      workflows: [
        workflow('semester', 'Persiapan Semester'),
        workflow('mengajar', 'Persiapan Mengajar'),
        workflow('evaluasi', 'Evaluasi Pembelajaran'),
        workflow('ujian', 'Persiapan Ujian'),
        workflow('tindak-lanjut', 'Tindak Lanjut Nilai'),
        workflow('administrasi', 'Administrasi Kelas'),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          assistantBootstrapProvider.overrideWith((ref) async => bootstrap),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(body: TeacherAssistantScreen()),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 140));

    expect(find.text('AI Assistant'), findsOneWidget);
    expect(
      find.text(
        'Halo Bapak/Ibu Guru. Hari ini ingin saya bantu menyiapkan apa?',
      ),
      findsNothing,
    );
    expect(find.text('menyiapkan pilihan...'), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Persiapan Mengajar'), findsOneWidget);
    final conversation = tester.widget<ListView>(
      find.byKey(const Key('assistant-conversation-list')),
    );
    expect(conversation.controller!.position.extentAfter, lessThan(2));
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Persiapan Mengajar'));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Saya sedang menganalisis...'), findsOneWidget);
    expect(
      find.text('Saya membaca kebutuhan workflow dan dokumen yang relevan.'),
      findsNothing,
    );
    await tester.pump(const Duration(milliseconds: 800));
    expect(
      find.text('Saya membaca kebutuhan workflow dan dokumen yang relevan.'),
      findsOneWidget,
    );
    expect(conversation.controller!.position.extentAfter, lessThan(2));
    await tester.pump(const Duration(milliseconds: 350));
    expect(
      find.text(
        'Saya mengecek arsip dokumen Bapak/Ibu yang sudah dibuat atau masih draft.',
      ),
      findsNothing,
    );
    await tester.pump(const Duration(milliseconds: 1000));
    expect(
      find.text(
        'Saya mengecek arsip dokumen Bapak/Ibu yang sudah dibuat atau masih draft.',
      ),
      findsOneWidget,
    );
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/teacher_assistant_workflow.png'),
    );
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('Zona Kreasi kosong tampil sebagai halaman komersial', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    var createTapped = false;
    var refreshTapped = false;
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          body: SpotlightEmptyState(
            onCreate: () => createTapped = true,
            onRefresh: () => refreshTapped = true,
          ),
        ),
      ),
    );
    await tester.pump();

    expect(
      find.text('Panggung inspirasi guru\ndimulai dari Anda'),
      findsOneWidget,
    );
    expect(find.text('Buat Zona Kreasi Pertama'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/teacher_spotlight_empty.png'),
    );

    await tester.tap(find.byKey(const Key('spotlight-empty-create')));
    await tester.tap(find.byKey(const Key('spotlight-empty-refresh')));
    expect(createTapped, isTrue);
    expect(refreshTapped, isTrue);
  });

  testWidgets('popup menu guru memuat kelompok web mobile lengkap', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const user = AppUser(
      id: 'teacher-1',
      email: 'guru@guruspace.id',
      name: 'Rina Puspitasari',
      role: UserRole.teacher,
      creditsRemaining: 125,
      membershipPlan: MembershipPlan(
        name: 'Platinum',
        slug: 'platinum',
        status: 'active',
        isActive: true,
      ),
    );

    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(body: TeacherMenuSheet(user: user)),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 900));

    expect(find.text('Semua fitur GuruSpace'), findsOneWidget);
    expect(find.text('Rina Puspitasari'), findsOneWidget);
    expect(find.text('125 kredit'), findsOneWidget);
    expect(find.text('AI Generator'), findsOneWidget);
    expect(find.text('Perangkat Ajar'), findsWidgets);
    expect(find.text('Modul Ajar / RPP'), findsOneWidget);
    await tester.tap(find.text('7 generator tersedia'));
    await tester.pump(const Duration(milliseconds: 320));
    expect(find.text('Modul Ajar / RPP'), findsNothing);
    await tester.tap(find.text('7 generator tersedia'));
    await tester.pumpAndSettle();
    expect(find.text('Modul Ajar / RPP'), findsOneWidget);
    expect(
      find.byWidgetPredicate(
        (widget) => widget is InkWell && widget.onTap != null,
      ),
      findsWidgets,
    );
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/teacher_menu_sheet.png'),
    );

    await tester.drag(find.byType(ListView).last, const Offset(0, -1600));
    await tester.pumpAndSettle();
    expect(find.text('Akun & Benefit'), findsOneWidget);
    expect(find.text('Afiliasi'), findsOneWidget);
    expect(find.text('Pengaturan'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Zona Kreasi memakai komposisi vertikal seperti Reels', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final post = SpotlightPost.fromJson({
      'id': 'spot-1',
      'caption':
          'Membuat pembelajaran berdiferensiasi menjadi lebih dekat, aktif, dan menyenangkan untuk semua siswa.',
      'videoUrl': 'https://cdn.guruspace.id/video.mp4',
      'viewCount': 1248,
      'createdAt': DateTime.now()
          .subtract(const Duration(hours: 2))
          .toIso8601String(),
      'author': {'id': 'teacher-1', 'name': 'Rina Puspitasari'},
      'likeCount': 128,
      'commentCount': 24,
      'likedByMe': true,
    });

    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: Colors.black,
          body: Stack(
            children: [
              SpotlightReelSlide(
                post: post,
                repository: const SpotlightRepository.preview(),
                isActive: true,
                shouldLoad: true,
                initializeVideo: false,
                mediaPlaceholder: const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF172554), Color(0xFF0F766E)],
                    ),
                  ),
                  child: Center(
                    child: Icon(
                      Icons.play_circle_fill_rounded,
                      color: Colors.white30,
                      size: 88,
                    ),
                  ),
                ),
                isAuthor: false,
                onDelete: () {},
                onCommentCountChanged: (_) {},
              ),
              SpotlightTopBar(onBack: () {}, onCreate: () {}),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Rina Puspitasari'), findsOneWidget);
    expect(find.text('128'), findsOneWidget);
    expect(find.text('24'), findsOneWidget);
    expect(find.text('1.248\ntayangan'), findsOneWidget);
    expect(find.byKey(const Key('spotlight-like')), findsOneWidget);
    expect(find.byKey(const Key('spotlight-comments')), findsOneWidget);
    expect(find.byKey(const Key('spotlight-progress')), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/teacher_spotlight_reel_upload.png'),
    );
  });

  testWidgets('Tugas menggunakan halaman khusus tanpa tab belajar gabungan', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final dashboard = StudentDashboard.fromJson({
      'student': {'name': 'Nabila', 'classRoom': const {}},
      'summary': const {},
      'assignments': [
        {
          'id': 'task-1',
          'title': 'Latihan Persamaan Kuadrat',
          'mapel': 'Matematika',
          'dueDate': '2030-08-20T23:59:00.000Z',
          'submissions': const [],
        },
      ],
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          studentDashboardProvider.overrideWith((ref) async => dashboard),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const StudentAssignmentsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('student-assignments-page')), findsOneWidget);
    expect(find.text('Latihan Persamaan Kuadrat'), findsOneWidget);
    expect(find.text('Daftar Tugas'), findsOneWidget);
    expect(find.byType(SegmentedButton<int>), findsNothing);
    await expectLater(
      find.byKey(const Key('student-assignments-page')),
      matchesGoldenFile('goldens/student_assignments_page.png'),
    );
  });

  testWidgets('sumber ebook eksternal tetap tersedia tanpa WebView berbahaya', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: StudentEbookReaderScreen(
            document: StudentEbookDocument(
              id: 'external-book',
              title: 'Sumber Resmi',
              author: 'Perpustakaan',
              category: 'Referensi',
              contentType: 'LINK',
              pageCount: 1,
              progress: 0,
              currentPage: 1,
              contentUrl: 'https://example.com/bacaan',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Bacaan tersedia di sumber eksternal'), findsOneWidget);
    expect(
      find.byKey(const Key('open-external-reading-source')),
      findsOneWidget,
    );
    expect(find.byType(WebViewWidget), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Quiz menggunakan halaman khusus dengan hasil dan quiz tersedia',
    (tester) async {
      tester.view.physicalSize = const Size(412, 915);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final dashboard = StudentDashboard.fromJson({
        'student': {'name': 'Nabila', 'classRoom': const {}},
        'summary': const {},
        'quizzes': [
          {
            'id': 'quiz-1',
            'title': 'Sistem Peredaran Darah',
            'mapel': 'Biologi',
            'attempts': const [],
            '_count': {'questions': 20},
          },
          {
            'id': 'quiz-2',
            'title': 'Teks Prosedur',
            'mapel': 'Bahasa Indonesia',
            'attempts': [
              {'score': 85},
            ],
            '_count': {'questions': 10},
          },
        ],
      });
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            studentDashboardProvider.overrideWith((ref) async => dashboard),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const StudentQuizScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('student-quiz-page')), findsOneWidget);
      expect(find.text('Quiz Tersedia'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Hasil Terbaru'),
        260,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Hasil Terbaru'), findsOneWidget);
      expect(find.byType(SegmentedButton<int>), findsNothing);
      await tester.dragUntilVisible(
        find.text('Quiz Tersedia'),
        find.byType(Scrollable).first,
        const Offset(0, 260),
      );
      await tester.pumpAndSettle();
      await expectLater(
        find.byKey(const Key('student-quiz-page')),
        matchesGoldenFile('goldens/student_quiz_page.png'),
      );
    },
  );

  testWidgets('Zona Baca menggunakan halaman katalog khusus', (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          home: StudentReadingScreen(
            loadBooks: () async => [
              {
                'id': 'book-1',
                'title': 'Bumi',
                'authorName': 'Tere Liye',
                'description': 'Bacaan literasi siswa.',
                'category': 'Fiksi',
                'contentType': 'ARTICLE',
                'contentText': 'Isi bacaan.',
                'estimatedMinutes': 20,
                'pageCount': 10,
                'progress': [
                  {'progressPercent': 45},
                ],
              },
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('student-reading-page')), findsOneWidget);
    expect(find.byKey(const Key('student-reading-search')), findsOneWidget);
    expect(find.byKey(const Key('student-reading-categories')), findsOneWidget);
    expect(find.text('Kategori'), findsOneWidget);
    expect(find.text('Fiksi'), findsWidgets);
    expect(find.text('Buku Unggulan'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Lanjutkan Membaca'),
      260,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Lanjutkan Membaca'), findsOneWidget);
    expect(find.byType(SegmentedButton<int>), findsNothing);
    await tester.dragUntilVisible(
      find.byKey(const Key('student-reading-search')),
      find.byType(Scrollable).first,
      const Offset(0, 260),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byKey(const Key('student-reading-page')),
      matchesGoldenFile('goldens/student_reading_page.png'),
    );
  });

  testWidgets('Zona Baca tetap tampil saat progress API bukan list', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          home: StudentReadingScreen(
            loadBooks: () async => [
              {
                'id': 'book-2',
                'title': 'Hujan',
                'authorName': 'Tere Liye',
                'description': 'Bacaan literasi siswa.',
                'category': 'Fiksi',
                'contentType': 'PDF',
                'contentUrl':
                    'https://cdn.example.r2.dev/uploads/reading/document/hujan.pdf',
                'estimatedMinutes': 30,
                'pageCount': 12,
                'progress': false,
              },
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('student-reading-page')), findsOneWidget);
    expect(find.text('Hujan'), findsWidgets);
    expect(find.textContaining('type'), findsNothing);
  });

  testWidgets('ebook PDF dibaca di reader GenPro dan halaman dapat dinavigasi', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    int? savedPage;
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          home: StudentEbookReaderScreen(
            document: const StudentEbookDocument(
              id: 'book-pdf-1',
              title: 'Bumi',
              author: 'Tere Liye',
              category: 'Fiksi',
              contentType: 'PDF',
              pageCount: 320,
              progress: 14,
              currentPage: 45,
              contentUrl: '/uploads/reading/bumi.pdf',
            ),
            loadPdf: () async => 'virtual-book.pdf',
            saveProgress:
                ({
                  required progressPercent,
                  required currentPage,
                  required secondsReadDelta,
                }) async {
                  savedPage = currentPage;
                },
            pdfPageBuilder: (context, pageNumber) => Container(
              key: ValueKey('fake-pdf-page-$pageNumber'),
              color: const Color(0xFFFFFEFC),
              padding: const EdgeInsets.fromLTRB(34, 44, 34, 22),
              child: Column(
                children: [
                  const Text(
                    'BAB 6',
                    style: TextStyle(letterSpacing: 4, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Pergi',
                    style: TextStyle(
                      color: Color(0xFF172033),
                      fontFamily: 'serif',
                      fontSize: 36,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 38),
                  const Text(
                    'Hari itu langit cerah, tidak ada awan. Matahari menggantung tepat di atas kepala, seolah mengawasi setiap langkah kami.\n\nRaib berdiri di tepi jembatan kayu yang sudah mulai lapuk. Di bawahnya, aliran sungai membawa banyak cerita.',
                    style: TextStyle(
                      color: Color(0xFF202533),
                      fontFamily: 'serif',
                      fontSize: 13.5,
                      height: 1.62,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '— $pageNumber —',
                    style: const TextStyle(fontFamily: 'serif'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('student-ebook-reader-page')), findsOneWidget);
    expect(find.text('Bumi'), findsOneWidget);
    expect(find.text('Tere Liye'), findsOneWidget);
    expect(find.byKey(const Key('ebook-page-indicator')), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byKey(const Key('student-ebook-reader-page')),
      matchesGoldenFile('goldens/student_ebook_reader_page.png'),
    );

    final turnRect = tester.getRect(
      find.byKey(const Key('ebook-page-turn-view')),
    );
    final turnGesture = await tester.startGesture(
      Offset(turnRect.right - 16, turnRect.center.dy),
    );
    await turnGesture.moveBy(const Offset(-24, 0));
    await tester.pump();
    await turnGesture.moveBy(const Offset(-190, 0));
    await tester.pump();
    await expectLater(
      find.byKey(const Key('student-ebook-reader-page')),
      matchesGoldenFile('goldens/student_ebook_page_turn_motion.png'),
    );
    await turnGesture.up();
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('— 46 —'), findsOneWidget);
    String pageIndicator() => tester
        .widget<Text>(find.byKey(const Key('ebook-page-indicator')))
        .textSpan!
        .toPlainText();
    expect(pageIndicator(), contains('46'));
    expect(savedPage, 46);

    await tester.tap(find.byTooltip('Pengaturan bacaan'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Perbesar'));
    await tester.pumpAndSettle();
    await tester.drag(
      find.byKey(const Key('ebook-page-turn-view')),
      const Offset(-280, 0),
    );
    await tester.pumpAndSettle();
    expect(pageIndicator(), contains('46'));

    await tester.tap(find.byTooltip('Pengaturan bacaan'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ukuran asli'));
    await tester.pumpAndSettle();
    final pageRect = tester.getRect(
      find.byKey(const Key('ebook-page-turn-view')),
    );
    await tester.tapAt(Offset(pageRect.right - 18, pageRect.center.dy));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 1));
    expect(pageIndicator(), contains('47'));
    expect(savedPage, 47);

    await tester.drag(
      find.byKey(const Key('ebook-page-turn-view')),
      const Offset(42, 0),
    );
    await tester.pumpAndSettle();
    expect(pageIndicator(), contains('47'));

    await tester.drag(
      find.byKey(const Key('ebook-page-turn-view')),
      const Offset(280, 0),
    );
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 1));
    expect(pageIndicator(), contains('46'));
    expect(savedPage, 46);
  });

  testWidgets(
    'Zona Kreasi siswa tanpa header, memiliki feed Reels dan composer',
    (tester) async {
      tester.view.physicalSize = const Size(412, 915);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final dashboard = StudentDashboard.fromJson({
        'student': {
          'name': 'Nabila',
          'classRoom': {
            'name': 'XI IPA 1',
            'school': {'name': 'SMA Negeri 1'},
          },
        },
        'summary': const {},
        'spotlight': [
          {
            'id': 'student-spot-1',
            'caption': 'Eksperimen sains sederhana di kelas.',
            'videoUrl': '/uploads/spotlight-siswa.mp4',
            'thumbnailUrl': '/uploads/spotlight-siswa.jpg',
            'publishedAt': '2026-08-11T08:00:00.000Z',
            'student': {'name': 'Nabila'},
          },
        ],
      });
      const user = AppUser(
        id: 'student-1',
        email: 'nabila@student.sch.id',
        name: 'Nabila',
        role: UserRole.student,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            studentDashboardProvider.overrideWith((ref) async => dashboard),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: Scaffold(
              body: StudentSpotlightScreen(
                user: user,
                active: false,
                onNotifications: () {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('student-spotlight-header')), findsNothing);
      expect(
        find.byKey(const Key('student-spotlight-controls')),
        findsOneWidget,
      );
      expect(find.byKey(const Key('student-spotlight-filters')), findsNothing);
      expect(find.byType(ChoiceChip), findsNothing);
      expect(find.byKey(const Key('student-spotlight-grid')), findsOneWidget);
      expect(find.byKey(const Key('student-spotlight-reels')), findsNothing);
      expect(
        find.byKey(const Key('student-spotlight-card-student-spot-1')),
        findsOneWidget,
      );
      expect(find.byKey(const Key('student-spotlight-create')), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const Key('student-spotlight-create')),
          matching: find.text('Buat Zona Kreasi'),
        ),
        findsNothing,
      );
      await tester.tap(
        find.byKey(const Key('student-spotlight-card-student-spot-1')),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('student-spotlight-reels')), findsOneWidget);
      expect(find.text('Eksperimen sains sederhana di kelas.'), findsOneWidget);
      expect(find.byKey(const Key('spotlight-like')), findsOneWidget);
      expect(find.byKey(const Key('spotlight-progress')), findsOneWidget);
      expect(find.byKey(const Key('spotlight-more-actions')), findsOneWidget);

      final reportMenu = tester.widget<PopupMenuButton<String>>(
        find.byKey(const Key('spotlight-more-actions')),
      );
      reportMenu.onSelected?.call('report');
      await tester.pumpAndSettle();
      expect(
        find.byKey(const Key('student-spotlight-report-sheet')),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('student-spotlight-report-submit')),
        findsOneWidget,
      );
      await tester.tap(find.byTooltip('Tutup'));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('student-spotlight-create')));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const Key('student-spotlight-composer')),
        findsOneWidget,
      );
      expect(find.text('Buat Zona Kreasi'), findsWidgets);
      expect(find.text('Publik'), findsOneWidget);
      expect(find.text('Ceritakan Zona Kreasi Anda...'), findsOneWidget);
      expect(
        find.byKey(const Key('student-spotlight-pick-image')),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('student-spotlight-pick-video')),
        findsOneWidget,
      );
      expect(find.byKey(const Key('student-spotlight-submit')), findsOneWidget);

      await tester.tap(find.byKey(const Key('student-spotlight-submit')));
      await tester.pump();
      expect(
        find.text('Pilih gambar atau video terlebih dahulu.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Zona Kreasi gambar tidak menampilkan kontrol pemutar video', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final dashboard = StudentDashboard.fromJson({
      'student': {
        'name': 'Nabila',
        'classRoom': {
          'name': 'XI IPA 1',
          'school': {'name': 'SMA Negeri 1'},
        },
      },
      'summary': const {},
      'spotlight': [
        {
          'id': 'student-image-1',
          'caption': 'Karya ilustrasi siswa untuk pameran sekolah.',
          'videoUrl': '/uploads/spotlight/karya-siswa.webp',
          'publishedAt': '2026-08-11T08:00:00.000Z',
          '_count': {'likes': 7},
          'likes': [
            {'id': 'like-1'},
          ],
          'student': {'name': 'Nabila'},
        },
      ],
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          studentDashboardProvider.overrideWith((ref) async => dashboard),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: StudentSpotlightScreen(
              user: const AppUser(
                id: 'student-1',
                email: 'nabila@student.sch.id',
                name: 'Nabila',
                role: UserRole.student,
              ),
              active: false,
              initialPostId: 'student-image-1',
              onNotifications: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(
      find.text('Karya ilustrasi siswa untuk pameran sekolah.'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('spotlight-like')), findsOneWidget);
    expect(find.text('7'), findsOneWidget);
    expect(find.byKey(const Key('spotlight-progress')), findsNothing);
    expect(find.byTooltip('Aktifkan suara'), findsNothing);
    expect(find.byTooltip('Matikan suara'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('login komersial responsif dan seluruh kontrol bekerja', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    String? submittedEmail;
    String? submittedPassword;
    var forgotPasswordTapped = false;
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: LoginPageView(
          onForgotPassword: (_) async => forgotPasswordTapped = true,
          onSubmit: (email, password) async {
            submittedEmail = email;
            submittedPassword = password;
          },
        ),
      ),
    );
    await tester.pump();
    await tester.runAsync(() async {
      await precacheImage(
        const AssetImage('assets/images/login_background.jpg'),
        tester.element(find.byType(LoginPageView)),
      );
    });
    await tester.pump();

    expect(find.text('Selamat datang kembali'), findsOneWidget);
    expect(find.text('Masuk Sekarang'), findsOneWidget);
    expect(find.textContaining("iBaenk's", findRichText: true), findsOneWidget);
    expect(find.byKey(const Key('login-access-selector')), findsNothing);
    expect(find.text('Siswa'), findsNothing);
    expect(find.text('Guru'), findsNothing);
    expect(find.byKey(const Key('login-email')), findsOneWidget);
    expect(find.byKey(const Key('login-password')), findsOneWidget);
    expect(find.byKey(const Key('forgot-password-button')), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/commercial_login_page.png'),
    );

    await tester.tap(find.byKey(const Key('forgot-password-button')));
    await tester.pump();
    expect(forgotPasswordTapped, isTrue);

    await tester.enterText(
      find.byKey(const Key('login-email')),
      'guru@demo.sch.id',
    );
    await tester.enterText(
      find.byKey(const Key('login-password')),
      'guru123456',
    );
    expect(
      tester
          .widget<EditableText>(
            find.descendant(
              of: find.byKey(const Key('login-password')),
              matching: find.byType(EditableText),
            ),
          )
          .obscureText,
      isTrue,
    );
    await tester.tap(find.byTooltip('Tampilkan password'));
    await tester.pump();
    expect(
      tester
          .widget<EditableText>(
            find.descendant(
              of: find.byKey(const Key('login-password')),
              matching: find.byType(EditableText),
            ),
          )
          .obscureText,
      isFalse,
    );
    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pump();

    expect(submittedEmail, 'guru@demo.sch.id');
    expect(submittedPassword, 'guru123456');
    expect(tester.takeException(), isNull);
  });

  testWidgets('lupa password menjalankan OTP dan menyimpan password baru', (
    tester,
  ) async {
    String? requestedEmail;
    String? resetEmail;
    String? resetCode;
    String? resetPassword;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: ForgotPasswordSheet(
            initialEmail: 'siswa@demo.sch.id',
            requestOtp: (email) async {
              requestedEmail = email;
              return 'Kode OTP sudah dikirim.';
            },
            resetPassword:
                ({required email, required code, required password}) async {
                  resetEmail = email;
                  resetCode = code;
                  resetPassword = password;
                  return 'Password berhasil diperbarui.';
                },
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('forgot-password-request-otp')));
    await tester.pump();
    expect(requestedEmail, 'siswa@demo.sch.id');
    expect(find.byKey(const Key('forgot-password-otp')), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('forgot-password-otp')),
      '123456',
    );
    await tester.enterText(
      find.byKey(const Key('forgot-password-new')),
      'password-baru',
    );
    await tester.enterText(
      find.byKey(const Key('forgot-password-confirm')),
      'password-baru',
    );
    await tester.tap(find.byKey(const Key('forgot-password-submit')));
    await tester.pump();

    expect(resetEmail, 'siswa@demo.sch.id');
    expect(resetCode, '123456');
    expect(resetPassword, 'password-baru');
    expect(find.text('Password berhasil diubah'), findsOneWidget);
    expect(find.byKey(const Key('forgot-password-done')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('login tetap dapat digunakan pada layar Android kecil', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: LoginPageView(onSubmit: (_, _) async {}),
      ),
    );
    await tester.pump();

    expect(find.text('Selamat datang kembali'), findsOneWidget);
    await tester.drag(
      find.byType(SingleChildScrollView),
      const Offset(0, -360),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('login-submit')), findsOneWidget);
    expect(find.text('Sesi Anda dilindungi dengan aman'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('login memakai logo aplikasi dari Super Admin', (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: LoginPageView(
          branding: const MobileBrandingDisplay(
            appName: 'GuruSpace Kalsel',
            logoUrl: '/uploads/logo-app.png',
            authLogoUrl: '/uploads/logo-login.png',
          ),
          onSubmit: (_, _) async {},
        ),
      ),
    );
    await tester.pump();

    final image = tester.widget<Image>(
      find.byWidgetPredicate(
        (widget) => widget is Image && widget.image is NetworkImage,
      ),
    );
    final provider = image.image as NetworkImage;
    expect(provider.url, endsWith('/uploads/logo-login.png'));
  });

  testWidgets('siswa dapat mengganti password dari halaman profil', (
    tester,
  ) async {
    String? submittedCurrentPassword;
    String? submittedNewPassword;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: StudentChangePasswordSheet(
            onSubmit:
                ({
                  required String currentPassword,
                  required String newPassword,
                }) async {
                  submittedCurrentPassword = currentPassword;
                  submittedNewPassword = newPassword;
                  return 'Password berhasil diperbarui.';
                },
          ),
        ),
      ),
    );

    await tester.enterText(
      find.byKey(const Key('student-current-password')),
      'password-lama',
    );
    await tester.enterText(
      find.byKey(const Key('student-new-password')),
      'password-baru',
    );
    await tester.enterText(
      find.byKey(const Key('student-confirm-password')),
      'password-baru',
    );
    await tester.tap(find.byKey(const Key('student-change-password-submit')));
    await tester.pumpAndSettle();

    expect(submittedCurrentPassword, 'password-lama');
    expect(submittedNewPassword, 'password-baru');
    expect(find.text('Password berhasil diubah'), findsOneWidget);
    expect(find.text('Password berhasil diperbarui.'), findsOneWidget);
    expect(
      find.byKey(const Key('student-change-password-done')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('siswa dapat mengisi dan mengirim form mading baru', (
    tester,
  ) async {
    StudentMadingDraft? submittedDraft;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: StudentMadingComposerSheet(
            onSubmit: (draft) async {
              submittedDraft = draft;
              return 'Karya berhasil dikirim.';
            },
          ),
        ),
      ),
    );

    await tester.enterText(
      find.byKey(const Key('student-mading-title')),
      'Manfaat Membaca Buku',
    );
    await tester.enterText(
      find.byKey(const Key('student-mading-content')),
      'Membaca buku membuka wawasan dan membantu siswa memahami dunia.',
    );
    await tester.ensureVisible(find.byKey(const Key('student-mading-submit')));
    await tester.tap(find.byKey(const Key('student-mading-submit')));
    await tester.pumpAndSettle();

    expect(submittedDraft?.title, 'Manfaat Membaca Buku');
    expect(submittedDraft?.category, 'Artikel Siswa');
    expect(submittedDraft?.visibility, 'GLOBAL');
    expect(tester.takeException(), isNull);
  });

  testWidgets('guru dapat membuka pengelolaan akun login siswa', (
    tester,
  ) async {
    var managed = false;
    final activeStudent = TeacherStudentAccountItem.fromJson({
      'id': 'student-1',
      'name': 'Siswa Demo',
      'nis': '2026001',
      'user': {'email': 'siswa@demo.sch.id'},
    });

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: TeacherStudentAccountCard(
            student: activeStudent,
            onManage: () => managed = true,
          ),
        ),
      ),
    );

    expect(activeStudent.hasAccount, isTrue);
    expect(find.text('Siswa Demo'), findsOneWidget);
    expect(find.text('siswa@demo.sch.id'), findsOneWidget);
    expect(find.text('Reset'), findsOneWidget);
    await tester.tap(find.text('Reset'));
    expect(managed, isTrue);
    expect(tester.takeException(), isNull);
  });
}
