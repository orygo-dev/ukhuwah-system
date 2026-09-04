double? _toDouble(Object? value) =>
    value is num ? value.toDouble() : double.tryParse('$value');
int _toInt(Object? value) =>
    value is num ? value.toInt() : int.tryParse('$value') ?? 0;
DateTime? _toDate(Object? value) =>
    value == null ? null : DateTime.tryParse(value.toString());
List<Map<String, dynamic>> _maps(Object? value) => value is List
    ? value
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList()
    : const [];

String? _avatarUrl(Map<String, dynamic> json) {
  final author = json['author'];
  if (author is Map) {
    final value = author['avatarUrl']?.toString().trim();
    if (value?.isNotEmpty == true) return value;
  }
  final student = json['student'];
  final user = student is Map ? student['user'] : null;
  if (user is Map) {
    final value = user['avatarUrl']?.toString().trim();
    if (value?.isNotEmpty == true) return value;
  }
  return null;
}

String _boardSchoolName(Map<String, dynamic> json) {
  final classRoom = json['classRoom'];
  final school = classRoom is Map ? classRoom['school'] : null;
  final nested = school is Map ? school['name']?.toString().trim() : null;
  if (nested?.isNotEmpty == true) return nested!;
  final direct = json['schoolName']?.toString().trim();
  return direct?.isNotEmpty == true ? direct! : 'Sekolah belum tercantum';
}

String? _optionalSchoolName(Map<String, dynamic> json) {
  final classRoom = json['classRoom'];
  final school = classRoom is Map ? classRoom['school'] : null;
  final nested = school is Map ? school['name']?.toString().trim() : null;
  if (nested?.isNotEmpty == true) return nested;
  final direct = json['schoolName']?.toString().trim();
  return direct?.isNotEmpty == true ? direct : null;
}

class LearningItem {
  const LearningItem({
    required this.id,
    required this.title,
    required this.subject,
    required this.kind,
    this.description,
    this.dueAt,
    this.completed = false,
    this.score,
    this.totalQuestions,
  });

  final String id;
  final String title;
  final String subject;
  final String kind;
  final String? description;
  final DateTime? dueAt;
  final bool completed;
  final double? score;
  final int? totalQuestions;
}

class PjjSessionItem {
  const PjjSessionItem({
    required this.id,
    required this.title,
    required this.subject,
    required this.start,
    required this.end,
    required this.status,
    this.className,
    this.teacherName,
  });
  final String id;
  final String title;
  final String subject;
  final DateTime start;
  final DateTime end;
  final String status;
  final String? className;
  final String? teacherName;

  factory PjjSessionItem.fromJson(Map<String, dynamic> json) {
    return PjjSessionItem(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Sesi PJJ',
      subject: json['subject']?.toString() ?? 'Pelajaran',
      start: _toDate(json['scheduledStart']) ?? DateTime.now(),
      end: _toDate(json['scheduledEnd']) ?? DateTime.now(),
      status: json['status']?.toString() ?? 'SCHEDULED',
      className: (json['classRoom'] as Map?)?['name']?.toString(),
      teacherName: (json['createdBy'] as Map?)?['name']?.toString(),
    );
  }
}

class TkaPackageItem {
  const TkaPackageItem({
    required this.id,
    required this.title,
    required this.subject,
    required this.durationMinutes,
    required this.questionCount,
    this.attemptId,
    this.status,
    this.score,
  });
  final String id;
  final String title;
  final String subject;
  final int durationMinutes;
  final int questionCount;
  final String? attemptId;
  final String? status;
  final double? score;

  factory TkaPackageItem.fromJson(Map<String, dynamic> json) {
    final attempts = _maps(json['attempts']);
    final attempt = attempts.isEmpty ? null : attempts.first;
    return TkaPackageItem(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Simulasi TKA',
      subject: (json['subject'] as Map?)?['name']?.toString() ?? 'TKA',
      durationMinutes: _toInt(json['durationMinutes']),
      questionCount: _toInt((json['_count'] as Map?)?['questions']),
      attemptId: attempt?['id']?.toString(),
      status: attempt?['status']?.toString(),
      score: _toDouble(attempt?['score']),
    );
  }
}

