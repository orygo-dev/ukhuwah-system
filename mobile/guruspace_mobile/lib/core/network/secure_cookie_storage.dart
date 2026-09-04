import 'dart:convert';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Cookie-jar storage backed by Android Keystore / iOS Keychain encryption.
///
/// Cookie values never fall back to plaintext storage. If secure storage is
/// unavailable, authentication fails closed instead of persisting a reusable
/// session token in an unprotected file.
class SecureCookieStorage implements Storage {
  SecureCookieStorage({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(
              storageNamespace: 'genpro_auth_cookies',
              resetOnError: true,
              migrateWithBackup: false,
            ),
          );

  final FlutterSecureStorage _storage;
  String _namespace = 'ie0_ps0';

  String _secureKey(String key) {
    final encoded = base64Url.encode(utf8.encode(key)).replaceAll('=', '');
    return 'cookie_${_namespace}_$encoded';
  }

  @override
  Future<void> init(bool persistSession, bool ignoreExpires) async {
    _namespace = 'ie${ignoreExpires ? 1 : 0}_ps${persistSession ? 1 : 0}';
  }

  @override
  Future<String?> read(String key) => _storage.read(key: _secureKey(key));

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: _secureKey(key), value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: _secureKey(key));

  @override
  Future<void> deleteAll(List<String> keys) async {
    for (final key in keys) {
      await delete(key);
    }
  }
}
