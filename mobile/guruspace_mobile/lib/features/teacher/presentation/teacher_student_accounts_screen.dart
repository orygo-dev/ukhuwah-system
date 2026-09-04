import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/dashboard/domain/dashboard_models.dart';

class TeacherStudentAccountsScreen extends ConsumerStatefulWidget {
  const TeacherStudentAccountsScreen({
    super.key,
    required this.classRoom,
    required this.attendancePage,
  });

  final TeacherClassItem classRoom;
  final Widget attendancePage;

  @override
  ConsumerState<TeacherStudentAccountsScreen> createState() =>
      _TeacherStudentAccountsScreenState();
}

class _TeacherStudentAccountsScreenState
    extends ConsumerState<TeacherStudentAccountsScreen> {
  List<TeacherStudentAccountItem> _students = const [];
  bool _loading = true;
  bool _refreshing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_load);
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _refreshing = _students.isNotEmpty;
        _loading = _students.isEmpty;
        _error = null;
      });
    }
    try {
      final json = await ref
          .read(apiClientProvider)
          .getJson('/api/attendance/classes/${widget.classRoom.id}');
      final room = Map<String, dynamic>.from(
        json['classRoom'] as Map? ?? const {},
      );
      final students = (room['students'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) => TeacherStudentAccountItem.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList();
      if (mounted) setState(() => _students = students);
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _refreshing = false;
        });
      }
    }
  }

  Future<void> _manageAccount(TeacherStudentAccountItem student) async {
    final result = await showModalBottomSheet<_AccountInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _StudentAccountSheet(student: student),
    );
    if (result == null || !mounted) return;
    try {
      if (student.hasAccount) {
        await ref.read(apiClientProvider).patchJson(
          '/api/students/${student.id}/account',
          {'password': result.password},
        );
        _toast('Password ${student.name} berhasil direset.');
      } else {
        await ref
            .read(apiClientProvider)
            .postJson(
              '/api/students/${student.id}/account',
              data: {
                'email': result.email,
                'password': result.password,
                'name': student.name,
              },
            );
        _toast('Akun login ${student.name} berhasil dibuat.');
      }
      await _load();
    } catch (error) {
      if (mounted) _toast(_message(error), error: true);
    }
  }

  Future<void> _activateBulk() async {
    final pending = _students.where((student) => !student.hasAccount).take(50);
    if (pending.isEmpty) {
      _toast('Semua siswa sudah memiliki akun login.');
      return;
    }
    final domain = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _BulkDomainSheet(studentCount: pending.length),
    );
    if (domain == null || !mounted) return;
    try {
      final json = await ref
          .read(apiClientProvider)
          .postJson(
            '/api/students/accounts/bulk',
            data: {
              'studentIds': pending.map((student) => student.id).toList(),
              'emailDomain': domain,
            },
          );
      final credentials = (json['created'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                _CreatedCredential.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _CredentialsDialog(credentials: credentials),
      );
      await _load();
    } catch (error) {
      if (mounted) _toast(_message(error), error: true);
    }
  }

  void _toast(String message, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: error ? AppColors.danger : AppColors.navy,
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final activeAccounts = _students
        .where((student) => student.hasAccount)
        .length;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.classRoom.name),
        actions: [
          IconButton(
            onPressed: _refreshing ? null : _load,
            tooltip: 'Muat ulang',
            icon: _refreshing
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading
          ? const LoadingView(label: 'Memuat akun siswa...')
          : _error != null && _students.isEmpty
          ? ErrorView(message: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                children: [
                  _AccountSummary(
                    total: _students.length,
                    active: activeAccounts,
                    onBulk: _activateBulk,
                    onAttendance: () => Navigator.of(context).push<void>(
                      MaterialPageRoute(builder: (_) => widget.attendancePage),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  ],
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Akun Login Siswa',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                      Text(
                        '$activeAccounts/${_students.length} aktif',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Guru hanya dapat mengelola akun siswa pada kelas yang diampu.',
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  if (_students.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Center(
                          child: Text('Belum ada siswa di kelas ini.'),
                        ),
                      ),
                    )
                  else
                    ..._students.map(
                      (student) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: TeacherStudentAccountCard(
                          student: student,
                          onManage: () => _manageAccount(student),
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}

class _AccountSummary extends StatelessWidget {
  const _AccountSummary({
    required this.total,
    required this.active,
    required this.onBulk,
    required this.onAttendance,
  });

  final int total;
  final int active;
  final VoidCallback onBulk;
  final VoidCallback onAttendance;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF0B5A26), Color(0xFF39B54A)],
      ),
      borderRadius: BorderRadius.circular(24),
      boxShadow: const [
        BoxShadow(
          color: Color(0x30007A33),
          blurRadius: 24,
          offset: Offset(0, 10),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.admin_panel_settings_outlined, color: Colors.white),
        const SizedBox(height: 12),
        const Text(
          'Kelola akses siswa',
          style: TextStyle(
            color: Colors.white,
            fontSize: 19,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '$active dari $total akun login sudah aktif',
          style: const TextStyle(color: Color(0xFFE8F6EA), fontSize: 12),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.blue,
                ),
                onPressed: total > active ? onBulk : null,
                icon: const Icon(Icons.key_rounded),
                label: const Text('Aktivasi Massal'),
              ),
            ),
            const SizedBox(width: 9),
            IconButton.filledTonal(
              onPressed: onAttendance,
              tooltip: 'Buka absensi',
              icon: const Icon(Icons.fact_check_outlined),
            ),
          ],
        ),
      ],
    ),
  );
}

