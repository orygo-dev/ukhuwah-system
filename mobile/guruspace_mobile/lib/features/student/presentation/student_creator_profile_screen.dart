import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';
import 'package:guruspace_mobile/features/spotlight/data/spotlight_repository.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_models.dart';
import 'package:guruspace_mobile/features/spotlight/domain/spotlight_share.dart';
import 'package:guruspace_mobile/features/spotlight/presentation/teacher_spotlight_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_inbox_screen.dart';

const _blue = Color(0xFF007A33);
const _cyan = Color(0xFF39B54A);
const _navy = Color(0xFF0F2418);
const _canvas = Color(0xFFF5FAF6);

final _creatorNavigationLocks = Expando<bool>();
final _creatorPreviewNavigationLocks = Expando<bool>();

Future<void> openStudentCreatorProfile(
  BuildContext context,
  String? studentId,
) async {
  final id = studentId?.trim() ?? '';
  if (id.isEmpty) return;
  final navigator = Navigator.of(context);
  if (_creatorNavigationLocks[navigator] == true) return;
  _creatorNavigationLocks[navigator] = true;
  try {
    await navigator.push<void>(
      MaterialPageRoute<void>(
        builder: (_) => StudentCreatorProfileScreen(studentId: id),
      ),
    );
  } finally {
    _creatorNavigationLocks[navigator] = false;
  }
}

Future<void> _openCreatorPreview(
  BuildContext context,
  WidgetBuilder builder,
) async {
  final navigator = Navigator.of(context);
  if (_creatorPreviewNavigationLocks[navigator] == true) return;
  _creatorPreviewNavigationLocks[navigator] = true;
  try {
    await navigator.push<void>(MaterialPageRoute<void>(builder: builder));
  } finally {
    _creatorPreviewNavigationLocks[navigator] = false;
  }
}

