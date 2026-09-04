import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/network/api_exception.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/features/auth/domain/auth_state.dart';
import 'package:guruspace_mobile/features/dashboard/domain/app_display_models.dart';

class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final variant = ref.watch(appVariantProvider);
    final branding = ref.watch(mobileAppDisplayProvider).asData?.value.branding;
    return LoginPageView(
      appName: variant.displayName,
      branding: branding,
      loading: auth.status == AuthStatus.authenticating,
      errorMessage: auth.errorMessage,
      onForgotPassword: (email) => _openForgotPassword(
        context,
        initialEmail: email,
        requestOtp: ref.read(authRepositoryProvider).requestPasswordReset,
        resetPassword: ref.read(authRepositoryProvider).resetPassword,
      ),
      onSubmit: (email, password) =>
          ref.read(authControllerProvider.notifier).login(email, password),
    );
  }
}

class LoginPageView extends StatefulWidget {
  const LoginPageView({
    super.key,
    required this.onSubmit,
    this.loading = false,
    this.errorMessage,
    this.branding,
    this.appName = 'GenPro',
    this.onForgotPassword,
  });

  final Future<void> Function(String email, String password) onSubmit;
  final bool loading;
  final String? errorMessage;
  final MobileBrandingDisplay? branding;
  final String appName;
  final Future<void> Function(String initialEmail)? onForgotPassword;

  @override
  State<LoginPageView> createState() => _LoginPageViewState();
}

class _LoginPageViewState extends State<LoginPageView> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate() || widget.loading) return;
    await widget.onSubmit(
      _emailController.text.trim(),
      _passwordController.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0753DC),
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset('assets/images/splash_background.png', fit: BoxFit.cover),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxHeight < 720;
                return SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight,
                    ),
                    child: IntrinsicHeight(
                      child: Column(
                        children: [
                          if (!compact)
                            const Spacer()
                          else
                            const SizedBox(height: 8),
                          _LoginHero(
                            compact: compact,
                            height: compact ? 134 : 148,
                            branding: widget.branding,
                            appName: widget.appName,
                          ),
                          _LoginFormSurface(
                            compact: compact,
                            formKey: _formKey,
                            emailController: _emailController,
                            passwordController: _passwordController,
                            obscurePassword: _obscurePassword,
                            onTogglePassword: widget.loading
                                ? null
                                : () => setState(
                                    () => _obscurePassword = !_obscurePassword,
                                  ),
                            loading: widget.loading,
                            errorMessage: widget.errorMessage,
                            onSubmit: _submit,
                            onForgotPassword: widget.loading
                                ? null
                                : () => widget.onForgotPassword?.call(
                                    _emailController.text.trim(),
                                  ),
                          ),
                          if (!compact)
                            const Spacer()
                          else
                            const SizedBox(height: 8),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14),
                            child: _LoginPoweredBy(),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _LoginHero extends StatelessWidget {
  const _LoginHero({
    required this.compact,
    required this.height,
    required this.branding,
    required this.appName,
  });

  final bool compact;
  final double height;
  final MobileBrandingDisplay? branding;
  final String appName;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: Padding(
        padding: EdgeInsets.only(top: compact ? 12 : 20, bottom: 14),
        child: Column(
          children: [
            _WhiteBrand(branding: branding, appName: appName),
            const Spacer(),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                'Selamat datang kembali',
                textAlign: TextAlign.center,
                maxLines: 1,
                style: TextStyle(
                  color: const Color(0xFF102B60),
                  fontSize: compact ? 24 : 28,
                  height: 1.08,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -.7,
                ),
              ),
            ),
            const SizedBox(height: 7),
            const FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                'Masuk untuk melanjutkan aktivitasmu',
                textAlign: TextAlign.center,
                maxLines: 1,
                style: TextStyle(
                  color: Color(0xFF6B7D9F),
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WhiteBrand extends StatelessWidget {
  const _WhiteBrand({required this.branding, required this.appName});

  final MobileBrandingDisplay? branding;
  final String appName;

  @override
  Widget build(BuildContext context) {
    final logoUrl = branding?.loginLogoUrl ?? '';
    final resolvedAppName = branding?.appName.trim().isNotEmpty == true
        ? branding!.appName
        : appName;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          constraints: const BoxConstraints(maxWidth: 210),
          height: 58,
          child: logoUrl.isNotEmpty
              ? Image.network(
                  _resolveBrandUrl(logoUrl),
                  fit: BoxFit.contain,
                  filterQuality: FilterQuality.high,
                  errorBuilder: (_, _, _) =>
                      _BrandFallback(appName: resolvedAppName),
                )
              : _BrandFallback(appName: resolvedAppName),
        ),
      ],
    );
  }
}

class _BrandFallback extends StatelessWidget {
  const _BrandFallback({required this.appName});

  final String appName;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Flexible(
        child: Text(
          appName,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Color(0xFF1554BF),
            fontSize: 28,
            fontWeight: FontWeight.w900,
            letterSpacing: -.8,
          ),
        ),
      ),
    ],
  );
}

