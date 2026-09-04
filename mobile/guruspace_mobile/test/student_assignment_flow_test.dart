import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/student/presentation/student_learning_detail_screen.dart';

class _AssignmentApi extends Fake implements ApiClient {
  Object? submittedData;

  @override
  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async => {
    'activity': {
      'id': 'task-1',
      'title': 'Latihan Persamaan Kuadrat',
      'subject': 'Matematika',
      'description': 'Jawab setiap soal dengan teliti.',
      'teacherName': 'Ibu Ratna',
      'mode': 'QUESTION_SET',
      'maxScore': 100,
      'allowResubmit': true,
      'acceptsSubmission': true,
      'dueAt': '2030-08-20T23:59:00.000Z',
    },
    'questions': [
      {
        'id': 'q-1',
        'type': 'SINGLE_CHOICE',
        'prompt': 'Nilai x dari x + 2 = 5 adalah ...',
        'options': ['1', '2', '3', '4'],
        'points': 50,
        'required': true,
      },
      {
        'id': 'q-2',
        'type': 'ESSAY',
        'prompt': 'Jelaskan langkah penyelesaiannya.',
        'options': const [],
        'points': 50,
        'required': true,
      },
    ],
    'submission': null,
  };

  @override
  Future<Map<String, dynamic>> postJson(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Duration? receiveTimeout,
  }) async {
    submittedData = data;
    return {
      'submission': {'id': 'submission-1'},
    };
  }
}

void main() {
  testWidgets('alur tugas terstruktur memandu soal dan review sebelum kirim', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = _AssignmentApi();
    const item = LearningItem(
      id: 'task-1',
      title: 'Latihan Persamaan Kuadrat',
      subject: 'Matematika',
      kind: 'Tugas',
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(api)],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const StudentLearningDetailScreen(item: item),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Progres pengerjaan'), findsOneWidget);
    expect(find.text('0 dari 2 soal terjawab · 2 wajib'), findsOneWidget);
    expect(
      find.textContaining('Nilai x dari x + 2 = 5 adalah ...'),
      findsOneWidget,
    );
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/student_assignment_detail_page.png'),
    );

    await tester.ensureVisible(find.text('3'));
    await tester.drag(find.byType(ListView).first, const Offset(0, -180));
    await tester.pumpAndSettle();
    await tester.tap(find.text('3'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('assignment-next')));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Jelaskan langkah penyelesaiannya.'),
      findsOneWidget,
    );

    await tester.enterText(find.byType(TextFormField), 'x = 5 - 2 = 3');
    await tester.tap(find.byKey(const Key('assignment-review-submit')));
    await tester.pumpAndSettle();
    expect(find.text('Kumpulkan tugas?'), findsOneWidget);
    expect(find.text('2 dari 2 soal telah diisi.'), findsOneWidget);
    expect(api.submittedData, isNull);
  });

  testWidgets('soal wajib kosong diarahkan ke nomor yang belum dijawab', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = _AssignmentApi();
    const item = LearningItem(
      id: 'task-1',
      title: 'Latihan Persamaan Kuadrat',
      subject: 'Matematika',
      kind: 'Tugas',
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(api)],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const StudentLearningDetailScreen(item: item),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('assignment-next')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('assignment-review-submit')));
    await tester.pump();

    expect(find.text('Soal wajib nomor 1 belum dijawab.'), findsOneWidget);
    expect(
      find.textContaining('Nilai x dari x + 2 = 5 adalah ...'),
      findsOneWidget,
    );
    expect(api.submittedData, isNull);
  });
}
