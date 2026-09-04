abstract final class AppConfig {
  static const baseUrl = String.fromEnvironment(
    'GURUSPACE_BASE_URL',
    defaultValue: 'https://guruspaceai.cloud',
  );

  static const appName = 'GuruSpace';
}

Uri validatedAppBaseUri({String? value, bool allowInsecureLocalhost = false}) {
  final uri = Uri.tryParse((value ?? AppConfig.baseUrl).trim());
  if (uri == null || !uri.hasAuthority || uri.host.isEmpty) {
    throw const FormatException('Alamat server GenPro tidak valid.');
  }
  final localHost =
      uri.host == 'localhost' ||
      uri.host == '127.0.0.1' ||
      uri.host == '10.0.2.2';
  if (uri.scheme != 'https' && !(allowInsecureLocalhost && localHost)) {
    throw const FormatException('Server GenPro wajib menggunakan HTTPS.');
  }
  return uri;
}

bool isSameOriginAppUri(Uri uri, {String? baseUrl}) {
  final origin = validatedAppBaseUri(value: baseUrl);
  return uri.scheme == origin.scheme &&
      uri.host.toLowerCase() == origin.host.toLowerCase() &&
      uri.port == origin.port;
}

Uri? safeExternalUri(String value, {String? baseUrl}) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  final origin = validatedAppBaseUri(value: baseUrl);
  final parsed = Uri.tryParse(trimmed);
  final uri = parsed?.hasScheme == true ? parsed! : origin.resolve(trimmed);
  if (uri.scheme != 'https' ||
      !uri.hasAuthority ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty) {
    return null;
  }
  return uri;
}

String? _appMediaPath(String path) {
  final appDisplayIndex = path.indexOf('/uploads/app-display/');
  if (appDisplayIndex >= 0) {
    return path.substring(appDisplayIndex);
  }
  const uploadsPrefix = '/uploads/';
  const mediaPrefix = '/api/media/';
  final uploadsIndex = path.indexOf(uploadsPrefix);
  if (uploadsIndex >= 0) {
    return '$mediaPrefix${path.substring(uploadsIndex + uploadsPrefix.length)}';
  }
  final mediaIndex = path.indexOf(mediaPrefix);
  if (mediaIndex >= 0) {
    return path.substring(mediaIndex);
  }
  return null;
}

String resolveAppMediaUrl(String value, {String? baseUrl}) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return trimmed;
  final origin = validatedAppBaseUri(value: baseUrl);
  final uri = Uri.tryParse(trimmed);
  if (uri != null && uri.hasScheme) {
    final rewritten = _appMediaPath(uri.path);
    if (rewritten != null) {
      final resolved = origin.resolve(rewritten);
      return uri.hasQuery
          ? resolved.replace(query: uri.query).toString()
          : resolved.toString();
    }
    return uri.toString();
  }
  final rewritten = _appMediaPath(
    trimmed.startsWith('/') ? trimmed : '/$trimmed',
  );
  if (rewritten != null) {
    return origin.resolve(rewritten).toString();
  }
  return origin.resolve(trimmed).toString();
}
