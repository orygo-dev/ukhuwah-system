import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/features/teacher/presentation/teacher_spotlight_reports_screen.dart';

enum TeacherReviewFeature { mading, spotlight }

class TeacherContentReviewScreen extends ConsumerStatefulWidget {
  const TeacherContentReviewScreen({
    super.key,
    this.initialFeature = TeacherReviewFeature.mading,
  });

  final TeacherReviewFeature initialFeature;

  @override
  ConsumerState<TeacherContentReviewScreen> createState() =>
      _TeacherContentReviewScreenState();
}

class _TeacherContentReviewScreenState
    extends ConsumerState<TeacherContentReviewScreen> {
  late TeacherReviewFeature _feature;
  List<_ReviewItem> _items = const [];
  bool _loading = true;
  String? _error;
  String? _actingId;

  @override
  void initState() {
    super.initState();
    _feature = widget.initialFeature;
    Future<void>.microtask(_load);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(apiClientProvider);
      final responses = await Future.wait([
        client.getJson('/api/student-board/posts'),
        client.getJson('/api/student-spotlight/submissions'),
      ]);
      final mading = (responses[0]['posts'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (json) => _ReviewItem.fromMading(Map<String, dynamic>.from(json)),
          );
      final spotlight = (responses[1]['submissions'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (json) =>
                _ReviewItem.fromSpotlight(Map<String, dynamic>.from(json)),
          );
      if (mounted) setState(() => _items = [...mading, ...spotlight]);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<_ReviewItem> get _visible {
    final selected = _items.where((item) => item.feature == _feature).toList();
    selected.sort((a, b) {
      if (a.status == 'PENDING_REVIEW' && b.status != 'PENDING_REVIEW') {
        return -1;
      }
      if (b.status == 'PENDING_REVIEW' && a.status != 'PENDING_REVIEW') {
        return 1;
      }
      return b.createdAt.compareTo(a.createdAt);
    });
    return selected;
  }

  int _pendingCount(TeacherReviewFeature feature) => _items
      .where(
        (item) => item.feature == feature && item.status == 'PENDING_REVIEW',
      )
      .length;

  Future<void> _openReview(_ReviewItem item) async {
    final note = TextEditingController(text: item.reviewNote ?? '');
    final visibility = ValueNotifier<String>(item.visibility);
    final result = await showModalBottomSheet<_ReviewDecision>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
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
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Keputusan review',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    item.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.muted),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: note,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText:
                          'Catatan untuk siswa (wajib untuk revisi/ditolak)',
                      filled: true,
                      fillColor: const Color(0xFFF5FAF6),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  ValueListenableBuilder<String>(
                    valueListenable: visibility,
                    builder: (context, selected, _) =>
                        DropdownButtonFormField<String>(
                          initialValue: selected,
                          decoration: InputDecoration(
                            labelText: 'Lingkup saat diterbitkan',
                            prefixIcon: const Icon(Icons.public_rounded),
                            filled: true,
                            fillColor: const Color(0xFFF5FAF6),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'CLASS',
                              child: Text('Kelas — hanya siswa di kelas ini'),
                            ),
                            DropdownMenuItem(
                              value: 'SCHOOL',
                              child: Text(
                                'Sekolah — seluruh siswa satu sekolah',
                              ),
                            ),
                            DropdownMenuItem(
                              value: 'GLOBAL',
                              child: Text('Global — seluruh siswa GenPro'),
                            ),
                          ],
                          onChanged: (value) {
                            if (value != null) visibility.value = value;
                          },
                        ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            if (note.text.trim().isEmpty) {
                              _showNoteRequired(context);
                              return;
                            }
                            Navigator.pop(
                              context,
                              _ReviewDecision('REJECTED', note.text.trim()),
                            );
                          },
                          icon: const Icon(Icons.close_rounded),
                          label: const Text('Tolak'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFDC2626),
                            side: const BorderSide(color: Color(0xFFFECACA)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            if (note.text.trim().isEmpty) {
                              _showNoteRequired(context);
                              return;
                            }
                            Navigator.pop(
                              context,
                              _ReviewDecision(
                                'REVISION_REQUESTED',
                                note.text.trim(),
                              ),
                            );
                          },
                          icon: const Icon(Icons.edit_outlined),
                          label: const Text('Revisi'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => Navigator.pop(
                        context,
                        _ReviewDecision(
                          'PUBLISHED',
                          note.text.trim(),
                          visibility.value,
                        ),
                      ),
                      icon: const Icon(Icons.check_circle_outline_rounded),
                      label: const Text('Setujui & Terbitkan'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    note.dispose();
    visibility.dispose();
    if (result != null) await _review(item, result);
  }

  void _showNoteRequired(BuildContext sheetContext) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Tambahkan catatan untuk siswa terlebih dahulu.'),
      ),
    );
  }

  Future<void> _review(_ReviewItem item, _ReviewDecision decision) async {
    setState(() => _actingId = item.id);
    try {
      final endpoint = item.feature == TeacherReviewFeature.mading
          ? '/api/student-board/posts/${item.id}'
          : '/api/student-spotlight/submissions/${item.id}';
      final response = await ref.read(apiClientProvider).patchJson(endpoint, {
        'status': decision.status,
        if (decision.note.isNotEmpty) 'reviewNote': decision.note,
        if (decision.status == 'PUBLISHED') 'visibility': decision.visibility,
      });
      final raw = item.feature == TeacherReviewFeature.mading
          ? response['post']
          : response['submission'];
      if (raw is Map) {
        final updated = item.feature == TeacherReviewFeature.mading
            ? _ReviewItem.fromMading(Map<String, dynamic>.from(raw))
            : _ReviewItem.fromSpotlight(Map<String, dynamic>.from(raw));
        if (mounted) {
          setState(() {
            _items = _items
                .map((current) => current.id == item.id ? updated : current)
                .toList();
          });
        }
      } else {
        await _load();
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_decisionMessage(decision.status))),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _actingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = _visible.where((item) => item.status == 'PENDING_REVIEW');
    final history = _visible.where((item) => item.status != 'PENDING_REVIEW');
    return Scaffold(
      backgroundColor: const Color(0xFFF5FAF6),
      appBar: AppBar(
        title: const Text('Review Konten Siswa'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF007A33), Color(0xFF39B54A)],
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x2B007A33),
                    blurRadius: 24,
                    offset: Offset(0, 10),
                  ),
                ],
              ),
              child: const Row(
                children: [
                  Icon(
                    Icons.verified_user_outlined,
                    color: Colors.white,
                    size: 34,
                  ),
                  SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Ruang Moderasi',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Periksa karya siswa sebelum tampil di aplikasi.',
                          style: TextStyle(
                            color: Color(0xFFE8F6EA),
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
                Expanded(
                  child: _featureButton(
                    TeacherReviewFeature.mading,
                    'Mading',
                    Icons.newspaper_outlined,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _featureButton(
                    TeacherReviewFeature.spotlight,
                    'Laporan',
                    Icons.smart_display_outlined,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 70),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              _messageCard(
                Icons.cloud_off_rounded,
                'Data belum dapat dimuat',
                _error!,
                const Color(0xFFDC2626),
              )
            else if (_visible.isEmpty)
              _messageCard(
                Icons.task_alt_rounded,
                'Antrean review sudah bersih',
                'Belum ada kiriman baru dari siswa.',
                const Color(0xFF16A34A),
              )
            else ...[
              _sectionTitle(
                'Menunggu Review',
                pending.length,
                const Color(0xFFD97706),
              ),
              if (pending.isEmpty)
                _messageCard(
                  Icons.task_alt_rounded,
                  'Tidak ada antrean',
                  'Semua kiriman sudah ditangani.',
                  const Color(0xFF16A34A),
                )
              else
                ...pending.map(_reviewCard),
              if (history.isNotEmpty) ...[
                const SizedBox(height: 20),
                _sectionTitle(
                  'Riwayat Terbaru',
                  history.length,
                  AppColors.blue,
                ),
                ...history.map(_reviewCard),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _featureButton(
    TeacherReviewFeature value,
    String label,
    IconData icon,
  ) {
    final active = _feature == value;
    final count = _pendingCount(value);
    return InkWell(
      onTap: () {
        if (value == TeacherReviewFeature.spotlight) {
          Navigator.push<void>(
            context,
            MaterialPageRoute(
              builder: (_) => const TeacherSpotlightReportsScreen(),
            ),
          );
          return;
        }
        setState(() => _feature = value);
      },
      borderRadius: BorderRadius.circular(18),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: active ? AppColors.blue : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: active ? AppColors.blue : AppColors.border),
          boxShadow: active
              ? const [
                  BoxShadow(
                    color: Color(0x26007A33),
                    blurRadius: 16,
                    offset: Offset(0, 7),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            Icon(icon, color: active ? Colors.white : AppColors.blue),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: active ? Colors.white : const Color(0xFF172033),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            if (count > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: active ? Colors.white : const Color(0xFFFFF3D6),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    color: active ? AppColors.blue : const Color(0xFFB45309),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String label, int count, Color color) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
        ),
        Text(
          '$count konten',
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );

  Widget _reviewCard(_ReviewItem item) {
    final pending = item.status == 'PENDING_REVIEW';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: pending ? const Color(0xFFFDE2A8) : AppColors.border,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D0F172A),
            blurRadius: 14,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: pending
                      ? const Color(0xFFFFF5DA)
                      : const Color(0xFFE8F6EA),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  item.feature == TeacherReviewFeature.mading
                      ? Icons.newspaper_outlined
                      : Icons.smart_display_outlined,
                  color: pending ? const Color(0xFFD97706) : AppColors.blue,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.studentName,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${item.className} · ${_visibilityLabel(item.visibility)} · ${_statusLabel(item.status)}',
                      style: TextStyle(
                        color: pending
                            ? const Color(0xFFD97706)
                            : AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 13),
          Text(
            item.title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 5),
          Text(
            item.content,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: AppColors.muted, height: 1.45),
          ),
          if (item.imageUrl != null && item.imageUrl!.isNotEmpty) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Image.network(
                _mediaUrl(item.imageUrl!),
                height: 150,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
          ],
          if (item.reviewNote?.isNotEmpty == true) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E8),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Catatan: ${item.reviewNote}',
                style: const TextStyle(color: Color(0xFF92400E), fontSize: 12),
              ),
            ),
          ],
          if (pending) ...[
            const SizedBox(height: 13),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _actingId == item.id
                    ? null
                    : () => _openReview(item),
                icon: _actingId == item.id
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.fact_check_outlined),
                label: const Text('Review Sekarang'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _messageCard(
    IconData icon,
    String title,
    String message,
    Color color,
  ) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 36),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      children: [
        Icon(icon, color: color, size: 42),
        const SizedBox(height: 12),
        Text(
          title,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 6),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.muted),
        ),
      ],
    ),
  );
}

