import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/providers.dart';

/// Optional presence, independent of login and learning requests.
/// No history, location, screen content, or device identifier is transmitted.
class StudentPresenceReporter extends ConsumerStatefulWidget {
  const StudentPresenceReporter({required this.child, super.key});
  final Widget child;

  @override
  ConsumerState<StudentPresenceReporter> createState() =>
      _StudentPresenceReporterState();
}

class _StudentPresenceReporterState
    extends ConsumerState<StudentPresenceReporter>
    with WidgetsBindingObserver {
  Timer? _timer;
  CancelToken? _request;
  bool _allowed = true;
  bool _foreground = true;
  bool _resumePending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final state = WidgetsBinding.instance.lifecycleState;
    _foreground = state == null || state == AppLifecycleState.resumed;
    unawaited(_send());
  }

  Future<void> _send() async {
    _timer?.cancel();
    if (!mounted || !_allowed || !_foreground || _request != null) return;
    final cancellation = CancelToken();
    _request = cancellation;
    try {
      final response = await ref
          .read(apiClientProvider)
          .dio
          .post<void>(
            '/api/student-presence/heartbeat',
            cancelToken: cancellation,
            options: Options(
              sendTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 10),
            ),
          );
      if (response.statusCode == 401 || response.statusCode == 403) {
        _allowed = false;
      }
    } on DioException catch (error) {
      if (error.response?.statusCode == 401 ||
          error.response?.statusCode == 403) {
        _allowed = false;
      }
    } catch (_) {
      // A missing presence service must not interrupt learning or sign-in.
    } finally {
      _request = null;
      if (mounted && _allowed && _foreground) {
        final delay = _resumePending
            ? Duration.zero
            : const Duration(seconds: 45);
        _resumePending = false;
        _timer = Timer(delay, () => unawaited(_send()));
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) {
      _resumePending = _request != null;
      unawaited(_send());
    } else {
      _resumePending = false;
      _timer?.cancel();
      _request?.cancel('App is not in foreground');
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _request?.cancel('Presence reporter disposed');
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
