import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/ads/mobile_ad_config.dart';
import 'package:guruspace_mobile/core/ads/student_admob_banner.dart';
import 'package:guruspace_mobile/core/network/api_exception.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_ads.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/spotlight_admob_slide.dart';
import 'package:guruspace_mobile/features/student/presentation/student_creator_profile_screen.dart';

class StudentMadingScreen extends ConsumerStatefulWidget {
  const StudentMadingScreen({super.key, required this.onNotifications});

  final VoidCallback onNotifications;

  @override
  ConsumerState<StudentMadingScreen> createState() =>
      _StudentMadingScreenState();
}

class _StudentMadingScreenState extends ConsumerState<StudentMadingScreen> {
  static const _filters = [
    'Semua',
    'Sekolahku',
    'Pengumuman',
    'Artikel Siswa',
    'Event',
  ];
  String _filter = 'Semua';
  final Map<String, StudentBoardItem> _itemOverrides = {};

  @override
  Widget build(BuildContext context) {
    final feed = ref.watch(studentMadingProvider);
    final dashboard = ref.watch(studentDashboardProvider).asData?.value;
    return SafeArea(
      bottom: false,
      child: Stack(
        children: [
          Column(
            children: [
              SizedBox(
                height: 46,
                child: ListView.separated(
                  key: const Key('student-mading-filters'),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 5,
                  ),
                  scrollDirection: Axis.horizontal,
                  itemCount: _filters.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, index) {
                    final label = _filters[index];
                    final selected = _filter == label;
                    return ChoiceChip(
                      label: Text(label),
                      selected: selected,
                      onSelected: (_) => setState(() => _filter = label),
                      showCheckmark: false,
                      backgroundColor: const Color(0xFFF5FAF6),
                      selectedColor: const Color(0xFFE8F6EA),
                      disabledColor: const Color(0xFFF5FAF6),
                      side: BorderSide(
                        color: selected
                            ? const Color(0xFF8DC63F)
                            : const Color(0xFFD7E8D9),
                      ),
                      shape: const StadiumBorder(),
                      padding: const EdgeInsets.symmetric(horizontal: 5),
                      labelStyle: TextStyle(
                        color: selected
                            ? const Color(0xFF007A33)
                            : const Color(0xFF5E6F5E),
                        fontSize: 12,
                        fontWeight: selected
                            ? FontWeight.w800
                            : FontWeight.w600,
                      ),
                    );
                  },
                ),
              ),
              Expanded(
                child: feed.when(
                  loading: () => const LoadingView(label: 'Membuka mading...'),
                  error: (error, _) => ErrorView(
                    message: '$error',
                    onRetry: () => ref.invalidate(studentMadingProvider),
                  ),
                  data: (items) {
                    final currentItems = items
                        .map((item) => _itemOverrides[item.id] ?? item)
                        .toList();
                    final visible = currentItems
                        .where(
                          (item) => _matches(
                            item,
                            schoolId: dashboard?.schoolId,
                            schoolName: dashboard?.schoolName,
                          ),
                        )
                        .toList();
                    if (visible.isEmpty) {
                      return _MadingEmptyState(
                        filtered: currentItems.isNotEmpty,
                        onCreate: _openComposer,
                      );
                    }
                    return RefreshIndicator(
                      onRefresh: () =>
                          ref.refresh(studentMadingProvider.future),
                      child: _MadingPinterestFeed(
                        items: visible,
                        onTap: (item) => _showPreview(item, visible),
                        onChanged: (updated) {
                          setState(() => _itemOverrides[updated.id] = updated);
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
          Positioned(
            right: 20,
            bottom: 94,
            child: _MadingCreateButton(onTap: _openComposer),
          ),
        ],
      ),
    );
  }

  bool _matches(
    StudentBoardItem item, {
    required String? schoolId,
    required String? schoolName,
  }) {
    if (_filter == 'Sekolahku') {
      return _sameSchool(
        itemSchoolId: item.schoolId,
        itemSchoolName: item.schoolName,
        viewerSchoolId: schoolId,
        viewerSchoolName: schoolName,
      );
    }
    final category = _category(item.category);
    if (_filter != 'Semua' && category != _filter) return false;
    return true;
  }

  Future<void> _openComposer() async {
    final message = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StudentMadingComposerSheet(onSubmit: _submitDraft),
    );
    if (!mounted || message == null) return;
    ref.invalidate(studentMadingProvider);
    ref.invalidate(studentDashboardProvider);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<String> _submitDraft(StudentMadingDraft draft) async {
    final repository = ref.read(dashboardRepositoryProvider);
    String? imageUrl;
    if (draft.imagePath != null && draft.imageName != null) {
      imageUrl = await repository.uploadStudentMadingImage(
        filePath: draft.imagePath!,
        fileName: draft.imageName!,
      );
    }
    return repository.createStudentMading(
      title: draft.title,
      category: draft.category,
      content: draft.content,
      visibility: draft.visibility,
      imageUrl: imageUrl,
    );
  }

  Future<void> _showPreview(
    StudentBoardItem item,
    List<StudentBoardItem> visible,
  ) async {
    final deleted = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => StudentMadingPreviewScreen(
          items: List<StudentBoardItem>.unmodifiable(visible),
          initialPostId: item.id,
          onChanged: (updated) {
            if (mounted) {
              setState(() => _itemOverrides[updated.id] = updated);
            }
          },
        ),
      ),
    );
    if (!mounted || deleted != true) return;
    _itemOverrides.remove(item.id);
    ref.invalidate(studentMadingProvider);
    ref.invalidate(studentDashboardProvider);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Mading berhasil dihapus.')));
  }
}

class StudentMadingPreviewScreen extends ConsumerStatefulWidget {
  const StudentMadingPreviewScreen({
    super.key,
    required this.items,
    required this.initialPostId,
    this.onChanged,
  });

  final List<StudentBoardItem> items;
  final String initialPostId;
  final ValueChanged<StudentBoardItem>? onChanged;

  @override
  ConsumerState<StudentMadingPreviewScreen> createState() =>
      _StudentMadingPreviewScreenState();
}

class _StudentMadingPreviewScreenState
    extends ConsumerState<StudentMadingPreviewScreen> {
  late final PageController _controller;
  late List<StudentBoardItem> _items;
  SpotlightAdsConfig _adsConfig = SpotlightAdsConfig.disabled;
  bool _adsSuppressed = false;
  int _activeIndex = 0;

  @override
  void initState() {
    super.initState();
    _items = [...widget.items];
    final initial = _items.indexWhere(
      (item) => item.id == widget.initialPostId,
    );
    _activeIndex = initial < 0 ? 0 : initial;
    _controller = PageController(initialPage: _activeIndex);
    Future<void>.microtask(_loadAdsConfig);
  }

  Future<void> _loadAdsConfig() async {
    try {
      final config = await ref.read(mobileAdConfigProvider.future);
      if (!mounted) return;
      final visiblePostId = _entries()[_activeIndex].post?.id;
      final nativeUnit = config.unitFor(StudentAdmobPlacement.madingNative);
      setState(() {
        _adsConfig = SpotlightAdsConfig(
          enabled: nativeUnit.isNotEmpty,
          androidAdUnitId: nativeUnit,
          everyNPosts: config.madingEveryNPosts,
        );
        _adsSuppressed = false;
      });
      if (visiblePostId == null) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_controller.hasClients) return;
        final next = _entries().indexWhere(
          (entry) => entry.post?.id == visiblePostId,
        );
        if (next >= 0 && next != _activeIndex) {
          _activeIndex = next;
          _controller.jumpToPage(next);
        }
      });
    } catch (_) {
      // Ads are optional and must never block organic Mading previews.
    }
  }

  List<SpotlightFeedEntry<StudentBoardItem>> _entries() =>
      buildSpotlightFeedEntries(
        _items,
        idOf: (item) => item.id,
        config: _adsSuppressed ? SpotlightAdsConfig.disabled : _adsConfig,
      );

  Future<void> _openDetail(
    StudentBoardItem item, {
    bool focusComments = false,
  }) async {
    final deleted = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => StudentMadingDetailScreen(
          item: item,
          focusComments: focusComments,
          onChanged: _replace,
        ),
      ),
    );
    if (!mounted || deleted != true) return;
    setState(() => _items.removeWhere((candidate) => candidate.id == item.id));
    ref.invalidate(studentMadingProvider);
    ref.invalidate(studentDashboardProvider);
    if (_items.isEmpty) {
      Navigator.pop(context, true);
      return;
    }
    if (_activeIndex >= _entries().length) {
      _activeIndex = _entries().length - 1;
      if (_controller.hasClients) _controller.jumpToPage(_activeIndex);
    }
  }

  void _replace(StudentBoardItem updated) {
    final index = _items.indexWhere((item) => item.id == updated.id);
    if (index < 0) return;
    setState(() => _items[index] = updated);
    widget.onChanged?.call(updated);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final entries = _entries();
    return Scaffold(
      key: const Key('student-mading-reels-preview'),
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            key: const Key('student-mading-reels-pages'),
            controller: _controller,
            scrollDirection: Axis.vertical,
            physics: const PageScrollPhysics(),
            itemCount: entries.length,
            onPageChanged: (index) => setState(() => _activeIndex = index),
            itemBuilder: (_, index) {
              final entry = entries[index];
              if (entry.isAd) {
                return SpotlightAdmobSlide(
                  key: ValueKey('mading-${entry.id}'),
                  adUnitId: _adsConfig.androidAdUnitId,
                  onUnavailable: () {
                    if (mounted && !_adsSuppressed) {
                      setState(() => _adsSuppressed = true);
                    }
                  },
                );
              }
              final item = entry.post!;
              return _MadingReelsPreviewSlide(
                key: ValueKey('mading-preview-${item.id}'),
                item: item,
                onChanged: _replace,
                onOpen: () => _openDetail(item),
                onComments: () => _openDetail(item, focusComments: true),
                onMore: () => _openDetail(item),
              );
            },
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 10,
            left: 12,
            child: _MadingFloatingControl(
              key: const Key('student-mading-reels-back'),
              tooltip: 'Kembali',
              icon: Icons.arrow_back_rounded,
              onTap: () => Navigator.maybePop(context),
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 10,
            right: 12,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: .5),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 7,
                ),
                child: Text(
                  '${_activeIndex + 1}/${entries.length}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MadingReelsPreviewSlide extends ConsumerStatefulWidget {
  const _MadingReelsPreviewSlide({
    super.key,
    required this.item,
    required this.onChanged,
    required this.onOpen,
    required this.onComments,
    required this.onMore,
  });

  final StudentBoardItem item;
  final ValueChanged<StudentBoardItem> onChanged;
  final VoidCallback onOpen;
  final VoidCallback onComments;
  final VoidCallback onMore;

  @override
  ConsumerState<_MadingReelsPreviewSlide> createState() =>
      _MadingReelsPreviewSlideState();
}

class _MadingReelsPreviewSlideState
    extends ConsumerState<_MadingReelsPreviewSlide> {
  late StudentBoardItem _item;
  bool _liking = false;

  @override
  void initState() {
    super.initState();
    _item = widget.item;
  }

  @override
  void didUpdateWidget(covariant _MadingReelsPreviewSlide oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item != widget.item) _item = widget.item;
  }

  Future<void> _toggleLike() async {
    if (_liking) return;
    final previous = _item;
    final desired = !previous.likedByMe;
    setState(() {
      _liking = true;
      _item = previous.copyWith(
        likedByMe: desired,
        likeCount: desired
            ? previous.likeCount + 1
            : (previous.likeCount > 0 ? previous.likeCount - 1 : 0),
      );
    });
    try {
      final result = await ref
          .read(dashboardRepositoryProvider)
          .setStudentMadingLike(_item.id, liked: desired);
      if (!mounted) return;
      setState(() {
        _item = _item.copyWith(
          likedByMe: result.liked,
          likeCount: result.count,
        );
      });
      widget.onChanged(_item);
    } catch (_) {
      if (mounted) setState(() => _item = previous);
    } finally {
      if (mounted) setState(() => _liking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasImage = _item.imageUrl?.trim().isNotEmpty == true;
    return ColoredBox(
      color: const Color(0xFF070B14),
      child: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            Positioned.fill(
              child: hasImage
                  ? Image.network(
                      _mediaUrl(_item.imageUrl!),
                      fit: BoxFit.contain,
                      errorBuilder: (_, _, _) => _MadingImageFallback(
                        category: _item.category,
                        accent: _categoryColor(_item.category),
                      ),
                    )
                  : _MadingImageFallback(
                      category: _item.category,
                      accent: _categoryColor(_item.category),
                    ),
            ),
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x26000000),
                      Color(0x00000000),
                      Color(0xE6000000),
                    ],
                    stops: [0, .48, 1],
                  ),
                ),
              ),
            ),
            Positioned(
              left: 18,
              right: 82,
              bottom: 26,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _item.studentId?.trim().isNotEmpty == true
                        ? () => openStudentCreatorProfile(
                            context,
                            _item.studentId,
                          )
                        : null,
                    child: Row(
                      children: [
                        _MadingAuthorAvatar(item: _item, size: 38),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _item.author,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              Text(
                                _item.schoolName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 13),
                  Text(
                    _item.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      height: 1.12,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    _item.content,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                      height: 1.42,
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    key: const Key('mading-preview-read-full'),
                    onPressed: widget.onOpen,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white54),
                      backgroundColor: Colors.black38,
                    ),
                    icon: const Icon(Icons.article_outlined, size: 18),
                    label: const Text('Baca lengkap'),
                  ),
                ],
              ),
            ),
            Positioned(
              right: 16,
              bottom: 32,
              child: Column(
                children: [
                  _MadingReelsAction(
                    icon: _item.likedByMe
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    label: '${_item.likeCount}',
                    active: _item.likedByMe,
                    onTap: _liking ? null : _toggleLike,
                  ),
                  const SizedBox(height: 18),
                  _MadingReelsAction(
                    icon: Icons.chat_bubble_outline_rounded,
                    label: '${_item.commentCount}',
                    onTap: widget.onComments,
                  ),
                  const SizedBox(height: 18),
                  _MadingReelsAction(
                    icon: Icons.visibility_outlined,
                    label: '${_item.viewCount}',
                  ),
                  const SizedBox(height: 18),
                  _MadingReelsAction(
                    icon: Icons.more_horiz_rounded,
                    label: 'Opsi',
                    onTap: widget.onMore,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MadingReelsAction extends StatelessWidget {
  const _MadingReelsAction({
    required this.icon,
    required this.label,
    this.active = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkResponse(
    onTap: onTap,
    radius: 28,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: .52),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white24),
          ),
          child: Icon(
            icon,
            color: active ? const Color(0xFFFF4D6D) : Colors.white,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}

class StudentMadingDetailScreen extends ConsumerStatefulWidget {
  const StudentMadingDetailScreen({
    super.key,
    required this.item,
    this.focusComments = false,
    this.onChanged,
    this.onView,
    this.onLoadComments,
    this.onReport,
    this.onDelete,
  });

  final StudentBoardItem item;
  final bool focusComments;
  final ValueChanged<StudentBoardItem>? onChanged;
  final Future<int> Function()? onView;
  final Future<({List<StudentBoardComment> comments, int count})> Function()?
  onLoadComments;
  final Future<String> Function(String reason, String? details)? onReport;
  final Future<void> Function()? onDelete;

  @override
  ConsumerState<StudentMadingDetailScreen> createState() =>
      _StudentMadingDetailScreenState();
}

class _StudentMadingDetailScreenState
    extends ConsumerState<StudentMadingDetailScreen> {
  final _commentController = TextEditingController();
  final _commentFocus = FocusNode();
  final _detailScroll = ScrollController();
  late StudentBoardItem _item;
  List<StudentBoardComment> _comments = const [];
  late bool _commentsOpen;
  bool _commentsLoaded = false;
  bool _loadingComments = false;
  bool _sendingComment = false;
  bool _liking = false;
  bool _bookmarking = false;
  bool _reporting = false;
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    _item = widget.item;
    _commentsOpen = widget.focusComments;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _recordView();
      if (_commentsOpen) {
        _loadComments();
        _focusComments();
      }
    });
  }

  Future<void> _recordView() async {
    try {
      final count = widget.onView != null
          ? await widget.onView!()
          : await ref
                .read(dashboardRepositoryProvider)
                .recordStudentMadingView(_item.id);
      if (!mounted) return;
      setState(() => _item = _item.copyWith(viewCount: count));
      widget.onChanged?.call(_item);
    } catch (_) {
      // View analytics must never interrupt reading the content.
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    _commentFocus.dispose();
    _detailScroll.dispose();
    super.dispose();
  }

  Future<void> _loadComments() async {
    if (_loadingComments) return;
    setState(() => _loadingComments = true);
    try {
      final result = widget.onLoadComments != null
          ? await widget.onLoadComments!()
          : await ref
                .read(dashboardRepositoryProvider)
                .getStudentMadingComments(_item.id);
      if (!mounted) return;
      setState(() {
        _comments = result.comments;
        _loadingComments = false;
        _commentsLoaded = true;
        _item = _item.copyWith(commentCount: result.count);
      });
      widget.onChanged?.call(_item);
    } catch (error) {
      if (!mounted) return;
      setState(() => _loadingComments = false);
      _showError(error);
    }
  }

  Future<void> _toggleComments() async {
    if (_commentsOpen) {
      _commentFocus.unfocus();
      setState(() => _commentsOpen = false);
      return;
    }
    setState(() => _commentsOpen = true);
    if (!_commentsLoaded) await _loadComments();
    _focusComments();
  }

  void _focusComments() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_commentsOpen) return;
      if (_detailScroll.hasClients) {
        _detailScroll.animateTo(
          _detailScroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
        );
      }
      _commentFocus.requestFocus();
    });
  }

  Future<void> _toggleLike() async {
    if (_liking) return;
    final previous = _item;
    final desired = !previous.likedByMe;
    setState(() {
      _liking = true;
      _item = previous.copyWith(
        likedByMe: desired,
        likeCount: desired
            ? previous.likeCount + 1
            : (previous.likeCount > 0 ? previous.likeCount - 1 : 0),
      );
    });
    try {
      final result = await ref
          .read(dashboardRepositoryProvider)
          .setStudentMadingLike(_item.id, liked: desired);
      if (!mounted) return;
      setState(() {
        _item = _item.copyWith(
          likedByMe: result.liked,
          likeCount: result.count,
        );
      });
      widget.onChanged?.call(_item);
    } catch (error) {
      if (!mounted) return;
      setState(() => _item = previous);
      _showError(error);
    } finally {
      if (mounted) setState(() => _liking = false);
    }
  }

  Future<void> _toggleBookmark() async {
    if (_bookmarking) return;
    final previous = _item;
    final desired = !previous.bookmarkedByMe;
    setState(() {
      _bookmarking = true;
      _item = previous.copyWith(bookmarkedByMe: desired);
    });
    try {
      final bookmarked = await ref
          .read(dashboardRepositoryProvider)
          .setStudentMadingBookmark(_item.id, bookmarked: desired);
      if (!mounted) return;
      setState(() => _item = _item.copyWith(bookmarkedByMe: bookmarked));
      widget.onChanged?.call(_item);
    } catch (error) {
      if (!mounted) return;
      setState(() => _item = previous);
      _showError(error);
    } finally {
      if (mounted) setState(() => _bookmarking = false);
    }
  }

  Future<void> _sendComment() async {
    final content = _commentController.text.trim();
    if (_sendingComment || content.isEmpty) return;
    setState(() => _sendingComment = true);
    try {
      final result = await ref
          .read(dashboardRepositoryProvider)
          .addStudentMadingComment(_item.id, content);
      if (!mounted) return;
      _commentController.clear();
      _commentFocus.unfocus();
      setState(() {
        _comments = [..._comments, result.comment];
        _item = _item.copyWith(commentCount: result.count);
      });
      widget.onChanged?.call(_item);
    } catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _sendingComment = false);
    }
  }

  Future<void> _report() async {
    if (_reporting || _item.isOwner || _item.reportedByMe) return;
    final draft = await showModalBottomSheet<_MadingReportDraft>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _MadingReportSheet(),
    );
    if (!mounted || draft == null) return;
    setState(() => _reporting = true);
    try {
      final message = widget.onReport != null
          ? await widget.onReport!(draft.reason, draft.details)
          : await ref
                .read(dashboardRepositoryProvider)
                .reportStudentMading(
                  postId: _item.id,
                  reason: draft.reason,
                  details: draft.details,
                );
      if (!mounted) return;
      setState(() => _item = _item.copyWith(reportedByMe: true));
      widget.onChanged?.call(_item);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
    } catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _reporting = false);
    }
  }

  Future<void> _delete() async {
    if (!_item.isOwner || _deleting) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hapus mading?'),
        content: const Text(
          'Konten, suka, komentar, arsip, dan laporan terkait akan dihapus permanen.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            key: const Key('student-mading-delete-confirm'),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;
    setState(() => _deleting = true);
    try {
      if (widget.onDelete != null) {
        await widget.onDelete!();
      } else {
        await ref
            .read(dashboardRepositoryProvider)
            .deleteStudentMading(_item.id);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  void _showError(Object error) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(_messageOf(error))));
  }

  @override
  Widget build(BuildContext context) {
    final accent = _categoryColor(_item.category);
    final hasImage = _item.imageUrl?.trim().isNotEmpty == true;
    final contentTopPadding = hasImage
        ? 22.0
        : MediaQuery.paddingOf(context).top + 68;
    return Scaffold(
      key: const Key('student-mading-detail-page'),
      backgroundColor: const Color(0xFFF5FAF6),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _commentsOpen ? _loadComments : () async {},
            child: ListView(
              key: const Key('student-mading-detail-scroll'),
              controller: _detailScroll,
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.zero,
              children: [
                if (hasImage)
                  ColoredBox(
                    color: const Color(0xFFF5FAF6),
                    child: Image.network(
                      _mediaUrl(_item.imageUrl!),
                      key: const Key('student-mading-detail-image'),
                      width: double.infinity,
                      fit: BoxFit.fitWidth,
                      loadingBuilder: (_, child, progress) => progress == null
                          ? child
                          : const SizedBox(
                              height: 260,
                              child: _MadingImageLoading(),
                            ),
                      errorBuilder: (_, _, _) => SizedBox(
                        height: 260,
                        child: _MadingImageFallback(
                          category: _item.category,
                          accent: accent,
                        ),
                      ),
                    ),
                  ),
                Container(
                  color: Colors.white,
                  padding: EdgeInsets.fromLTRB(20, contentTopPadding, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _MadingCategoryPill(
                        category: _item.category,
                        accent: accent,
                      ),
                      const SizedBox(height: 14),
                      Text(
                        _item.title,
                        key: const Key('student-mading-detail-title'),
                        style: const TextStyle(
                          color: Color(0xFF0F2418),
                          fontSize: 28,
                          height: 1.14,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -.55,
                        ),
                      ),
                      const SizedBox(height: 18),
                      GestureDetector(
                        key: const Key('student-mading-detail-author'),
                        behavior: HitTestBehavior.opaque,
                        onTap: _item.studentId?.trim().isNotEmpty == true
                            ? () => openStudentCreatorProfile(
                                context,
                                _item.studentId,
                              )
                            : null,
                        child: Row(
                          children: [
                            _MadingAuthorAvatar(item: _item, size: 44),
                            const SizedBox(width: 11),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _item.author,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  Text(
                                    _item.schoolName,
                                    key: const Key(
                                      'student-mading-detail-school',
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: AppColors.muted,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  Text(
                                    _relativeTime(_item.publishedAt),
                                    style: const TextStyle(
                                      color: AppColors.muted,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 22),
                      SelectableText(
                        _item.content,
                        key: const Key('student-mading-detail-content'),
                        style: const TextStyle(
                          color: Color(0xFF0F2418),
                          fontSize: 16,
                          height: 1.72,
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Divider(height: 1),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _MadingActionButton(
                            key: const Key('student-mading-detail-like'),
                            icon: _item.likedByMe
                                ? Icons.thumb_up_alt_rounded
                                : Icons.thumb_up_alt_outlined,
                            label: '${_item.likeCount}',
                            active: _item.likedByMe,
                            onTap: _liking ? null : _toggleLike,
                          ),
                          const SizedBox(width: 8),
                          _MadingActionButton(
                            key: const Key('student-mading-detail-views'),
                            icon: Icons.visibility_outlined,
                            label: '${_item.viewCount}',
                            onTap: null,
                          ),
                          const SizedBox(width: 8),
                          _MadingActionButton(
                            key: const Key('student-mading-detail-comments'),
                            icon: Icons.chat_bubble_outline_rounded,
                            label: '${_item.commentCount}',
                            active: _commentsOpen,
                            onTap: _toggleComments,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (_commentsOpen) const SizedBox(height: 10),
                if (_commentsOpen)
                  Container(
                    key: const Key('student-mading-comments-panel'),
                    color: Colors.white,
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 30),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Komentar (${_item.commentCount})',
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (_loadingComments)
                          const Center(child: CircularProgressIndicator())
                        else if (_comments.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Center(
                              child: Text(
                                'Belum ada komentar. Jadilah yang pertama.',
                                style: TextStyle(color: AppColors.muted),
                              ),
                            ),
                          )
                        else
                          ..._comments.map(
                            (comment) => _MadingCommentTile(comment: comment),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 10,
            left: 12,
            child: _MadingFloatingControl(
              key: const Key('student-mading-detail-back'),
              tooltip: 'Kembali',
              icon: Icons.arrow_back_rounded,
              onTap: () => Navigator.maybePop(context),
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 10,
            right: 12,
            child: Row(
              children: [
                _MadingFloatingControl(
                  key: const Key('student-mading-detail-bookmark'),
                  tooltip: _item.bookmarkedByMe
                      ? 'Hapus dari arsip'
                      : 'Arsipkan',
                  icon: _item.bookmarkedByMe
                      ? Icons.bookmark_rounded
                      : Icons.bookmark_border_rounded,
                  active: _item.bookmarkedByMe,
                  onTap: _bookmarking ? null : _toggleBookmark,
                ),
                const SizedBox(width: 8),
                PopupMenuButton<String>(
                  key: const Key('student-mading-detail-more'),
                  tooltip: 'Opsi mading',
                  enabled: !_deleting,
                  position: PopupMenuPosition.under,
                  onSelected: (value) async {
                    if (value == 'report') await _report();
                    if (value == 'delete') await _delete();
                  },
                  itemBuilder: (_) => [
                    if (_item.isOwner)
                      const PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            Icon(
                              Icons.delete_outline_rounded,
                              color: Colors.red,
                            ),
                            SizedBox(width: 10),
                            Flexible(
                              child: Text(
                                'Hapus konten',
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: Colors.red),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      PopupMenuItem(
                        value: 'report',
                        enabled: !_item.reportedByMe && !_reporting,
                        child: Row(
                          children: [
                            Icon(
                              _item.reportedByMe
                                  ? Icons.flag_rounded
                                  : Icons.flag_outlined,
                              color: Colors.red,
                            ),
                            const SizedBox(width: 10),
                            Flexible(
                              child: Text(
                                _item.reportedByMe
                                    ? 'Sudah dilaporkan'
                                    : 'Laporkan konten',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .94),
                      shape: BoxShape.circle,
                      boxShadow: const [
                        BoxShadow(color: Color(0x26000000), blurRadius: 12),
                      ],
                    ),
                    child: _deleting
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.more_horiz_rounded),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: _commentsOpen
          ? SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: Color(0xFFD7E8D9))),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        key: const Key('student-mading-comment-field'),
                        controller: _commentController,
                        focusNode: _commentFocus,
                        minLines: 1,
                        maxLines: 3,
                        textInputAction: TextInputAction.newline,
                        decoration: const InputDecoration(
                          hintText: 'Tulis komentar...',
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      key: const Key('student-mading-send-comment'),
                      tooltip: 'Kirim komentar',
                      onPressed: _sendingComment ? null : _sendComment,
                      icon: _sendingComment
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.send_rounded),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }
}

class _MadingFloatingControl extends StatelessWidget {
  const _MadingFloatingControl({
    super.key,
    required this.tooltip,
    required this.icon,
    required this.onTap,
    this.active = false,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onTap;
  final bool active;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: tooltip,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: .94),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFD7E8D9)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x2B0D1D36),
              blurRadius: 14,
              offset: Offset(0, 5),
            ),
          ],
        ),
        child: Icon(
          icon,
          color: active ? AppColors.blue : AppColors.navy,
          size: 23,
        ),
      ),
    ),
  );
}

class _MadingActionButton extends StatelessWidget {
  const _MadingActionButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool active;

  @override
  Widget build(BuildContext context) => Semantics(
    button: onTap != null,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFE8F6EA) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 19,
              color: active ? AppColors.blue : AppColors.muted,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: active ? AppColors.blue : AppColors.muted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _MadingCommentTile extends StatelessWidget {
  const _MadingCommentTile({required this.comment});

  final StudentBoardComment comment;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _MadingCommentAvatar(comment: comment),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF4F7FB),
              borderRadius: BorderRadius.circular(15),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        comment.author,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    Text(
                      _relativeTime(comment.createdAt),
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 9,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 5),
                Text(
                  comment.content,
                  style: const TextStyle(fontSize: 13, height: 1.4),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class _MadingCommentAvatar extends StatelessWidget {
  const _MadingCommentAvatar({required this.comment});

  final StudentBoardComment comment;

  @override
  Widget build(BuildContext context) {
    final url = comment.authorAvatarUrl?.trim();
    final fallback = ColoredBox(
      color: AppColors.blue,
      child: Center(
        child: Text(
          _initials(comment.author),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
    return Container(
      width: 34,
      height: 34,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(shape: BoxShape.circle),
      child: url?.isNotEmpty == true
          ? Image.network(
              _mediaUrl(url!),
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => fallback,
            )
          : fallback,
    );
  }
}

class _MadingCreateButton extends StatelessWidget {
  const _MadingCreateButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: 'Buat mading baru',
    child: Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: const Key('student-mading-create'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF39B54A), Color(0xFF0B5A26)],
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: const [
              BoxShadow(
                color: Color(0x4D0756DC),
                blurRadius: 18,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(Icons.add_rounded, color: Colors.white, size: 29),
        ),
      ),
    ),
  );
}

typedef MadingLikeAction =
    Future<({bool liked, int count})> Function(bool liked);
typedef MadingBookmarkAction = Future<bool> Function(bool bookmarked);

class _MadingPinterestFeed extends StatelessWidget {
  const _MadingPinterestFeed({
    required this.items,
    required this.onTap,
    required this.onChanged,
  });

  final List<StudentBoardItem> items;
  final ValueChanged<StudentBoardItem> onTap;
  final ValueChanged<StudentBoardItem> onChanged;

  @override
  Widget build(BuildContext context) {
    final firstCount = items.length > 8 ? 8 : items.length;
    Widget cardAt(int index) {
      final item = items[index];
      return StudentMadingPostCard(
        key: ValueKey('mading-${item.id}'),
        item: item,
        onTap: () => onTap(item),
        onChanged: onChanged,
        imageHeight: _masonryImageHeight(item, index),
      );
    }

    return CustomScrollView(
      key: const Key('student-mading-feed'),
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
          sliver: SliverMasonryGrid.count(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 10,
            childCount: firstCount,
            itemBuilder: (_, index) => cardAt(index),
          ),
        ),
        if (items.length >= 4)
          const SliverPadding(
            padding: EdgeInsets.symmetric(horizontal: 12),
            sliver: SliverToBoxAdapter(
              child: StudentAdmobBanner(
                placement: StudentAdmobPlacement.madingBanner,
              ),
            ),
          ),
        if (items.length > firstCount)
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 0),
            sliver: SliverMasonryGrid.count(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 10,
              childCount: items.length - firstCount,
              itemBuilder: (_, index) => cardAt(index + firstCount),
            ),
          ),
        const SliverToBoxAdapter(child: SizedBox(height: 126)),
      ],
    );
  }
}

double _masonryImageHeight(StudentBoardItem item, int index) {
  const imageHeights = [188.0, 226.0, 164.0, 208.0];
  const fallbackHeights = [122.0, 154.0, 136.0, 168.0];
  final heights = item.imageUrl?.trim().isNotEmpty == true
      ? imageHeights
      : fallbackHeights;
  return heights[index % heights.length];
}

class StudentMadingPostCard extends ConsumerStatefulWidget {
  const StudentMadingPostCard({
    super.key,
    required this.item,
    required this.onTap,
    required this.onChanged,
    this.onLike,
    this.onBookmark,
    this.imageHeight = 188,
  });
  final StudentBoardItem item;
  final VoidCallback onTap;
  final ValueChanged<StudentBoardItem> onChanged;
  final MadingLikeAction? onLike;
  final MadingBookmarkAction? onBookmark;
  final double imageHeight;

  @override
  ConsumerState<StudentMadingPostCard> createState() =>
      _StudentMadingPostCardState();
}

class _StudentMadingPostCardState extends ConsumerState<StudentMadingPostCard> {
  late StudentBoardItem _item;
  bool _liking = false;
  bool _bookmarking = false;

  @override
  void initState() {
    super.initState();
    _item = widget.item;
  }

  @override
  void didUpdateWidget(covariant StudentMadingPostCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item != widget.item) _item = widget.item;
  }

  Future<void> _toggleLike() async {
    if (_liking) return;
    final previous = _item;
    final desired = !previous.likedByMe;
    setState(() {
      _liking = true;
      _item = previous.copyWith(
        likedByMe: desired,
        likeCount: desired
            ? previous.likeCount + 1
            : (previous.likeCount > 0 ? previous.likeCount - 1 : 0),
      );
    });
    try {
      final result = widget.onLike != null
          ? await widget.onLike!(desired)
          : await ref
                .read(dashboardRepositoryProvider)
                .setStudentMadingLike(_item.id, liked: desired);
      if (!mounted) return;
      setState(() {
        _item = _item.copyWith(
          likedByMe: result.liked,
          likeCount: result.count,
        );
      });
      widget.onChanged(_item);
    } catch (error) {
      if (!mounted) return;
      setState(() => _item = previous);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_messageOf(error))));
    } finally {
      if (mounted) setState(() => _liking = false);
    }
  }

  Future<void> _toggleBookmark() async {
    if (_bookmarking) return;
    final previous = _item;
    final desired = !previous.bookmarkedByMe;
    setState(() {
      _bookmarking = true;
      _item = previous.copyWith(bookmarkedByMe: desired);
    });
    try {
      final bookmarked = widget.onBookmark != null
          ? await widget.onBookmark!(desired)
          : await ref
                .read(dashboardRepositoryProvider)
                .setStudentMadingBookmark(_item.id, bookmarked: desired);
      if (!mounted) return;
      setState(() => _item = _item.copyWith(bookmarkedByMe: bookmarked));
      widget.onChanged(_item);
    } catch (error) {
      if (!mounted) return;
      setState(() => _item = previous);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_messageOf(error))));
    } finally {
      if (mounted) setState(() => _bookmarking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = _item;
    final accent = _categoryColor(item.category);
    return Semantics(
      button: true,
      label: 'Buka ${item.title}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFD7E8D9)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x12132B4E),
                blurRadius: 14,
                offset: Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _MadingThumbnail(
                item: item,
                accent: accent,
                height: widget.imageHeight,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(11, 11, 11, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _category(item.category).toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: accent,
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        letterSpacing: .65,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      item.title,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        height: 1.18,
                      ),
                    ),
                    const SizedBox(height: 10),
                    GestureDetector(
                      key: const Key('student-mading-card-author-action'),
                      behavior: HitTestBehavior.opaque,
                      onTap: item.studentId?.trim().isNotEmpty == true
                          ? () => openStudentCreatorProfile(
                              context,
                              item.studentId,
                            )
                          : null,
                      child: Row(
                        children: [
                          _MadingAuthorAvatar(item: item, size: 27),
                          const SizedBox(width: 7),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.author,
                                  key: const Key('student-mading-card-author'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                Text(
                                  item.schoolName,
                                  key: const Key('student-mading-card-school'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 8.5,
                                    color: AppColors.muted,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  _relativeTime(item.publishedAt),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 8,
                                    color: AppColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _MadingCardMetric(
                          key: const Key('student-mading-card-like'),
                          icon: item.likedByMe
                              ? Icons.thumb_up_alt_rounded
                              : Icons.thumb_up_alt_outlined,
                          label: '${item.likeCount}',
                          color: item.likedByMe ? AppColors.blue : accent,
                          onTap: _liking ? null : _toggleLike,
                        ),
                        _MadingCardMetric(
                          key: const Key('student-mading-card-comments'),
                          icon: Icons.chat_bubble_outline_rounded,
                          label: '${item.commentCount}',
                          onTap: widget.onTap,
                        ),
                        _MadingCardMetric(
                          key: const Key('student-mading-card-views'),
                          icon: Icons.visibility_outlined,
                          label: '${item.viewCount}',
                        ),
                        const Spacer(),
                        _MadingCardMetric(
                          key: const Key('student-mading-card-bookmark'),
                          icon: item.bookmarkedByMe
                              ? Icons.bookmark_rounded
                              : Icons.bookmark_border_rounded,
                          color: item.bookmarkedByMe
                              ? AppColors.blue
                              : AppColors.muted,
                          onTap: _bookmarking ? null : _toggleBookmark,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MadingThumbnail extends StatelessWidget {
  const _MadingThumbnail({
    required this.item,
    required this.accent,
    required this.height,
  });
  final StudentBoardItem item;
  final Color accent;
  final double height;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      color: accent.withValues(alpha: .12),
      alignment: Alignment.center,
      child: Icon(_categoryIcon(item.category), color: accent, size: 38),
    );
    return SizedBox(
      width: double.infinity,
      height: height,
      child: item.imageUrl?.trim().isNotEmpty == true
          ? Image.network(
              _mediaUrl(item.imageUrl!),
              key: const Key('student-mading-card-image'),
              fit: BoxFit.cover,
              loadingBuilder: (_, child, progress) =>
                  progress == null ? child : const _MadingImageLoading(),
              errorBuilder: (_, _, _) => fallback,
            )
          : fallback,
    );
  }
}

class _MadingCardMetric extends StatelessWidget {
  const _MadingCardMetric({
    super.key,
    required this.icon,
    this.label,
    this.color = AppColors.muted,
    this.onTap,
  });

  final IconData icon;
  final String? label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: onTap != null,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 5),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            if (label != null) ...[
              const SizedBox(width: 3),
              Text(
                label!,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _MadingEmptyState extends StatelessWidget {
  const _MadingEmptyState({required this.filtered, required this.onCreate});
  final bool filtered;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.newspaper_rounded,
            size: 62,
            color: Color(0xFF8DC63F),
          ),
          const SizedBox(height: 16),
          Text(
            filtered ? 'Konten tidak ditemukan' : 'Mading masih kosong',
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            filtered
                ? 'Coba gunakan kata kunci atau kategori lain.'
                : 'Jadilah siswa pertama yang mengirim karya untuk mading.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted, height: 1.4),
          ),
          if (!filtered) ...[
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onCreate,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Buat Mading'),
            ),
          ],
        ],
      ),
    ),
  );
}

class _MadingAuthorAvatar extends StatelessWidget {
  const _MadingAuthorAvatar({required this.item, required this.size});

  final StudentBoardItem item;
  final double size;

  @override
  Widget build(BuildContext context) {
    final avatarUrl = item.authorAvatarUrl?.trim();
    final fallback = ColoredBox(
      color: _categoryColor(item.category),
      child: Center(
        child: Text(
          _initials(item.author),
          style: TextStyle(
            color: Colors.white,
            fontSize: size * .32,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
    return Container(
      key: const Key('student-mading-author-avatar'),
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 1.5),
        boxShadow: const [BoxShadow(color: Color(0x24132B4E), blurRadius: 8)],
      ),
      child: avatarUrl?.isNotEmpty == true
          ? Image.network(
              _mediaUrl(avatarUrl!),
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => fallback,
            )
          : fallback,
    );
  }
}

class _MadingCategoryPill extends StatelessWidget {
  const _MadingCategoryPill({required this.category, required this.accent});

  final String category;
  final Color accent;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_categoryIcon(category), size: 14, color: accent),
          const SizedBox(width: 6),
          Text(
            _category(category).toUpperCase(),
            style: TextStyle(
              color: accent,
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: .7,
            ),
          ),
        ],
      ),
    ),
  );
}

class _MadingImageLoading extends StatelessWidget {
  const _MadingImageLoading();

  @override
  Widget build(BuildContext context) => const ColoredBox(
    color: Color(0xFFD7E8D9),
    child: Center(
      child: SizedBox.square(
        dimension: 24,
        child: CircularProgressIndicator(strokeWidth: 2.5),
      ),
    ),
  );
}

class _MadingImageFallback extends StatelessWidget {
  const _MadingImageFallback({required this.category, required this.accent});

  final String category;
  final Color accent;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: accent.withValues(alpha: .12),
    child: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_categoryIcon(category), color: accent, size: 42),
          const SizedBox(height: 8),
          const Text(
            'Gambar tidak dapat dimuat',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
        ],
      ),
    ),
  );
}

class StudentMadingDraft {
  const StudentMadingDraft({
    required this.title,
    required this.category,
    required this.content,
    required this.visibility,
    this.imagePath,
    this.imageName,
  });
  final String title;
  final String category;
  final String content;
  final String visibility;
  final String? imagePath;
  final String? imageName;
}

class StudentMadingComposerSheet extends StatefulWidget {
  const StudentMadingComposerSheet({super.key, required this.onSubmit});
  final Future<String> Function(StudentMadingDraft draft) onSubmit;

  @override
  State<StudentMadingComposerSheet> createState() =>
      _StudentMadingComposerSheetState();
}

class _StudentMadingComposerSheetState
    extends State<StudentMadingComposerSheet> {
  final formKey = GlobalKey<FormState>();
  final titleController = TextEditingController();
  final contentController = TextEditingController();
  String category = 'Artikel Siswa';
  String visibility = 'GLOBAL';
  String? imagePath;
  String? imageName;
  bool loading = false;
  String? error;

  @override
  void dispose() {
    titleController.dispose();
    contentController.dispose();
    super.dispose();
  }

  Future<void> pickImage() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp'],
      allowMultiple: false,
    );
    final file = result?.files.singleOrNull;
    if (!mounted || file?.path == null) return;
    if (file!.size > 5 * 1024 * 1024) {
      setState(() => error = 'Ukuran gambar maksimal 5 MB.');
      return;
    }
    setState(() {
      imagePath = file.path;
      imageName = file.name;
      error = null;
    });
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate() || loading) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final message = await widget.onSubmit(
        StudentMadingDraft(
          title: titleController.text.trim(),
          category: category,
          content: contentController.text.trim(),
          visibility: visibility,
          imagePath: imagePath,
          imageName: imageName,
        ),
      );
      if (mounted) Navigator.pop(context, message);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } catch (_) {
      if (mounted) setState(() => error = 'Konten mading belum dapat dikirim.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedPadding(
    duration: const Duration(milliseconds: 180),
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: Container(
      key: const Key('student-mading-composer'),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * .92,
      ),
      padding: const EdgeInsets.fromLTRB(22, 12, 22, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: SingleChildScrollView(
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 18),
                  decoration: BoxDecoration(
                    color: const Color(0xFFD7E8D9),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const Text(
                'Buat Konten Mading',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 5),
              const Text(
                'Bagikan pengumuman, artikel, atau kegiatan sekolah.',
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 20),
              DropdownButtonFormField<String>(
                key: const Key('student-mading-category'),
                initialValue: category,
                decoration: const InputDecoration(
                  labelText: 'Kategori',
                  prefixIcon: Icon(Icons.category_outlined),
                ),
                items: const [
                  DropdownMenuItem(
                    value: 'Artikel Siswa',
                    child: Text('Artikel Siswa'),
                  ),
                  DropdownMenuItem(
                    value: 'Pengumuman',
                    child: Text('Pengumuman'),
                  ),
                  DropdownMenuItem(value: 'Event', child: Text('Event')),
                ],
                onChanged: (value) =>
                    setState(() => category = value ?? category),
              ),
              const SizedBox(height: 13),
              TextFormField(
                key: const Key('student-mading-title'),
                controller: titleController,
                decoration: const InputDecoration(
                  labelText: 'Judul',
                  prefixIcon: Icon(Icons.title_rounded),
                ),
                validator: (value) => (value?.trim().length ?? 0) < 3
                    ? 'Judul minimal 3 karakter.'
                    : null,
              ),
              const SizedBox(height: 13),
              TextFormField(
                key: const Key('student-mading-content'),
                controller: contentController,
                minLines: 4,
                maxLines: 7,
                decoration: const InputDecoration(
                  labelText: 'Isi konten',
                  alignLabelWithHint: true,
                  prefixIcon: Padding(
                    padding: EdgeInsets.only(bottom: 72),
                    child: Icon(Icons.notes_rounded),
                  ),
                ),
                validator: (value) => (value?.trim().length ?? 0) < 20
                    ? 'Isi konten minimal 20 karakter.'
                    : null,
              ),
              const SizedBox(height: 13),
              OutlinedButton.icon(
                key: const Key('student-mading-image'),
                onPressed: loading ? null : pickImage,
                icon: const Icon(Icons.add_photo_alternate_outlined),
                label: Text(imageName ?? 'Tambahkan gambar (opsional)'),
              ),
              const SizedBox(height: 13),
              DropdownButtonFormField<String>(
                key: const Key('student-mading-visibility'),
                initialValue: visibility,
                decoration: const InputDecoration(
                  labelText: 'Tampilkan untuk',
                  prefixIcon: Icon(Icons.visibility_outlined),
                ),
                items: const [
                  DropdownMenuItem(
                    value: 'GLOBAL',
                    child: Text('Publik GenPro'),
                  ),
                  DropdownMenuItem(value: 'CLASS', child: Text('Kelas saya')),
                  DropdownMenuItem(
                    value: 'SCHOOL',
                    child: Text('Seluruh sekolah'),
                  ),
                ],
                onChanged: (value) =>
                    setState(() => visibility = value ?? visibility),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(
                  error!,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton.icon(
                key: const Key('student-mading-submit'),
                onPressed: loading ? null : submit,
                icon: loading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_rounded),
                label: Text(loading ? 'Mengirim...' : 'Kirim Konten'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _MadingReportDraft {
  const _MadingReportDraft(this.reason, this.details);

  final String reason;
  final String? details;
}

class _MadingReportSheet extends StatefulWidget {
  const _MadingReportSheet();

  @override
  State<_MadingReportSheet> createState() => _MadingReportSheetState();
}

class _MadingReportSheetState extends State<_MadingReportSheet> {
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
      _MadingReportDraft(
        _reason!,
        _details.text.trim().isEmpty ? null : _details.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('student-mading-report-sheet'),
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
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Laporkan Mading',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Laporan bersifat rahasia dan akan diperiksa moderator.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
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
                          secondary: Icon(reason.$3),
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
                  key: const Key('student-mading-report-details'),
                  controller: _details,
                  minLines: 2,
                  maxLines: 4,
                  maxLength: 1000,
                  decoration: const InputDecoration(
                    hintText: 'Jelaskan masalah pada konten ini...',
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
              key: const Key('student-mading-report-submit'),
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

String _category(String value) {
  final lower = value.toLowerCase();
  if (lower.contains('event') || lower.contains('kegiatan')) return 'Event';
  if (lower.contains('artikel') || lower.contains('karya')) {
    return 'Artikel Siswa';
  }
  return 'Pengumuman';
}

bool _sameSchool({
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

Color _categoryColor(String value) => switch (_category(value)) {
  'Artikel Siswa' => const Color(0xFF8A4A20),
  'Event' => const Color(0xFFD51B7A),
  _ => const Color(0xFF0B5A26),
};

IconData _categoryIcon(String value) => switch (_category(value)) {
  'Artikel Siswa' => Icons.auto_stories_rounded,
  'Event' => Icons.event_note_rounded,
  _ => Icons.apartment_rounded,
};

String _relativeTime(DateTime value) {
  final difference = DateTime.now().difference(value);
  if (difference.inMinutes < 1) return 'baru saja';
  if (difference.inHours < 1) return '${difference.inMinutes} menit yang lalu';
  if (difference.inDays < 1) return '${difference.inHours} jam yang lalu';
  return '${difference.inDays} hari yang lalu';
}

String _mediaUrl(String value) => resolveAppMediaUrl(value);

String _initials(String name) {
  final parts = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .take(2)
      .toList();
  if (parts.isEmpty) return 'S';
  return parts.map((part) => part[0].toUpperCase()).join();
}

String _messageOf(Object error) => error is ApiException
    ? error.message
    : 'Permintaan gagal. Silakan coba kembali.';
