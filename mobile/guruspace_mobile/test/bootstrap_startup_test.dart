import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('optional push initialization cannot block the first app frame', () {
    final bootstrap = File('lib/bootstrap.dart').readAsStringSync();
    final push = File(
      'lib/core/notifications/push_notification_service.dart',
    ).readAsStringSync();

    expect(
      bootstrap,
      contains(
        'unawaited(PushNotificationService.instance.captureLaunchMessage())',
      ),
    );
    expect(
      bootstrap,
      isNot(
        contains(
          'await PushNotificationService.instance.captureLaunchMessage()',
        ),
      ),
    );
    expect(push, contains('getInitialMessage()'));
    expect(push, contains('.timeout(const Duration(seconds: 5))'));
    expect(
      bootstrap.indexOf('runApp('),
      lessThan(bootstrap.indexOf('initializeDateFormatting')),
    );
    expect(bootstrap, contains('UKHUWAH Mobile belum dapat disiapkan.'));
    expect(bootstrap, contains("assets/images/native_splash_logo.png"));
    expect(bootstrap, contains("Powered by iBaenk's"));
  });
}
