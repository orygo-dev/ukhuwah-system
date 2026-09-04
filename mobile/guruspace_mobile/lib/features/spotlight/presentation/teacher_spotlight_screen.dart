import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_share.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/features/auth/domain/app_user.dart';
import 'package:guruspace_mobile/features/spotlight/data/spotlight_repository.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_models.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_ads.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/spotlight_admob_slide.dart';
import 'package:video_player/video_player.dart';

class TeacherSpotlightScreen extends ConsumerStatefulWidget {
  const TeacherSpotlightScreen({
    super.key,
    required this.user,
    required this.onBack,
  });

  final AppUser user;
  final VoidCallback onBack;

  @override
  ConsumerState<TeacherSpotlightScreen> createState() =>
      _TeacherSpotlightScreenState();
}

class _TeacherSpotlightScreenState
    extends ConsumerState<TeacherSpotlightScreen> {
  final _pageController = PageController();
  final _viewed = <String>{};
  final _deletedIds = <String>{};
  bool _deleting = false;
  List<SpotlightPost> _posts = const [];
  String? _nextCursor;
  int _activeIndex = 0;
  bool _loading = true;
  bool _loadingMore = false;
  bool _showSwipeHint = true;
  SpotlightAdsConfig _adsConfig = SpotlightAdsConfig.disabled;
  bool _adsSuppressed = false;
  String? _error;
  Timer? _swipeHintTimer;

  SpotlightRepository get _repository => ref.read(spotlightRepositoryProvider);

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_loadInitial);
    Future<void>.microtask(_loadAdsConfig);
    _swipeHintTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) setState(() => _showSwipeHint = false);
    });
  }

  Future<void> _loadAdsConfig() async {
    try {
      final config = await _repository.getAdsConfig();
      if (!mounted) return;
      final oldEntries = _feedEntries;
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
          final newIndex = _feedEntries.indexWhere(
            (entry) => entry.post?.id == visiblePostId,
          );
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

  List<SpotlightFeedEntry<SpotlightPost>> get _feedEntries =>
      buildSpotlightFeedEntries(
        _posts,
        idOf: (post) => post.id,
        config: _adsSuppressed ? SpotlightAdsConfig.disabled : _adsConfig,
      );

  @override
  void dispose() {
    _swipeHintTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final page = await _repository.getFeed();
      if (!mounted) return;
      setState(() {
        _posts = page.posts
            .where((post) => !_deletedIds.contains(post.id))
            .toList();
        _nextCursor = page.nextCursor;
        _activeIndex = 0;
      });
      if (_posts.isNotEmpty) {
        _trackView(_posts.first.id);
      }
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    final cursor = _nextCursor;
    if (cursor == null || _loadingMore) return;
    setState(() => _loadingMore = true);
    try {
      final page = await _repository.getFeed(cursor: cursor);
      if (!mounted) return;
      setState(() {
        final existing = _posts.map((post) => post.id).toSet();
        _posts = [
          ..._posts,
          ...page.posts.where(
            (post) => !_deletedIds.contains(post.id) && existing.add(post.id),
          ),
        ];
        _nextCursor = page.nextCursor;
      });
    } catch (error) {
      if (mounted) _toast(_message(error));
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _trackView(String postId) async {
    if (!_viewed.add(postId)) return;
    try {
      final count = await _repository.trackView(postId);
      if (!mounted) return;
      setState(() {
        _posts = _posts
            .map(
              (post) =>
                  post.id == postId ? post.copyWith(viewCount: count) : post,
            )
            .toList();
      });
    } catch (_) {
      // Tayangan tidak boleh mengganggu pengalaman menonton.
    }
  }

  void _onPageChanged(int index) {
    final entries = _feedEntries;
    if (index < 0 || index >= entries.length) return;
    setState(() {
      _activeIndex = index;
      _showSwipeHint = false;
    });
    final post = entries[index].post;
    if (post != null) _trackView(post.id);
    if (index >= entries.length - 2) _loadMore();
  }

  Future<void> _openCreate() async {
    final post = await showModalBottomSheet<SpotlightPost>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreateSpotlightSheet(repository: _repository),
    );
    if (post == null || !mounted) return;
    setState(() {
      _posts = [post, ..._posts];
      _activeIndex = 0;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _pageController.hasClients) _pageController.jumpToPage(0);
    });
    _trackView(post.id);
    _toast('Zona Kreasi berhasil dipublikasikan.');
  }

  Future<void> _delete(SpotlightPost post) async {
    if (_deleting) return;
    setState(() => _deleting = true);
    try {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Hapus Zona Kreasi?'),
          content: const Text('Video ini akan dihapus dari feed Zona Kreasi.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Batal'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Hapus'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
      await _repository.delete(post.id);
      if (!mounted) return;
      setState(() {
        _deletedIds.add(post.id);
        _posts = _posts.where((item) => item.id != post.id).toList();
        _activeIndex = _posts.isEmpty
            ? 0
            : _activeIndex.clamp(0, _posts.length - 1);
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _pageController.hasClients) {
          _pageController.jumpToPage(_activeIndex);
        }
      });
      _toast('Zona Kreasi dihapus.');
    } catch (error) {
      if (mounted) _toast(_message(error));
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xE6212121),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: Colors.black,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: ColoredBox(
        color: Colors.black,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(child: _buildContent()),
            Positioned(
              top: 0,
              left: 0,
              child: SpotlightTopBar(
                onBack: widget.onBack,
                onCreate: _openCreate,
              ),
            ),
            if (_posts.length > 1 && _showSwipeHint && !_loading)
              Positioned(
                top: MediaQuery.paddingOf(context).top + 82,
                right: 18,
                child: const _SwipeHint(),
              ),
            if (_loadingMore)
              const Positioned(
                top: 70,
                left: 0,
                right: 0,
                child: Center(
                  child: SizedBox.square(
                    dimension: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }
    if (_error != null) {
      return _SpotlightMessage(
        icon: Icons.cloud_off_rounded,
        title: 'Zona Kreasi belum dapat dimuat',
        description: _error!,
        actionLabel: 'Coba Lagi',
        onAction: _loadInitial,
      );
    }
    if (_posts.isEmpty) {
      return SpotlightEmptyState(
        onCreate: _openCreate,
        onRefresh: _loadInitial,
      );
    }
    final entries = _feedEntries;
    return PageView.builder(
      key: const Key('spotlight-reel-page-view'),
      controller: _pageController,
      scrollDirection: Axis.vertical,
      physics: const PageScrollPhysics(),
      itemCount: entries.length,
      onPageChanged: _onPageChanged,
      itemBuilder: (context, index) {
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
        final post = entry.post!;
        return SpotlightReelSlide(
          key: ValueKey(post.id),
          post: post,
          repository: _repository,
          isActive: !_deleting && index == _activeIndex,
          shouldLoad: (index - _activeIndex).abs() <= 1,
          isAuthor: post.author.id == widget.user.id,
          onDelete: () => _delete(post),
          onCommentCountChanged: (count) {
            if (!mounted) return;
            setState(() {
              final current = _posts.indexWhere((item) => item.id == post.id);
              if (current >= 0) {
                _posts[current] = _posts[current].copyWith(commentCount: count);
              }
            });
          },
        );
      },
    );
  }
}

class SpotlightTopBar extends StatelessWidget {
  const SpotlightTopBar({
    super.key,
    required this.onBack,
    required this.onCreate,
  });

  final VoidCallback onBack;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _SpotlightHeaderButton(
            key: const Key('spotlight-back'),
            onPressed: onBack,
            tooltip: 'Kembali ke beranda',
            icon: Icons.arrow_back_rounded,
          ),
          const SizedBox(width: 12),
          _SpotlightHeaderButton(
            key: const Key('spotlight-create'),
            onPressed: onCreate,
            tooltip: 'Buat Zona Kreasi',
            icon: Icons.add_rounded,
          ),
        ],
      ),
    ),
  );
}

