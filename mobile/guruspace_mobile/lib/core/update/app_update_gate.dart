import 'dart:async';

import 'package:flutter/material.dart';
import 'package:guruspace_mobile/core/config/app_variant.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/update/app_update_screen.dart';
import 'package:guruspace_mobile/core/update/app_update_service.dart';

class AppUpdateGate extends StatefulWidget {
  const AppUpdateGate({
    super.key,
    required this.variant,
    required this.child,
    this.service,
    this.checkTimeout = const Duration(seconds: 4),
  });

  final AppVariant variant;
  final Widget child;
  final AppUpdateService? service;
  final Duration checkTimeout;

  @override
  State<AppUpdateGate> createState() => _AppUpdateGateState();
}

class _AppUpdateGateState extends State<AppUpdateGate> {
  late final AppUpdateService _service;
  late final bool _ownsService;
  StreamSubscription<AppUpdateProgress>? _progressSubscription;
  AppUpdateInfo? _info;
  AppUpdateProgress? _progress;
  bool _checking = true;
  bool _dismissed = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _ownsService = widget.service == null;
    _service =
        widget.service ??
        PlayAppUpdateService(packageName: widget.variant.packageId);
    _progressSubscription = _service.progress.listen(_onProgress);
    unawaited(_check());
  }

  @override
  void dispose() {
    unawaited(_progressSubscription?.cancel());
    if (_ownsService) _service.dispose();
    super.dispose();
  }

  Future<void> _check() async {
    try {
      final info = await _service.checkForUpdate().timeout(widget.checkTimeout);
      if (!mounted) return;
      setState(() {
        _info = info;
        _checking = false;
        if (info.installStatus == AppUpdateInstallStatus.downloaded) {
          _progress = const AppUpdateProgress(
            status: AppUpdateInstallStatus.downloaded,
          );
        }
      });
    } catch (_) {
      if (!mounted) return;
      // Fail open: network/Play Store trouble must not block login.
      setState(() => _checking = false);
    }
  }

  void _onProgress(AppUpdateProgress progress) {
    if (!mounted) return;
    setState(() {
      _progress = progress;
      if (progress.status == AppUpdateInstallStatus.failed ||
          progress.status == AppUpdateInstallStatus.canceled) {
        _busy = false;
        _error =
            progress.message ??
            (progress.status == AppUpdateInstallStatus.canceled
                ? 'Pembaruan dibatalkan. Anda dapat mencobanya kembali.'
                : 'Pembaruan belum dapat dipasang.');
      } else if (progress.status == AppUpdateInstallStatus.downloading ||
          progress.status == AppUpdateInstallStatus.pending) {
        _busy = false;
        _error = null;
      }
    });
  }

  Future<void> _update() async {
    if (_busy || _info == null) return;
    if (_progress?.status == AppUpdateInstallStatus.pending ||
        _progress?.status == AppUpdateInstallStatus.downloading ||
        _progress?.status == AppUpdateInstallStatus.installing) {
      return;
    }
    if (_progress?.status == AppUpdateInstallStatus.downloaded ||
        _info!.installStatus == AppUpdateInstallStatus.downloaded) {
      setState(() {
        _busy = true;
        _error = null;
      });
      try {
        final completed = await _service.completeUpdate();
        if (mounted && !completed) {
          setState(() {
            _busy = false;
            _error = 'Pembaruan belum dapat dipasang.';
          });
        }
      } catch (_) {
        if (mounted) {
          setState(() {
            _busy = false;
            _error = 'Pembaruan belum dapat dipasang.';
          });
        }
      }
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final immediate = _info!.required || !_info!.flexibleAllowed;
      final started = await _service.startUpdate(immediate: immediate);
      if (!mounted) return;
      if (!started) {
        setState(() {
          _busy = false;
          _error = 'Pembaruan otomatis tidak tersedia pada perangkat ini.';
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = 'Pembaruan otomatis belum dapat dimulai.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = _info;
    if (_checking) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: const Scaffold(
          key: Key('app-update-checking'),
          backgroundColor: Color(0xFFF8FBFF),
          body: Center(
            child: SizedBox.square(
              dimension: 28,
              child: CircularProgressIndicator(strokeWidth: 3),
            ),
          ),
        ),
      );
    }
    if (_dismissed || info == null || !info.available) return widget.child;
    return MaterialApp(
      title: widget.variant.displayName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: AppUpdateScreen(
        info: info,
        progress: _progress,
        busy:
            _busy ||
            _progress?.status == AppUpdateInstallStatus.pending ||
            _progress?.status == AppUpdateInstallStatus.downloading ||
            _progress?.status == AppUpdateInstallStatus.installing,
        error: _error,
        onUpdate: _update,
        onLater: info.required ? null : () => setState(() => _dismissed = true),
        onOpenStore: () => unawaited(_service.openStore()),
      ),
    );
  }
}