class TeacherStudentAccountCard extends StatelessWidget {
  const TeacherStudentAccountCard({
    super.key,
    required this.student,
    required this.onManage,
  });

  final TeacherStudentAccountItem student;
  final VoidCallback onManage;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: student.hasAccount
                ? const Color(0xFFDCFCE7)
                : AppColors.blueSoft,
            child: Icon(
              student.hasAccount
                  ? Icons.verified_user_rounded
                  : Icons.person_outline_rounded,
              color: student.hasAccount ? AppColors.success : AppColors.blue,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  student.name,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 3),
                Text(
                  student.email ??
                      (student.nis == null
                          ? 'Belum memiliki akun'
                          : 'NIS ${student.nis}'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: onManage,
            child: Text(student.hasAccount ? 'Reset' : 'Aktifkan'),
          ),
        ],
      ),
    ),
  );
}

class _StudentAccountSheet extends StatefulWidget {
  const _StudentAccountSheet({required this.student});
  final TeacherStudentAccountItem student;

  @override
  State<_StudentAccountSheet> createState() => _StudentAccountSheetState();
}

class _StudentAccountSheetState extends State<_StudentAccountSheet> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _email.text = widget.student.email ?? '';
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    final email = _email.text.trim().toLowerCase();
    if (!widget.student.hasAccount) {
      final validEmail = RegExp(
        r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
      ).hasMatch(email);
      if (!validEmail) {
        setState(() => _error = 'Masukkan email siswa yang valid.');
        return;
      }
    }
    if (_password.text.length < 8) {
      setState(() => _error = 'Password minimal 8 karakter.');
      return;
    }
    Navigator.pop(
      context,
      _AccountInput(email: email, password: _password.text),
    );
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: Container(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              widget.student.hasAccount ? 'Reset Password' : 'Aktifkan Login',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 5),
            Text(
              widget.student.name,
              style: const TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 18),
            if (!widget.student.hasAccount) ...[
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email siswa',
                  prefixIcon: Icon(Icons.mail_outline_rounded),
                ),
              ),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: _password,
              obscureText: _obscure,
              decoration: InputDecoration(
                labelText: widget.student.hasAccount
                    ? 'Password baru'
                    : 'Password awal',
                helperText: 'Minimal 8 karakter',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _obscure = !_obscure),
                  icon: Icon(
                    _obscure
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _submit,
              child: Text(
                widget.student.hasAccount ? 'Simpan Password' : 'Buat Akun',
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _BulkDomainSheet extends StatefulWidget {
  const _BulkDomainSheet({required this.studentCount});
  final int studentCount;

  @override
  State<_BulkDomainSheet> createState() => _BulkDomainSheetState();
}

class _BulkDomainSheetState extends State<_BulkDomainSheet> {
  final _domain = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _domain.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _domain.text.trim().toLowerCase();
    if (!RegExp(
      r'^[a-z0-9.-]+\.[a-z]{2,}$',
      caseSensitive: false,
    ).hasMatch(value)) {
      setState(() => _error = 'Masukkan domain email yang valid.');
      return;
    }
    Navigator.pop(context, value);
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: Container(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Aktivasi Massal',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 6),
            Text(
              'Sistem akan membuat akun untuk ${widget.studentCount} siswa yang belum aktif.',
              style: const TextStyle(color: AppColors.muted, height: 1.4),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _domain,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                labelText: 'Domain email siswa',
                hintText: 'siswa.sekolah.sch.id',
                prefixIcon: Icon(Icons.alternate_email_rounded),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: _submit,
              icon: const Icon(Icons.key_rounded),
              label: const Text('Buat Akun Siswa'),
            ),
          ],
        ),
      ),
    ),
  );
}

