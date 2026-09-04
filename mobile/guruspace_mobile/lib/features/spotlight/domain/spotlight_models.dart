class SpotlightAuthor {
  const SpotlightAuthor({
    required this.id,
    required this.name,
    this.avatarUrl,
    this.schoolName,
  });

  final String id;
  final String name;
  final String? avatarUrl;
  final String? schoolName;

  factory SpotlightAuthor.fromJson(Map<String, dynamic> json) =>
      SpotlightAuthor(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? 'GuruSpace',
        avatarUrl: json['avatarUrl']?.toString(),
        schoolName: json['schoolName']?.toString(),
      );
}

class SpotlightPost {
  const SpotlightPost({
    required this.id,
    required this.caption,
    required this.videoUrl,
    required this.viewCount,
    required this.createdAt,
    required this.author,
    required this.likeCount,
    required this.commentCount,
    required this.likedByMe,
    this.thumbnailUrl,
  });

  final String id;
  final String caption;
  final String videoUrl;
  final String? thumbnailUrl;
  final int viewCount;
  final DateTime createdAt;
  final SpotlightAuthor author;
  final int likeCount;
  final int commentCount;
  final bool likedByMe;

  factory SpotlightPost.fromJson(Map<String, dynamic> json) => SpotlightPost(
    id: json['id']?.toString() ?? '',
    caption: json['caption']?.toString() ?? '',
    videoUrl: json['videoUrl']?.toString() ?? '',
    thumbnailUrl: json['thumbnailUrl']?.toString(),
    viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
    createdAt:
        DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
        DateTime.now(),
    author: SpotlightAuthor.fromJson(
      Map<String, dynamic>.from(json['author'] as Map? ?? const {}),
    ),
    likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
    commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
    likedByMe: json['likedByMe'] == true,
  );

  bool get isImageMedia => isSpotlightImageUrl(videoUrl);

  SpotlightPost copyWith({
    int? viewCount,
    int? likeCount,
    int? commentCount,
    bool? likedByMe,
  }) => SpotlightPost(
    id: id,
    caption: caption,
    videoUrl: videoUrl,
    thumbnailUrl: thumbnailUrl,
    viewCount: viewCount ?? this.viewCount,
    createdAt: createdAt,
    author: author,
    likeCount: likeCount ?? this.likeCount,
    commentCount: commentCount ?? this.commentCount,
    likedByMe: likedByMe ?? this.likedByMe,
  );
}

class SpotlightComment {
  const SpotlightComment({
    required this.id,
    required this.content,
    required this.createdAt,
    required this.user,
  });

  final String id;
  final String content;
  final DateTime createdAt;
  final SpotlightAuthor user;

  factory SpotlightComment.fromJson(Map<String, dynamic> json) =>
      SpotlightComment(
        id: json['id']?.toString() ?? '',
        content: json['content']?.toString() ?? '',
        createdAt:
            DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
            DateTime.now(),
        user: SpotlightAuthor.fromJson(
          Map<String, dynamic>.from(json['user'] as Map? ?? const {}),
        ),
      );
}

class SpotlightFeedPage {
  const SpotlightFeedPage({required this.posts, this.nextCursor});

  final List<SpotlightPost> posts;
  final String? nextCursor;
}

bool isSpotlightImageUrl(String value) {
  final path = Uri.tryParse(value)?.path.toLowerCase() ?? value.toLowerCase();
  return path.endsWith('.jpg') ||
      path.endsWith('.jpeg') ||
      path.endsWith('.png') ||
      path.endsWith('.webp') ||
      path.endsWith('.gif') ||
      path.endsWith('.avif');
}