class _LoginFormSurface extends StatelessWidget {
  const _LoginFormSurface({
    required this.compact,
    required this.formKey,
    required this.emailController,
    required this.passwordController,
    required this.obscurePassword,
    required this.onTogglePassword,
    required this.loading,
    required this.errorMessage,
    required this.onSubmit,
    required this.onForgotPassword,
  });

  final bool compact;
  final GlobalKey<FormState> formKey;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final bool obscurePassword;
  final VoidCallback? onTogglePassword;
  final bool loading;
  final String? errorMessage;
  final VoidCallback onSubmit;
  final VoidCallback? onForgotPassword;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 440),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .88),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: const Color(0xBFFFFFFF), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Color(0x26103475),
            blurRadius: 32,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              compact ? 22 : 26,
              20,
              compact ? 22 : 26,
            ),
            child: AutofillGroup(
              child: Form(
                key: formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      key: const Key('login-email'),
                      controller: emailController,
                      enabled: !loading,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        prefixIcon: Icon(Icons.mail_outline_rounded),
                      ),
                      validator: (value) {
                        final email = value?.trim() ?? '';
                        if (!email.contains('@') || !email.contains('.')) {
                          return 'Masukkan email yang valid.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 15),
                    TextFormField(
                      key: const Key('login-password'),
                      controller: passwordController,
                      enabled: !loading,
                      obscureText: obscurePassword,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      onFieldSubmitted: (_) => onSubmit(),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          tooltip: obscurePassword
                              ? 'Tampilkan password'
                              : 'Sembunyikan password',
                          onPressed: onTogglePassword,
                          icon: Icon(
                            obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (value) => (value?.length ?? 0) < 6
                          ? 'Password minimal 6 karakter.'
                          : null,
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        key: const Key('forgot-password-button'),
                        onPressed: onForgotPassword,
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.fromLTRB(12, 8, 2, 4),
                          minimumSize: const Size(0, 36),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text(
                          'Lupa password?',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                    if (errorMessage != null) ...[
                      const SizedBox(height: 14),
                      _LoginError(message: errorMessage!),
                    ],
                    SizedBox(height: compact ? 20 : 24),
                    _GradientLoginButton(
                      loading: loading,
                      onPressed: loading ? null : onSubmit,
                    ),
                    SizedBox(height: compact ? 18 : 24),
                    const _SecureSessionNote(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

Future<void> _openForgotPassword(
  BuildContext context, {
  required String initialEmail,
  required Future<String> Function(String email) requestOtp,
  required Future<String> Function({
    required String email,
    required String code,
    required String password,
  })
  resetPassword,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => ForgotPasswordSheet(
      initialEmail: initialEmail,
      requestOtp: requestOtp,
      resetPassword: resetPassword,
    ),
  );
}

class ForgotPasswordSheet extends StatefulWidget {
  const ForgotPasswordSheet({
    super.key,
    required this.initialEmail,
    required this.requestOtp,
    required this.resetPassword,
  });

  final String initialEmail;
  final Future<String> Function(String email) requestOtp;
  final Future<String> Function({
    required String email,
    required String code,
    required String password,
  })
  resetPassword;

  @override
  State<ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<ForgotPasswordSheet> {
  final _emailKey = GlobalKey<FormState>();
  final _resetKey = GlobalKey<FormState>();
  late final TextEditingController _emailController;
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _otpRequested = false;
  bool _loading = false;
  bool _completed = false;
  String? _message;
  String? _error;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _requestOtp() async {
    if (!_emailKey.currentState!.validate() || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final message = await widget.requestOtp(_emailController.text.trim());
      if (!mounted) return;
      setState(() {
        _otpRequested = true;
        _message = message;
      });
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Kode OTP belum dapat dikirim. Coba lagi.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resetPassword() async {
    if (!_resetKey.currentState!.validate() || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final message = await widget.resetPassword(
        email: _emailController.text.trim(),
        code: _otpController.text.trim(),
        password: _passwordController.text,
      );
      if (!mounted) return;
      setState(() {
        _completed = true;
        _message = message;
      });
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Password belum dapat diperbarui. Coba lagi.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    return AnimatedPadding(
      duration: const Duration(milliseconds: 180),
      padding: EdgeInsets.only(bottom: keyboard),
      child: Container(
        key: const Key('forgot-password-sheet'),
        constraints: const BoxConstraints(maxWidth: 520),
        padding: const EdgeInsets.fromLTRB(22, 12, 22, 24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFD7DEEA),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              Container(
                width: 52,
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFE9F1FF),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: Icon(
                  _completed ? Icons.check_rounded : Icons.lock_reset_rounded,
                  color: const Color(0xFF1D5BD7),
                  size: 29,
                ),
              ),
              const SizedBox(height: 15),
              Text(
                _completed ? 'Password berhasil diubah' : 'Lupa password?',
                style: const TextStyle(
                  fontSize: 23,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -.5,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                _completed
                    ? (_message ?? 'Silakan masuk menggunakan password baru.')
                    : _otpRequested
                    ? 'Masukkan kode OTP dari WhatsApp dan buat password baru.'
                    : 'Masukkan email akun siswa. Kode OTP akan dikirim ke nomor WhatsApp yang terdaftar.',
                style: const TextStyle(color: AppColors.muted, height: 1.45),
              ),
              const SizedBox(height: 20),
              if (_completed)
                FilledButton(
                  key: const Key('forgot-password-done'),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Kembali ke Login'),
                )
              else if (!_otpRequested)
                Form(
                  key: _emailKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        key: const Key('forgot-password-email'),
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.done,
                        decoration: const InputDecoration(
                          labelText: 'Email akun siswa',
                          prefixIcon: Icon(Icons.mail_outline_rounded),
                        ),
                        validator: (value) {
                          final email = value?.trim() ?? '';
                          return email.contains('@') && email.contains('.')
                              ? null
                              : 'Masukkan email yang valid.';
                        },
                        onFieldSubmitted: (_) => _requestOtp(),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        key: const Key('forgot-password-request-otp'),
                        onPressed: _loading ? null : _requestOtp,
                        child: Text(
                          _loading ? 'Mengirim...' : 'Kirim Kode OTP',
                        ),
                      ),
                    ],
                  ),
                )
              else
                Form(
                  key: _resetKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        key: const Key('forgot-password-otp'),
                        controller: _otpController,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Kode OTP',
                          prefixIcon: Icon(Icons.pin_outlined),
                        ),
                        validator: (value) => (value?.trim().length ?? 0) < 4
                            ? 'Masukkan kode OTP.'
                            : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        key: const Key('forgot-password-new'),
                        controller: _passwordController,
                        obscureText: true,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Password baru',
                          prefixIcon: Icon(Icons.lock_outline_rounded),
                        ),
                        validator: (value) => (value?.length ?? 0) < 8
                            ? 'Password minimal 8 karakter.'
                            : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        key: const Key('forgot-password-confirm'),
                        controller: _confirmController,
                        obscureText: true,
                        textInputAction: TextInputAction.done,
                        decoration: const InputDecoration(
                          labelText: 'Ulangi password baru',
                          prefixIcon: Icon(Icons.verified_user_outlined),
                        ),
                        validator: (value) => value == _passwordController.text
                            ? null
                            : 'Konfirmasi password tidak sama.',
                        onFieldSubmitted: (_) => _resetPassword(),
                      ),
                      if (_message != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          _message!,
                          style: const TextStyle(
                            color: Color(0xFF426187),
                            fontSize: 12,
                            height: 1.4,
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      FilledButton(
                        key: const Key('forgot-password-submit'),
                        onPressed: _loading ? null : _resetPassword,
                        child: Text(
                          _loading ? 'Menyimpan...' : 'Simpan Password Baru',
                        ),
                      ),
                      TextButton(
                        onPressed: _loading
                            ? null
                            : () => setState(() {
                                _otpRequested = false;
                                _message = null;
                              }),
                        child: const Text('Ganti email'),
                      ),
                    ],
                  ),
                ),
              if (_error != null) ...[
                const SizedBox(height: 13),
                _LoginError(message: _error!),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _GradientLoginButton extends StatefulWidget {
  const _GradientLoginButton({required this.loading, required this.onPressed});

  final bool loading;
  final VoidCallback? onPressed;

  @override
  State<_GradientLoginButton> createState() => _GradientLoginButtonState();
}

class _GradientLoginButtonState extends State<_GradientLoginButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) => AnimatedScale(
    scale: _pressed ? .985 : 1,
    duration: const Duration(milliseconds: 110),
    curve: Curves.easeOut,
    child: Semantics(
      button: true,
      label: 'Masuk Sekarang',
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          height: 58,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [Color(0xFF173DBB), Color(0xFF2166E5), Color(0xFF168BD8)],
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0x3349A4FF)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x44204AD5),
                blurRadius: 24,
                offset: Offset(0, 11),
              ),
              BoxShadow(
                color: Color(0x1FFFFFFF),
                blurRadius: 1,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: InkWell(
            key: const Key('login-submit'),
            onTap: widget.onPressed,
            onHighlightChanged: (value) {
              if (_pressed != value) {
                setState(() => _pressed = value);
              }
            },
            borderRadius: BorderRadius.circular(18),
            splashColor: Colors.white12,
            highlightColor: Colors.white10,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                child: widget.loading
                    ? const Center(
                        key: Key('login-loading'),
                        child: SizedBox.square(
                          dimension: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        ),
                      )
                    : Stack(
                        key: const Key('login-label'),
                        alignment: Alignment.center,
                        children: [
                          const Center(
                            child: Text(
                              'Masuk Sekarang',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                letterSpacing: .1,
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: const Color(0x24FFFFFF),
                                borderRadius: BorderRadius.circular(13),
                                border: Border.all(
                                  color: const Color(0x2EFFFFFF),
                                ),
                              ),
                              child: const Icon(
                                Icons.arrow_forward_rounded,
                                color: Colors.white,
                                size: 20,
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
    ),
  );
}

class _LoginError extends StatelessWidget {
  const _LoginError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(13),
    decoration: BoxDecoration(
      color: const Color(0xFFFEF2F2),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const Color(0xFFFECACA)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(
          Icons.error_outline_rounded,
          color: AppColors.danger,
          size: 20,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            message,
            style: const TextStyle(color: Color(0xFF991B1B), height: 1.4),
          ),
        ),
      ],
    ),
  );
}

class _SecureSessionNote extends StatelessWidget {
  const _SecureSessionNote();

  @override
  Widget build(BuildContext context) => const Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Icon(Icons.verified_user_outlined, color: AppColors.blueBright, size: 21),
      SizedBox(width: 9),
      Flexible(
        child: Text(
          'Sesi Anda dilindungi dengan aman',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.muted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    ],
  );
}

class _LoginPoweredBy extends StatelessWidget {
  const _LoginPoweredBy();

  @override
  Widget build(BuildContext context) => const Text.rich(
    TextSpan(
      style: TextStyle(
        color: Color(0xD9FFFFFF),
        fontSize: 12,
        letterSpacing: .2,
      ),
      children: [
        TextSpan(text: 'powered by '),
        TextSpan(
          text: "iBaenk's",
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
        ),
      ],
    ),
    textAlign: TextAlign.center,
  );
}

String _resolveBrandUrl(String value) {
  final uri = Uri.parse(value.trim());
  return (uri.hasScheme ? uri : Uri.parse(AppConfig.baseUrl).resolveUri(uri))
      .toString();
}
