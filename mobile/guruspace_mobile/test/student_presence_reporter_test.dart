import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/core/presence/student_presence_reporter.dart';
import 'package:guruspace_mobile/core/providers.dart';

class PresenceAdapter implements HttpClientAdapter {
  int calls = 0;
  int status = 204;
  bool closed = false;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls++;
    expect(options.path, '/api/student-presence/heartbeat');
    expect(options.method, 'POST');
    expect(options.data, isNull);
    return ResponseBody.fromString('', status);
  }

  @override
  void close({bool force = false}) {
    closed = true;
  }
}

class PresenceClient extends Fake implements ApiClient {
  PresenceClient(this.dio);
  @override
  final Dio dio;
}

void main() {
  Future<PresenceAdapter> mount(WidgetTester tester, {int status = 204}) async {
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    final adapter = PresenceAdapter()..status = status;
    final dio = Dio(
      BaseOptions(baseUrl: 'https://example.test', validateStatus: (_) => true),
    )..httpClientAdapter = adapter;
    addTearDown(() => dio.close(force: true));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(PresenceClient(dio))],
        child: const MaterialApp(
          home: StudentPresenceReporter(child: Text('Belajar tetap berjalan')),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 10));
    return adapter;
  }

  testWidgets(
    'foreground heartbeat repeats; pause stops; resume restarts; disposal cancels timer',
    (tester) async {
      final adapter = await mount(tester);
      expect(adapter.calls, 1);
      await tester.pump(const Duration(seconds: 45));
      expect(adapter.calls, 2);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump(const Duration(minutes: 3));
      expect(adapter.calls, 2);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 10));
      expect(adapter.calls, 3);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(minutes: 3));
      expect(adapter.calls, 3);
    },
  );

  testWidgets(
    '401 stops optional heartbeat without changing the learning screen',
    (tester) async {
      final adapter = await mount(tester, status: 401);
      await tester.pump(const Duration(minutes: 3));
      expect(adapter.calls, 1);
      expect(find.text('Belajar tetap berjalan'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('503 retries at bounded interval and never blocks the child', (
    tester,
  ) async {
    final adapter = await mount(tester, status: 503);
    expect(find.text('Belajar tetap berjalan'), findsOneWidget);
    await tester.pump(const Duration(seconds: 45));
    expect(adapter.calls, 2);
    await tester.pumpWidget(const SizedBox());
  });
}