class _SpotlightHeaderButton extends StatelessWidget {
  const _SpotlightHeaderButton({
    super.key,
    required this.icon,
    required this.onPressed,
    required this.tooltip,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: tooltip,
    child: Material(
      color: const Color(0x66000000),
      shape: CircleBorder(side: BorderSide(color: Colors.white.withAlpha(42))),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onPressed,
        child: SizedBox.square(
          dimension: 44,
          child: Icon(icon, color: Colors.white, size: 24),
        ),
      ),
    ),
  );
}

class _SwipeHint extends StatelessWidget {
  const _SwipeHint();

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: 1),
    duration: const Duration(milliseconds: 520),
    curve: Curves.easeOutCubic,
    builder: (_, value, child) => Opacity(
      opacity: value,
      child: Transform.translate(
        offset: Offset(0, 8 * (1 - value)),
        child: child,
      ),
    ),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0x78000000),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white24),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.keyboard_double_arrow_up_rounded,
            color: Colors.white,
            size: 18,
          ),
          SizedBox(width: 5),
          Text(
            'Geser untuk berikutnya',
            style: TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    ),
  );
}

class SpotlightReelSlide extends StatefulWidget {
  const SpotlightReelSlide({
    super.key,
    required this.post,
    required this.repository,
    required this.isActive,
    required this.shouldLoad,
    required this.isAuthor,
    required this.onDelete,
    required this.onCommentCountChanged,
    this.initializeVideo = true,
    this.mediaPlaceholder,
    this.engagementEnabled = true,
    this.likeEnabled,
    this.onToggleLike,
    this.onReport,
    this.onAuthorTap,
    this.shareKind = SpotlightKind.teacher,
  });

