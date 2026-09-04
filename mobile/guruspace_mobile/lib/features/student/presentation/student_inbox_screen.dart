import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/student/domain/student_social_models.dart';
import 'package:guruspace_mobile/features/student/presentation/student_creator_profile_screen.dart';

String _newClientMessageId() {
  final random = Random.secure();
  final entropy = List.generate(
    4,
    (_) => random.nextInt(0x7fffffff).toRadixString(36),
  ).join('-');
  return '${DateTime.now().microsecondsSinceEpoch}-$entropy';
}

class StudentInboxScreen extends ConsumerStatefulWidget {
  const StudentInboxScreen({super.key, this.initialConversationId});
  final String? initialConversationId;

  @override
  ConsumerState<StudentInboxScreen> createState() => _StudentInboxScreenState();
}

class _StudentInboxScreenState extends ConsumerState<StudentInboxScreen>
    with WidgetsBindingObserver {
  Timer? _poller;
  bool _openedInitial = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startPolling();
    WidgetsBinding.instance.addPostFrameCallback((_) => _openInitial());
  }

  void _startPolling() {
    _poller?.cancel();
    _poller = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) ref.read(studentSocialRefreshProvider.notifier).state++;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(studentSocialRefreshProvider.notifier).state++;
      _startPolling();
    } else {
      _poller?.cancel();
    }
  }

  Future<void> _openInitial() async {
    final id = widget.initialConversationId?.trim() ?? '';
    if (!mounted || _openedInitial || id.isEmpty) return;
    _openedInitial = true;
    await _openConversation(id);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poller?.cancel();
    super.dispose();
  }

  Future<void> _openConversation(String id) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(builder: (_) => StudentConversationScreen(id: id)),
    );
    if (mounted) ref.read(studentSocialRefreshProvider.notifier).state++;
  }

  Future<void> _respond(StudentMessageRequestItem item, bool accept) async {
    try {
      final id = await ref
          .read(studentSocialRepositoryProvider)
          .respondRequest(item.id, accept);
      ref.read(studentSocialRefreshProvider.notifier).state++;
      if (accept && id?.isNotEmpty == true && mounted) {
        await _openConversation(id!);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(studentInboxProvider);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F8FD),
        appBar: AppBar(
          title: const Text('Inbox'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Percakapan'),
              Tab(text: 'Permintaan'),
            ],
          ),
        ),
        body: value.when(
          loading: () => const LoadingView(label: 'Memuat pesan...'),
          error: (error, _) => ErrorView(
            message: '$error',
            onRetry: () =>
                ref.read(studentSocialRefreshProvider.notifier).state++,
          ),
          data: (inbox) => TabBarView(
            children: [
              _ConversationList(inbox: inbox, onOpen: _openConversation),
              _RequestList(inbox: inbox, onRespond: _respond),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConversationList extends StatelessWidget {
  const _ConversationList({required this.inbox, required this.onOpen});
  final StudentInboxData inbox;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    if (inbox.conversations.isEmpty) {
      return const _SocialEmpty(
        icon: Icons.forum_outlined,
        title: 'Belum ada percakapan',
        message: 'Ikuti teman dan mulai pesan dari profil kreator.',
      );
    }
    return RefreshIndicator(
      onRefresh: () async {
        ProviderScope.containerOf(
          context,
        ).read(studentSocialRefreshProvider.notifier).state++;
      },
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: inbox.conversations.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final item = inbox.conversations[index];
          final message = item.lastMessage?.content ?? 'Mulai percakapan';
          return Card(
            margin: EdgeInsets.zero,
            child: ListTile(
              onTap: () => onOpen(item.id),
              leading: _SocialAvatar(user: item.otherUser),
              title: Text(
                item.otherUser.name,
                style: TextStyle(
                  fontWeight: item.unread ? FontWeight.w900 : FontWeight.w700,
                ),
              ),
              subtitle: Text(
                '${item.otherUser.schoolName}\n$message',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              isThreeLine: true,
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    DateFormat('HH:mm').format(item.updatedAt.toLocal()),
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (item.unread)
                    const CircleAvatar(
                      radius: 6,
                      backgroundColor: AppColors.blue,
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _RequestList extends StatelessWidget {
  const _RequestList({required this.inbox, required this.onRespond});
  final StudentInboxData inbox;
  final void Function(StudentMessageRequestItem, bool) onRespond;

  @override
  Widget build(BuildContext context) {
    if (inbox.requests.isEmpty) {
      return const _SocialEmpty(
        icon: Icons.mark_chat_unread_outlined,
        title: 'Tidak ada permintaan',
        message: 'Permintaan pesan baru akan tampil di sini.',
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: const Color(0xFFEAF3FF),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Text(
            'Terima hanya permintaan dari orang yang Anda kenal. Jangan membagikan data pribadi.',
            style: TextStyle(
              color: AppColors.navy,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 12),
        ...inbox.requests.map(
          (item) => Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: _SocialAvatar(user: item.sender),
                    title: Text(
                      item.sender.name,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    subtitle: Text(
                      '${item.sender.schoolName}\n${item.message}',
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                    isThreeLine: true,
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => onRespond(item, false),
                          child: const Text('Tolak'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          onPressed: () => onRespond(item, true),
                          child: const Text('Terima'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class StudentConversationScreen extends ConsumerStatefulWidget {
  const StudentConversationScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<StudentConversationScreen> createState() =>
      _StudentConversationScreenState();
}

class _StudentConversationScreenState
    extends ConsumerState<StudentConversationScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (_sending || text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref
          .read(studentSocialRepositoryProvider)
          .sendMessage(
            conversationId: widget.id,
            content: text,
            clientMessageId: _newClientMessageId(),
          );
      _controller.clear();
      ref.read(studentSocialRefreshProvider.notifier).state++;
      ref.invalidate(studentConversationProvider(widget.id));
      await ref.read(studentConversationProvider(widget.id).future);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(studentConversationProvider(widget.id));
    final other = value.asData?.value.otherUser;
    return Scaffold(
      backgroundColor: const Color(0xFFF5F8FD),
      appBar: AppBar(
        titleSpacing: 0,
        title: other != null
            ? InkWell(
                onTap: other.studentId?.isNotEmpty == true
                    ? () => openStudentCreatorProfile(context, other.studentId)
                    : null,
                child: Row(
                  children: [
                    _SocialAvatar(user: other, radius: 18),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            other.name,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            other.schoolName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 10,
                              color: AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )
            : const Text('Percakapan'),
      ),
      body: value.when(
        loading: () => const LoadingView(label: 'Membuka percakapan...'),
        error: (error, _) => ErrorView(
          message: '$error',
          onRetry: () => ref.invalidate(studentConversationProvider(widget.id)),
        ),
        data: (detail) => Column(
          children: [
            Expanded(
              child: detail.messages.isEmpty
                  ? const _SocialEmpty(
                      icon: Icons.waving_hand_outlined,
                      title: 'Mulai percakapan',
                      message:
                          'Kirim pesan yang positif dan saling menghargai.',
                    )
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: detail.messages.length,
                      itemBuilder: (context, index) {
                        final item = detail.messages[index];
                        return Align(
                          alignment: item.isMine
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          child: Container(
                            constraints: BoxConstraints(
                              maxWidth: MediaQuery.sizeOf(context).width * .78,
                            ),
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
                            decoration: BoxDecoration(
                              color: item.isMine
                                  ? AppColors.blue
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x100C3B84),
                                  blurRadius: 10,
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  item.content,
                                  style: TextStyle(
                                    color: item.isMine
                                        ? Colors.white
                                        : AppColors.navy,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  DateFormat(
                                    'HH:mm',
                                  ).format(item.createdAt.toLocal()),
                                  style: TextStyle(
                                    fontSize: 9,
                                    color: item.isMine
                                        ? Colors.white70
                                        : AppColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
            SafeArea(
              top: false,
              child: Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        minLines: 1,
                        maxLines: 4,
                        maxLength: 1000,
                        decoration: const InputDecoration(
                          counterText: '',
                          hintText: 'Tulis pesan...',
                        ),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      onPressed: _sending ? null : _send,
                      icon: _sending
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
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
  }
}

class _SocialAvatar extends StatelessWidget {
  const _SocialAvatar({required this.user, this.radius = 24});
  final StudentSocialUser user;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final avatar = user.avatarUrl?.trim() ?? '';
    return CircleAvatar(
      radius: radius,
      backgroundColor: const Color(0xFFDDEAFF),
      backgroundImage: avatar.isNotEmpty
          ? NetworkImage(resolveAppMediaUrl(avatar))
          : null,
      child: avatar.isEmpty
          ? Text(user.name.isEmpty ? 'S' : user.name[0].toUpperCase())
          : null,
    );
  }
}

class _SocialEmpty extends StatelessWidget {
  const _SocialEmpty({
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 54, color: AppColors.blue),
          const SizedBox(height: 14),
          Text(
            title,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted),
          ),
        ],
      ),
    ),
  );
}
