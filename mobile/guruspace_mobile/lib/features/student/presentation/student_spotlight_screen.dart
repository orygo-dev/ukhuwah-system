import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/spotlight/data/spotlight_repository.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_models.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_ads.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_share.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/spotlight_admob_slide.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/teacher_spotlight_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_creator_profile_screen.dart';
import 'package:video_trimmer/video_trimmer.dart';

enum _SpotlightCategory { forYou, school, latest, following }

const _spotlightCategoryClearance = 82.0;

class StudentSpotlightScreen extends ConsumerStatefulWidget {
  const StudentSpotlightScreen({
    super.key,
    required this.user,
    required this.onNotifications,
    this.active = true,
    this.initialPostId,
    this.itemsOverride,
  });

  final AppUser user;
  final VoidCallback onNotifications;
  final bool active;
  final String? initialPostId;
  final List<StudentSpotlightItem>? itemsOverride;

  @override
  ConsumerState<StudentSpotlightScreen> createState() =>
      _StudentSpotlightScreenState();
}

class _StudentSpotlightScreenState
    extends ConsumerState<StudentSpotlightScreen> {
  final _pageController = PageController();
  int _activeIndex = 0;
  String? _appliedInitialPostId;
  bool _reporting = false;
  bool _deleting = false;
  final _deletedIds = <String>{};
  SpotlightAdsConfig _adsConfig = SpotlightAdsConfig.disabled;
  bool _adsSuppressed = false;
  List<StudentSpotlightItem> _visibleItems = const [];
  _SpotlightCategory _category = _SpotlightCategory.forYou;

  bool get _showPreview => widget.initialPostId?.trim().isNotEmpty == true;

  List<StudentSpotlightItem> _categorize(
    Iterable<StudentSpotlightItem> source, {
    String? viewerSchoolId,
    String? viewerSchoolName,
  }) {
    final items = source.toList();
    switch (_category) {
      case _SpotlightCategory.forYou:
        items.sort((a, b) {
          final popularity = b.likeCount.compareTo(a.likeCount);
          return popularity != 0
              ? popularity
              : b.publishedAt.compareTo(a.publishedAt);
        });
      case _SpotlightCategory.latest:
        items.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
      case _SpotlightCategory.school:
        return items.where((item) {
          return _sameSpotlightSchool(
            itemSchoolId: item.schoolId,
            itemSchoolName: item.schoolName,
            viewerSchoolId: viewerSchoolId,
            viewerSchoolName: viewerSchoolName,
          );
        }).toList()..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
      case _SpotlightCategory.following:
        return items.where((item) => item.isFollowing).toList()
          ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
    }
    return items;
  }

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_loadAdsConfig);
  }

  Future<void> _loadAdsConfig() async {
    try {
      final config = await ref.read(spotlightRepositoryProvider).getAdsConfig();
      if (!mounted) return;
      final oldEntries = _feedEntries(_visibleItems);
      final visiblePostId =
          _activeIndex >= 0 && _activeIndex < oldEntries.length
          ? oldEntries[_activeIndex].post?.id
          : null;
      setState(() {
        _adsConfig = config;
        _adsSuppressed = false;
      });
      if (visiblePostId != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || !_pageController.hasClients) return;
          final newIndex = _feedEntries(
            _visibleItems,
          ).indexWhere((entry) => entry.post?.id == visiblePostId);
          if (newIndex >= 0 && newIndex != _activeIndex) {
            _activeIndex = newIndex;
            _pageController.jumpToPage(newIndex);
          }
        });
      }
    } catch (_) {
      // Kegagalan konfigurasi iklan tidak boleh mengganggu feed organik.
    }
  }

  List<SpotlightFeedEntry<StudentSpotlightItem>> _feedEntries(
    List<StudentSpotlightItem> items,
  ) => buildSpotlightFeedEntries(
    items,
    idOf: (item) => item.id,
    config: _adsSuppressed ? SpotlightAdsConfig.disabled : _adsConfig,
  );

  @override
  void didUpdateWidget(covariant StudentSpotlightScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialPostId != oldWidget.initialPostId) {
      _appliedInitialPostId = null;
    }
  }

  void _applyInitialPost(List<StudentSpotlightItem> items) {
    final postId = widget.initialPostId;
    if (postId == null || postId == _appliedInitialPostId) return;
    final entries = _feedEntries(items);
    final index = entries.indexWhere((entry) => entry.post?.id == postId);
    if (index < 0) return;
    _appliedInitialPostId = postId;
    _activeIndex = index;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_pageController.hasClients) return;
      _pageController.jumpToPage(index);
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _openComposer() async {
    final message = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) =>
          StudentSpotlightComposerSheet(user: widget.user, onSubmit: _submit),
    );
    if (!mounted || message == null) return;
    ref.invalidate(studentDashboardProvider);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
  }

  Future<String> _submit(StudentSpotlightDraft draft) async {
    final repository = ref.read(dashboardRepositoryProvider);
    final mediaUrl = await repository.uploadStudentSpotlightMedia(
      filePath: draft.mediaPath,
      fileName: draft.mediaName,
      onProgress: draft.onProgress,
    );
    return repository.createStudentSpotlight(
      caption: draft.caption,
      videoUrl: mediaUrl,
      visibility: draft.visibility,
    );
  }

  Future<void> _openReport(StudentSpotlightItem item) async {
    setState(() => _reporting = true);
    final draft = await showModalBottomSheet<_SpotlightReportDraft>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SpotlightReportSheet(author: item.author),
    );
    if (!mounted) return;
    setState(() => _reporting = false);
    if (draft == null) return;
    try {
      final result = await ref
          .read(dashboardRepositoryProvider)
          .reportStudentSpotlight(
            submissionId: item.id,
            reason: draft.reason,
            details: draft.details,
          );
      if (!mounted) return;
      if (result.hidden) ref.invalidate(studentDashboardProvider);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(result.message),
            behavior: SnackBarBehavior.floating,
          ),
        );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text('$error'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFFB91C1C),
          ),
        );
    }
  }

  Future<void> _delete(StudentSpotlightItem item) async {
    if (!item.isOwner || _deleting) return;
    setState(() => _deleting = true);
    try {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Hapus Zona Kreasi?'),
          content: const Text(
            'Konten ini akan dihapus dari Zona Kreasi beserta suka dan laporannya. Tindakan ini tidak dapat dibatalkan.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Batal'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Hapus'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
      await ref
          .read(dashboardRepositoryProvider)
          .deleteStudentSpotlight(item.id);
      if (!mounted) return;
      setState(() {
        _deletedIds.add(item.id);
        _activeIndex = 0;
      });
      if (_pageController.hasClients) _pageController.jumpToPage(0);
      ref.invalidate(studentDashboardProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Zona Kreasi berhasil dihapus.')),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Konten belum berhasil dihapus. Silakan coba lagi.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  Future<void> _openPreview(
    StudentSpotlightItem item,
    List<StudentSpotlightItem> items,
  ) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          body: StudentSpotlightScreen(
            user: widget.user,
            active: true,
            initialPostId: item.id,
            itemsOverride: List<StudentSpotlightItem>.unmodifiable(items),
            onNotifications: widget.onNotifications,
          ),
        ),
      ),
    );
    if (mounted && widget.itemsOverride == null) {
      ref.invalidate(studentDashboardProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dashboardAsync = widget.itemsOverride == null
        ? ref.watch(studentDashboardProvider)
        : null;
    final itemsAsync = dashboardAsync != null
        ? dashboardAsync.whenData((data) => data.spotlight)
        : AsyncValue.data(widget.itemsOverride!);
    return SafeArea(
      bottom: false,
      child: Stack(
        children: [
          Column(
            children: [
              Expanded(
                child: itemsAsync.when(
                  loading: () =>
                      const LoadingView(label: 'Menyiapkan Zona Kreasi...'),
                  error: (error, _) => ErrorView(
                    message: '$error',
                    onRetry: () => ref.invalidate(studentDashboardProvider),
                  ),
                  data: (sourceItems) {
                    final items = _categorize(
                      sourceItems.where((item) {
                        return !_deletedIds.contains(item.id);
                      }),
                      viewerSchoolId: dashboardAsync?.asData?.value.schoolId,
                      viewerSchoolName:
                          dashboardAsync?.asData?.value.schoolName,
                    );
                    _visibleItems = items;
                    if (_showPreview) _applyInitialPost(items);
                    if (items.isEmpty) {
                      if (!_showPreview &&
                          _category == _SpotlightCategory.following) {
                        return _FollowingSpotlightEmptyState(
                          topPadding: _spotlightCategoryClearance,
                          onShowForYou: () => setState(
                            () => _category = _SpotlightCategory.forYou,
                          ),
                        );
                      }
                      return _SpotlightEmptyState(
                        filtered: false,
                        onCreate: _openComposer,
                        onRefresh: () =>
                            ref.invalidate(studentDashboardProvider),
                      );
                    }
                    if (!_showPreview) {
                      return RefreshIndicator(
                        onRefresh: () =>
                            ref.refresh(studentDashboardProvider.future),
                        child: _StudentSpotlightPinterestFeed(
                          items: items,
                          topPadding: _spotlightCategoryClearance,
                          onTap: (item) => _openPreview(item, items),
                        ),
                      );
                    }
                    final entries = _feedEntries(items);
                    return RefreshIndicator(
                      onRefresh: () =>
                          ref.refresh(studentDashboardProvider.future),
                      child: PageView.builder(
                        key: const Key('student-spotlight-reels'),
                        controller: _pageController,
                        scrollDirection: Axis.vertical,
                        physics: const PageScrollPhysics(),
                        itemCount: entries.length,
                        onPageChanged: (index) =>
                            setState(() => _activeIndex = index),
                        itemBuilder: (_, index) {
                          final entry = entries[index];
                          if (entry.isAd) {
                            return SpotlightAdmobSlide(
                              key: ValueKey(entry.id),
                              adUnitId: _adsConfig.androidAdUnitId,
                              onUnavailable: () {
                                if (mounted && !_adsSuppressed) {
                                  setState(() => _adsSuppressed = true);
                                }
                              },
                            );
                          }
                          final item = entry.post!;
                          return SpotlightReelSlide(
                            key: ValueKey(item.id),
                            post: _asSpotlightPost(item),
                            repository: const SpotlightRepository.preview(),
                            isActive:
                                widget.active &&
                                !_reporting &&
                                !_deleting &&
                                index == _activeIndex,
                            shouldLoad:
                                widget.active &&
                                (index - _activeIndex).abs() <= 1,
                            isAuthor: item.isOwner,
                            shareKind: SpotlightKind.student,
                            engagementEnabled: false,
                            likeEnabled: true,
                            onToggleLike: () => ref
                                .read(dashboardRepositoryProvider)
                                .toggleStudentSpotlightLike(item.id),
                            onReport: item.isOwner
                                ? null
                                : () => _openReport(item),
                            onAuthorTap:
                                item.studentId?.trim().isNotEmpty == true
                                ? () => openStudentCreatorProfile(
                                    context,
                                    item.studentId,
                                  )
                                : null,
                            mediaPlaceholder: isSpotlightImageUrl(item.videoUrl)
                                ? Image.network(
                                    _mediaUrl(item.videoUrl),
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, _, _) => const ColoredBox(
                                      color: Color(0xFF18181B),
                                      child: Center(
                                        child: Icon(
                                          Icons.broken_image_outlined,
                                          color: Colors.white54,
                                          size: 48,
                                        ),
                                      ),
                                    ),
                                  )
                                : null,
                            onDelete: () => _delete(item),
                            onCommentCountChanged: (_) {},
                          );
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
          if (!_showPreview)
            Positioned(
              top: 8,
              left: 8,
              right: 8,
              child: _SpotlightCategoryBar(
                category: _category,
                onCategoryChanged: (value) => setState(() {
                  _category = value;
                  _activeIndex = 0;
                }),
              ),
            ),
          Positioned(
            right: 18,
            bottom: 22,
            child: _CreateSpotlightButton(onTap: _openComposer),
          ),
        ],
      ),
    );
  }
}

class _StudentSpotlightPinterestFeed extends StatelessWidget {
  const _StudentSpotlightPinterestFeed({
    required this.items,
    required this.topPadding,
    required this.onTap,
  });

  final List<StudentSpotlightItem> items;
  final double topPadding;
  final ValueChanged<StudentSpotlightItem> onTap;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: const Color(0xFFF5F8FD),
    child: GridView.builder(
      key: const Key('student-spotlight-grid'),
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(12, topPadding, 12, 112),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 10,
        childAspectRatio: 9 / 16,
      ),
      itemCount: items.length,
      itemBuilder: (_, index) {
        final item = items[index];
        return _StudentSpotlightThumbnailCard(
          key: ValueKey('student-spotlight-card-${item.id}'),
          item: item,
          onTap: () => onTap(item),
          onAuthorTap: item.studentId?.trim().isNotEmpty == true
              ? () => openStudentCreatorProfile(context, item.studentId)
              : null,
        );
      },
    ),
  );
}

class _StudentSpotlightThumbnailCard extends StatelessWidget {
  const _StudentSpotlightThumbnailCard({
    super.key,
    required this.item,
    required this.onTap,
    this.onAuthorTap,
  });

  final StudentSpotlightItem item;
  final VoidCallback onTap;
  final VoidCallback? onAuthorTap;

  @override
  Widget build(BuildContext context) {
    final isImage = isSpotlightImageUrl(item.videoUrl);
    final thumbnail = item.thumbnailUrl?.trim().isNotEmpty == true
        ? item.thumbnailUrl!.trim()
        : isImage
        ? item.videoUrl.trim()
        : null;
    final school = item.schoolName?.trim();
    return Semantics(
      button: true,
      label: 'Buka Zona Kreasi oleh ${item.author}',
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Ink(
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE2EAF5)),
              borderRadius: BorderRadius.circular(20),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x14132B4E),
                  blurRadius: 16,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (thumbnail != null)
                  Image.network(
                    _mediaUrl(thumbnail),
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) =>
                        const _SpotlightThumbnailFallback(),
                  )
                else
                  const _SpotlightThumbnailFallback(),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Color(0xD908142B)],
                      stops: [0.48, 1],
                    ),
                  ),
                ),
                if (!isImage)
                  const Center(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Color(0xDFFFFFFF),
                        shape: BoxShape.circle,
                      ),
                      child: SizedBox.square(
                        dimension: 46,
                        child: Icon(
                          Icons.play_arrow_rounded,
                          color: Color(0xFF126BEE),
                          size: 30,
                        ),
                      ),
                    ),
                  ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: InkWell(
                    key: ValueKey('student-spotlight-author-${item.id}'),
                    onTap: onAuthorTap,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(10, 10, 9, 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          _SpotlightThumbnailAvatar(
                            name: item.author,
                            avatarUrl: item.authorAvatarUrl,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.author,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                if (school?.isNotEmpty == true) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    school!,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Color(0xFFDDE8FA),
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.favorite_border_rounded,
                            color: Colors.white,
                            size: 15,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            '${item.likeCount}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FollowingSpotlightEmptyState extends StatelessWidget {
  const _FollowingSpotlightEmptyState({
    required this.topPadding,
    required this.onShowForYou,
  });

  final double topPadding;
  final VoidCallback onShowForYou;

  @override
  Widget build(BuildContext context) => ListView(
    key: const Key('student-spotlight-following-empty'),
    padding: EdgeInsets.fromLTRB(28, topPadding + 48, 28, 120),
    children: [
      const Icon(
        Icons.people_outline_rounded,
        color: Color(0xFF126BEE),
        size: 54,
      ),
      const SizedBox(height: 16),
      const Text(
        'Belum ada karya dari akun yang Anda ikuti',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Color(0xFF17233D),
          fontSize: 17,
          fontWeight: FontWeight.w900,
        ),
      ),
      const SizedBox(height: 8),
      const Text(
        'Ikuti kreator yang Anda sukai agar karya terbaru mereka tampil di sini.',
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.muted, height: 1.45),
      ),
      const SizedBox(height: 20),
      FilledButton(onPressed: onShowForYou, child: const Text('Lihat Untukmu')),
    ],
  );
}