class TkaQuestionItem {
  const TkaQuestionItem({
    required this.id,
    required this.type,
    required this.prompt,
    required this.options,
    this.stimulus,
  });

  final String id;
  final String type;
  final String? stimulus;
  final String prompt;
  final List<String> options;

  factory TkaQuestionItem.fromJson(Map<String, dynamic> json) =>
      TkaQuestionItem(
        id: json['id']?.toString() ?? '',
        type: json['type']?.toString() ?? 'SINGLE_CHOICE',
        stimulus: json['stimulus']?.toString(),
        prompt: json['prompt']?.toString() ?? '',
        options: (json['options'] as List? ?? const [])
            .map(
              (value) => value is Map
                  ? (value['text'] ?? value['label'] ?? value['value'])
                        .toString()
                  : value.toString(),
            )
            .toList(),
      );
}

class TkaAttemptDetail {
  const TkaAttemptDetail({
    required this.id,
    required this.title,
    required this.subject,
    required this.status,
    required this.expiresAt,
    required this.questions,
    required this.answers,
    this.score,
    this.correctCount = 0,
  });

  final String id;
  final String title;
  final String subject;
  final String status;
  final DateTime expiresAt;
  final List<TkaQuestionItem> questions;
  final Map<String, Set<int>> answers;
  final double? score;
  final int correctCount;

  factory TkaAttemptDetail.fromJson(Map<String, dynamic> json) {
    final attempt = Map<String, dynamic>.from(json['attempt'] as Map? ?? {});
    final package = Map<String, dynamic>.from(json['package'] as Map? ?? {});
    final answers = <String, Set<int>>{};
    for (final item in _maps(json['answers'])) {
      answers[item['questionId']?.toString() ?? ''] =
          (item['selectedAnswers'] as List? ?? const []).map(_toInt).toSet();
    }
    return TkaAttemptDetail(
      id: attempt['id']?.toString() ?? '',
      title: package['title']?.toString() ?? 'Simulasi TKA',
      subject: package['subject']?.toString() ?? 'TKA',
      status: attempt['status']?.toString() ?? 'IN_PROGRESS',
      expiresAt: _toDate(attempt['expiresAt']) ?? DateTime.now(),
      questions: _maps(
        json['questions'],
      ).map(TkaQuestionItem.fromJson).toList(),
      answers: answers,
      score: _toDouble(attempt['score']),
      correctCount: _toInt(attempt['correctCount']),
    );
  }
}

class StudentDashboard {
  const StudentDashboard({
    required this.name,
    required this.className,
    required this.schoolName,
    required this.schoolId,
    required this.teacherName,
    required this.pendingAssignments,
    required this.attendancePercent,
    required this.attendanceCounts,
    required this.averageScore,
    required this.followerCount,
    required this.assignments,
    required this.quizzes,
    required this.exams,
    required this.pjj,
    required this.tkaPackages,
    required this.reading,
    required this.boardPosts,
    required this.spotlight,
  });

  final String name;
  final String className;
  final String schoolName;
  final String? schoolId;
  final String teacherName;
  final int pendingAssignments;
  final int? attendancePercent;
  final Map<String, int> attendanceCounts;
  final double? averageScore;
  final int followerCount;
  final List<LearningItem> assignments;
  final List<LearningItem> quizzes;
  final List<LearningItem> exams;
  final List<PjjSessionItem> pjj;
  final List<TkaPackageItem> tkaPackages;
  final List<ReadingProgressItem> reading;
  final List<StudentBoardItem> boardPosts;
  final List<StudentSpotlightItem> spotlight;

