import 'package:guruspace_mobile/features/auth/domain/app_user.dart';

enum AuthStatus { checking, unauthenticated, authenticating, authenticated }

class AuthState {
  const AuthState({required this.status, this.user, this.errorMessage});

  const AuthState.checking() : this(status: AuthStatus.checking);
  const AuthState.unauthenticated({String? errorMessage})
    : this(status: AuthStatus.unauthenticated, errorMessage: errorMessage);

  final AuthStatus status;
  final AppUser? user;
  final String? errorMessage;

  AuthState copyWith({
    AuthStatus? status,
    AppUser? user,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
    );
  }
}