class _SpotlightThumbnailFallback extends StatelessWidget {
  const _SpotlightThumbnailFallback();

  @override
  Widget build(BuildContext context) => const DecoratedBox(
    decoration: BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF152B65), Color(0xFF0B83D9)],
      ),
    ),
    child: Center(
      child: Icon(Icons.auto_awesome_rounded, color: Colors.white70, size: 42),
    ),
  );
}

class _SpotlightThumbnailAvatar extends StatelessWidget {
  const _SpotlightThumbnailAvatar({required this.name, this.avatarUrl});

  final String name;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final source = avatarUrl?.trim();
    final initial = name.trim().isEmpty ? 'S' : name.trim()[0].toUpperCase();
    return Container(
      width: 30,
      height: 30,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        color: Color(0xFFDCEAFF),
        shape: BoxShape.circle,
      ),
      child: source?.isNotEmpty == true
          ? Image.network(
              _mediaUrl(source!),
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => _SpotlightAvatarInitial(initial),
            )
          : _SpotlightAvatarInitial(initial),
    );
  }
}

class _SpotlightAvatarInitial extends StatelessWidget {
  const _SpotlightAvatarInitial(this.initial);

  final String initial;

  @override
  Widget build(BuildContext context) => Center(
    child: Text(
      initial,
      style: const TextStyle(
        color: Color(0xFF126BEE),
        fontSize: 12,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

SpotlightPost _asSpotlightPost(StudentSpotlightItem item) => SpotlightPost(
  id: item.id,
  caption: item.caption,
  videoUrl: item.videoUrl,
  thumbnailUrl: item.thumbnailUrl,
  viewCount: 0,
  createdAt: item.publishedAt,
  author: SpotlightAuthor(
    id: item.studentId ?? item.id,
    name: item.author,
    avatarUrl: item.authorAvatarUrl,
    schoolName: item.schoolName,
  ),
  likeCount: item.likeCount,
  commentCount: 0,
  likedByMe: item.likedByMe,
);

bool _sameSpotlightSchool({
  required String? itemSchoolId,
  required String? itemSchoolName,
  required String? viewerSchoolId,
  required String? viewerSchoolName,
}) {
  final itemId = itemSchoolId?.trim();
  final viewerId = viewerSchoolId?.trim();
  if (itemId?.isNotEmpty == true && viewerId?.isNotEmpty == true) {
    return itemId == viewerId;
  }
  final itemName = itemSchoolName?.trim().toLowerCase();
  final viewerName = viewerSchoolName?.trim().toLowerCase();
  return itemName?.isNotEmpty == true &&
      viewerName?.isNotEmpty == true &&
      itemName == viewerName;
}

class _SpotlightCategoryBar extends StatelessWidget {
  const _SpotlightCategoryBar({
    required this.category,
    required this.onCategoryChanged,
  });

  final _SpotlightCategory category;
  final ValueChanged<_SpotlightCategory> onCategoryChanged;

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('student-spotlight-controls'),
    height: 66,
    padding: const EdgeInsets.all(5),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .98),
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: const Color(0xFFE2E9F4)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x17142D55),
          blurRadius: 22,
          offset: Offset(0, 9),
        ),
      ],
    ),
    child: Row(
      key: const Key('student-spotlight-categories'),
      children: _SpotlightCategory.values.map((value) {
        final selected = value == category;
        final label = switch (value) {
          _SpotlightCategory.forYou => 'Untukmu',
          _SpotlightCategory.school => 'Sekolahku',
          _SpotlightCategory.latest => 'Terbaru',
          _SpotlightCategory.following => 'Mengikuti',
        };
        final icon = switch (value) {
          _SpotlightCategory.forYou => Icons.auto_awesome_rounded,
          _SpotlightCategory.school => Icons.school_rounded,
          _SpotlightCategory.latest => Icons.bolt_rounded,
          _SpotlightCategory.following => Icons.people_alt_rounded,
        };
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Semantics(
              selected: selected,
              button: true,
              label: 'Filter $label',
              child: Material(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(17),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  key: ValueKey('student-spotlight-category-${value.name}'),
                  onTap: selected ? null : () => onCategoryChanged(value),
                  borderRadius: BorderRadius.circular(17),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeOutCubic,
                    decoration: BoxDecoration(
                      gradient: selected
                          ? const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFF1959E8), Color(0xFF13A9E8)],
                            )
                          : null,
                      color: selected ? null : Colors.transparent,
                      borderRadius: BorderRadius.circular(17),
                      boxShadow: selected
                          ? const [
                              BoxShadow(
                                color: Color(0x401959E8),
                                blurRadius: 12,
                                offset: Offset(0, 5),
                              ),
                            ]
                          : null,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        AnimatedScale(
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeOutBack,
                          scale: selected ? 1.08 : 1,
                          child: Icon(
                            icon,
                            size: 19,
                            color: selected
                                ? Colors.white
                                : const Color(0xFF75839A),
                          ),
                        ),
                        const SizedBox(height: 4),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            label,
                            maxLines: 1,
                            style: TextStyle(
                              color: selected
                                  ? Colors.white
                                  : const Color(0xFF526078),
                              fontSize: 10.5,
                              fontWeight: selected
                                  ? FontWeight.w900
                                  : FontWeight.w700,
                              letterSpacing: -.1,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    ),
  );
}

class _CreateSpotlightButton extends StatelessWidget {
  const _CreateSpotlightButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    shape: const CircleBorder(),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      key: const Key('student-spotlight-create'),
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Ink(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF367BFF), Color(0xFF0756DC)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 1.5),
          boxShadow: const [
            BoxShadow(
              color: Color(0x52075ADC),
              blurRadius: 20,
              offset: Offset(0, 9),
            ),
          ],
        ),
        child: const Tooltip(
          message: 'Buat Zona Kreasi',
          child: Icon(Icons.add_rounded, color: Colors.white, size: 29),
        ),
      ),
    ),
  );
}

