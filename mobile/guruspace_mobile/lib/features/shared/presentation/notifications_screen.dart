import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/core/widgets/dashboard_components.dart';

class NotificationListItem {
  const NotificationListItem({
    required this.recipientId,
    required this.notificationId,
    required this.title,
    required this.message,
    required this.priority,
    required this.publishAt,
    required this.senderName,
    this.readAt,
    this.actionUrl,
    this.imageUrl,
  });

  final String recipientId;
  final String notificationId;
  final String title;
  final String message;
  final String priority;
  final DateTime publishAt;
  final String senderName;
  final DateTime? readAt;
  final String? actionUrl;
  final String? imageUrl;

  bool get unread => readAt == null;

  factory NotificationListItem.fromJson(Map<String, dynamic> json) {
    final notification = Map<String, dynamic>.from(
      json['notification'] as Map? ?? const {},
    );
    final sender = Map<String, dynamic>.from(
      notification['sender'] as Map? ?? const {},
    );
    return NotificationListItem(
      recipientId: json['id']?.toString() ?? '',
      notificationId: notification['id']?.toString() ?? '',
      title: notification['title']?.toString() ?? 'Pemberitahuan',
      message: notification['message']?.toString() ?? '',
      priority: notification['priority']?.toString() ?? 'NORMAL',
      publishAt:
          DateTime.tryParse(notification['publishAt']?.toString() ?? '') ??
          DateTime.now(),
      senderName: sender['name']?.toString() ?? 'GuruSpace',
      readAt: DateTime.tryParse(json['readAt']?.toString() ?? ''),
      actionUrl: _cleanText(notification['actionUrl']),
      imageUrl: _cleanText(notification['imageUrl']),
    );
  }
}

class NotificationInboxData {
  const NotificationInboxData({required this.items, required this.unreadCount});

  final List<NotificationListItem> items;
  final int unreadCount;
}

String? _cleanText(Object? value) {
  final text = value?.toString().trim() ?? '';
  return text.isEmpty ? null : text;
}

String? _absoluteUrl(String? value) {
  final trimmed = value?.trim() ?? '';
  if (trimmed.isEmpty) return null;
  return resolveAppMediaUrl(trimmed);
}

