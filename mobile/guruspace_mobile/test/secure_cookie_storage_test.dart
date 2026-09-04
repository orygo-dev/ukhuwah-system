import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/network/secure_cookie_storage.dart';

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  test('cookie sesi tersimpan dan terhapus melalui secure storage', () async {
    final storage = SecureCookieStorage();
    await storage.init(false, false);
    await storage.write('guruspaceai.cloud', 'session=encrypted-value');

    expect(await storage.read('guruspaceai.cloud'), 'session=encrypted-value');

    await storage.delete('guruspaceai.cloud');
    expect(await storage.read('guruspaceai.cloud'), isNull);
  });

  test(
    'namespace cookie terpisah dan deleteAll hanya menghapus key terkait',
    () async {
      final storage = SecureCookieStorage();
      await storage.init(false, false);
      await storage.write('a.example', 'a');
      await storage.write('b.example', 'b');

      await storage.deleteAll(['a.example']);

      expect(await storage.read('a.example'), isNull);
      expect(await storage.read('b.example'), 'b');
    },
  );
}