class _SpotlightReportDraft {
  const _SpotlightReportDraft(this.reason, this.details);

  final String reason;
  final String? details;
}

class _SpotlightReportSheet extends StatefulWidget {
  const _SpotlightReportSheet({required this.author});

  final String author;

  @override
  State<_SpotlightReportSheet> createState() => _SpotlightReportSheetState();
}

class _SpotlightReportSheetState extends State<_SpotlightReportSheet> {
  static const _reasons = <(String, String, IconData)>[
    ('INAPPROPRIATE', 'Konten tidak pantas', Icons.report_outlined),
    ('BULLYING', 'Perundungan atau pelecehan', Icons.person_off_outlined),
    (
      'VIOLENCE',
      'Kekerasan atau tindakan berbahaya',
      Icons.warning_amber_rounded,
    ),
    ('SEXUAL_CONTENT', 'Konten seksual atau pornografi', Icons.shield_outlined),
    ('SPAM', 'Spam atau menyesatkan', Icons.mark_email_unread_outlined),
    ('PRIVACY', 'Pelanggaran privasi', Icons.privacy_tip_outlined),
    ('OTHER', 'Alasan lainnya', Icons.more_horiz_rounded),
  ];

  final _details = TextEditingController();
  String? _reason;

  @override
  void dispose() {
    _details.dispose();
    super.dispose();
  }

