import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/core/widgets/dashboard_components.dart';
import 'package:guruspace_mobile/core/widgets/mobile_web_shell.dart';

class NativeDataScreen extends ConsumerStatefulWidget {
  const NativeDataScreen({
    super.key,
    required this.title,
    required this.description,
    required this.icon,
    required this.endpoint,
    this.eyebrow = 'GuruSpace',
    this.listKeys = const [],
    this.emptyMessage = 'Belum ada data untuk ditampilkan.',
  });

  final String title;
  final String description;
  final IconData icon;
  final String endpoint;
  final String eyebrow;
  final List<String> listKeys;
  final String emptyMessage;

  @override
  ConsumerState<NativeDataScreen> createState() => _NativeDataScreenState();
}

class _NativeDataScreenState extends ConsumerState<NativeDataScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref.read(apiClientProvider).getJson(widget.endpoint);
      if (mounted) setState(() => _data = data);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _items() {
    final data = _data ?? const <String, dynamic>{};
    for (final key in widget.listKeys) {
      final value = data[key];
      if (value is List) return _asMaps(value);
    }
    for (final value in data.values) {
      if (value is List) return _asMaps(value);
    }
    return const [];
  }

  List<Map<String, dynamic>> _asMaps(List<dynamic> values) => values
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();

  String _text(Map<String, dynamic> item, List<String> keys, String fallback) {
    for (final key in keys) {
      final value = item[key];
      if (value != null && value.toString().trim().isNotEmpty) {
        return value.toString();
      }
    }
    return fallback;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              sliver: SliverToBoxAdapter(
                child: PageIntro(
                  eyebrow: widget.eyebrow,
                  title: widget.title,
                  description: widget.description,
                  icon: widget.icon,
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(child: LoadingView())
            else if (_error != null)
              SliverFillRemaining(
                child: ErrorView(message: _error!, onRetry: _load),
              )
            else
              _buildContent(),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    final items = _items();
    if (items.isEmpty) {
      final summary = (_data ?? const <String, dynamic>{}).entries
          .where(
            (entry) =>
                entry.value is String ||
                entry.value is num ||
                entry.value is bool,
          )
          .toList();
      if (summary.isNotEmpty) {
        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          sliver: SliverList.list(
            children: summary
                .map(
                  (entry) => Card(
                    child: ListTile(
                      title: Text(_label(entry.key)),
                      trailing: Text(
                        entry.value.toString(),
                        style: const TextStyle(
                          color: AppColors.blue,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        );
      }
      return SliverFillRemaining(
        child: EmptyCard(
          icon: widget.icon,
          title: widget.title,
          message: widget.emptyMessage,
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
      sliver: SliverList.separated(
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final item = items[index];
          final title = _text(item, const [
            'title',
            'name',
            'subject',
            'mapel',
            'label',
          ], '${widget.title} ${index + 1}');
          final subtitle = _text(item, const [
            'description',
            'summary',
            'category',
            'status',
            'content',
          ], 'Ketuk untuk melihat detail');
          return Card(
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 8,
              ),
              leading: CircleAvatar(
                backgroundColor: AppColors.blue.withValues(alpha: .1),
                child: Icon(widget.icon, color: AppColors.blue),
              ),
              title: Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(
                subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => _showDetail(title, item),
            ),
          );
        },
      ),
    );
  }

  void _showDetail(String title, Map<String, dynamic> item) {
    final rows = item.entries.where((entry) {
      final value = entry.value;
      return value != null && value is! List && value is! Map;
    }).toList();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: rows.length,
                  separatorBuilder: (_, _) => const Divider(height: 20),
                  itemBuilder: (_, index) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _label(rows[index].key),
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(rows[index].value.toString()),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _label(String value) => value
      .replaceAllMapped(
        RegExp(r'([a-z])([A-Z])'),
        (match) => '${match[1]} ${match[2]}',
      )
      .replaceAll('_', ' ')
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

void openNativeDataScreen(
  BuildContext context, {
  required String title,
  required String description,
  required IconData icon,
  required String endpoint,
  List<String> listKeys = const [],
  String eyebrow = 'GuruSpace',
}) {
  Navigator.push<void>(
    context,
    MaterialPageRoute(
      builder: (_) => NativeDataScreen(
        title: title,
        description: description,
        icon: icon,
        endpoint: endpoint,
        listKeys: listKeys,
        eyebrow: eyebrow,
      ),
    ),
  );
}
