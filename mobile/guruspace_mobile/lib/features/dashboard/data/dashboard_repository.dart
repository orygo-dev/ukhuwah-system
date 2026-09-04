import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/core/network/api_exception.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';

class DashboardRepository {
  const DashboardRepository(this._client);
  final ApiClient _client;

  Future<StudentDashboard> getStudentDashboard() async {
    final json = await _client.getJson('/api/mobile/v1/student/dashboard');
    return StudentDashboard.fromJson(json);
  }

  Future<TeacherDashboard> getTeacherDashboard() async {
    final json = await _client.getJson('/api/mobile/v1/teacher/dashboard');
    return TeacherDashboard.fromJson(json);
  }

  Future<List<StudentBoardItem>> getStudentMading() async {
    final json = await _client.getJson('/api/student/board-posts');
    final values = json['posts'] as List? ?? const [];
    return values
        .whereType<Map>()
        .map(
          (item) => StudentBoardItem.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();
  }

  Future<StudentWorks> getStudentWorks() async {
    final json = await _client.getJson('/api/mobile/v1/student/works');
    return StudentWorks.fromJson(json);
  }

  Future<StudentCreatorProfile> getStudentCreatorProfile(
    String studentId,
  ) async {
    final json = await _client.getJson(
      '/api/mobile/v1/student/creators/${Uri.encodeComponent(studentId)}',
    );
    return StudentCreatorProfile.fromJson(json);
  }

  Future<String> uploadStudentMadingImage({
    required String filePath,
    required String fileName,
  }) async {
    final json = await _client.postMultipartFile(
      '/api/student/board-posts/upload',
      fieldName: 'file',
      filePath: filePath,
      fileName: fileName,
    );
    return json['url']?.toString() ?? '';
  }

  Future<String> createStudentMading({
    required String title,
    required String category,
    required String content,
    required String visibility,
    String? imageUrl,
  }) async {
    final json = await _client.postJson(
      '/api/student/board-posts',
      data: {
        'title': title,
        'category': category,
        'content': content,
        'visibility': visibility,
        'imageUrl': imageUrl ?? '',
      },
    );
    return json['reviewEnabled'] == true
        ? 'Karya berhasil dikirim dan menunggu peninjauan.'
        : 'Karya berhasil diterbitkan.';
  }

  Future<({bool liked, int count})> setStudentMadingLike(
    String postId, {
    required bool liked,
  }) async {
    final json = await _client.postJson(
      '/api/student/board-posts/${Uri.encodeComponent(postId)}/like',
      data: {'liked': liked},
    );
    return (
      liked: json['liked'] == true,
      count: (json['likeCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<bool> setStudentMadingBookmark(
    String postId, {
    required bool bookmarked,
  }) async {
    final json = await _client.postJson(
      '/api/student/board-posts/${Uri.encodeComponent(postId)}/bookmark',
      data: {'bookmarked': bookmarked},
    );
    return json['bookmarked'] == true;
  }

  Future<int> recordStudentMadingView(String postId) async {
    final json = await _client.postJson(
      '/api/student/board-posts/${Uri.encodeComponent(postId)}/view',
      data: const {},
    );
    return (json['viewCount'] as num?)?.toInt() ?? 0;
  }

  Future<({List<StudentBoardComment> comments, int count})>
  getStudentMadingComments(String postId) async {
    final json = await _client.getJson(
      '/api/student/board-posts/${Uri.encodeComponent(postId)}/comments',
    );
    final comments = (json['comments'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (item) =>
              StudentBoardComment.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();
    return (
      comments: comments,
      count: (json['commentCount'] as num?)?.toInt() ?? comments.length,
    );
  }

  Future<({StudentBoardComment comment, int count})> addStudentMadingComment(
    String postId,
    String content,
  ) async {
    final json = await _client.postJson(
      '/api/student/board-posts/${Uri.encodeComponent(postId)}/comments',
      data: {'content': content},
    );
    return (
      comment: StudentBoardComment.fromJson(
        Map<String, dynamic>.from(json['comment'] as Map? ?? const {}),
      ),
      count: (json['commentCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<String> reportStudentMading({
    required String postId,
    required String reason,
    String? details,
  }) async {
    final json = await _client.postJson(
      '/api/student/board-posts/${Uri.encodeComponent(postId)}/reports',
      data: {
        'reason': reason,
        if (details?.trim().isNotEmpty == true) 'details': details!.trim(),
      },
    );
    return json['message']?.toString() ??
        'Laporan diterima dan akan diperiksa moderator.';
  }

  Future<void> deleteStudentMading(String postId) async {
    await _client.deleteJson(
      '/api/student/board-posts/${Uri.encodeComponent(postId)}',
    );
  }

  Future<String> uploadStudentSpotlightMedia({
    required String filePath,
    required String fileName,
    void Function(int sent, int total)? onProgress,
  }) async {
    final json = await _client.postMultipartFile(
      '/api/student/spotlight/upload',
      fieldName: 'file',
      filePath: filePath,
      fileName: fileName,
      onSendProgress: onProgress,
    );
    final url = json['url']?.toString() ?? '';
    if (url.isEmpty) {
      throw StateError('Server tidak mengembalikan URL media Zona Kreasi.');
    }
    return url;
  }

  Future<String> createStudentSpotlight({
    required String caption,
    required String videoUrl,
    required String visibility,
    String? thumbnailUrl,
  }) async {
    final json = await _client.postJson(
      '/api/student/spotlight-submissions',
      data: {
        'caption': caption,
        'videoUrl': videoUrl,
        'thumbnailUrl': thumbnailUrl ?? '',
        'visibility': visibility,
      },
    );
    return json['reviewEnabled'] == true
        ? 'Zona Kreasi berhasil dikirim dan menunggu review guru.'
        : 'Zona Kreasi berhasil diterbitkan.';
  }

  Future<void> deleteStudentSpotlight(String submissionId) async {
    await _client.deleteJson(
      '/api/student/spotlight-submissions/${Uri.encodeComponent(submissionId)}',
    );
  }

  Future<({bool liked, int count})> toggleStudentSpotlightLike(
    String submissionId,
  ) async {
    final json = await _client.postJson(
      '/api/student/spotlight-submissions/$submissionId/like',
    );
    return (
      liked: json['liked'] == true,
      count: (json['likeCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<({String message, bool hidden})> reportStudentSpotlight({
    required String submissionId,
    required String reason,
    String? details,
  }) async {
    final json = await _client.postJson(
      '/api/student/spotlight-submissions/$submissionId/reports',
      data: {
        'reason': reason,
        if (details?.trim().isNotEmpty == true) 'details': details!.trim(),
      },
    );
    return (
      message: json['message']?.toString() ?? 'Laporan berhasil dikirim.',
      hidden: json['hidden'] == true,
    );
  }

  Future<String> startTka(String packageId) async {
    final json = await _client.postJson(
      '/api/student/tka/attempts',
      data: {'packageId': packageId},
    );
    final attemptId = (json['attempt'] as Map?)?['id']?.toString() ?? '';
    if (attemptId.isEmpty) {
      throw const ApiException('Paket TKA belum dapat dibuka.');
    }
    return attemptId;
  }

  Future<TkaAttemptDetail> getTkaAttempt(String id) async {
    final json = await _client.getJson('/api/student/tka/attempts/$id');
    return TkaAttemptDetail.fromJson(json);
  }

  Future<void> saveTkaAnswer(
    String attemptId,
    String questionId,
    Set<int> selected,
  ) async {
    await _client.patchJson('/api/student/tka/attempts/$attemptId', {
      'action': 'SAVE',
      'questionId': questionId,
      'selectedAnswers': selected.toList()..sort(),
    });
  }

  Future<Map<String, dynamic>> submitTka(String attemptId) async {
    final json = await _client.patchJson(
      '/api/student/tka/attempts/$attemptId',
      {'action': 'SUBMIT'},
    );
    return Map<String, dynamic>.from(json['result'] as Map? ?? {});
  }
}
