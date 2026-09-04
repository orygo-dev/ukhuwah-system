import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

enum AppUpdateInstallStatus {
  unknown,
  pending,
  downloading,
  installing,
  installed,
  downloaded,
  failed,
  canceled,
}

class AppUpdateInfo {
  const AppUpdateInfo({
    required this.available,
    required this.availableVersionCode,
    required this.priority,
    required this.immediateAllowed,
    required this.flexibleAllowed,
    required this.developerTriggered,
    required this.installStatus,
    this.stalenessDays,
  });

  const AppUpdateInfo.unavailable()
    : available = false,
      availableVersionCode = 0,
      priority = 0,
      immediateAllowed = false,
      flexibleAllowed = false,
      developerTriggered = false,
      installStatus = AppUpdateInstallStatus.unknown,
      stalenessDays = null;

  final bool available;
  final int availableVersionCode;
  final int priority;
  final bool immediateAllowed;
  final bool flexibleAllowed;
  final bool developerTriggered;
  final AppUpdateInstallStatus installStatus;
  final int? stalenessDays;

  bool get required =>
      developerTriggered || (priority >= 4 && immediateAllowed);

  factory AppUpdateInfo.fromMap(Map<Object?, Object?> map) => AppUpdateInfo(
    available: map['available'] == true,
    availableVersionCode: (map['availableVersionCode'] as num?)?.toInt() ?? 0,
    priority: (map['priority'] as num?)?.toInt() ?? 0,
    immediateAllowed: map['immediateAllowed'] == true,
    flexibleAllowed: map['flexibleAllowed'] == true,
    developerTriggered: map['developerTriggered'] == true,
    installStatus: appUpdateInstallStatus(
      (map['installStatus'] as num?)?.toInt(),
    ),
    stalenessDays: (map['stalenessDays'] as num?)?.toInt(),
  );
}

class AppUpdateProgress {
  const AppUpdateProgress({
    required this.status,
    this.bytesDownloaded = 0,
    this.totalBytes = 0,
    this.message,
  });

  final AppUpdateInstallStatus status;
  final int bytesDownloaded;
  final int totalBytes;
  final String? message;

  double? get fraction =>
      totalBytes > 0 ? (bytesDownloaded / totalBytes).clamp(0.0, 1.0) : null;
}

AppUpdateInstallStatus appUpdateInstallStatus(int? value) => switch (value) {
  1 => AppUpdateInstallStatus.pending,
  2 => AppUpdateInstallStatus.downloading,
  3 => AppUpdateInstallStatus.installing,
  4 => AppUpdateInstallStatus.installed,
  5 => AppUpdateInstallStatus.failed,
  6 => AppUpdateInstallStatus.canceled,
  11 => AppUpdateInstallStatus.downloaded,
  _ => AppUpdateInstallStatus.unknown,
};

abstract class AppUpdateService {
  Future<AppUpdateInfo> checkForUpdate();

  Future<bool> startUpdate({required bool immediate});

  Future<bool> completeUpdate();

  Future<bool> openStore();

  Stream<AppUpdateProgress> get progress;

  void dispose();
}

class PlayAppUpdateService implements AppUpdateService {
  PlayAppUpdateService({required this.packageName}) {
    _channel.setMethodCallHandler(_handleNativeCall);
  }

  static const _channel = MethodChannel('genpro/in_app_update');
  final String packageName;
  final _progress = StreamController<AppUpdateProgress>.broadcast();
  bool _disposed = false;

  bool get _supported =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  @override
  Stream<AppUpdateProgress> get progress => _progress.stream;

  @override
  Future<AppUpdateInfo> checkForUpdate() async {
    if (!_supported) return const AppUpdateInfo.unavailable();
    final value = await _channel.invokeMapMethod<Object?, Object?>(
      'checkForUpdate',
    );
    return value == null
        ? const AppUpdateInfo.unavailable()
        : AppUpdateInfo.fromMap(value);
  }

  @override
  Future<bool> startUpdate({required bool immediate}) async {
    if (!_supported) return false;
    return await _channel.invokeMethod<bool>('startUpdate', {
          'immediate': immediate,
        }) ??
        false;
  }

  @override
  Future<bool> completeUpdate() async {
    if (!_supported) return false;
    return await _channel.invokeMethod<bool>('completeUpdate') ?? false;
  }

  @override
  Future<bool> openStore() async {
    final market = Uri.parse('market://details?id=$packageName');
    final web = Uri.https('play.google.com', '/store/apps/details', {
      'id': packageName,
    });
    try {
      if (await launchUrl(market, mode: LaunchMode.externalApplication)) {
        return true;
      }
    } catch (_) {
      // Browser fallback below also works on devices without Play Store.
    }
    try {
      return await launchUrl(web, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }

  Future<void> _handleNativeCall(MethodCall call) async {
    if (_disposed) return;
    final arguments = call.arguments;
    final map = arguments is Map
        ? Map<Object?, Object?>.from(arguments)
        : const <Object?, Object?>{};
    switch (call.method) {
      case 'installState':
        _progress.add(
          AppUpdateProgress(
            status: appUpdateInstallStatus((map['status'] as num?)?.toInt()),
            bytesDownloaded: (map['bytesDownloaded'] as num?)?.toInt() ?? 0,
            totalBytes: (map['totalBytes'] as num?)?.toInt() ?? 0,
          ),
        );
        return;
      case 'flowResult':
        if ((map['resultCode'] as num?)?.toInt() == 0) {
          _progress.add(
            const AppUpdateProgress(status: AppUpdateInstallStatus.canceled),
          );
        }
        return;
      case 'flowError':
        _progress.add(
          AppUpdateProgress(
            status: AppUpdateInstallStatus.failed,
            message: map['message']?.toString(),
          ),
        );
        return;
    }
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _channel.setMethodCallHandler(null);
    unawaited(_progress.close());
  }
}
