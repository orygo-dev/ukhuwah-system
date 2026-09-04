import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';

class TeacherSpotlightReportsScreen extends ConsumerStatefulWidget {
  const TeacherSpotlightReportsScreen({super.key});

  @override
  ConsumerState<TeacherSpotlightReportsScreen> createState() =>
      _TeacherSpotlightReportsScreenState();
}

class _TeacherSpotlightReportsScreenState
    extends ConsumerState<TeacherSpotlightReportsScreen> {
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;
  String? _error;
  String? _actingId;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_load);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await ref
          .read(apiClientProvider)
          .getJson('/api/student-spotlight/reports');
      final items = (response['items'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
      if (mounted) setState(() => _items = items);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openAction(Map<String, dynamic> item) async {
    final note = TextEditingController();
    final autoHidden = item['autoHidden'] == true;
    final action = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
        ),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: SafeArea(
            top: false,
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
                  'Tindakan moderasi',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Periksa konteks laporan sebelum mengambil keputusan.',
                  style: TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: note,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Catatan moderator (wajib jika disembunyikan)',
                    filled: true,
                    fillColor: const Color(0xFFF7F9FC),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          if (note.text.trim().isEmpty) {
                            _noteRequired();
                            return;
                          }
                          Navigator.pop(sheetContext, 'HIDE');
                        },
                        icon: const Icon(Icons.visibility_off_outlined),
                        label: const Text('Sembunyikan'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          if (note.text.trim().isEmpty) {
                            _noteRequired();
                            return;
                          }
                          Navigator.pop(sheetContext, 'REMOVE');
                        },
                        icon: const Icon(Icons.delete_outline_rounded),
                        label: const Text('Hapus'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFDC2626),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => Navigator.pop(
                      sheetContext,
                      autoHidden ? 'RESTORE' : 'KEEP',
                    ),
                    icon: const Icon(Icons.check_circle_outline_rounded),
                    label: Text(
                      autoHidden ? 'Pulihkan Zona Kreasi' : 'Tetap Tampilkan',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    final moderatorNote = note.text.trim();
    note.dispose();
    if (action != null) await _moderate(item, action, moderatorNote);
  }

  void _noteRequired() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Tambahkan catatan moderator dahulu.')),
    );
  }

  Future<void> _moderate(
    Map<String, dynamic> item,
    String action,
    String note,
  ) async {
    final id = '${item['id']}';
    setState(() => _actingId = id);
    try {
      final response = await ref.read(apiClientProvider).patchJson(
        '/api/student-spotlight/reports/$id',
        {'action': action, if (note.isNotEmpty) 'note': note},
      );
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${response['message'] ?? 'Laporan ditangani.'}'),
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
      if (mounted) setState(() => _actingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final open = _items
        .where((item) => (item['openReportCount'] as num? ?? 0) > 0)
        .toList();
    return Scaffold(
      backgroundColor: const Color(0xFFF5F8FD),
      appBar: AppBar(
        title: const Text('Laporan Zona Kreasi'),
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
                  colors: [Color(0xFF7C2D12), Color(0xFFEA580C)],
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Row(
                children: [
                  Icon(Icons.shield_outlined, color: Colors.white, size: 34),
                  SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Moderasi berbasis laporan',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Zona Kreasi langsung terbit. Tindak hanya konten yang melanggar.',
                          style: TextStyle(
                            color: Color(0xFFFFEDD5),
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 70),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              _InfoCard(
                icon: Icons.cloud_off_rounded,
                title: 'Laporan belum dapat dimuat',
                message: _error!,
                color: const Color(0xFFDC2626),
              )
            else if (open.isEmpty)
              const _InfoCard(
                icon: Icons.task_alt_rounded,
                title: 'Tidak ada laporan terbuka',
                message: 'Semua laporan Zona Kreasi sudah ditangani.',
                color: Color(0xFF16A34A),
              )
            else
              ...open.map(_reportCard),
          ],
        ),
      ),
    );
  }

  Widget _reportCard(Map<String, dynamic> item) {
    final student = item['student'] is Map
        ? '${(item['student'] as Map)['name'] ?? 'Siswa'}'
        : 'Siswa';
    final classroom = item['classRoom'] is Map
        ? '${(item['classRoom'] as Map)['name'] ?? 'Kelas'}'
        : 'Kelas';
    final reports = (item['reports'] as List? ?? const [])
        .whereType<Map>()
        .where((report) => report['status'] == 'OPEN')
        .toList();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.flag_outlined, color: Color(0xFFDC2626)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '$student · $classroom',
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                Text('${reports.length} laporan'),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              '${item['caption'] ?? ''}',
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            ...reports.take(3).map((report) {
              final reporter = report['reporter'] is Map
                  ? '${(report['reporter'] as Map)['name'] ?? 'Pengguna'}'
                  : 'Pengguna';
              return Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 7),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Text(
                  '${_reasonLabel('${report['reason']}')} · $reporter',
                ),
              );
            }),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _actingId == '${item['id']}'
                    ? null
                    : () => _openAction(item),
                icon: const Icon(Icons.gavel_rounded),
                label: const Text('Periksa & Tindak'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _reasonLabel(String reason) => switch (reason) {
  'INAPPROPRIATE' => 'Konten tidak pantas',
  'BULLYING' => 'Perundungan',
  'VIOLENCE' => 'Kekerasan',
  'SEXUAL_CONTENT' => 'Konten seksual',
  'SPAM' => 'Spam',
  'PRIVACY' => 'Pelanggaran privasi',
  _ => 'Lainnya',
};

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.icon,
    required this.title,
    required this.message,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String message;
  final Color color;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        children: [
          Icon(icon, color: color, size: 42),
          const SizedBox(height: 10),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 5),
          Text(message, textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}
