import 'package:guruspace_mobile/features/auth/domain/app_user.dart';

enum AppAudience { student, teacher }

class AppVariant {
  const AppVariant._({
    required this.audience,
    required this.displayName,
    required this.packageId,
    required this.requiredRole,
  });

  final AppAudience audience;
  final String displayName;
  final String packageId;
  final UserRole requiredRole;

  static const student = AppVariant._(
    audience: AppAudience.student,
    displayName: 'GenPro',
    packageId: 'com.genpro.app',
    requiredRole: UserRole.student,
  );

  static const teacher = AppVariant._(
    audience: AppAudience.teacher,
    displayName: 'GenPro Guru',
    packageId: 'com.genpro.teacher',
    requiredRole: UserRole.teacher,
  );

  bool accepts(UserRole role) => role == requiredRole;

  String wrongRoleMessage(UserRole actualRole) {
    final accountType = switch (actualRole) {
      UserRole.student => 'siswa',
      UserRole.teacher => 'guru',
      _ => 'yang tidak didukung',
    };
    final targetApp = audience == AppAudience.student
        ? 'GenPro Guru'
        : 'GenPro';
    return 'Akun ini adalah akun $accountType. Silakan masuk melalui aplikasi $targetApp.';
  }
}
