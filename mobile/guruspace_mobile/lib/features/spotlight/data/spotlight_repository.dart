import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_models.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_ads.dart';

class SpotlightRepository {
  const SpotlightRepository(this._api);
  const SpotlightRepository.preview() : _api = null;

  final ApiClient? _api;

  ApiClient get _client =>
      _api ?? (throw StateError('Preview repository cannot call the API.'));

  Future<SpotlightFeedPage> getFeed({String? cursor}) async {
    final json = await _client.getJson(
      '/api/spotlight/posts',
      query: {'limit': 8, 'cursor': ?cursor},
    );
    final rows = json['posts'] as List? ?? const [];
    return SpotlightFeedPage(
      posts: rows
          .whereType<Map>()
          .map(
            (item) => SpotlightPost.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      nextCursor: json['nextCursor']?.toString(),
    );
  }

  Future<SpotlightAdsConfig> getAdsConfig() async {
    final json = await _client.getJson('/api/mobile/v1/spotlight/reels-ads');
    return SpotlightAdsConfig.fromJson(json);
  }

  Future<({bool liked, int count})> toggleLike(String postId) async {
    final json = await _client.postJson('/api/spotlight/posts/$postId/like');
    return (
      liked: json['liked'] == true,
      count: (json['likeCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<int> trackView(String postId) async {
    final json = await _client.postJson('/api/spotlight/posts/$postId/view');
    return (json['viewCount'] as num?)?.toInt() ?? 0;
  }

  Future<List<SpotlightComment>> getComments(String postId) async {
    final json = await _client.getJson('/api/spotlight/posts/$postId/comments');
    return (json['comments'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (item) => SpotlightComment.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();
  }

  Future<({SpotlightComment comment, int count})> addComment(
    String postId,
    String content,
  ) async {
    final json = await _client.postJson(
      '/api/spotlight/posts/$postId/comments',
      data: {'content': content},
    );
    return (
      comment: SpotlightComment.fromJson(
        Map<String, dynamic>.from(json['comment'] as Map? ?? const {}),
      ),
      count: (json['commentCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<SpotlightPost> create({
    required String caption,
    required String videoUrl,
    String? thumbnailUrl,
  }) async {
    final json = await _client.postJson(
      '/api/spotlight/posts',
      data: {
        'caption': caption,
        'videoUrl': videoUrl,
        if (thumbnailUrl?.trim().isNotEmpty == true)
          'thumbnailUrl': thumbnailUrl!.trim(),
      },
    );
    return SpotlightPost.fromJson(
      Map<String, dynamic>.from(json['post'] as Map? ?? const {}),
    );
  }

  Future<String> uploadVideo({
    required String filePath,
    required String fileName,
    void Function(int sent, int total)? onProgress,
  }) async {
    final json = await _client.postMultipartFile(
      '/api/spotlight/upload',
      fieldName: 'file',
      filePath: filePath,
      fileName: fileName,
      onSendProgress: onProgress,
    );
    final url = json['url']?.toString() ?? '';
    if (url.isEmpty) throw StateError('Server tidak mengembalikan URL video.');
    return url;
  }

  Future<void> delete(String postId) async {
    await _client.deleteJson('/api/spotlight/posts/$postId');
  }
}