  final SpotlightPost post;
  final SpotlightRepository repository;
  final bool isActive;
  final bool shouldLoad;
  final bool isAuthor;
  final VoidCallback onDelete;
  final ValueChanged<int> onCommentCountChanged;
  final bool initializeVideo;
  final Widget? mediaPlaceholder;
  final bool engagementEnabled;
  final bool? likeEnabled;
  final Future<({bool liked, int count})> Function()? onToggleLike;
  final VoidCallback? onReport;
  final VoidCallback? onAuthorTap;
  final SpotlightKind shareKind;

  @override
  State<SpotlightReelSlide> createState() => _SpotlightReelSlideState();
}

class _SpotlightReelSlideState extends State<SpotlightReelSlide>
    with SingleTickerProviderStateMixin {
  VideoPlayerController? _controller;
  bool _videoError = false;
  bool _muted = true;
  bool _liked = false;
  bool _liking = false;
  int _likeCount = 0;
  int _commentCount = 0;
  bool _captionExpanded = false;
  bool _heartBurst = false;
  bool _commentsOpen = false;
  bool _sharing = false;
  bool _showPlaybackFeedback = false;
  int _controllerGeneration = 0;
  Timer? _playbackFeedbackTimer;

  @override
  void initState() {
    super.initState();
    _liked = widget.post.likedByMe;
    _likeCount = widget.post.likeCount;
    _commentCount = widget.post.commentCount;
    if (widget.shouldLoad && widget.initializeVideo && _isVideo) {
      _initializeVideo();
    }
  }

  bool get _isVideo => !widget.post.isImageMedia;

  @override
  void didUpdateWidget(covariant SpotlightReelSlide oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.shouldLoad &&
        widget.shouldLoad &&
        widget.initializeVideo &&
        _isVideo) {
      _initializeVideo();
    }
    if (oldWidget.shouldLoad && !widget.shouldLoad) _disposeController();
    if (oldWidget.isActive != widget.isActive) _syncPlayback();
    if (oldWidget.post.likeCount != widget.post.likeCount) {
      _likeCount = widget.post.likeCount;
      _liked = widget.post.likedByMe;
    }
    if (oldWidget.post.commentCount != widget.post.commentCount) {
      _commentCount = widget.post.commentCount;
    }
  }

  Future<void> _initializeVideo() async {
    if (_controller != null ||
        widget.post.videoUrl.trim().isEmpty ||
        !_isVideo) {
      return;
    }
    final generation = ++_controllerGeneration;
    _videoError = false;
    try {
      final controller = VideoPlayerController.networkUrl(
        _resolveUri(widget.post.videoUrl),
      );
      _controller = controller;
      await controller.initialize();
      if (!mounted ||
          generation != _controllerGeneration ||
          _controller != controller) {
        return;
      }
      await controller.setLooping(true);
      if (!mounted ||
          generation != _controllerGeneration ||
          _controller != controller) {
        return;
      }
      await controller.setVolume(_muted ? 0 : 1);
      if (!mounted ||
          generation != _controllerGeneration ||
          _controller != controller) {
        // The lifecycle owner already disposed this controller.
        return;
      }
      setState(() {});
      _syncPlayback();
    } catch (_) {
      if (mounted && generation == _controllerGeneration) {
        setState(() => _videoError = true);
        await _disposeController();
      }
    }
  }

  void _syncPlayback() {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (widget.isActive && !_commentsOpen && !_sharing && !_videoError) {
      controller.play();
    } else {
      controller.pause();
    }
  }

  Future<void> _disposeController() async {
    _controllerGeneration++;
    final controller = _controller;
    _controller = null;
    if (controller != null) await controller.dispose();
  }

  @override
  void dispose() {
    _playbackFeedbackTimer?.cancel();
    _disposeController();
    super.dispose();
  }

  Future<void> _toggleLike({bool burst = false}) async {
    if (_liking || (burst && _liked)) return;
    final previousLiked = _liked;
    final previousCount = _likeCount;
    setState(() {
      _liking = true;
      _liked = !_liked;
      _likeCount += _liked ? 1 : -1;
      if (burst) {
        _heartBurst = true;
      }
    });
    if (burst) {
      Future<void>.delayed(const Duration(milliseconds: 720), () {
        if (mounted) {
          setState(() => _heartBurst = false);
        }
      });
    }
    try {
      final result = widget.onToggleLike == null
          ? await widget.repository.toggleLike(widget.post.id)
          : await widget.onToggleLike!();
      if (mounted) {
        setState(() {
          _liked = result.liked;
          _likeCount = result.count;
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _liked = previousLiked;
        _likeCount = previousCount;
      });
      _showToast(_message(error));
    } finally {
      if (mounted) setState(() => _liking = false);
    }
  }

  void _togglePlayback() {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    setState(() {
      controller.value.isPlaying ? controller.pause() : controller.play();
      _showPlaybackFeedback = true;
    });
    _playbackFeedbackTimer?.cancel();
    _playbackFeedbackTimer = Timer(const Duration(milliseconds: 650), () {
      if (mounted) setState(() => _showPlaybackFeedback = false);
    });
  }

  Future<void> _toggleMute() async {
    setState(() => _muted = !_muted);
    await _controller?.setVolume(_muted ? 0 : 1);
  }

  Future<void> _share() async {
    if (_sharing) return;
    setState(() => _sharing = true);
    _syncPlayback();
    try {
      final box = context.findRenderObject() as RenderBox?;
      await SharePlus.instance.share(
        ShareParams(
          // Share the link only: captions of restricted content must not leak.
          text: spotlightShareUrl(widget.shareKind, widget.post.id),
          title: 'Bagikan Zona Kreasi',
          sharePositionOrigin: box == null
              ? null
              : box.localToGlobal(Offset.zero) & box.size,
        ),
      );
    } catch (_) {
      if (mounted) {
        _showToast(
          'Tidak dapat membuka menu Bagikan. Gunakan Salin tautan pada menu opsi.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _sharing = false);
        _syncPlayback();
      }
    }
  }

  Future<void> _copyLink() async {
    try {
      await Clipboard.setData(
        ClipboardData(
          text: spotlightShareUrl(widget.shareKind, widget.post.id),
        ),
      );
      if (mounted) _showToast('Tautan Zona Kreasi disalin.');
    } catch (_) {
      if (mounted) _showToast('Tautan belum berhasil disalin.');
    }
  }

  Future<void> _openComments() async {
    setState(() => _commentsOpen = true);
    _syncPlayback();
    final count = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SpotlightCommentsSheet(
        post: widget.post,
        repository: widget.repository,
      ),
    );
    if (!mounted) return;
    setState(() {
      _commentsOpen = false;
      if (count != null) _commentCount = count;
    });
    if (count != null) widget.onCommentCountChanged(count);
    _syncPlayback();
  }

  void _showToast(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xE6212121),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final isVideo = _isVideo;
    final canLike = widget.likeEnabled ?? widget.engagementEnabled;
    return ColoredBox(
      color: Colors.black,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: isVideo ? _togglePlayback : null,
        onDoubleTap: canLike ? () => _toggleLike(burst: true) : null,
        child: Stack(
          fit: StackFit.expand,
          children: [
            _buildMedia(controller),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: [0, .48, 1],
                  colors: [
                    Color(0x52000000),
                    Colors.transparent,
                    Color(0xD9000000),
                  ],
                ),
              ),
            ),
            if (_heartBurst)
              Center(
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: .45, end: 1),
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.elasticOut,
                  builder: (_, scale, child) =>
                      Transform.scale(scale: scale, child: child),
                  child: const Icon(
                    Icons.favorite_rounded,
                    size: 104,
                    color: Color(0xFFF43F5E),
                    shadows: [Shadow(blurRadius: 28, color: Colors.black54)],
                  ),
                ),
              ),
            if (isVideo && _showPlaybackFeedback && controller != null)
              Center(
                child: AnimatedOpacity(
                  opacity: _showPlaybackFeedback ? 1 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: const BoxDecoration(
                      color: Color(0x8A000000),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      controller.value.isPlaying
                          ? Icons.play_arrow_rounded
                          : Icons.pause_rounded,
                      color: Colors.white,
                      size: 38,
                    ),
                  ),
                ),
              ),
            Positioned(
              top: MediaQuery.paddingOf(context).top + 12,
              right: 12,
              child: PopupMenuButton<String>(
                key: const Key('spotlight-more-actions'),
                tooltip: 'Opsi Zona Kreasi',
                color: Colors.white,
                position: PopupMenuPosition.under,
                onSelected: (value) {
                  if (value == 'report') widget.onReport?.call();
                  if (value == 'delete' && widget.isAuthor) widget.onDelete();
                  if (value == 'copy') _copyLink();
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(
                    value: 'copy',
                    child: Text('Salin tautan'),
                  ),
                  if (widget.isAuthor)
                    const PopupMenuItem(
                      value: 'delete',
                      child: Text(
                        'Hapus konten',
                        style: TextStyle(color: Color(0xFFDC2626)),
                      ),
                    ),
                  if (widget.onReport != null)
                    const PopupMenuItem(
                      value: 'report',
                      child: Row(
                        children: [
                          Icon(Icons.flag_outlined, color: Color(0xFFDC2626)),
                          SizedBox(width: 10),
                          Text('Laporkan konten'),
                        ],
                      ),
                    ),
                ],
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0x66000000),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white24),
                  ),
                  child: const Icon(
                    Icons.more_horiz_rounded,
                    color: Colors.white,
                    size: 23,
                  ),
                ),
              ),
            ),
            if (isVideo)
              Positioned(
                top: MediaQuery.paddingOf(context).top + 60,
                right: 16,
                child: _CompactReelButton(
                  icon: _muted
                      ? Icons.volume_off_rounded
                      : Icons.volume_up_rounded,
                  tooltip: _muted ? 'Aktifkan suara' : 'Matikan suara',
                  onTap: _toggleMute,
                ),
              ),
            Positioned(
              right: 13,
              bottom: 112,
              child: Column(
                children: [
                  if (canLike)
                    _ReelAction(
                      key: const Key('spotlight-like'),
                      icon: _liked
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      label: '$_likeCount',
                      selected: _liked,
                      onTap: () => _toggleLike(),
                    ),
                  if (widget.engagementEnabled)
                    _ReelAction(
                      key: const Key('spotlight-comments'),
                      icon: Icons.chat_bubble_outline_rounded,
                      label: '$_commentCount',
                      onTap: _openComments,
                    ),
                  _ReelAction(
                    icon: Icons.near_me_outlined,
                    label: 'Bagikan',
                    onTap: _share,
                  ),
                  _ReelAction(
                    icon: Icons.visibility_outlined,
                    label: '${_formatCount(widget.post.viewCount)}\ntayangan',
                    onTap: () {},
                  ),
                ],
              ),
            ),
            Positioned(
              left: 16,
              right: 82,
              bottom: 54,
              child: _ReelCaption(
                post: widget.post,
                expanded: _captionExpanded,
                onAuthorTap: widget.onAuthorTap,
                onToggle: () =>
                    setState(() => _captionExpanded = !_captionExpanded),
              ),
            ),
            if (isVideo)
              Positioned(
                left: 16,
                right: 16,
                bottom: 14,
                child: _SpotlightPlaybackBar(
                  key: const Key('spotlight-progress'),
                  controller: controller,
                  isPlaying: controller?.value.isPlaying ?? widget.isActive,
                  onToggle: _togglePlayback,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMedia(VideoPlayerController? controller) {
    if (widget.mediaPlaceholder != null) {
      return widget.mediaPlaceholder!;
    }
    if (_videoError) {
      return const _SpotlightMessage(
        icon: Icons.videocam_off_outlined,
        title: 'Video tidak dapat diputar',
        description: 'Pastikan URL video MP4 atau WebM dapat diakses.',
      );
    }
    if (controller != null && controller.value.isInitialized) {
      final size = controller.value.size;
      return ClipRect(
        child: FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: size.width,
            height: size.height,
            child: VideoPlayer(controller),
          ),
        ),
      );
    }
    final thumbnail = widget.post.thumbnailUrl;
    if (thumbnail != null && thumbnail.isNotEmpty) {
      return Image.network(
        _resolveUri(thumbnail).toString(),
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const ColoredBox(color: Color(0xFF18181B)),
      );
    }
    return const ColoredBox(
      color: Color(0xFF18181B),
      child: Center(
        child: Icon(
          Icons.play_circle_fill_rounded,
          color: Colors.white38,
          size: 72,
        ),
      ),
    );
  }
}

