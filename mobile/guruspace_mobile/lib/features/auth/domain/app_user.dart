import 'dart:typed_data';

import 'package:guruspace_mobile/core/config/app_config.dart';

enum UserRole {
  student,
  teacher,
  schoolAdmin,
  provinceAdmin,
  superAdmin,
  unknown;

  static UserRole fromApi(String? value) => switch (value) {
    'STUDENT' => UserRole.student,
    'TEACHER' => UserRole.teacher,
    'SCHOOL_ADMIN' => UserRole.schoolAdmin,
    'PROVINCE_ADMIN' => UserRole.provinceAdmin,
    'SUPER_ADMIN' => UserRole.superAdmin,
    _ => UserRole.unknown,
  };
}

class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.schoolId,
    this.studentId,
    this.avatarUrl,
    this.avatarBytes,
    this.creditsRemaining = 0,
    this.membershipPlan,
  });

  final String id;
  final String email;
  final String name;
  final UserRole role;
  final String? schoolId;
  final String? studentId;
  final String? avatarUrl;
  final Uint8List? avatarBytes;
  final int creditsRemaining;
  final MembershipPlan? membershipPlan;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    final rawAvatar = json['avatarUrl']?.toString().trim();
    return AppUser(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Pengguna GuruSpace',
      role: UserRole.fromApi(json['role']?.toString()),
      schoolId: json['schoolId']?.toString(),
      studentId: json['studentId']?.toString(),
      avatarUrl: rawAvatar == null || rawAvatar.isEmpty
          ? null
          : resolveAppMediaUrl(rawAvatar),
      creditsRemaining: (json['creditsRemaining'] as num?)?.toInt() ?? 0,
      membershipPlan: json['membershipPlan'] is Map
          ? MembershipPlan.fromJson(
              Map<String, dynamic>.from(json['membershipPlan'] as Map),
            )
          : null,
    );
  }

  AppUser copyWith({String? avatarUrl, Uint8List? avatarBytes}) => AppUser(
    id: id,
    email: email,
    name: name,
    role: role,
    schoolId: schoolId,
    studentId: studentId,
    avatarUrl: avatarUrl != null ? resolveAppMediaUrl(avatarUrl) : this.avatarUrl,
    avatarBytes: avatarBytes ?? this.avatarBytes,
    creditsRemaining: creditsRemaining,
    membershipPlan: membershipPlan,
  );
}

class MembershipPlan {
  const MembershipPlan({
    required this.name,
    required this.slug,
    required this.status,
    required this.isActive,
    this.expiresAt,
  });

  final String name;
  final String slug;
  final String status;
  final bool isActive;
  final DateTime? expiresAt;

  factory MembershipPlan.fromJson(Map<String, dynamic> json) => MembershipPlan(
    name: json['name']?.toString() ?? 'Member',
    slug: json['slug']?.toString() ?? '',
    status: json['status']?.toString() ?? 'active',
    isActive: json['isActive'] == true,
    expiresAt: DateTime.tryParse(json['expiresAt']?.toString() ?? ''),
  );
}