  void _submit() {
    if (_reason == null) return;
    if (_reason == 'OTHER' && _details.text.trim().length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Jelaskan alasan minimal 5 karakter.')),
      );
      return;
    }
    Navigator.pop(
      context,
      _SpotlightReportDraft(
        _reason!,
        _details.text.trim().isEmpty ? null : _details.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('student-spotlight-report-sheet'),
    constraints: BoxConstraints(
      maxHeight: MediaQuery.sizeOf(context).height * .86,
    ),
    decoration: const BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 12, 8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Laporkan Zona Kreasi',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Laporan Anda bersifat rahasia dan akan diperiksa moderator.',
                      style: TextStyle(
                        color: Colors.blueGrey.shade600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Tutup',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Flexible(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            children: [
              RadioGroup<String>(
                groupValue: _reason,
                onChanged: (value) => setState(() => _reason = value),
                child: Column(
                  children: _reasons
                      .map(
                        (reason) => RadioListTile<String>(
                          value: reason.$1,
                          secondary: Icon(
                            reason.$3,
                            color: const Color(0xFF475569),
                          ),
                          title: Text(
                            reason.$2,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
              if (_reason == 'OTHER') ...[
                const SizedBox(height: 6),
                TextField(
                  key: const Key('student-spotlight-report-details'),
                  controller: _details,
                  minLines: 2,
                  maxLines: 4,
                  maxLength: 1000,
                  decoration: InputDecoration(
                    hintText: 'Jelaskan masalah pada konten ini...',
                    filled: true,
                    fillColor: const Color(0xFFF6F8FC),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 18),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              key: const Key('student-spotlight-report-submit'),
              onPressed: _reason == null ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              icon: const Icon(Icons.flag_outlined),
              label: const Text('Kirim Laporan'),
            ),
          ),
        ),
      ],
    ),
  );
}

class _SpotlightEmptyState extends StatelessWidget {
  const _SpotlightEmptyState({
    required this.filtered,
    required this.onCreate,
    required this.onRefresh,
  });

  final bool filtered;
  final VoidCallback onCreate;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: const Color(0xFFF5F7FB),
    child: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(30),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 104,
              height: 104,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFE7EEFF), Color(0xFFF2E9FF)],
                ),
                borderRadius: BorderRadius.circular(32),
              ),
              child: const Icon(
                Icons.video_collection_rounded,
                color: Color(0xFF3569EB),
                size: 48,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              filtered
                  ? 'Zona Kreasi tidak ditemukan'
                  : 'Belum ada Zona Kreasi',
              style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(
              filtered
                  ? 'Coba gunakan kata pencarian yang berbeda.'
                  : 'Bagikan karya, kegiatan, atau prestasi melalui video pendek.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, height: 1.45),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: filtered ? onRefresh : onCreate,
              icon: Icon(filtered ? Icons.refresh_rounded : Icons.add_rounded),
              label: Text(filtered ? 'Tampilkan Semua' : 'Buat Zona Kreasi'),
            ),
          ],
        ),
      ),
    ),
  );
}