class _ReviewDecision {
  const _ReviewDecision(this.status, this.note, [this.visibility = 'CLASS']);
  final String status;
  final String note;
  final String visibility;
}

class _ReviewItem {
  const _ReviewItem({
    required this.id,
    required this.feature,
    required this.title,
    required this.content,
    required this.status,
    required this.studentName,
    required this.className,
    required this.visibility,
    required this.createdAt,
    this.imageUrl,
    this.reviewNote,
  });
  final String id;
  final TeacherReviewFeature feature;
  final String title;
  final String content;
  final String status;
  final String studentName;
  final String className;
  final String visibility;
  final DateTime createdAt;
  final String? imageUrl;
  final String? reviewNote;

  factory _ReviewItem.fromMading(Map<String, dynamic> json) => _ReviewItem(
    id: '${json['id']}',
    feature: TeacherReviewFeature.mading,
    title: '${json['title'] ?? 'Mading Siswa'}',
    content: '${json['content'] ?? ''}',
    status: '${json['status'] ?? ''}',
    studentName:
        _nestedName(json['student']) ?? _nestedName(json['author']) ?? 'Siswa',
    className: _nestedName(json['classRoom']) ?? 'Kelas',
    visibility: '${json['visibility'] ?? 'CLASS'}',
    createdAt: DateTime.tryParse('${json['createdAt']}') ?? DateTime.now(),
    imageUrl: json['imageUrl']?.toString(),
    reviewNote: json['reviewNote']?.toString(),
  );

