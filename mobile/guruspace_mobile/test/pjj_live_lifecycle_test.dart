import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/features/shared/domain/pjj_live_lifecycle.dart';

void main() {
  test('rapid retry remains single-flight and stale attempt is cancelled', () {
    final gate = PjjConnectionAttemptGate();
    final first = gate.begin();
    expect(first, isNotNull);
    expect(gate.begin(), isNull);
    gate.cancel();
    expect(gate.isCurrent(first!), isFalse);
    final second = gate.begin();
    expect(second, isNotNull);
    expect(gate.isCurrent(second!), isTrue);
    gate.finish(second);
    expect(gate.begin(), isNotNull);
  });

  test('permission matrix honors all lobby preference combinations', () {
    expect(pjjRequiredPermissions(camera: false, microphone: false), isEmpty);
    expect(pjjRequiredPermissions(camera: true, microphone: false), {'camera'});
    expect(pjjRequiredPermissions(camera: false, microphone: true), {
      'microphone',
    });
    expect(pjjRequiredPermissions(camera: true, microphone: true), {
      'camera',
      'microphone',
    });
  });

  test('chat client message id is a UUID v4', () {
    final id = pjjClientMessageId();
    expect(
      id,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
    expect(pjjClientMessageId(), isNot(id));
  });
}