class StudentSpotlightDraft {
  const StudentSpotlightDraft({
    required this.caption,
    required this.visibility,
    required this.mediaPath,
    required this.mediaName,
    required this.isVideo,
    this.onProgress,
  });

  final String caption;
  final String visibility;
  final String mediaPath;
  final String mediaName;
  final bool isVideo;
  final void Function(int sent, int total)? onProgress;
}

class StudentSpotlightComposerSheet extends StatefulWidget {
  const StudentSpotlightComposerSheet({
    super.key,
    required this.user,
    required this.onSubmit,
  });

  final AppUser user;
  final Future<String> Function(StudentSpotlightDraft draft) onSubmit;

  @override
  State<StudentSpotlightComposerSheet> createState() =>
      _StudentSpotlightComposerSheetState();
}

class _StudentSpotlightComposerSheetState
    extends State<StudentSpotlightComposerSheet> {
  final _caption = TextEditingController();
  final _trimmer = Trimmer();
  PlatformFile? _media;
  bool _isVideo = false;
  bool _mediaReady = false;
  bool _isPlaying = false;
  double _trimStart = 0;
  double _trimEnd = 60000;
  String _visibility = 'GLOBAL';
  bool _sending = false;
  double _progress = 0;
  String? _error;

  @override
  void dispose() {
    _caption.dispose();
    _trimmer.dispose();
    super.dispose();
  }

  Future<void> _pickMedia({required bool video}) async {
    setState(() => _error = null);
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: video
            ? const ['mp4', 'mov', 'webm']
            : const ['jpg', 'jpeg', 'png', 'webp'],
        allowMultiple: false,
        withData: false,
      );
      if (!mounted || result == null || result.files.isEmpty) return;
      final file = result.files.single;
      if (file.path == null || file.path!.isEmpty) {
        setState(() => _error = 'Media tidak dapat dibaca dari perangkat.');
        return;
      }
      final maxBytes = video ? 40 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxBytes) {
        setState(
          () => _error = video
              ? 'Ukuran video maksimal 40 MB.'
              : 'Ukuran gambar maksimal 10 MB.',
        );
        return;
      }
      setState(() {
        _media = file;
        _isVideo = video;
        _mediaReady = !video;
        _isPlaying = false;
        _trimStart = 0;
        _trimEnd = 60000;
      });
      if (video) {
        await _trimmer.loadVideo(videoFile: File(file.path!));
        final duration = _trimmer.videoPlayerController?.value.duration;
        if (!mounted) return;
        setState(() {
          _mediaReady = true;
          _trimEnd = (duration?.inMilliseconds ?? 60000)
              .clamp(500, 60000)
              .toDouble();
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Galeri media tidak dapat dibuka.');
    }
  }

  Future<String?> _exportVideo() async {
    String? outputPath;
    await _trimmer.saveTrimmedVideo(
      startValue: _trimStart,
      endValue: _trimEnd,
      videoFileName: 'spotlight_${DateTime.now().millisecondsSinceEpoch}',
      onSave: (value) => outputPath = value,
    );
    return outputPath;
  }

  Future<void> _submit() async {
    final media = _media;
    final caption = _caption.text.trim();
    if (media?.path == null) {
      setState(() => _error = 'Pilih gambar atau video terlebih dahulu.');
      return;
    }
    if (caption.length < 10) {
      setState(() => _error = 'Caption minimal 10 karakter.');
      return;
    }
    setState(() {
      _sending = true;
      _progress = 0;
      _error = null;
    });
    try {
      var mediaPath = media!.path!;
      var mediaName = media.name;
      if (_isVideo) {
        final selectedDuration = _trimEnd - _trimStart;
        if (selectedDuration < 500 || selectedDuration > 60000.5) {
          throw StateError('Pilih potongan video antara 1 hingga 60 detik.');
        }
        final trimmedPath = await _exportVideo();
        if (trimmedPath == null || trimmedPath.isEmpty) {
          throw StateError('Video belum berhasil dipotong. Silakan coba lagi.');
        }
        mediaPath = trimmedPath;
        mediaName = File(trimmedPath).uri.pathSegments.last;
      }
      final message = await widget.onSubmit(
        StudentSpotlightDraft(
          caption: caption,
          visibility: _visibility,
          mediaPath: mediaPath,
          mediaName: mediaName,
          isVideo: _isVideo,
          onProgress: (sent, total) {
            if (!mounted || total <= 0) return;
            setState(() => _progress = sent / total);
          },
        ),
      );
      if (mounted) Navigator.pop(context, message);
    } catch (error) {
      if (mounted) setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      heightFactor: .96,
      child: Container(
        key: const Key('student-spotlight-composer'),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 14, 8),
                child: Row(
                  children: [
                    IconButton(
                      tooltip: 'Tutup',
                      onPressed: _sending ? null : () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded),
                    ),
                    const Expanded(
                      child: Text(
                        'Buat Zona Kreasi',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 48),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Color(0xFFEDF4FF), Color(0xFFF5EEFF)],
                          ),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFDCE7FB)),
                        ),
                        child: const Row(
                          children: [
                            Icon(
                              Icons.auto_awesome_rounded,
                              color: Color(0xFF3B6FDF),
                              size: 27,
                            ),
                            SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Bagikan momen terbaikmu',
                                    style: TextStyle(
                                      color: Color(0xFF142A52),
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  SizedBox(height: 3),
                                  Text(
                                    'Gunakan gambar atau video singkat yang menginspirasi.',
                                    style: TextStyle(
                                      color: Color(0xFF61718D),
                                      fontSize: 11,
                                      height: 1.35,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          _ComposerAvatar(user: widget.user),
                          const SizedBox(width: 11),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.user.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                _AudienceSelector(
                                  value: _visibility,
                                  onChanged: _sending
                                      ? null
                                      : (value) =>
                                            setState(() => _visibility = value),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 15),
                      TextField(
                        key: const Key('student-spotlight-caption'),
                        controller: _caption,
                        enabled: !_sending,
                        minLines: 2,
                        maxLines: 5,
                        maxLength: 2000,
                        style: const TextStyle(fontSize: 17, height: 1.4),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding: EdgeInsets.zero,
                          hintText: 'Ceritakan Zona Kreasi Anda...',
                          counterText: '',
                        ),
                      ),
                      const SizedBox(height: 12),
                      _MediaStudioCard(
                        media: _media,
                        isVideo: _isVideo,
                        ready: _mediaReady,
                        trimmer: _trimmer,
                        isPlaying: _isPlaying,
                        start: _trimStart,
                        end: _trimEnd,
                        enabled: !_sending,
                        onPickImage: () => _pickMedia(video: false),
                        onPickVideo: () => _pickMedia(video: true),
                        onStartChanged: (value) =>
                            setState(() => _trimStart = value),
                        onEndChanged: (value) =>
                            setState(() => _trimEnd = value),
                        onPlaybackChanged: (value) =>
                            setState(() => _isPlaying = value),
                        onTogglePlayback: () async {
                          final playing = await _trimmer.videoPlaybackControl(
                            startValue: _trimStart,
                            endValue: _trimEnd,
                          );
                          if (mounted) setState(() => _isPlaying = playing);
                        },
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(13),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF8E8),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFFFE0A3)),
                        ),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.verified_user_outlined,
                              size: 20,
                              color: Color(0xFFB66A00),
                            ),
                            SizedBox(width: 9),
                            Expanded(
                              child: Text(
                                'Gambar maksimal 10 MB. Video maksimal 40 MB dan 60 detik setelah dipotong. Konten akan diperiksa guru jika moderasi sekolah aktif.',
                                style: TextStyle(
                                  color: Color(0xFF815200),
                                  fontSize: 11.5,
                                  height: 1.4,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_sending) ...[
                        const SizedBox(height: 16),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                            minHeight: 7,
                            value: _progress > 0 ? _progress : null,
                            color: const Color(0xFF1769E8),
                            backgroundColor: const Color(0xFFDCE8FF),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _progress > 0
                              ? 'Mengunggah ${(_progress * 100).round()}%'
                              : _isVideo
                              ? 'Memotong dan menyiapkan video...'
                              : 'Menyiapkan gambar...',
                          style: const TextStyle(
                            color: Color(0xFF1769E8),
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 13),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFECEC),
                            borderRadius: BorderRadius.circular(13),
                          ),
                          child: Text(
                            _error!,
                            style: const TextStyle(
                              color: Color(0xFFB42318),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 14),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    key: const Key('student-spotlight-submit'),
                    onPressed: _sending ? null : _submit,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    icon: _sending
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.send_rounded),
                    label: Text(
                      _sending
                          ? 'Menerbitkan Zona Kreasi...'
                          : 'Terbitkan Zona Kreasi',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ComposerAvatar extends StatelessWidget {
  const _ComposerAvatar({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final bytes = user.avatarBytes;
    final avatarUrl = user.avatarUrl;
    return Container(
      width: 48,
      height: 48,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Color(0xFFE5EDFF),
      ),
      child: bytes != null
          ? Image.memory(bytes, fit: BoxFit.cover)
          : avatarUrl?.trim().isNotEmpty == true
          ? Image.network(
              _mediaUrl(avatarUrl!),
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => _initial(),
            )
          : _initial(),
    );
  }

  Widget _initial() => Center(
    child: Text(
      user.name.trim().isEmpty ? 'S' : user.name.trim()[0].toUpperCase(),
      style: const TextStyle(
        color: Color(0xFF1769E8),
        fontWeight: FontWeight.w900,
        fontSize: 18,
      ),
    ),
  );
}

class _AudienceSelector extends StatelessWidget {
  const _AudienceSelector({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) => PopupMenuButton<String>(
    key: const Key('student-spotlight-visibility'),
    enabled: onChanged != null,
    initialValue: value,
    onSelected: onChanged,
    itemBuilder: (_) => const [
      PopupMenuItem(value: 'GLOBAL', child: Text('Publik — semua siswa')),
      PopupMenuItem(value: 'SCHOOL', child: Text('Sekolah saya')),
      PopupMenuItem(value: 'CLASS', child: Text('Kelas saya')),
    ],
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F3F8),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFD8E0EC)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            value == 'GLOBAL'
                ? Icons.public_rounded
                : value == 'CLASS'
                ? Icons.groups_2_rounded
                : Icons.school_rounded,
            size: 14,
            color: const Color(0xFF3C4A5D),
          ),
          const SizedBox(width: 5),
          Text(
            value == 'GLOBAL'
                ? 'Publik'
                : value == 'CLASS'
                ? 'Kelas saya'
                : 'Sekolah saya',
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
          ),
          const SizedBox(width: 3),
          const Icon(Icons.arrow_drop_down_rounded, size: 17),
        ],
      ),
    ),
  );
}