  factory StudentDashboard.fromJson(Map<String, dynamic> json) {
    final student = Map<String, dynamic>.from(json['student'] as Map? ?? {});
    final room = Map<String, dynamic>.from(student['classRoom'] as Map? ?? {});
    final summary = Map<String, dynamic>.from(json['summary'] as Map? ?? {});
    final attendanceCounts = <String, int>{};
    for (final item in _maps(json['attendance'])) {
      attendanceCounts[item['status']?.toString() ?? ''] = _toInt(
        (item['_count'] as Map?)?['_all'],
      );
    }
    return StudentDashboard(
      name: student['name']?.toString() ?? 'Siswa',
      className: room['name']?.toString() ?? 'Kelas belum terhubung',
      schoolName: (room['school'] as Map?)?['name']?.toString() ?? 'GuruSpace',
      schoolId:
          (room['school'] as Map?)?['id']?.toString() ??
          room['schoolId']?.toString(),
      teacherName: (room['teacher'] as Map?)?['name']?.toString() ?? 'Guru',
      pendingAssignments: _toInt(summary['pendingAssignments']),
      attendancePercent: summary['attendancePercent'] == null
          ? null
          : _toInt(summary['attendancePercent']),
      attendanceCounts: attendanceCounts,
      averageScore: _toDouble(summary['averageScore']),
      followerCount: _toInt(summary['followerCount']),
      assignments: _maps(json['assignments']).map((item) {
        final submissions = _maps(item['submissions']);
        final submission = submissions.isEmpty ? null : submissions.first;
        return LearningItem(
          id: item['id']?.toString() ?? '',
          title: item['title']?.toString() ?? 'Tugas',
          subject: item['mapel']?.toString() ?? 'Pelajaran',
          kind: 'Tugas',
          description: item['description']?.toString(),
          dueAt: _toDate(item['dueAt'] ?? item['dueDate']),
          completed: submission != null,
          score: _toDouble(submission?['score']),
        );
      }).toList(),
      quizzes: _maps(json['quizzes']).map((item) {
        final attempts = _maps(item['attempts']);
        final attempt = attempts.isEmpty ? null : attempts.first;
        return LearningItem(
          id: item['id']?.toString() ?? '',
          title: item['title']?.toString() ?? 'Kuis',
          subject: item['mapel']?.toString() ?? 'Pelajaran',
          kind: 'Kuis',
          description: item['description']?.toString(),
          completed: attempt != null,
          score: _toDouble(attempt?['score']),
          totalQuestions: _toInt((item['_count'] as Map?)?['questions']),
        );
      }).toList(),
      exams: _maps(json['exams']).map((item) {
        final attempts = _maps(item['attempts']);
        final attempt = attempts.isEmpty ? null : attempts.first;
        return LearningItem(
          id: item['id']?.toString() ?? '',
          title: item['title']?.toString() ?? 'Ujian',
          subject: item['mapel']?.toString() ?? 'Pelajaran',
          kind: 'Ujian',
          dueAt: _toDate(item['endAt']),
          completed: attempt != null,
          score: _toDouble(attempt?['score']),
          totalQuestions: _toInt((item['_count'] as Map?)?['questions']),
        );
      }).toList(),
      pjj: _maps(json['upcomingPjj']).map(PjjSessionItem.fromJson).toList(),
      tkaPackages: _maps(
        json['tkaPackages'],
      ).map(TkaPackageItem.fromJson).toList(),
      reading: _maps(
        json['reading'],
      ).map(ReadingProgressItem.fromJson).toList(),
      boardPosts: _maps(
        json['boardPosts'],
      ).map(StudentBoardItem.fromJson).toList(),
      spotlight: _maps(
        json['spotlight'],
      ).map(StudentSpotlightItem.fromJson).toList(),
    );
  }
}

class StudentBoardItem {
  const StudentBoardItem({
    required this.id,
    required this.title,
    required this.category,
    required this.content,
    required this.author,
    required this.publishedAt,
    this.studentId,
    this.schoolId,
    this.schoolName = 'Sekolah belum tercantum',
    this.imageUrl,
    this.authorAvatarUrl,
    this.likeCount = 0,
    this.commentCount = 0,
    this.viewCount = 0,
    this.likedByMe = false,
    this.bookmarkedByMe = false,
    this.isOwner = false,
    this.reportedByMe = false,
    this.status = 'PUBLISHED',
    this.visibility = 'GLOBAL',
    this.reviewNote,
  });

  final String id;
  final String title;
  final String category;
  final String content;
  final String author;
  final String? studentId;
  final String? schoolId;
  final String schoolName;
  final DateTime publishedAt;
  final String? imageUrl;
  final String? authorAvatarUrl;
  final int likeCount;
  final int commentCount;
  final int viewCount;
  final bool likedByMe;
  final bool bookmarkedByMe;
  final bool isOwner;
  final bool reportedByMe;
  final String status;
  final String visibility;
  final String? reviewNote;

