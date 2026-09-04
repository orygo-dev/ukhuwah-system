import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/config/app_variant.dart';
import 'package:guruspace_mobile/core/notifications/push_notification_service.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/presence/student_presence_reporter.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';
import 'package:guruspace_mobile/features/auth/domain/auth_state.dart';
import 'package:guruspace_mobile/features/auth/presentation/login_screen.dart';
import 'package:guruspace_mobile/features/splash/presentation/genpro_splash_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_app.dart';
import 'package:guruspace_mobile/features/teacher/presentation/teacher_app.dart';

class GuruSpaceApp extends ConsumerWidget {
  const GuruSpaceApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final variant = ref.watch(appVariantProvider);
    return MaterialApp(
      navigatorKey: PushNotificationService.instance.navigatorKey,
      title: variant.displayName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const _AuthGate(),
    );
  }
}

class _AuthGate extends ConsumerStatefulWidget {
  const _AuthGate();

  @override
  ConsumerState<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends ConsumerState<_AuthGate> {
  bool _animationDone = false;

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final variant = ref.watch(appVariantProvider);

    if (auth.status == AuthStatus.authenticated && auth.user != null) {
      final appId = variant.audience == AppAudience.student
          ? 'com.genpro.app'
          : 'com.genpro.teacher';
      unawaited(
        PushNotificationService.instance.syncAuthenticated(
          userId: auth.user!.id,
          appId: appId,
        ),
      );
    }

    if (!_animationDone) {
      return GenProSplashScreen(
        key: const ValueKey('genpro-splash-intro'),
        onFinished: () {
          if (mounted) setState(() => _animationDone = true);
        },
      );
    }
    if (auth.status == AuthStatus.checking) {
      return const GenProSplashHold();
    }
    return _destination(auth);
  }

  Widget _destination(AuthState auth) {
    if (auth.status != AuthStatus.authenticated || auth.user == null) {
      return const LoginScreen();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      PushNotificationService.instance.markAppReady();
    });
    return switch (auth.user!.role) {
      UserRole.student => StudentPresenceReporter(
        key: ValueKey('presence-${auth.user!.id}'),
        child: StudentApp(
          key: ValueKey('student-app-${auth.user!.id}'),
          user: auth.user!,
        ),
      ),
      UserRole.teacher => TeacherApp(
        key: ValueKey('teacher-app-${auth.user!.id}'),
        user: auth.user!,
      ),
      _ => const LoginScreen(),
    };
  }
}
