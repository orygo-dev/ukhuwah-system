import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/config/app_variant.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';

void main() {
  test('identitas aplikasi siswa dan guru terpisah', () {
    expect(AppVariant.student.displayName, 'GenPro');
    expect(AppVariant.student.packageId, 'com.genpro.app');
    expect(AppVariant.student.requiredRole, UserRole.student);

    expect(AppVariant.teacher.displayName, 'GenPro Guru');
    expect(AppVariant.teacher.packageId, 'com.genpro.teacher');
    expect(AppVariant.teacher.requiredRole, UserRole.teacher);
  });

  test('setiap aplikasi hanya menerima role yang sesuai', () {
    expect(AppVariant.student.accepts(UserRole.student), isTrue);
    expect(AppVariant.student.accepts(UserRole.teacher), isFalse);
    expect(AppVariant.teacher.accepts(UserRole.teacher), isTrue);
    expect(AppVariant.teacher.accepts(UserRole.student), isFalse);
  });

  test('pesan salah aplikasi mengarahkan ke aplikasi yang benar', () {
    expect(
      AppVariant.student.wrongRoleMessage(UserRole.teacher),
      contains('GenPro Guru'),
    );
    expect(
      AppVariant.teacher.wrongRoleMessage(UserRole.student),
      contains('GenPro'),
    );
  });
}