class StudentCreatorProfileScreen extends ConsumerWidget {
  const StudentCreatorProfileScreen({super.key, required this.studentId});
  final String studentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(studentCreatorProfileProvider(studentId));
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: _canvas,
        body: value.when(
          loading: () => const SafeArea(
            child: LoadingView(label: 'Membuka profil kreator...'),
          ),
          error: (error, _) => SafeArea(
            child: ErrorView(
              message: '$error',
              onRetry: () =>
                  ref.invalidate(studentCreatorProfileProvider(studentId)),
            ),
          ),
          data: (profile) => Column(
            children: [
              _ProfileHero(profile: profile),
              _ProfileTabs(profile: profile),
              Expanded(
                child: TabBarView(
                  children: [
                    _MadingGrid(profile: profile),
                    _SpotlightGrid(profile: profile),
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

class _ProfileHero extends ConsumerStatefulWidget {
  const _ProfileHero({required this.profile});
  final StudentCreatorProfile profile;

  @override
  ConsumerState<_ProfileHero> createState() => _ProfileHeroState();
}

class _ProfileHeroState extends ConsumerState<_ProfileHero> {
  bool _busy = false;

  Future<void> _toggleFollow() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(studentSocialRepositoryProvider)
          .setFollow(
            widget.profile.id,
            following: !widget.profile.social.following,
          );
      ref.invalidate(studentCreatorProfileProvider(widget.profile.id));
      ref.read(studentSocialRefreshProvider.notifier).state++;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _message() async {
    if (_busy) return;
    final social = widget.profile.social;
    if (social.requestStatus == 'PENDING') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Permintaan pesan masih menunggu persetujuan.'),
        ),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      String? conversationId;
      if (social.canMessage) {
        conversationId = social.conversationId;
        if (conversationId?.isNotEmpty != true) {
          conversationId = await ref
              .read(studentSocialRepositoryProvider)
              .startConversation(widget.profile.id);
        }
      } else {
        final controller = TextEditingController();
        final content = await showDialog<String>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Minta izin mengirim pesan'),
            content: TextField(
              controller: controller,
              maxLength: 500,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Tulis pesan pembuka yang sopan...',
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Batal'),
              ),
              FilledButton(
                onPressed: () =>
                    Navigator.pop(dialogContext, controller.text.trim()),
                child: const Text('Kirim'),
              ),
            ],
          ),
        );
        controller.dispose();
        if (content?.isNotEmpty != true) return;
        conversationId = await ref
            .read(studentSocialRepositoryProvider)
            .requestMessage(widget.profile.id, content!);
        ref.invalidate(studentCreatorProfileProvider(widget.profile.id));
        if (conversationId?.isNotEmpty != true && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Permintaan pesan berhasil dikirim.')),
          );
        }
      }
      if (conversationId?.isNotEmpty == true && mounted) {
        await Navigator.push<void>(
          context,
          MaterialPageRoute(
            builder: (_) => StudentConversationScreen(id: conversationId!),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _block() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Blokir siswa ini?'),
        content: const Text(
          'Kalian tidak dapat saling mengikuti atau mengirim pesan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Blokir'),
          ),
        ],
      ),
    );
    if (confirmed != true || _busy) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(apiClientProvider)
          .postJson(
            '/api/mobile/v1/student/social/blocks/${Uri.encodeComponent(widget.profile.id)}',
            data: const {},
          );
      ref.invalidate(studentCreatorProfileProvider(widget.profile.id));
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.profile;
    final media = MediaQuery.of(context);
    final textScale = media.textScaler.scale(1);
    final socialEnabled = profile.social.enabled;
    final textScaleAllowance =
        ((textScale - 1).clamp(0, .5)) * (socialEnabled ? 100 : 44);
    return Container(
      key: const Key('creator-profile-hero'),
      width: double.infinity,
      // SafeArea consumes the Android status-bar inset inside this fixed visual
      // hero. Add that inset back so the statistics panel cannot overflow.
      height:
          (socialEnabled ? 455 : 326) + media.padding.top + textScaleAllowance,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(36)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF007A33), _blue, _cyan],
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x391677FF),
            blurRadius: 28,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned(
            right: -70,
            top: -60,
            child: _Orb(size: 220, color: Color(0x2639E7FF)),
          ),
          const Positioned(
            left: -90,
            bottom: -110,
            child: _Orb(size: 260, color: Color(0x24FFFFFF)),
          ),
          const Positioned(
            right: 35,
            top: 145,
            child: _Orb(size: 13, color: Color(0xB3FFFFFF)),
          ),
          SafeArea(
            bottom: false,
            child: Column(
              children: [
                SizedBox(
                  height: 52,
                  child: Row(
                    children: [
                      const SizedBox(width: 8),
                      IconButton(
                        key: const Key('creator-profile-back'),
                        onPressed: () => Navigator.maybePop(context),
                        icon: const Icon(
                          Icons.arrow_back_rounded,
                          color: Colors.white,
                        ),
                      ),
                      const Text(
                        'Profil Kreator',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
                _ProfileAvatar(profile: profile, size: 102),
                const SizedBox(height: 9),
                Text(
                  profile.name,
                  key: const Key('creator-profile-name'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 23,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Flexible(
                        child: Text(
                          profile.schoolName,
                          key: const Key('creator-profile-school'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            color: Color(0xFFE8F6EA),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      if (profile.className?.trim().isNotEmpty == true) ...[
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 7),
                          child: Text(
                            '·',
                            style: TextStyle(
                              color: Color(0xFFE8F6EA),
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        Flexible(
                          child: Text(
                            profile.className!,
                            key: const Key('creator-profile-class'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFFE8F6EA),
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (profile.social.enabled) ...[
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _CompactMetric(
                        value: profile.social.followerCount,
                        label: 'Pengikut',
                      ),
                      const _SocialDivider(),
                      _CompactMetric(
                        value: profile.social.followingCount,
                        label: 'Mengikuti',
                      ),
                      const _SocialDivider(),
                      _CompactMetric(
                        value: profile.mading.length + profile.spotlight.length,
                        label: 'Karya',
                      ),
                    ],
                  ),
                  if (!profile.social.isSelf && !profile.social.blocked) ...[
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              key: const Key('creator-follow-button'),
                              onPressed: _busy ? null : _toggleFollow,
                              style: FilledButton.styleFrom(
                                backgroundColor: profile.social.following
                                    ? Colors.white
                                    : const Color(0xFF007A33),
                                foregroundColor: profile.social.following
                                    ? const Color(0xFF007A33)
                                    : Colors.white,
                              ),
                              child: Text(
                                profile.social.following
                                    ? 'Mengikuti'
                                    : 'Ikuti',
                              ),
                            ),
                          ),
                          const SizedBox(width: 9),
                          Expanded(
                            child: OutlinedButton.icon(
                              key: const Key('creator-message-button'),
                              onPressed: _busy || !profile.social.following
                                  ? null
                                  : _message,
                              icon: const Icon(
                                Icons.chat_bubble_outline_rounded,
                                size: 17,
                              ),
                              label: Text(
                                profile.social.requestStatus == 'PENDING'
                                    ? 'Menunggu'
                                    : 'Pesan',
                              ),
                              style: OutlinedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: const Color(0xFF007A33),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filledTonal(
                            onPressed: _busy ? null : _block,
                            icon: const Icon(Icons.more_horiz_rounded),
                            tooltip: 'Opsi profil',
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
                const Spacer(),
                Container(
                  margin: const EdgeInsets.fromLTRB(32, 0, 32, 20),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0x2CFFFFFF),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0x40FFFFFF)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _Metric(
                          value: profile.mading.length,
                          label: 'Mading',
                        ),
                      ),
                      const SizedBox(
                        height: 35,
                        child: VerticalDivider(color: Color(0x61FFFFFF)),
                      ),
                      Expanded(
                        child: _Metric(
                          value: profile.spotlight.length,
                          label: 'Zona Kreasi',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CompactMetric extends StatelessWidget {
  const _CompactMetric({required this.value, required this.label});
  final int value;
  final String label;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 76,
    child: Column(
      children: [
        Text(
          '$value',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 17,
          ),
        ),
        Text(
          label,
          style: const TextStyle(color: Color(0xFFE8F6EA), fontSize: 10),
        ),
      ],
    ),
  );
}

class _SocialDivider extends StatelessWidget {
  const _SocialDivider();
  @override
  Widget build(BuildContext context) => const SizedBox(
    height: 30,
    child: VerticalDivider(color: Color(0x55FFFFFF)),
  );
}

class _ProfileTabs extends StatelessWidget {
  const _ProfileTabs({required this.profile});
  final StudentCreatorProfile profile;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.fromLTRB(14, 14, 14, 8),
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(17),
      border: Border.all(color: const Color(0xFFE3EAF4)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x10113254),
          blurRadius: 16,
          offset: Offset(0, 5),
        ),
      ],
    ),
    child: TabBar(
      dividerColor: Colors.transparent,
      indicatorSize: TabBarIndicatorSize.tab,
      indicator: BoxDecoration(
        gradient: const LinearGradient(colors: [_blue, _cyan]),
        borderRadius: BorderRadius.circular(13),
      ),
      labelColor: Colors.white,
      unselectedLabelColor: AppColors.muted,
      labelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12),
      tabs: [
        Tab(text: 'Mading (${profile.mading.length})'),
        Tab(text: 'Zona Kreasi (${profile.spotlight.length})'),
      ],
    ),
  );
}

class _MadingGrid extends StatelessWidget {
  const _MadingGrid({required this.profile});
  final StudentCreatorProfile profile;

  @override
  Widget build(BuildContext context) {
    if (profile.mading.isEmpty) {
      return const _Empty(
        icon: Icons.auto_stories_outlined,
        label: 'Belum ada Mading yang dapat dilihat.',
      );
    }
    return MasonryGridView.count(
      key: const Key('creator-mading-grid'),
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 28),
      crossAxisCount: 2,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      itemCount: profile.mading.length,
      itemBuilder: (_, index) => _PortfolioCard(
        key: Key('creator-mading-card-${profile.mading[index].id}'),
        title: profile.mading[index].title,
        label: profile.mading[index].category,
        likes: profile.mading[index].likeCount,
        views: profile.mading[index].viewCount,
        media: _MadingMedia(item: profile.mading[index]),
        aspectRatio: profile.mading[index].imageUrl?.trim().isNotEmpty == true
            ? .92
            : 1.25,
        onTap: () => _openCreatorPreview(
          context,
          (_) =>
              CreatorMadingPreviewScreen(profile: profile, initialIndex: index),
        ),
      ),
    );
  }
}

class _SpotlightGrid extends StatelessWidget {
  const _SpotlightGrid({required this.profile});
  final StudentCreatorProfile profile;

  @override
  Widget build(BuildContext context) {
    if (profile.spotlight.isEmpty) {
      return const _Empty(
        icon: Icons.smart_display_outlined,
        label: 'Belum ada Zona Kreasi yang dapat dilihat.',
      );
    }
    return MasonryGridView.count(
      key: const Key('creator-spotlight-grid'),
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 28),
      crossAxisCount: 2,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      itemCount: profile.spotlight.length,
      itemBuilder: (_, index) {
        final item = profile.spotlight[index];
        final preview = item.thumbnailUrl?.trim().isNotEmpty == true
            ? item.thumbnailUrl
            : _isImage(item.videoUrl)
            ? item.videoUrl
            : null;
        return _PortfolioCard(
          key: Key('creator-spotlight-card-${item.id}'),
          title: item.caption,
          label: 'Zona Kreasi',
          likes: item.likeCount,
          aspectRatio: .78,
          showPlay: true,
          media: preview?.trim().isNotEmpty == true
              ? Image.network(
                  resolveAppMediaUrl(preview!),
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) =>
                      const _MediaFallback(icon: Icons.smart_display_rounded),
                )
              : const _MediaFallback(icon: Icons.smart_display_rounded),
          onTap: () => _openCreatorPreview(
            context,
            (_) => CreatorSpotlightPreviewScreen(
              items: profile.spotlight,
              initialIndex: index,
            ),
          ),
        );
      },
    );
  }
}

class _PortfolioCard extends StatelessWidget {
  const _PortfolioCard({
    super.key,
    required this.title,
    required this.label,
    required this.likes,
    required this.media,
    required this.aspectRatio,
    required this.onTap,
    this.views,
    this.showPlay = false,
  });
  final String title;
  final String label;
  final int likes;
  final int? views;
  final Widget media;
  final double aspectRatio;
  final VoidCallback onTap;
  final bool showPlay;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(19),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Ink(
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFE2EAF5)),
          borderRadius: BorderRadius.circular(19),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: aspectRatio,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  media,
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Color(0xA007182E)],
                      ),
                    ),
                  ),
                  if (showPlay)
                    const Center(
                      child: CircleAvatar(
                        radius: 21,
                        backgroundColor: Color(0xDFFFFFFF),
                        child: Icon(
                          Icons.play_arrow_rounded,
                          color: _blue,
                          size: 28,
                        ),
                      ),
                    ),
                  Positioned(
                    left: 9,
                    bottom: 8,
                    child: _TypeLabel(label: label),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(11),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: _navy,
                      height: 1.2,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 9),
                  _Engagement(likes: likes, views: views),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class CreatorMadingPreviewScreen extends StatelessWidget {
  const CreatorMadingPreviewScreen({
    super.key,
    required this.profile,
    required this.initialIndex,
  });
  final StudentCreatorProfile profile;
  final int initialIndex;

  @override
  Widget build(BuildContext context) {
    final items = _rotate(profile.mading, initialIndex);
    return Scaffold(
      key: const Key('creator-mading-preview'),
      backgroundColor: _canvas,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Mading Kreator',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
            ),
            Text(
              '${profile.name} • ${items.length} karya',
              style: const TextStyle(color: AppColors.muted, fontSize: 10),
            ),
          ],
        ),
      ),
      body: ListView.separated(
        key: const Key('creator-mading-preview-scroll'),
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
        itemCount: items.length,
        separatorBuilder: (_, index) =>
            _NextWork(current: index + 1, total: items.length),
        itemBuilder: (_, index) => _MadingArticle(
          key: Key('creator-mading-preview-item-${items[index].id}'),
          item: items[index],
          profile: profile,
          position: index + 1,
          total: items.length,
        ),
      ),
    );
  }
}