final notificationsProvider = FutureProvider<NotificationInboxData>((
  ref,
) async {
  ref.watch(authenticatedUserIdProvider);
  final json = await ref
      .watch(apiClientProvider)
      .getJson('/api/notifications', query: {'limit': 30});
  final items = json['items'];
  final parsed = items is List
      ? items
            .whereType<Map>()
            .map(
              (item) => NotificationListItem.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList()
      : const <NotificationListItem>[];
  parsed.sort((a, b) => b.publishAt.compareTo(a.publishAt));
  final unreadCount = json['unreadCount'] is num
      ? (json['unreadCount'] as num).toInt()
      : parsed.where((item) => item.unread).length;
  return NotificationInboxData(items: parsed, unreadCount: unreadCount);
});

final studentUnreadNotificationsProvider = FutureProvider<int>((ref) async {
  final data = await ref.watch(notificationsProvider.future);
  return data.unreadCount;
});

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key, this.initialNotificationId});

  final String? initialNotificationId;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.canvas,
    body: NotificationsScreen(initialNotificationId: initialNotificationId),
  );
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({
    super.key,
    this.embedded = false,
    this.initialNotificationId,
  });

  final bool embedded;
  final String? initialNotificationId;

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _openedInitial = false;

  NotificationListItem? _matchNotification(
    List<NotificationListItem> items,
    String targetId,
  ) {
    for (final item in items) {
      if (item.notificationId == targetId || item.recipientId == targetId) {
        return item;
      }
    }
    return null;
  }

  void _openInitialNotification(AsyncValue<NotificationInboxData> next) {
    final targetId = widget.initialNotificationId?.trim();
    if (_openedInitial || targetId == null || targetId.isEmpty) return;
    final inbox = next.asData?.value;
    if (inbox == null) return;
    final match = _matchNotification(inbox.items, targetId);
    _openedInitial = true;
    Future.microtask(() async {
      var item = match;
      if (item == null) {
        try {
          final json = await ref
              .read(apiClientProvider)
              .getJson(
                '/api/notifications',
                query: {'notificationId': targetId, 'limit': '1'},
              );
          final items = json['items'];
          if (items is List) {
            item = _matchNotification(
              items
                  .whereType<Map>()
                  .map(
                    (entry) => NotificationListItem.fromJson(
                      Map<String, dynamic>.from(entry),
                    ),
                  )
                  .toList(),
              targetId,
            );
          }
        } catch (_) {
          item = null;
        }
      }
      final opened = item;
      if (opened == null || !mounted) return;
      try {
        if (opened.unread) {
          await ref
              .read(apiClientProvider)
              .postJson(
                '/api/notifications/read',
                data: {'recipientId': opened.recipientId},
              );
        }
      } catch (_) {
        // Detail tetap dibuka meskipun tanda-baca gagal.
      }
      if (!mounted) return;
      await Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder: (_) => _NotificationDetailScreen(item: opened),
        ),
      );
      if (mounted) ref.invalidate(notificationsProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<NotificationInboxData>>(
      notificationsProvider,
      (_, next) => _openInitialNotification(next),
    );
    final notifications = ref.watch(notificationsProvider);
    _openInitialNotification(notifications);
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(notificationsProvider),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          if (!widget.embedded)
            SliverAppBar.large(
              title: const Text('Pemberitahuan'),
              actions: [const _ReadAllButton()],
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
              sliver: SliverToBoxAdapter(
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Belum dibaca',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const _ReadAllButton(),
                  ],
                ),
              ),
            ),
          notifications.when(
            loading: () => const SliverFillRemaining(child: LoadingView()),
            error: (error, _) => SliverFillRemaining(
              child: ErrorView(
                message: '$error',
                onRetry: () => ref.invalidate(notificationsProvider),
              ),
            ),
            data: (inbox) => inbox.items.isEmpty
                ? const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: EmptyCard(
                        icon: Icons.notifications_none_rounded,
                        title: 'Belum ada pemberitahuan',
                        message:
                            'Informasi penting dari GuruSpace akan tampil di sini.',
                      ),
                    ),
                  )
                : SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
                    sliver: SliverList.separated(
                      itemCount: inbox.items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final item = inbox.items[index];
                        return _NotificationCard(
                          item: item,
                          onOpen: () async {
                            if (item.unread) {
                              await ref
                                  .read(apiClientProvider)
                                  .postJson(
                                    '/api/notifications/read',
                                    data: {'recipientId': item.recipientId},
                                  );
                              ref.invalidate(notificationsProvider);
                            }
                            if (!context.mounted) return;
                            await Navigator.push<void>(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    _NotificationDetailScreen(item: item),
                              ),
                            );
                            ref.invalidate(notificationsProvider);
                          },
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ReadAllButton extends ConsumerStatefulWidget {
  const _ReadAllButton();

  @override
  ConsumerState<_ReadAllButton> createState() => _ReadAllButtonState();
}

class _ReadAllButtonState extends ConsumerState<_ReadAllButton> {
  bool _submitting = false;

  @override
  Widget build(BuildContext context) {
    final unread = ref.watch(studentUnreadNotificationsProvider);
    final hasUnread = (unread.asData?.value ?? 0) > 0;
    return TextButton(
      onPressed: !hasUnread || _submitting ? null : _markAllRead,
      child: _submitting
          ? const SizedBox.square(
              dimension: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Text('Baca semua'),
    );
  }

  Future<void> _markAllRead() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(apiClientProvider)
          .postJson('/api/notifications/read', data: {'all': true});
      if (!mounted) return;
      ref.invalidate(notificationsProvider);
      await ref.read(notificationsProvider.future);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Notifikasi belum dapat diperbarui: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.item, required this.onOpen});

  final NotificationListItem item;
  final Future<void> Function() onOpen;

  @override
  Widget build(BuildContext context) {
    final priorityColor = _priorityColor(item.priority);
    return Card(
      color: item.unread ? const Color(0xFFE8F6EA) : Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    backgroundColor: priorityColor.withValues(alpha: .12),
                    child: Icon(
                      Icons.notifications_rounded,
                      color: priorityColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          item.message,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${item.senderName} · ${DateFormat('d MMM yyyy, HH:mm', 'id_ID').format(item.publishAt)}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(Icons.chevron_right_rounded, color: priorityColor),
                ],
              ),
              if (item.imageUrl != null) ...[
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(
                    _absoluteUrl(item.imageUrl)!,
                    fit: BoxFit.cover,
                    height: 168,
                    width: double.infinity,
                    errorBuilder: (_, _, _) => Container(
                      height: 120,
                      color: const Color(0xFFF5FAF6),
                      alignment: Alignment.center,
                      child: const Text('Gambar tidak dapat dimuat'),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationDetailScreen extends StatelessWidget {
  const _NotificationDetailScreen({required this.item});

  final NotificationListItem item;

  @override
  Widget build(BuildContext context) {
    final priorityColor = _priorityColor(item.priority);
    return Scaffold(
      appBar: AppBar(title: const Text('Detail Pemberitahuan')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: priorityColor.withValues(alpha: .08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: priorityColor.withValues(alpha: .2)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: priorityColor.withValues(alpha: .14),
                  child: Icon(
                    Icons.notifications_active_rounded,
                    color: priorityColor,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${item.senderName} · ${DateFormat('d MMM yyyy, HH:mm', 'id_ID').format(item.publishAt)}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (item.imageUrl != null) ...[
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Image.network(
                _absoluteUrl(item.imageUrl)!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  height: 160,
                  color: const Color(0xFFF5FAF6),
                  alignment: Alignment.center,
                  child: const Text('Gambar tidak dapat dimuat'),
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFD7E8D9)),
            ),
            child: Text(
              item.message,
              style: const TextStyle(fontSize: 15, height: 1.6),
            ),
          ),
          if (item.actionUrl != null) ...[
            const SizedBox(height: 16),
            Text(
              'Tautan terkait: ${item.actionUrl}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.muted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

Color _priorityColor(String? priority) => switch (priority) {
  'URGENT' => AppColors.danger,
  'IMPORTANT' => AppColors.warning,
  _ => AppColors.blue,
};
