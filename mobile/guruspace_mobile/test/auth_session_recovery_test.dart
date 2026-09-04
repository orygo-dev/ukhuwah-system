import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/core/network/api_exception.dart';
import 'package:guruspace_mobile/features/auth/data/auth_repository.dart';

class SessionClient extends Fake implements ApiClient {
  bool cleared = false;
  Map<String, dynamic> session = {
    'user': {
      'id': 'teacher-1',
      'name': 'Teacher',
      'email': 'teacher@example.test',
      'role': 'TEACHER',
    },
  };
  ApiException? bootstrapError;

  @override
  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    if (path == '/api/auth/session') return session;
    if (path == '/api/mobile/v1/bootstrap') {
      if (bootstrapError != null) throw bootstrapError!;
      return {
        'user': {...session['user'] as Map, 'name': 'Updated Teacher'},
      };
    }
    throw StateError('Unexpected request: $path');
  }

  @override
  Future<void> clearSession() async {
    cleared = true;
  }
}

void main() {
  test('bootstrap 401 clears stale cookies and returns to login', () async {
    final client = SessionClient()
      ..bootstrapError = const ApiException(
        'Sesi login tidak valid.',
        statusCode: 401,
      );
    expect(await AuthRepository(client).currentUser(), isNull);
    expect(client.cleared, isTrue);
  });

  test('empty Auth.js session clears persisted session', () async {
    final client = SessionClient()..session = {};
    expect(await AuthRepository(client).currentUser(), isNull);
    expect(client.cleared, isTrue);
  });

  test('valid teacher session uses current bootstrap profile', () async {
    final client = SessionClient();
    final user = await AuthRepository(client).currentUser();
    expect(user?.name, 'Updated Teacher');
    expect(client.cleared, isFalse);
  });

  test('temporary network failure does not erase a valid session', () async {
    final client = SessionClient()
      ..bootstrapError = const ApiException(
        'Server sementara tidak tersedia.',
        statusCode: 503,
      );
    final user = await AuthRepository(client).currentUser();
    expect(user?.id, 'teacher-1');
    expect(client.cleared, isFalse);
  });
}