  StudentBoardItem copyWith({
    int? likeCount,
    int? commentCount,
    int? viewCount,
    bool? likedByMe,
    bool? bookmarkedByMe,
    bool? reportedByMe,
  }) => StudentBoardItem(
    id: id,
    title: title,
    category: category,
    content: content,
    author: author,
    studentId: studentId,
    schoolId: schoolId,
    schoolName: schoolName,
    publishedAt: publishedAt,
    imageUrl: imageUrl,
    authorAvatarUrl: authorAvatarUrl,
    likeCount: likeCount ?? this.likeCount,
    commentCount: commentCount ?? this.commentCount,
    viewCount: viewCount ?? this.viewCount,
    likedByMe: likedByMe ?? this.likedByMe,
    bookmarkedByMe: bookmarkedByMe ?? this.bookmarkedByMe,
    isOwner: isOwner,
    reportedByMe: reportedByMe ?? this.reportedByMe,
    status: status,
    visibility: visibility,
    reviewNote: reviewNote,
  );

  factory StudentBoardItem.fromJson(
    Map<String, dynamic> json,
  ) => StudentBoardItem(
    id: json['id']?.toString() ?? '',
    title: json['title']?.toString() ?? 'Pengumuman sekolah',
    category: json['category']?.toString() ?? 'Pengumuman',
    content: json['content']?.toString() ?? '',
    author:
        (json['student'] as Map?)?['name']?.toString() ??
        (json['author'] as Map?)?['name']?.toString() ??
        'GuruSpace',
    studentId: (json['student'] as Map?)?['id']?.toString(),
    schoolId:
        ((json['classRoom'] as Map?)?['school'] as Map?)?['id']?.toString() ??
        json['schoolId']?.toString(),
    schoolName: _boardSchoolName(json),
    publishedAt:
        _toDate(json['publishedAt']) ??
        _toDate(json['createdAt']) ??
        DateTime.now(),
    imageUrl: json['imageUrl']?.toString(),
    authorAvatarUrl: _avatarUrl(json),
    likeCount: _toInt((json['_count'] as Map?)?['likes']),
    commentCount: _toInt((json['_count'] as Map?)?['comments']),
    viewCount: _toInt(json['viewCount']),
    likedByMe: (json['likes'] as List?)?.whereType<Map>().isNotEmpty == true,
    bookmarkedByMe:
        (json['bookmarks'] as List?)?.whereType<Map>().isNotEmpty == true,
    isOwner: json['isOwner'] == true,
    reportedByMe:
        json['reportedByMe'] == true ||
        (json['reports'] as List?)?.whereType<Map>().isNotEmpty == true,
    status: json['status']?.toString() ?? 'PUBLISHED',
    visibility: json['visibility']?.toString() ?? 'GLOBAL',
    reviewNote: json['reviewNote']?.toString(),
  );
}

class StudentBoardComment {
  const StudentBoardComment({
    required this.id,
    required this.content,
    required this.author,
    required this.createdAt,
    this.authorAvatarUrl,
  });

  final String id;
  final String content;
  final String author;
  final DateTime createdAt;
  final String? authorAvatarUrl;

  factory StudentBoardComment.fromJson(Map<String, dynamic> json) =>
      StudentBoardComment(
        id: json['id']?.toString() ?? '',
        content: json['content']?.toString() ?? '',
        author: (json['user'] as Map?)?['name']?.toString() ?? 'Siswa',
        createdAt: _toDate(json['createdAt']) ?? DateTime.now(),
        authorAvatarUrl: (json['user'] as Map?)?['avatarUrl']?.toString(),
      );
}

class StudentSpotlightItem {
  const StudentSpotlightItem({
    required this.id,
    required this.caption,
    required this.videoUrl,
    required this.author,
    required this.publishedAt,
    this.studentId,
    this.schoolId,
    this.schoolName,
    this.thumbnailUrl,
    this.authorAvatarUrl,
    this.likeCount = 0,
    this.likedByMe = false,
    this.isFollowing = false,
    this.isOwner = false,
    this.status = 'PUBLISHED',
    this.visibility = 'GLOBAL',
    this.reviewNote,
  });

