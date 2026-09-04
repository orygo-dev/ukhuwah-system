import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/config/app_variant.dart';
import 'package:guruspace_mobile/core/network/api_exception.dart';
import 'package:guruspace_mobile/features/auth/data/auth_repository.dart';
import 'package:guruspace_mobile/features/auth/domain/auth_state.dart';
import 'package:guruspace_mobile/core/notifications/push_notification_service.dart';

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._repository, this._variant)
    : super(const AuthState.checking()) {
    restoreSession();
  }

  final AuthRepository _repository;
  final AppVariant _variant;

  Future<void> restoreSession() async {
    state = const AuthState.checking();
    try {
      final user = await _repository.currentUser();
      if (user == null) {
        state = const AuthState.unauthenticated();
      } else if (!_variant.accepts(user.role)) {
        await _repository.logout();
        state = AuthState.unauthenticated(
          errorMessage: _variant.wrongRoleMessage(user.role),
        );
      } else {
        state = AuthState(status: AuthStatus.authenticated, user: user);
      }
    } on ApiException catch (error) {
      state = AuthState.unauthenticated(errorMessage: error.message);
    } catch (_) {
      state = const AuthState.unauthenticated(
        errorMessage: 'Tidak dapat terhubung ke server GuruSpace.',
      );
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(status: AuthStatus.authenticating, clearError: true);
    try {
      final user = await _repository.login(email, password);
      if (!_variant.accepts(user.role)) {
        await _repository.logout();
        state = AuthState.unauthenticated(
          errorMessage: _variant.wrongRoleMessage(user.role),
        );
        return;
      }
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } on ApiException catch (error) {
      state = AuthState.unauthenticated(errorMessage: error.message);
    } catch (_) {
      state = const AuthState.unauthenticated(
        errorMessage: 'Terjadi kesalahan saat masuk. Silakan coba lagi.',
      );
    }
  }

  Future<void> logout() async {
    await PushNotificationService.instance.unregister();
    await _repository.logout();
    state = const AuthState.unauthenticated();
  }

  void updateAvatarUrl(String avatarUrl, {Uint8List? avatarBytes}) {
    final user = state.user;
    if (user == null) return;
    state = state.copyWith(
      user: user.copyWith(avatarUrl: avatarUrl, avatarBytes: avatarBytes),
    );
  }
}