class _MediaStudioCard extends StatelessWidget {
  const _MediaStudioCard({
    required this.media,
    required this.isVideo,
    required this.ready,
    required this.trimmer,
    required this.isPlaying,
    required this.start,
    required this.end,
    required this.enabled,
    required this.onPickImage,
    required this.onPickVideo,
    required this.onStartChanged,
    required this.onEndChanged,
    required this.onPlaybackChanged,
    required this.onTogglePlayback,
  });

  final PlatformFile? media;
  final bool isVideo;
  final bool ready;
  final Trimmer trimmer;
  final bool isPlaying;
  final double start;
  final double end;
  final bool enabled;
  final VoidCallback onPickImage;
  final VoidCallback onPickVideo;
  final ValueChanged<double> onStartChanged;
  final ValueChanged<double> onEndChanged;
  final ValueChanged<bool> onPlaybackChanged;
  final VoidCallback onTogglePlayback;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: const Color(0xFFF6F8FC),
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: const Color(0xFFDCE4F0)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0F17345F),
          blurRadius: 24,
          offset: Offset(0, 10),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 13, 14, 11),
          child: Row(
            children: [
              Container(
                width: 35,
                height: 35,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF347CFF), Color(0xFF8B5CF6)],
                  ),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: Colors.white,
                  size: 19,
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Media Zona Kreasi',
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      'Pilih gambar atau potong video hingga 60 detik',
                      style: TextStyle(color: AppColors.muted, fontSize: 10.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (media == null)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 14),
            child: Row(
              children: [
                Expanded(
                  child: _MediaChoice(
                    key: const Key('student-spotlight-pick-image'),
                    icon: Icons.add_photo_alternate_rounded,
                    title: 'Gambar',
                    subtitle: 'JPG, PNG, WebP',
                    colors: const [Color(0xFF16A085), Color(0xFF31C48D)],
                    enabled: enabled,
                    onTap: onPickImage,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _MediaChoice(
                    key: const Key('student-spotlight-pick-video'),
                    icon: Icons.video_library_rounded,
                    title: 'Video',
                    subtitle: 'Maksimal 60 detik',
                    colors: const [Color(0xFF347CFF), Color(0xFF7657E8)],
                    enabled: enabled,
                    onTap: onPickVideo,
                  ),
                ),
              ],
            ),
          )
        else if (!isVideo)
          _ImageStudio(
            file: File(media!.path!),
            enabled: enabled,
            onReplace: onPickImage,
          )
        else if (!ready)
          const SizedBox(
            height: 290,
            child: Center(child: CircularProgressIndicator()),
          )
        else
          _VideoTrimStudio(
            trimmer: trimmer,
            isPlaying: isPlaying,
            start: start,
            end: end,
            enabled: enabled,
            onStartChanged: onStartChanged,
            onEndChanged: onEndChanged,
            onPlaybackChanged: onPlaybackChanged,
            onTogglePlayback: onTogglePlayback,
            onReplace: onPickVideo,
          ),
      ],
    ),
  );
}