class _CompactReelButton extends StatelessWidget {
  const _CompactReelButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0x78000000),
    shape: const CircleBorder(side: BorderSide(color: Colors.white24)),
    child: IconButton(
      visualDensity: VisualDensity.compact,
      tooltip: tooltip,
      onPressed: onTap,
      icon: Icon(icon, color: Colors.white, size: 20),
    ),
  );
}

class _SpotlightPlaybackBar extends StatelessWidget {
  const _SpotlightPlaybackBar({
    super.key,
    required this.controller,
    required this.isPlaying,
    required this.onToggle,
  });

  final VideoPlayerController? controller;
  final bool isPlaying;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final progress = controller == null
        ? const LinearProgressIndicator(
            value: .38,
            minHeight: 3,
            color: Color(0xFF38BDF8),
            backgroundColor: Colors.white24,
            borderRadius: BorderRadius.all(Radius.circular(99)),
          )
        : VideoProgressIndicator(
            controller!,
            allowScrubbing: true,
            padding: EdgeInsets.zero,
            colors: const VideoProgressColors(
              playedColor: Color(0xFF38BDF8),
              bufferedColor: Colors.white38,
              backgroundColor: Colors.white24,
            ),
          );
    return Row(
      children: [
        InkResponse(
          onTap: onToggle,
          radius: 20,
          child: Padding(
            padding: const EdgeInsets.only(right: 10),
            child: Icon(
              isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
              color: Colors.white,
              size: 25,
            ),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: progress,
          ),
        ),
      ],
    );
  }
}

