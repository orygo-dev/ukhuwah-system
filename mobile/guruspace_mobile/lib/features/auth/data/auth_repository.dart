import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/core/network/api_exception.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';

class AuthRepository {
  const AuthRepository(this._client);
  final ApiClient _client;

  Future<AppUser?> currentUser() async {
    final json = await _client.getJson('/api/auth/session');
    final user = json['user'];
    if (user is! Map) {
      await _client.clearSession();
      return null;
    }
    final sessionUser = AppUser.fromJson(Map<String, dynamic>.from(user));
    try {
      final bootstrap = await _client.getJson('/api/mobile/v1/bootstrap');
      final latestUser = bootstrap['user'];
      if (latestUser is Map) {
        return AppUser.fromJson(Map<String, dynamic>.from(latestUser));
      }
    } on ApiException catch (error) {
      if (error.isUnauthorized) {
        // Cookie lama/dicabut bukan kegagalan jaringan sementara. Jangan buka
        // dashboard dengan sesi yang sudah ditolak oleh API server.
        await _client.clearSession();
        return null;
      }
      // Jangan hapus sesi hanya karena bootstrap sementara tidak tersedia.
    }
    return sessionUser;
  }

  Future<AppUser> login(String email, String password) async {
    final csrf = await _client.getJson('/api/auth/csrf');
    final token = csrf['csrfToken']?.toString();
    if (token == null || token.isEmpty) {
      throw const ApiException('Token keamanan login tidak tersedia.');
    }
    final response = await _client.postForm(
      '/api/auth/callback/credentials',
      {
        'csrfToken': token,
        'email': email.trim().toLowerCase(),
        'password': password,
        'callbackUrl': '/',
      },
      headers: {'X-Auth-Return-Redirect': '1'},
    );
    final redirectUrl = response['url']?.toString() ?? '';
    if (redirectUrl.contains('error=')) {
      throw const ApiException('Email atau password salah.', statusCode: 401);
    }
    final user = await currentUser();
    if (user == null) {
      throw const ApiException(
        'Sesi login belum terbentuk. Silakan coba lagi.',
      );
    }
    if (user.role != UserRole.student && user.role != UserRole.teacher) {
      await logout();
      throw const ApiException(
        'Versi awal aplikasi hanya mendukung akun siswa dan guru.',
        statusCode: 403,
      );
    }
    return user;
  }

  Future<String> requestPasswordReset(String email) async {
    final response = await _client.postJson(
      '/api/auth/forgot-password/request',
      data: {'email': email.trim().toLowerCase()},
    );
    return response['message']?.toString() ??
        'Jika email terdaftar, kode OTP akan dikirim melalui WhatsApp.';
  }

  Future<String> resetPassword({
    required String email,
    required String code,
    required String password,
  }) async {
    final response = await _client.postJson(
      '/api/auth/forgot-password/reset',
      data: {
        'email': email.trim().toLowerCase(),
        'code': code.trim(),
        'password': password,
      },
    );
    return response['message']?.toString() ?? 'Password berhasil diperbarui.';
  }

  Future<String> uploadStudentAvatar({
    required String filePath,
    required String fileName,
  }) async {
    final response = await _client.postMultipartFile(
      '/api/mobile/v1/student/profile/avatar',
      fieldName: 'file',
      filePath: filePath,
      fileName: fileName,
    );
    final avatarUrl = response['avatarUrl']?.toString() ?? '';
    if (avatarUrl.isEmpty) {
      throw const ApiException('Alamat foto profil tidak tersedia.');
    }
    return resolveAppMediaUrl(
      Uri.parse(_client.dio.options.baseUrl).resolve(avatarUrl).toString(),
    );
  }

  Future<String> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await _client.postJson(
      '/api/mobile/v1/account/password',
      data: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
    return response['message']?.toString() ?? 'Password berhasil diperbarui.';
  }

  Future<void> logout() async {
    try {
      final csrf = await _client.getJson('/api/auth/csrf');
      final token = csrf['csrfToken']?.toString();
      if (token != null && token.isNotEmpty) {
        await _client.postForm(
          '/api/auth/signout',
          {'csrfToken': token, 'callbackUrl': '/'},
          headers: {'X-Auth-Return-Redirect': '1'},
        );
      }
    } finally {
      await _client.clearSession();
    }
  }
}