  final String id;
  final String caption;
  final String videoUrl;
  final String author;
  final String? studentId;
  final String? schoolId;
  final DateTime publishedAt;
  final String? schoolName;
  final String? thumbnailUrl;
  final String? authorAvatarUrl;
  final int likeCount;
  final bool likedByMe;
  final bool isFollowing;
  final bool isOwner;
  final String status;
  final String visibility;
  final String? reviewNote;

  factory StudentSpotlightItem.fromJson(
    Map<String, dynamic> json,
  ) => StudentSpotlightItem(
    id: json['id']?.toString() ?? '',
    caption: json['caption']?.toString() ?? 'Karya siswa GuruSpace',
    videoUrl: json['videoUrl']?.toString() ?? '',
    author: (json['student'] as Map?)?['name']?.toString() ?? 'Siswa',
    studentId: (json['student'] as Map?)?['id']?.toString(),
    schoolId:
        ((json['classRoom'] as Map?)?['school'] as Map?)?['id']?.toString() ??
        json['schoolId']?.toString(),
    publishedAt:
        _toDate(json['publishedAt']) ??
        _toDate(json['createdAt']) ??
        DateTime.now(),
    schoolName: _optionalSchoolName(json),
    thumbnailUrl: json['thumbnailUrl']?.toString(),
    authorAvatarUrl: _avatarUrl(json),
    likeCount: _toInt((json['_count'] as Map?)?['likes']),
    likedByMe: (json['likes'] as List?)?.whereType<Map>().isNotEmpty == true,
    isFollowing: json['isFollowing'] == true,
    isOwner: json['isOwner'] == true,
    status: json['status']?.toString() ?? 'PUBLISHED',
    visibility: json['visibility']?.toString() ?? 'GLOBAL',
    reviewNote: json['reviewNote']?.toString(),
  );
}

class StudentCreatorProfile {
  const StudentCreatorProfile({
    required this.id,
    required this.name,
    required this.schoolName,
    this.className,
    required this.mading,
    required this.spotlight,
    this.social = const StudentCreatorSocial.disabled(),
    this.avatarUrl,
  });

  final String id;
  final String name;
  final String schoolName;
  final String? className;
  final String? avatarUrl;
  final List<StudentBoardItem> mading;
  final List<StudentSpotlightItem> spotlight;
  final StudentCreatorSocial social;

  factory StudentCreatorProfile.fromJson(Map<String, dynamic> json) {
    final student = Map<String, dynamic>.from(
      json['student'] as Map? ?? const {},
    );
    return StudentCreatorProfile(
      id: student['id']?.toString() ?? '',
      name: student['name']?.toString() ?? 'Siswa',
      schoolName:
          student['schoolName']?.toString() ?? 'Sekolah belum tercantum',
      className: student['className']?.toString(),
      avatarUrl: student['avatarUrl']?.toString(),
      mading: _maps(json['mading']).map(StudentBoardItem.fromJson).toList(),
      spotlight: _maps(
        json['spotlight'],
      ).map(StudentSpotlightItem.fromJson).toList(),
      social: StudentCreatorSocial.fromJson(
        Map<String, dynamic>.from(json['social'] as Map? ?? const {}),
      ),
    );
  }
}

class StudentCreatorSocial {
  const StudentCreatorSocial({
    required this.followerCount,
    required this.followingCount,
    required this.isSelf,
    required this.following,
    required this.followsViewer,
    required this.mutual,
    required this.blocked,
    required this.canMessage,
    required this.enabled,
    this.requestStatus,
    this.conversationId,
  });
  const StudentCreatorSocial.disabled()
    : followerCount = 0,
      followingCount = 0,
      isSelf = false,
      following = false,
      followsViewer = false,
      mutual = false,
      blocked = false,
      canMessage = false,
      enabled = false,
      requestStatus = null,
      conversationId = null;
  final int followerCount;
  final int followingCount;
  final bool isSelf;
  final bool following;
  final bool followsViewer;
  final bool mutual;
  final bool blocked;
  final bool canMessage;
  final bool enabled;
  final String? requestStatus;
  final String? conversationId;

