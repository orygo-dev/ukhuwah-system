import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';
import 'package:guruspace_mobile/features/dashboard/domain/app_display_models.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/student/presentation/student_app.dart';
import 'package:guruspace_mobile/features/student/presentation/student_profile_screen.dart';
import 'package:guruspace_mobile/features/shared/presentation/notifications_screen.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() async => initializeDateFormatting('id_ID'));

  testWidgets('baca semua menghapus badge notifikasi global siswa', (
    tester,
  ) async {
    final api = _NotificationApi();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          studentDashboardProvider.overrideWith((_) async => _dashboard()),
          studentMadingProvider.overrideWith((_) async => const []),
          mobileAppDisplayProvider.overrideWith(
            (_) async => MobileAppDisplay.fromJson(const {}),
          ),
          mobileBannerProvider.overrideWith(
            (_) async => MobileBannerDisplay.fromJson(const {}),
          ),
          mobilePopupProvider.overrideWith(
            (_) async => MobilePopupDisplay.fromJson(const {}),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const StudentApp(user: _user),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(
      find.byKey(const Key('student-header-notification-badge')),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const Key('student-header-notifications')));
    await tester.pumpAndSettle();
    expect(find.text('Notifikasi ujian'), findsOneWidget);
    await tester.tap(find.text('Baca semua'));
    await tester.pumpAndSettle();
    expect(api.readAllCalls, 1);

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(
      find.byKey(const Key('student-header-notification-badge')),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('badge inbox menampilkan jumlah dan membuka inbox siswa', (
    tester,
  ) async {
    final api = _NotificationApi(socialUnread: 3);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          studentDashboardProvider.overrideWith((_) async => _dashboard()),
          studentMadingProvider.overrideWith((_) async => const []),
          studentWorksProvider.overrideWith(
            (_) async => const StudentWorks(mading: [], spotlight: []),
          ),
          mobileAppDisplayProvider.overrideWith(
            (_) async => MobileAppDisplay.fromJson(const {}),
          ),
          mobileBannerProvider.overrideWith(
            (_) async => MobileBannerDisplay.fromJson(const {}),
          ),
          mobilePopupProvider.overrideWith(
            (_) async => MobilePopupDisplay.fromJson(const {}),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const StudentApp(user: _user),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('student-header-inbox-badge')), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    await tester.tap(find.byKey(const Key('student-header-inbox')));
    await tester.pumpAndSettle();
    expect(find.text('Inbox'), findsOneWidget);
    expect(find.text('Percakapan'), findsOneWidget);
    expect(find.text('Permintaan'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('profil menampilkan portofolio mading dan Zona Kreasi siswa', (
    tester,
  ) async {
    final works = StudentWorks.fromJson({
      'mading': [
        {
          'id': 'mading-1',
          'title': 'Robot Penyiram Tanaman',
          'category': 'Teknologi',
          'content': 'Karya teknologi siswa.',
          'status': 'PUBLISHED',
          'createdAt': '2026-08-30T01:00:00.000Z',
          'student': {'name': 'Nabila'},
          'isOwner': true,
        },
      ],
      'spotlight': [
        {
          'id': 'kreasi-1',
          'caption': 'Tari kreasi sekolah',
          'videoUrl': '/uploads/spotlight/tari.mp4',
          'status': 'PENDING_REVIEW',
          'createdAt': '2026-08-30T02:00:00.000Z',
          'student': {'name': 'Nabila'},
          'isOwner': true,
        },
      ],
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          studentDashboardProvider.overrideWith((_) async => _dashboard()),
          studentWorksProvider.overrideWith((_) async => works),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const StudentProfileScreen(user: _user),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('student-profile-works')), findsOneWidget);
    expect(find.text('Portofolio Karya'), findsOneWidget);
    expect(find.text('Robot Penyiram Tanaman'), findsOneWidget);
    expect(find.text('Tari kreasi sekolah'), findsOneWidget);

    await tester.ensureVisible(
      find.byKey(const Key('student-profile-open-works')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('student-profile-open-works')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student-works-screen')), findsOneWidget);
    expect(find.text('Mading'), findsWidgets);
    expect(find.text('Robot Penyiram Tanaman'), findsOneWidget);

    await tester.tap(find.text('Zona Kreasi').last);
    await tester.pumpAndSettle();
    expect(find.text('Tari kreasi sekolah'), findsOneWidget);
    expect(find.text('Ditinjau'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('portofolio mempertahankan status moderasi dan kepemilikan', () {
    final works = StudentWorks.fromJson({
      'mading': [
        {
          'id': 'm1',
          'title': 'Karya',
          'category': 'Sains',
          'content': 'Isi',
          'status': 'REVISION_REQUESTED',
          'reviewNote': 'Perjelas sumber.',
          'isOwner': true,
        },
      ],
      'spotlight': const [],
    });

    expect(works.total, 1);
    expect(works.mading.single.status, 'REVISION_REQUESTED');
    expect(works.mading.single.reviewNote, 'Perjelas sumber.');
    expect(works.mading.single.isOwner, isTrue);
  });

  testWidgets('pergantian akun mengganti identitas walau avatar sama', (
    tester,
  ) async {
    var activeUser = _user;
    late StateSetter updateHost;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_NotificationApi()),
          studentDashboardProvider.overrideWith((_) async => _dashboard()),
          studentWorksProvider.overrideWith(
            (_) async => const StudentWorks(mading: [], spotlight: []),
          ),
          studentMadingProvider.overrideWith((_) async => const []),
          notificationsProvider.overrideWith(
            (_) async => const NotificationInboxData(items: [], unreadCount: 0),
          ),
          mobileAppDisplayProvider.overrideWith(
            (_) async => MobileAppDisplay.fromJson(const {}),
          ),
          mobileBannerProvider.overrideWith(
            (_) async => MobileBannerDisplay.fromJson(const {}),
          ),
          mobilePopupProvider.overrideWith(
            (_) async => MobilePopupDisplay.fromJson(const {}),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: StatefulBuilder(
            builder: (context, setState) {
              updateHost = setState;
              return StudentApp(user: activeUser);
            },
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    updateHost(() => activeUser = _otherUser);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Profil').last);
    await tester.pumpAndSettle();

    expect(find.text(_otherUser.email), findsOneWidget);
    expect(find.text(_user.email), findsNothing);
    expect(tester.takeException(), isNull);
  });

  test('dashboard refetch ketika identitas sesi berubah', () async {
    final session = StateProvider<String?>((_) => 'user-a');
    final api = _SessionAwareDashboardApi('Akun Pertama');
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authenticatedUserIdProvider.overrideWith((ref) => ref.watch(session)),
      ],
    );
    addTearDown(container.dispose);

    final first = await container.read(studentDashboardProvider.future);
    expect(first.name, 'Akun Pertama');

    api.name = 'Akun Kedua';
    container.read(session.notifier).state = 'user-b';
    final second = await container.read(studentDashboardProvider.future);

    expect(second.name, 'Akun Kedua');
    expect(api.dashboardCalls, 2);
  });
}

const _user = AppUser(
  id: 'student-user-1',
  email: 'nabila@example.sch.id',
  name: 'Nabila',
  role: UserRole.student,
);

const _otherUser = AppUser(
  id: 'student-user-2',
  email: 'reza@example.sch.id',
  name: 'Reza',
  role: UserRole.student,
);

StudentDashboard _dashboard() => StudentDashboard.fromJson({
  'student': {
    'name': 'Nabila',
    'classRoom': {
      'name': 'XI IPA 1',
      'school': {'name': 'SMA Negeri Demo'},
      'teacher': {'name': 'Pak Budi'},
    },
  },
  'summary': {
    'pendingAssignments': 0,
    'attendancePercent': 95,
    'averageScore': 88,
  },
  'assignments': const [],
  'quizzes': const [],
  'exams': const [],
  'attendance': const [],
  'upcomingPjj': const [],
  'tkaPackages': const [],
  'reading': const [],
  'boardPosts': const [],
  'spotlight': const [],
});

class _NotificationApi implements ApiClient {
  _NotificationApi({this.socialUnread = 0});
  final int socialUnread;
  bool unread = true;
  int readAllCalls = 0;

  @override
  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    if (path == '/api/notifications') {
      return {
        'unreadCount': unread ? 1 : 0,
        'items': [
          {
            'id': 'recipient-1',
            'readAt': unread ? null : '2026-08-30T03:00:00.000Z',
            'notification': {
              'id': 'notification-1',
              'title': 'Notifikasi ujian',
              'message': 'Ujian dimulai besok.',
              'priority': 'NORMAL',
              'publishAt': '2026-08-30T02:00:00.000Z',
              'sender': {'name': 'Sekolah'},
            },
          },
        ],
      };
    }
    if (path == '/api/mobile/v1/student/social/unread') {
      return {'unreadCount': socialUnread};
    }
    if (path == '/api/mobile/v1/student/social/inbox') {
      return {
        'unreadTotal': socialUnread,
        'conversations': const [],
        'requests': const [],
      };
    }
    return const {};
  }

  @override
  Future<Map<String, dynamic>> postJson(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Duration? receiveTimeout,
  }) async {
    if (path == '/api/notifications/read' &&
        data is Map &&
        data['all'] == true) {
      readAllCalls += 1;
      unread = false;
    }
    return const {'ok': true};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _SessionAwareDashboardApi implements ApiClient {
  _SessionAwareDashboardApi(this.name);
  String name;
  int dashboardCalls = 0;

  @override
  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    if (path == '/api/mobile/v1/student/dashboard') {
      dashboardCalls += 1;
      return {
        'student': {
          'name': name,
          'classRoom': {
            'name': 'XI IPA 1',
            'school': {'name': 'SMA Negeri Demo'},
            'teacher': {'name': 'Pak Budi'},
          },
        },
        'summary': const {},
        'assignments': const [],
        'quizzes': const [],
        'exams': const [],
        'attendance': const [],
        'upcomingPjj': const [],
        'tkaPackages': const [],
        'reading': const [],
        'boardPosts': const [],
        'spotlight': const [],
      };
    }
    return const {};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