class _MadingArticle extends StatelessWidget {
  const _MadingArticle({
    super.key,
    required this.item,
    required this.profile,
    required this.position,
    required this.total,
  });
  final StudentBoardItem item;
  final StudentCreatorProfile profile;
  final int position;
  final int total;

  @override
  Widget build(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: const Color(0xFFE2EAF5)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x14132B4E),
          blurRadius: 20,
          offset: Offset(0, 8),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (item.imageUrl?.trim().isNotEmpty == true)
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 520),
            child: Image.network(
              resolveAppMediaUrl(item.imageUrl!),
              width: double.infinity,
              fit: BoxFit.contain,
              errorBuilder: (_, _, _) =>
                  SizedBox(height: 260, child: _MadingMedia(item: item)),
            ),
          )
        else
          SizedBox(height: 260, child: _MadingMedia(item: item)),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _LightLabel(label: item.category),
                  const Spacer(),
                  Text(
                    '$position dari $total',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 13),
              Text(
                item.title,
                style: const TextStyle(
                  color: _navy,
                  fontSize: 25,
                  height: 1.15,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 15),
              _Identity(profile: profile),
              const SizedBox(height: 20),
              Text(
                item.content,
                style: const TextStyle(
                  color: Color(0xFF0F2418),
                  fontSize: 15.5,
                  height: 1.7,
                ),
              ),
              const SizedBox(height: 22),
              const Divider(height: 1),
              const SizedBox(height: 13),
              _Engagement(
                likes: item.likeCount,
                views: item.viewCount,
                comments: item.commentCount,
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class CreatorSpotlightPreviewScreen extends ConsumerStatefulWidget {
  const CreatorSpotlightPreviewScreen({
    super.key,
    required this.items,
    required this.initialIndex,
    this.initializeMedia = true,
  });
  final List<StudentSpotlightItem> items;
  final int initialIndex;
  final bool initializeMedia;

  @override
  ConsumerState<CreatorSpotlightPreviewScreen> createState() =>
      _CreatorSpotlightPreviewScreenState();
}

class _CreatorSpotlightPreviewScreenState
    extends ConsumerState<CreatorSpotlightPreviewScreen> {
  late final PageController _controller;
  late int _index;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex.clamp(0, widget.items.length - 1);
    _controller = PageController(initialPage: _index);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    key: const Key('creator-spotlight-preview'),
    backgroundColor: Colors.black,
    body: Stack(
      children: [
        PageView.builder(
          key: const Key('creator-spotlight-preview-pages'),
          controller: _controller,
          scrollDirection: Axis.vertical,
          itemCount: widget.items.length,
          onPageChanged: (value) => setState(() => _index = value),
          itemBuilder: (_, index) {
            final item = widget.items[index];
            return SpotlightReelSlide(
              key: ValueKey(item.id),
              post: _spotlightPost(item),
              repository: const SpotlightRepository.preview(),
              isActive: index == _index,
              shouldLoad: (index - _index).abs() <= 1,
              initializeVideo: widget.initializeMedia,
              isAuthor: false,
              shareKind: SpotlightKind.student,
              engagementEnabled: false,
              likeEnabled: true,
              onToggleLike: () => ref
                  .read(dashboardRepositoryProvider)
                  .toggleStudentSpotlightLike(item.id),
              mediaPlaceholder: _isImage(item.videoUrl)
                  ? Image.network(
                      resolveAppMediaUrl(item.videoUrl),
                      fit: BoxFit.contain,
                      errorBuilder: (_, _, _) => const ColoredBox(
                        color: Color(0xFF111827),
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
              onDelete: () {},
              onCommentCountChanged: (_) {},
            );
          },
        ),
        SafeArea(
          child: Stack(
            children: [
              Positioned(
                top: 10,
                left: 12,
                child: _OverlayButton(
                  key: const Key('creator-spotlight-preview-back'),
                  onTap: () => Navigator.maybePop(context),
                ),
              ),
              Align(
                alignment: Alignment.topCenter,
                child: Container(
                  key: const Key('creator-spotlight-preview-position'),
                  margin: const EdgeInsets.only(top: 14),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 13,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x8A000000),
                    borderRadius: BorderRadius.circular(99),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: Text(
                    '${_index + 1} dari ${widget.items.length}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.profile, required this.size});
  final StudentCreatorProfile profile;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: const Color(0xFFD8EAFF),
      border: Border.all(color: Colors.white, width: 4),
      boxShadow: const [
        BoxShadow(
          color: Color(0x40053274),
          blurRadius: 20,
          offset: Offset(0, 9),
        ),
      ],
    ),
    child: profile.avatarUrl?.trim().isNotEmpty == true
        ? Image.network(
            resolveAppMediaUrl(profile.avatarUrl!),
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => _Initial(name: profile.name),
          )
        : _Initial(name: profile.name),
  );
}

class _Initial extends StatelessWidget {
  const _Initial({required this.name});
  final String name;
  @override
  Widget build(BuildContext context) => Center(
    child: Text(
      name.trim().isEmpty ? 'S' : name.trim().substring(0, 1).toUpperCase(),
      style: const TextStyle(
        color: _blue,
        fontSize: 35,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

class _Identity extends StatelessWidget {
  const _Identity({required this.profile});
  final StudentCreatorProfile profile;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      _ProfileAvatar(profile: profile, size: 40),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              profile.name,
              style: const TextStyle(
                color: _navy,
                fontSize: 12.5,
                fontWeight: FontWeight.w900,
              ),
            ),
            Text(
              [
                profile.schoolName,
                if (profile.className?.trim().isNotEmpty == true)
                  profile.className!,
              ].join(' · '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.muted, fontSize: 10),
            ),
          ],
        ),
      ),
    ],
  );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.value, required this.label});
  final int value;
  final String label;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        '$value',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 21,
          fontWeight: FontWeight.w900,
        ),
      ),
      Text(
        label,
        style: const TextStyle(
          color: Color(0xFFE8F6EA),
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _Orb extends StatelessWidget {
  const _Orb({required this.size, required this.color});
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

class _MadingMedia extends StatelessWidget {
  const _MadingMedia({required this.item});
  final StudentBoardItem item;
  @override
  Widget build(BuildContext context) => item.imageUrl?.trim().isNotEmpty == true
      ? Image.network(
          resolveAppMediaUrl(item.imageUrl!),
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) =>
              const _MediaFallback(icon: Icons.auto_stories_rounded),
        )
      : const _MediaFallback(icon: Icons.auto_stories_rounded);
}

class _MediaFallback extends StatelessWidget {
  const _MediaFallback({required this.icon});
  final IconData icon;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFDFEEFF), Color(0xFFB7DAFF), Color(0xFFD8F8FF)],
      ),
    ),
    child: Center(child: Icon(icon, color: _blue, size: 38)),
  );
}

class _TypeLabel extends StatelessWidget {
  const _TypeLabel({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: const Color(0xC9122342),
      borderRadius: BorderRadius.circular(99),
      border: Border.all(color: Colors.white24),
    ),
    child: Text(
      label,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 8.5,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class _LightLabel extends StatelessWidget {
  const _LightLabel({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0xFFE8F6EA),
      borderRadius: BorderRadius.circular(99),
    ),
    child: Text(
      label,
      style: const TextStyle(
        color: _blue,
        fontSize: 10,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

class _Engagement extends StatelessWidget {
  const _Engagement({required this.likes, this.views, this.comments});
  final int likes;
  final int? views;
  final int? comments;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(
        Icons.favorite_border_rounded,
        size: 15,
        color: AppColors.muted,
      ),
      const SizedBox(width: 4),
      Text('$likes', style: _countStyle),
      if (comments != null) ...[
        const SizedBox(width: 12),
        const Icon(
          Icons.chat_bubble_outline_rounded,
          size: 15,
          color: AppColors.muted,
        ),
        const SizedBox(width: 4),
        Text('$comments', style: _countStyle),
      ],
      if (views != null) ...[
        const SizedBox(width: 12),
        const Icon(Icons.visibility_outlined, size: 15, color: AppColors.muted),
        const SizedBox(width: 4),
        Text('$views', style: _countStyle),
      ],
    ],
  );
}

const _countStyle = TextStyle(
  fontSize: 10,
  color: AppColors.muted,
  fontWeight: FontWeight.w700,
);

class _NextWork extends StatelessWidget {
  const _NextWork({required this.current, required this.total});
  final int current;
  final int total;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 24),
    child: Row(
      children: [
        const Expanded(child: Divider()),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            '↓ Karya berikutnya • ${current + 1} dari $total',
            style: const TextStyle(
              color: _blue,
              fontSize: 10.5,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const Expanded(child: Divider()),
      ],
    ),
  );
}

class _OverlayButton extends StatelessWidget {
  const _OverlayButton({super.key, required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0x8A000000),
    shape: const CircleBorder(),
    child: InkWell(
      customBorder: const CircleBorder(),
      onTap: onTap,
      child: const SizedBox(
        width: 42,
        height: 42,
        child: Icon(Icons.close_rounded, color: Colors.white),
      ),
    ),
  );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.label});
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 38,
          backgroundColor: const Color(0xFFE7F1FF),
          child: Icon(icon, size: 38, color: _blue),
        ),
        const SizedBox(height: 14),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.muted,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

List<T> _rotate<T>(List<T> source, int index) {
  if (source.isEmpty) return const [];
  final start = index.clamp(0, source.length - 1);
  return [...source.skip(start), ...source.take(start)];
}

SpotlightPost _spotlightPost(StudentSpotlightItem item) => SpotlightPost(
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

bool _isImage(String value) {
  final path = Uri.tryParse(value)?.path.toLowerCase() ?? value.toLowerCase();
  return path.endsWith('.jpg') ||
      path.endsWith('.jpeg') ||
      path.endsWith('.png') ||
      path.endsWith('.webp') ||
      path.endsWith('.gif');
}