class _ReelAction extends StatelessWidget {
  const _ReelAction({
    super.key,
    required this.icon,
    required this.onTap,
    this.label,
    this.selected = false,
  });

  final IconData icon;
  final String? label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 13),
    child: InkResponse(
      onTap: onTap,
      radius: 30,
      child: Column(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOutBack,
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: selected
                  ? const Color(0xFFF43F5E)
                  : const Color(0x82000000),
              shape: BoxShape.circle,
              border: Border.all(
                color: selected ? const Color(0xFFFFA3B2) : Colors.white30,
              ),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black38,
                  blurRadius: 18,
                  offset: Offset(0, 5),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 25),
          ),
          if (label != null) ...[
            const SizedBox(height: 4),
            Text(
              label!,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10.5,
                height: 1.15,
                fontWeight: FontWeight.w800,
                shadows: [Shadow(blurRadius: 8, color: Colors.black)],
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    ),
  );
}

class _ReelCaption extends StatelessWidget {
  const _ReelCaption({
    required this.post,
    required this.expanded,
    required this.onToggle,
    this.onAuthorTap,
  });

  final SpotlightPost post;
  final bool expanded;
  final VoidCallback onToggle;
  final VoidCallback? onAuthorTap;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      GestureDetector(
        key: const Key('spotlight-author-action'),
        behavior: HitTestBehavior.opaque,
        onTap: onAuthorTap,
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(2),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [Color(0xFF38BDF8), Color(0xFF2563EB)],
                ),
              ),
              child: _Avatar(author: post.author, size: 40),
            ),
            const SizedBox(width: 11),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          post.author.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -.15,
                            shadows: [
                              Shadow(blurRadius: 8, color: Colors.black),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 5),
                      const Icon(
                        Icons.verified_rounded,
                        color: Color(0xFF38BDF8),
                        size: 17,
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    post.author.schoolName?.trim().isNotEmpty == true
                        ? post.author.schoolName!.trim()
                        : _relativeTime(post.createdAt),
                    key: const Key('spotlight-author-school'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFFBAE6FD),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      shadows: [Shadow(blurRadius: 6, color: Colors.black)],
                    ),
                  ),
                  if (post.author.schoolName?.trim().isNotEmpty == true)
                    Text(
                      _relativeTime(post.createdAt),
                      style: const TextStyle(
                        color: Colors.white60,
                        fontSize: 10,
                        shadows: [Shadow(blurRadius: 6, color: Colors.black)],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 11),
      Text(
        post.caption,
        maxLines: expanded ? null : 3,
        overflow: expanded ? null : TextOverflow.ellipsis,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 15,
          height: 1.38,
          fontWeight: FontWeight.w600,
          shadows: [Shadow(blurRadius: 8, color: Colors.black)],
        ),
      ),
      if (post.caption.length > 80)
        GestureDetector(
          onTap: onToggle,
          child: Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 2),
            child: Text(
              expanded ? 'Sembunyikan' : 'Selengkapnya',
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
    ],
  );
}

