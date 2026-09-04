import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/config/app_variant.dart';
import 'package:guruspace_mobile/core/ads/mobile_ad_config.dart';
import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/features/auth/data/auth_repository.dart';
import 'package:guruspace_mobile/features/auth/domain/auth_state.dart';
import 'package:guruspace_mobile/features/auth/presentation/auth_controller.dart';
import 'package:guruspace_mobile/features/dashboard/data/dashboard_repository.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/dashboard/domain/app_display_models.dart';
import 'package:guruspace_mobile/features/spotlight/data/spotlight_repository.dart';
import 'package:guruspace_mobile/features/student/data/student_social_repository.dart';
import 'package:guruspace_mobile/features/student/domain/student_social_models.dart';

final apiClientProvider = Provider<ApiClient>(
  (ref) => throw UnimplementedError('ApiClient must be overridden in main().'),
);

final appVariantProvider = Provider<AppVariant>((ref) => AppVariant.student);

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider)),
);

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => DashboardRepository(ref.watch(apiClientProvider)),
);

final spotlightRepositoryProvider = Provider<SpotlightRepository>(
  (ref) => SpotlightRepository(ref.watch(apiClientProvider)),
);

final studentSocialRepositoryProvider = Provider<StudentSocialRepository>(
  (ref) => StudentSocialRepository(ref.watch(apiClientProvider)),
);

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(
    ref.watch(authRepositoryProvider),
    ref.watch(appVariantProvider),
  ),
);

/// Identity boundary for every provider that contains account-private data.
/// A different login must produce a different dependency and force a refetch.
final authenticatedUserIdProvider = Provider<String?>((ref) {
  return ref.watch(authControllerProvider.select((state) => state.user?.id));
});

void _watchAuthenticatedUser(Ref ref) {
  ref.watch(authenticatedUserIdProvider);
}

final studentDashboardProvider = FutureProvider<StudentDashboard>((ref) {
  _watchAuthenticatedUser(ref);
  return ref.watch(dashboardRepositoryProvider).getStudentDashboard();
});

final studentMadingProvider = FutureProvider<List<StudentBoardItem>>((ref) {
  _watchAuthenticatedUser(ref);
  return ref.watch(dashboardRepositoryProvider).getStudentMading();
});

final mobileAdConfigProvider = FutureProvider<MobileAdConfig>((ref) async {
  _watchAuthenticatedUser(ref);
  final json = await ref.watch(apiClientProvider).getJson('/api/mobile/v1/ads');
  return MobileAdConfig.fromJson(json);
});

final studentWorksProvider = FutureProvider<StudentWorks>((ref) {
  _watchAuthenticatedUser(ref);
  return ref.watch(dashboardRepositoryProvider).getStudentWorks();
});

final studentCreatorProfileProvider =
    FutureProvider.family<StudentCreatorProfile, String>((ref, studentId) {
      _watchAuthenticatedUser(ref);
      return ref
          .watch(dashboardRepositoryProvider)
          .getStudentCreatorProfile(studentId);
    });

final studentSocialRefreshProvider = StateProvider<int>((ref) => 0);

final studentInboxProvider = FutureProvider<StudentInboxData>((ref) {
  _watchAuthenticatedUser(ref);
  ref.watch(studentSocialRefreshProvider);
  return ref.watch(studentSocialRepositoryProvider).getInbox();
});

final studentSocialUnreadProvider = FutureProvider<int>((ref) {
  _watchAuthenticatedUser(ref);
  ref.watch(studentSocialRefreshProvider);
  return ref.watch(studentSocialRepositoryProvider).getUnreadCount();
});

final studentConversationProvider =
    FutureProvider.family<StudentConversationDetail, String>((ref, id) {
      _watchAuthenticatedUser(ref);
      ref.watch(studentSocialRefreshProvider);
      return ref.watch(studentSocialRepositoryProvider).getConversation(id);
    });

final teacherDashboardProvider = FutureProvider<TeacherDashboard>((ref) {
  _watchAuthenticatedUser(ref);
  return ref.watch(dashboardRepositoryProvider).getTeacherDashboard();
});

final mobileAppDisplayProvider = FutureProvider<MobileAppDisplay>((ref) async {
  final json = await ref.watch(apiClientProvider).getJson('/api/app-display');
  return MobileAppDisplay.fromJson(json);
});

final mobileBannerProvider = FutureProvider<MobileBannerDisplay>(
  (ref) async => (await ref.watch(mobileAppDisplayProvider.future)).banners,
);

final mobilePopupProvider = FutureProvider<MobilePopupDisplay>(
  (ref) async => (await ref.watch(mobileAppDisplayProvider.future)).popup,
);
