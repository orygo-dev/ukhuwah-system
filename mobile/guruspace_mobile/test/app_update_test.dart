import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/config/app_variant.dart';
import 'package:guruspace_mobile/core/update/app_update_gate.dart';
import 'package:guruspace_mobile/core/update/app_update_service.dart';

class FakeAppUpdateService implements AppUpdateService {
  FakeAppUpdateService({
    this.info = const AppUpdateInfo.unavailable(),
    this.checkError,
    this.checkCompleter,
    this.startResult = true,
    this.completeResult = true,
  });

  final AppUpdateInfo info;
  final Object? checkError;
  final Completer<AppUpdateInfo>? checkCompleter;
  bool startResult;
  bool completeResult;
  int checkCalls = 0;
  int startCalls = 0;
  int completeCalls = 0;
  int storeCalls = 0;
  bool? lastImmediate;
  final controller = StreamController<AppUpdateProgress>.broadcast();

  @override
  Stream<AppUpdateProgress> get progress => controller.stream;

  @override
  Future<AppUpdateInfo> checkForUpdate() async {
    checkCalls++;
    if (checkError != null) throw checkError!;
    if (checkCompleter != null) return checkCompleter!.future;
    return info;
  }

  @override
  Future<bool> startUpdate({required bool immediate}) async {
    startCalls++;
    lastImmediate = immediate;
    return startResult;
  }

  @override
  Future<bool> completeUpdate() async {
    completeCalls++;
    return completeResult;
  }

  @override
  Future<bool> openStore() async {
    storeCalls++;
    return true;
  }

  void emit(AppUpdateProgress progress) => controller.add(progress);

  @override
  void dispose() {
    unawaited(controller.close());
  }
}

const optionalUpdate = AppUpdateInfo(
  available: true,
  availableVersionCode: 12,
  priority: 2,
  immediateAllowed: true,
  flexibleAllowed: true,
  developerTriggered: false,
  installStatus: AppUpdateInstallStatus.unknown,
);

const requiredUpdate = AppUpdateInfo(
  available: true,
  availableVersionCode: 13,
  priority: 5,
  immediateAllowed: true,
  flexibleAllowed: true,
  developerTriggered: false,
  installStatus: AppUpdateInstallStatus.unknown,
);

void main() {
  Future<void> mount(
    WidgetTester tester,
    FakeAppUpdateService service, {
    Duration timeout = const Duration(seconds: 4),
  }) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(service.dispose);
    await tester.pumpWidget(
      AppUpdateGate(
        variant: AppVariant.student,
        service: service,
        checkTimeout: timeout,
        child: const MaterialApp(
          home: Scaffold(body: Text('Aplikasi GenPro berjalan')),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('no update leaves the existing app untouched', (tester) async {
    final service = FakeAppUpdateService();
    await mount(tester, service);

    expect(find.text('Aplikasi GenPro berjalan'), findsOneWidget);
    expect(find.byKey(const Key('app-update-page')), findsNothing);
    expect(service.checkCalls, 1);
  });

  testWidgets('Play check failure fails open and never blocks login', (
    tester,
  ) async {
    final service = FakeAppUpdateService(checkError: Exception('offline'));
    await mount(tester, service);

    expect(find.text('Aplikasi GenPro berjalan'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('check timeout fails open and late result is ignored safely', (
    tester,
  ) async {
    final completer = Completer<AppUpdateInfo>();
    final service = FakeAppUpdateService(checkCompleter: completer);
    await mount(tester, service, timeout: const Duration(milliseconds: 50));

    await tester.pump(const Duration(milliseconds: 51));
    expect(find.text('Aplikasi GenPro berjalan'), findsOneWidget);
    completer.complete(optionalUpdate);
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.byKey(const Key('app-update-page')), findsNothing);
  });

  testWidgets('optional update can be postponed without changing app flow', (
    tester,
  ) async {
    final service = FakeAppUpdateService(info: optionalUpdate);
    await mount(tester, service);

    expect(find.text('Versi baru tersedia'), findsOneWidget);
    expect(find.byKey(const Key('app-update-later')), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('app-update-later')));
    await tester.tap(find.byKey(const Key('app-update-later')));
    await tester.pump();

    expect(find.text('Aplikasi GenPro berjalan'), findsOneWidget);
    expect(service.startCalls, 0);
  });

  testWidgets('optional update starts flexible download only once', (
    tester,
  ) async {
    final service = FakeAppUpdateService(info: optionalUpdate);
    await mount(tester, service);

    await tester.ensureVisible(find.byKey(const Key('app-update-primary')));
    await tester.tap(find.byKey(const Key('app-update-primary')));
    await tester.tap(find.byKey(const Key('app-update-primary')));
    await tester.pump();

    expect(service.startCalls, 1);
    expect(service.lastImmediate, isFalse);
    service.emit(
      const AppUpdateProgress(
        status: AppUpdateInstallStatus.downloading,
        bytesDownloaded: 50,
        totalBytes: 100,
      ),
    );
    await tester.pump();
    expect(find.byKey(const Key('app-update-progress')), findsOneWidget);
    await tester.tap(find.byKey(const Key('app-update-primary')));
    await tester.pump();
    expect(service.startCalls, 1);

    service.emit(
      const AppUpdateProgress(status: AppUpdateInstallStatus.downloaded),
    );
    await tester.pump();
    expect(find.text('Pasang & Mulai Ulang'), findsOneWidget);
    await tester.tap(find.byKey(const Key('app-update-primary')));
    await tester.pump();
    expect(service.completeCalls, 1);
  });

  testWidgets('required update cannot be dismissed and uses immediate flow', (
    tester,
  ) async {
    final service = FakeAppUpdateService(info: requiredUpdate);
    await mount(tester, service);

    expect(find.text('Pembaruan diperlukan'), findsOneWidget);
    expect(find.byKey(const Key('app-update-later')), findsNothing);
    await tester.ensureVisible(find.byKey(const Key('app-update-primary')));
    await tester.tap(find.byKey(const Key('app-update-primary')));
    await tester.pump();
    expect(service.startCalls, 1);
    expect(service.lastImmediate, isTrue);
  });

  testWidgets('automatic update failure exposes Play Store fallback', (
    tester,
  ) async {
    final service = FakeAppUpdateService(
      info: optionalUpdate,
      startResult: false,
    );
    await mount(tester, service);

    await tester.ensureVisible(find.byKey(const Key('app-update-primary')));
    await tester.tap(find.byKey(const Key('app-update-primary')));
    await tester.pump();
    expect(find.byKey(const Key('app-update-error')), findsOneWidget);
    await tester.ensureVisible(
      find.byKey(const Key('app-update-store-fallback')),
    );
    await tester.tap(find.byKey(const Key('app-update-store-fallback')));
    await tester.pump();
    expect(service.storeCalls, 1);
  });
}