class _CredentialsDialog extends StatelessWidget {
  const _CredentialsDialog({required this.credentials});
  final List<_CreatedCredential> credentials;

  Future<void> _copy(BuildContext context) async {
    final text = credentials
        .map(
          (item) =>
              '${item.name}\nEmail: ${item.email}\nPassword: ${item.password}',
        )
        .join('\n\n');
    await Clipboard.setData(ClipboardData(text: text));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kredensial berhasil disalin.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Simpan Kredensial'),
    content: SizedBox(
      width: double.maxFinite,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Password hanya ditampilkan sekali. Salin sebelum menutup halaman ini.',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 12),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: credentials.length,
              separatorBuilder: (_, _) => const Divider(),
              itemBuilder: (_, index) {
                final item = credentials[index];
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(item.name),
                  subtitle: Text('${item.email}\n${item.password}'),
                );
              },
            ),
          ),
        ],
      ),
    ),
    actions: [
      TextButton.icon(
        onPressed: () => _copy(context),
        icon: const Icon(Icons.copy_rounded),
        label: const Text('Salin Semua'),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Selesai'),
      ),
    ],
  );
}

class TeacherStudentAccountItem {
  const TeacherStudentAccountItem({
    required this.id,
    required this.name,
    this.nis,
    this.email,
  });

  final String id;
  final String name;
  final String? nis;
  final String? email;
  bool get hasAccount => email?.isNotEmpty == true;

  factory TeacherStudentAccountItem.fromJson(Map<String, dynamic> json) =>
      TeacherStudentAccountItem(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? 'Siswa',
        nis: json['nis']?.toString(),
        email: (json['user'] as Map?)?['email']?.toString(),
      );
}

class _CreatedCredential {
  const _CreatedCredential({
    required this.name,
    required this.email,
    required this.password,
  });

  final String name;
  final String email;
  final String password;

  factory _CreatedCredential.fromJson(Map<String, dynamic> json) =>
      _CreatedCredential(
        name: json['name']?.toString() ?? 'Siswa',
        email: json['email']?.toString() ?? '',
        password: json['password']?.toString() ?? '',
      );
}

class _AccountInput {
  const _AccountInput({required this.email, required this.password});
  final String email;
  final String password;
}

String _message(Object error) {
  final value = error.toString();
  return value.startsWith('Exception: ') ? value.substring(11) : value;
}
