enum StudentAdmobPlacement {
  readingBanner,
  madingBanner,
  assignmentsBanner,
  quizBanner,
  madingNative,
}

class MobileAdConfig {
  const MobileAdConfig({
    required this.enabled,
    required this.studentUnits,
    required this.madingEveryNPosts,
  });

  static const disabled = MobileAdConfig(
    enabled: false,
    studentUnits: {},
    madingEveryNPosts: 5,
  );

  final bool enabled;
  final Map<StudentAdmobPlacement, String> studentUnits;
  final int madingEveryNPosts;

  static final RegExp _adUnitPattern = RegExp(r'^ca-app-pub-\d{16}/\d{10}$');

  factory MobileAdConfig.fromJson(Map<String, dynamic> json) {
    if (json['enabled'] != true || json['ageTreatment'] != 2) {
      return disabled;
    }
    final student = json['student'];
    if (student is! Map) return disabled;
    final raw = Map<String, dynamic>.from(student);
    final units = <StudentAdmobPlacement, String>{};
    void add(StudentAdmobPlacement placement, String key) {
      final value = raw[key]?.toString().trim() ?? '';
      if (_adUnitPattern.hasMatch(value)) units[placement] = value;
    }

    add(StudentAdmobPlacement.readingBanner, 'readingBanner');
    add(StudentAdmobPlacement.madingBanner, 'madingBanner');
    add(StudentAdmobPlacement.assignmentsBanner, 'assignmentsBanner');
    add(StudentAdmobPlacement.quizBanner, 'quizBanner');
    add(StudentAdmobPlacement.madingNative, 'madingNative');
    final requestedFrequency =
        (json['madingEveryNPosts'] as num?)?.toInt() ?? 5;
    return MobileAdConfig(
      enabled: units.isNotEmpty,
      studentUnits: Map.unmodifiable(units),
      madingEveryNPosts: requestedFrequency.clamp(4, 20),
    );
  }

  String unitFor(StudentAdmobPlacement placement) =>
      enabled ? studentUnits[placement] ?? '' : '';
}