class _SpotlightCommentsSheet extends StatefulWidget {
  const _SpotlightCommentsSheet({required this.post, required this.repository});

  final SpotlightPost post;
  final SpotlightRepository repository;

  @override
  State<_SpotlightCommentsSheet> createState() =>
      _SpotlightCommentsSheetState();
}

class _SpotlightCommentsSheetState extends State<_SpotlightCommentsSheet> {
  final _controller = TextEditingController();
  List<SpotlightComment> _comments = const [];
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final comments = await widget.repository.getComments(widget.post.id);
      if (mounted) setState(() => _comments = comments);
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final result = await widget.repository.addComment(widget.post.id, text);
      if (!mounted) return;
      _controller.clear();
      setState(() => _comments = [..._comments, result.comment]);
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: Container(
      height: MediaQuery.sizeOf(context).height * .72,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 9),
          Container(
            width: 42,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFD4D4D8),
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 8, 10),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'Komentar',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context, _comments.length),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(child: _buildComments()),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Text(
                _error!,
                style: const TextStyle(color: Colors.red, fontSize: 12),
              ),
            ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 9, 10, 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      maxLength: 1000,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: 'Tulis komentar...',
                        filled: true,
                        fillColor: const Color(0xFFF4F4F5),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  IconButton.filled(
                    onPressed: _sending ? null : _send,
                    icon: _sending
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
          ),
        ],
      ),
    ),
  );

  Widget _buildComments() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_comments.isEmpty) {
      return const Center(
        child: Text(
          'Belum ada komentar. Jadilah yang pertama!',
          style: TextStyle(color: Color(0xFF71717A)),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _comments.length,
      separatorBuilder: (_, _) => const SizedBox(height: 16),
      itemBuilder: (_, index) {
        final comment = _comments[index];
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Avatar(author: comment.user, size: 34, darkText: true),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(
                        color: Color(0xFF18181B),
                        fontSize: 13,
                      ),
                      children: [
                        TextSpan(
                          text: comment.user.name,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        TextSpan(
                          text: '  ${_relativeTime(comment.createdAt)}',
                          style: const TextStyle(
                            color: Color(0xFF71717A),
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(comment.content),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _CreateSpotlightSheet extends StatefulWidget {
  const _CreateSpotlightSheet({required this.repository});

  final SpotlightRepository repository;

  @override
  State<_CreateSpotlightSheet> createState() => _CreateSpotlightSheetState();
}

class _CreateSpotlightSheetState extends State<_CreateSpotlightSheet> {
  final _caption = TextEditingController();
  PlatformFile? _video;
  bool _sending = false;
  double _uploadProgress = 0;
  String? _error;

  @override
  void dispose() {
    _caption.dispose();
    super.dispose();
  }

  Future<void> _pickVideo() async {
    setState(() => _error = null);
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.video,
        allowMultiple: false,
        withData: false,
      );
      if (!mounted || result == null || result.files.isEmpty) return;
      final file = result.files.single;
      if (file.path == null || file.path!.isEmpty) {
        setState(
          () => _error = 'File video tidak dapat dibaca dari perangkat.',
        );
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setState(() => _error = 'Ukuran video maksimal 100 MB.');
        return;
      }
      setState(() => _video = file);
    } catch (_) {
      if (mounted) setState(() => _error = 'Galeri video tidak dapat dibuka.');
    }
  }

  Future<void> _submit() async {
    final video = _video;
    if (_caption.text.trim().isEmpty || video?.path == null) {
      setState(() => _error = 'Caption dan file video wajib dipilih.');
      return;
    }
    setState(() {
      _sending = true;
      _uploadProgress = 0;
      _error = null;
    });
    try {
      final videoUrl = await widget.repository.uploadVideo(
        filePath: video!.path!,
        fileName: video.name,
        onProgress: (sent, total) {
          if (!mounted || total <= 0) return;
          setState(() => _uploadProgress = sent / total);
        },
      );
      final post = await widget.repository.create(
        caption: _caption.text.trim(),
        videoUrl: videoUrl,
      );
      if (mounted) Navigator.pop(context, post);
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD4D4D8),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Buat Zona Kreasi',
                style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 5),
              const Text(
                'Bagikan video pendek praktik baik dan inspirasi pembelajaran.',
                style: TextStyle(color: Color(0xFF71717A), height: 1.4),
              ),
              const SizedBox(height: 18),
              TextField(
                controller: _caption,
                maxLength: 2000,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Caption',
                  hintText: 'Ceritakan isi video Anda...',
                ),
              ),
              const SizedBox(height: 10),
              InkWell(
                key: const Key('spotlight-pick-video'),
                onTap: _sending ? null : _pickVideo,
                borderRadius: BorderRadius.circular(18),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _video == null
                        ? const Color(0xFFF8FAFC)
                        : const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: _video == null
                          ? const Color(0xFFCBD5E1)
                          : const Color(0xFF60A5FA),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: _video == null
                              ? Colors.white
                              : const Color(0xFF2563EB),
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: Icon(
                          _video == null
                              ? Icons.video_library_outlined
                              : Icons.check_rounded,
                          color: _video == null
                              ? const Color(0xFF2563EB)
                              : Colors.white,
                        ),
                      ),
                      const SizedBox(width: 13),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _video?.name ?? 'Pilih video dari perangkat',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Color(0xFF0F172A),
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              _video == null
                                  ? 'MP4, MOV, atau WebM · Maksimal 100 MB'
                                  : _formatFileSize(_video!.size),
                              style: const TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _video == null ? 'Pilih' : 'Ganti',
                        style: const TextStyle(
                          color: Color(0xFF2563EB),
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (_sending) ...[
                const SizedBox(height: 14),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    minHeight: 7,
                    value: _uploadProgress > 0 ? _uploadProgress : null,
                    color: const Color(0xFF2563EB),
                    backgroundColor: const Color(0xFFDBEAFE),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _uploadProgress > 0
                      ? 'Mengunggah ${(_uploadProgress * 100).round()}%'
                      : 'Menyiapkan unggahan...',
                  style: const TextStyle(
                    color: Color(0xFF2563EB),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _sending ? null : _submit,
                  icon: _sending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.publish_rounded),
                  label: Text(
                    _sending
                        ? 'Mengunggah video...'
                        : 'Publikasikan Zona Kreasi',
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

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.author,
    required this.size,
    this.darkText = false,
  });

  final SpotlightAuthor author;
  final double size;
  final bool darkText;

  @override
  Widget build(BuildContext context) {
    final url = author.avatarUrl;
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(0xFF2563EB),
        border: darkText ? null : Border.all(color: Colors.white54, width: 1.5),
      ),
      child: url != null && url.isNotEmpty
          ? Image.network(
              resolveAppMediaUrl(url),
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => _initials(),
            )
          : _initials(),
    );
  }

  Widget _initials() => Center(
    child: Text(
      _initialsOf(author.name),
      style: TextStyle(
        color: darkText ? Colors.white : Colors.white,
        fontSize: size * .3,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

class _SpotlightMessage extends StatelessWidget {
  const _SpotlightMessage({
    required this.icon,
    required this.title,
    required this.description,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String description;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 34),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white54, size: 52),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 19,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white60, height: 1.45),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 20),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    ),
  );
}

class SpotlightEmptyState extends StatelessWidget {
  const SpotlightEmptyState({
    super.key,
    required this.onCreate,
    required this.onRefresh,
  });

  final VoidCallback onCreate;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF091329), Color(0xFF102A43), Color(0xFF061A1B)],
        stops: [0, .54, 1],
      ),
    ),
    child: Stack(
      children: [
        Positioned(
          top: 92,
          right: -74,
          child: Container(
            width: 210,
            height: 210,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [Color(0x5522D3EE), Color(0x00102843)],
              ),
            ),
          ),
        ),
        Positioned(
          bottom: 34,
          left: -88,
          child: Container(
            width: 240,
            height: 240,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [Color(0x443B82F6), Color(0x00091329)],
              ),
            ),
          ),
        ),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(26, 82, 26, 34),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 218,
                    height: 238,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 184,
                          height: 224,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFF2563EB), Color(0xFF0891B2)],
                            ),
                            borderRadius: BorderRadius.circular(34),
                            border: Border.all(color: Colors.white24),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x552563EB),
                                blurRadius: 42,
                                offset: Offset(0, 18),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              Padding(
                                padding: const EdgeInsets.fromLTRB(
                                  17,
                                  15,
                                  17,
                                  0,
                                ),
                                child: Row(
                                  children: [
                                    ...List.generate(
                                      3,
                                      (index) => Container(
                                        width: 5,
                                        height: 5,
                                        margin: const EdgeInsets.only(right: 5),
                                        decoration: BoxDecoration(
                                          color: Colors.white.withValues(
                                            alpha: index == 0 ? .9 : .36,
                                          ),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                    ),
                                    const Spacer(),
                                    const Icon(
                                      Icons.auto_awesome_rounded,
                                      color: Colors.white70,
                                      size: 16,
                                    ),
                                  ],
                                ),
                              ),
                              const Expanded(
                                child: Center(
                                  child: Icon(
                                    Icons.play_arrow_rounded,
                                    color: Colors.white,
                                    size: 76,
                                  ),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.fromLTRB(
                                  18,
                                  0,
                                  18,
                                  18,
                                ),
                                child: Column(
                                  children: [
                                    Container(
                                      height: 8,
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(
                                          alpha: .92,
                                        ),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Align(
                                      alignment: Alignment.centerLeft,
                                      child: Container(
                                        width: 92,
                                        height: 7,
                                        decoration: BoxDecoration(
                                          color: Colors.white.withValues(
                                            alpha: .48,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        Positioned(
                          right: 0,
                          bottom: 20,
                          child: Container(
                            width: 58,
                            height: 58,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF43F5E),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 4),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x55F43F5E),
                                  blurRadius: 20,
                                  offset: Offset(0, 8),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.add_rounded,
                              color: Colors.white,
                              size: 30,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Panggung inspirasi guru\ndimulai dari Anda',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 25,
                      height: 1.12,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -.5,
                    ),
                  ),
                  const SizedBox(height: 11),
                  const Text(
                    'Bagikan video pendek, praktik baik, dan ide mengajar yang dapat menginspirasi komunitas GuruSpace.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFFB8C7DB),
                      fontSize: 13,
                      height: 1.55,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      key: const Key('spotlight-empty-create'),
                      onPressed: onCreate,
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF0F4C81),
                        minimumSize: const Size.fromHeight(52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(17),
                        ),
                      ),
                      icon: const Icon(Icons.videocam_rounded),
                      label: const Text(
                        'Buat Zona Kreasi Pertama',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    key: const Key('spotlight-empty-refresh'),
                    onPressed: onRefresh,
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFB8C7DB),
                    ),
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Periksa feed kembali'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

Uri _resolveUri(String value) {
  final uri = Uri.parse(value.trim());
  return uri.hasScheme ? uri : Uri.parse(AppConfig.baseUrl).resolveUri(uri);
}

String _initialsOf(String name) => name
    .trim()
    .split(RegExp(r'\s+'))
    .where((word) => word.isNotEmpty)
    .take(2)
    .map((word) => word[0].toUpperCase())
    .join();

String _relativeTime(DateTime date) {
  final diff = DateTime.now().difference(date.toLocal());
  if (diff.inMinutes < 1) return 'Baru saja';
  if (diff.inMinutes < 60) return '${diff.inMinutes} menit lalu';
  if (diff.inHours < 24) return '${diff.inHours} jam lalu';
  if (diff.inDays < 7) return '${diff.inDays} hari lalu';
  return '${date.day}/${date.month}/${date.year}';
}

String _formatCount(int value) {
  final digits = value.toString();
  final result = StringBuffer();
  for (var index = 0; index < digits.length; index++) {
    if (index > 0 && (digits.length - index) % 3 == 0) result.write('.');
    result.write(digits[index]);
  }
  return result.toString();
}

String _formatFileSize(int bytes) {
  if (bytes >= 1024 * 1024) {
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
  if (bytes >= 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
  return '$bytes byte';
}

String _message(Object error) {
  final value = error.toString();
  return value.startsWith('Exception: ') ? value.substring(11) : value;
}