  factory _ReviewItem.fromSpotlight(Map<String, dynamic> json) => _ReviewItem(
    id: '${json['id']}',
    feature: TeacherReviewFeature.spotlight,
    title: 'Zona Kreasi ${_nestedName(json['student']) ?? 'Siswa'}',
    content: '${json['caption'] ?? ''}',
    status: '${json['status'] ?? ''}',
    studentName: _nestedName(json['student']) ?? 'Siswa',
    className: _nestedName(json['classRoom']) ?? 'Kelas',
    visibility: '${json['visibility'] ?? 'CLASS'}',
    createdAt: DateTime.tryParse('${json['createdAt']}') ?? DateTime.now(),
    imageUrl: json['thumbnailUrl']?.toString().trim().isNotEmpty == true
        ? json['thumbnailUrl']?.toString()
        : _isImageMediaUrl('${json['videoUrl']}')
        ? json['videoUrl']?.toString()
        : null,
    reviewNote: json['reviewNote']?.toString(),
  );
}

String? _nestedName(dynamic value) =>
    value is Map ? value['name']?.toString() : null;
bool _isImageMediaUrl(String value) {
  final path = Uri.tryParse(value)?.path.toLowerCase() ?? value.toLowerCase();
  return path.endsWith('.jpg') ||
      path.endsWith('.jpeg') ||
      path.endsWith('.png') ||
      path.endsWith('.webp');
}

String _statusLabel(String status) => switch (status) {
  'PENDING_REVIEW' => 'Menunggu review',
  'PUBLISHED' => 'Terbit',
  'REVISION_REQUESTED' => 'Perlu revisi',
  'REJECTED' => 'Ditolak',
  _ => status,
};
String _visibilityLabel(String visibility) => switch (visibility) {
  'GLOBAL' => 'Global',
  'SCHOOL' => 'Sekolah',
  _ => 'Kelas',
};
String _decisionMessage(String status) => switch (status) {
  'PUBLISHED' => 'Konten disetujui dan sudah diterbitkan.',
  'REVISION_REQUESTED' => 'Permintaan revisi dikirim kepada siswa.',
  _ => 'Konten ditolak dan siswa menerima catatan.',
};
String _mediaUrl(String value) =>
    value.startsWith('http://') || value.startsWith('https://')
    ? value
    : Uri.parse(AppConfig.baseUrl).resolve(value).toString();