class _MediaChoice extends StatelessWidget {
  const _MediaChoice({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.colors,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final List<Color> colors;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(18),
    child: InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE0E7F1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: colors),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: Colors.white, size: 23),
            ),
            const SizedBox(height: 18),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 3),
            Text(
              subtitle,
              style: const TextStyle(color: AppColors.muted, fontSize: 10.5),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ImageStudio extends StatelessWidget {
  const _ImageStudio({
    required this.file,
    required this.enabled,
    required this.onReplace,
  });

  final File file;
  final bool enabled;
  final VoidCallback onReplace;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      ClipRRect(
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(23)),
        child: SizedBox(
          height: 360,
          width: double.infinity,
          child: Image.file(file, fit: BoxFit.cover),
        ),
      ),
      Positioned(
        right: 12,
        top: 12,
        child: _ReplaceMediaButton(
          enabled: enabled,
          label: 'Ganti gambar',
          onTap: onReplace,
        ),
      ),
    ],
  );
}

class _VideoTrimStudio extends StatelessWidget {
  const _VideoTrimStudio({
    required this.trimmer,
    required this.isPlaying,
    required this.start,
    required this.end,
    required this.enabled,
    required this.onStartChanged,
    required this.onEndChanged,
    required this.onPlaybackChanged,
    required this.onTogglePlayback,
    required this.onReplace,
  });

