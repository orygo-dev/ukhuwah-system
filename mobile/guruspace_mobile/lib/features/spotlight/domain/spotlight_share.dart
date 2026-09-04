import 'package:guruspace_mobile/core/config/app_config.dart';

enum SpotlightKind { teacher, student }

String spotlightShareUrl(SpotlightKind kind, String postId) => Uri.parse(
  AppConfig.baseUrl,
).resolve('/spotlight/${kind.name}/${Uri.encodeComponent(postId)}').toString();