  factory StudentCreatorSocial.fromJson(Map<String, dynamic> json) =>
      StudentCreatorSocial(
        followerCount: _toInt(json['followerCount']),
        followingCount: _toInt(json['followingCount']),
        isSelf: json['isSelf'] == true,
        following: json['following'] == true,
        followsViewer: json['followsViewer'] == true,
        mutual: json['mutual'] == true,
        blocked: json['blocked'] == true,
        canMessage: json['canMessage'] == true,
        enabled: json['enabled'] == true,
        requestStatus: json['requestStatus']?.toString(),
        conversationId: json['conversationId']?.toString(),
      );
}

class StudentWorks {
  const StudentWorks({required this.mading, required this.spotlight});

  final List<StudentBoardItem> mading;
  final List<StudentSpotlightItem> spotlight;

  int get total => mading.length + spotlight.length;

  factory StudentWorks.fromJson(Map<String, dynamic> json) => StudentWorks(
    mading: _maps(json['mading']).map(StudentBoardItem.fromJson).toList(),
    spotlight: _maps(
      json['spotlight'],
    ).map(StudentSpotlightItem.fromJson).toList(),
  );
}

class ReadingProgressItem {
  const ReadingProgressItem({
    required this.title,
    required this.category,
    required this.progress,
    this.coverUrl,
  });
  final String title;
  final String category;
  final int progress;
  final String? coverUrl;

  factory ReadingProgressItem.fromJson(Map<String, dynamic> json) {
    final book = Map<String, dynamic>.from(json['book'] as Map? ?? {});
    return ReadingProgressItem(
      title: book['title']?.toString() ?? 'Bacaan',
      category: book['category']?.toString() ?? 'Literasi',
      progress: _toInt(json['progressPercent']),
      coverUrl: book['coverUrl']?.toString(),
    );
  }
}

class TeacherClassItem {
  const TeacherClassItem({
    required this.id,
    required this.teacherId,
    required this.name,
    required this.level,
    required this.students,
    required this.deliveryMode,
  });
  final String id;
  final String teacherId;
  final String name;
  final String level;
  final int students;
  final String deliveryMode;

  factory TeacherClassItem.fromJson(Map<String, dynamic> json) =>
      TeacherClassItem(
        id: json['id']?.toString() ?? '',
        teacherId: json['teacherId']?.toString() ?? '',
        name: json['name']?.toString() ?? 'Kelas',
        level: json['jenjang']?.toString() ?? '',
        students: _toInt((json['_count'] as Map?)?['students']),
        deliveryMode: json['deliveryMode']?.toString() ?? 'REGULAR',
      );
}

class ActivityPoint {
  const ActivityPoint(this.date, this.students);
  final DateTime date;
  final int students;
}

class TeacherDashboard {
  const TeacherDashboard({
    required this.teacherId,
    required this.name,
    required this.schoolName,
    required this.activeClasses,
    required this.activeStudents,
    required this.attendancePercent,
    required this.pendingGrading,
    required this.classes,
    required this.pjj,
    required this.activity,
  });
  final String teacherId;
  final String name;
  final String schoolName;
  final int activeClasses;
  final int activeStudents;
  final int? attendancePercent;
  final int pendingGrading;
  final List<TeacherClassItem> classes;
  final List<PjjSessionItem> pjj;
  final List<ActivityPoint> activity;

  factory TeacherDashboard.fromJson(Map<String, dynamic> json) {
    final teacher = Map<String, dynamic>.from(json['teacher'] as Map? ?? {});
    final summary = Map<String, dynamic>.from(json['summary'] as Map? ?? {});
    return TeacherDashboard(
      teacherId: teacher['id']?.toString() ?? '',
      name: teacher['name']?.toString() ?? 'Guru',
      schoolName:
          (teacher['school'] as Map?)?['name']?.toString() ?? 'GuruSpace',
      activeClasses: _toInt(summary['activeClasses']),
      activeStudents: _toInt(summary['activeStudents']),
      attendancePercent: summary['attendancePercent'] == null
          ? null
          : _toInt(summary['attendancePercent']),
      pendingGrading: _toInt(summary['pendingGrading']),
      classes: _maps(json['classes']).map(TeacherClassItem.fromJson).toList(),
      pjj: _maps(json['upcomingPjj']).map(PjjSessionItem.fromJson).toList(),
      activity: _maps(json['activityByDate']).map((item) {
        return ActivityPoint(
          _toDate(item['date']) ?? DateTime.now(),
          _toInt(item['students']),
        );
      }).toList(),
    );
  }
}