  final Trimmer trimmer;
  final bool isPlaying;
  final double start;
  final double end;
  final bool enabled;
  final ValueChanged<double> onStartChanged;
  final ValueChanged<double> onEndChanged;
  final ValueChanged<bool> onPlaybackChanged;
  final VoidCallback onTogglePlayback;
  final VoidCallback onReplace;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Stack(
        alignment: Alignment.center,
        children: [
          Container(
            height: 300,
            width: double.infinity,
            color: Colors.black,
            child: VideoViewer(trimmer: trimmer),
          ),
          Material(
            color: const Color(0x9C000000),
            shape: const CircleBorder(),
            child: IconButton(
              onPressed: enabled ? onTogglePlayback : null,
              iconSize: 34,
              icon: Icon(
                isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                color: Colors.white,
              ),
            ),
          ),
          Positioned(
            right: 12,
            top: 12,
            child: _ReplaceMediaButton(
              enabled: enabled,
              label: 'Ganti video',
              onTap: onReplace,
            ),
          ),
        ],
      ),
      Container(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
        color: const Color(0xFF101318),
        child: Column(
          children: [
            Row(
              children: [
                const Icon(
                  Icons.content_cut_rounded,
                  color: Colors.white70,
                  size: 17,
                ),
                const SizedBox(width: 7),
                const Expanded(
                  child: Text(
                    'Pilih bagian video',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Text(
                  '${_clock(start)} – ${_clock(end)}',
                  style: const TextStyle(
                    color: Color(0xFF8AB4FF),
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            IgnorePointer(
              ignoring: !enabled,
              child: TrimViewer(
                trimmer: trimmer,
                viewerHeight: 58,
                viewerWidth: MediaQuery.sizeOf(context).width - 64,
                maxVideoLength: const Duration(seconds: 60),
                durationTextStyle: const TextStyle(
                  color: Colors.white70,
                  fontSize: 10,
                ),
                editorProperties: const TrimEditorProperties(
                  borderPaintColor: Color(0xFF3B82F6),
                  scrubberPaintColor: Colors.white,
                  circlePaintColor: Color(0xFF3B82F6),
                  borderWidth: 3,
                ),
                areaProperties: const TrimAreaProperties(thumbnailQuality: 60),
                onChangeStart: onStartChanged,
                onChangeEnd: onEndChanged,
                onChangePlaybackState: onPlaybackChanged,
              ),
            ),
            const SizedBox(height: 7),
            const Text(
              'Geser bingkai biru seperti Status WhatsApp · maksimal 1 menit',
              style: TextStyle(color: Colors.white54, fontSize: 10.5),
            ),
          ],
        ),
      ),
    ],
  );
}

class _ReplaceMediaButton extends StatelessWidget {
  const _ReplaceMediaButton({
    required this.enabled,
    required this.label,
    required this.onTap,
  });

  final bool enabled;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => FilledButton.icon(
    onPressed: enabled ? onTap : null,
    style: FilledButton.styleFrom(
      backgroundColor: const Color(0xB8000000),
      foregroundColor: Colors.white,
      visualDensity: VisualDensity.compact,
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
    ),
    icon: const Icon(Icons.refresh_rounded, size: 15),
    label: Text(label, style: const TextStyle(fontSize: 10.5)),
  );
}

String _clock(double milliseconds) {
  final total = (milliseconds / 1000).floor().clamp(0, 3599);
  return '${total ~/ 60}:${(total % 60).toString().padLeft(2, '0')}';
}

String _mediaUrl(String value) => resolveAppMediaUrl(value);

String _friendlyError(Object error) {
  final text = '$error';
  return text
      .replaceFirst('ApiException: ', '')
      .replaceFirst('Bad state: ', '');
}
