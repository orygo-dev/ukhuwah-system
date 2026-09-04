import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/app/guruspace_app.dart';
import 'package:guruspace_mobile/core/config/app_variant.dart';
import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/core/notifications/push_notification_service.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/update/app_update_gate.dart';
import 'package:intl/date_symbol_data_local.dart';

Future<void> bootstrap(AppVariant variant) async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(_BootstrapRoot(variant: variant));
  // Push is optional infrastructure. A slow/outdated Google Play Services
  // implementation must never hold the first Flutter frame hostage.
  unawaited(PushNotificationService.instance.captureLaunchMessage());
}

class _BootstrapRoot extends StatefulWidget {
  const _BootstrapRoot({required this.variant});

  final AppVariant variant;

  @override
  State<_BootstrapRoot> createState() => _BootstrapRootState();
}

class _BootstrapRootState extends State<_BootstrapRoot> {
  late Future<ApiClient> _runtime = _initializeRuntime();

  Future<ApiClient> _initializeRuntime() async {
    try {
      await initializeDateFormatting('id_ID');
      final apiClient = await ApiClient.create();
      unawaited(PushNotificationService.instance.initialize(apiClient));
      return apiClient;
    } catch (error, stackTrace) {
      debugPrint('Bootstrap runtime initialization failed: $error');
      debugPrintStack(stackTrace: stackTrace);
      rethrow;
    }
  }

  void _retry() {
    setState(() {
      _runtime = _initializeRuntime();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ApiClient>(
      future: _runtime,
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          return ProviderScope(
            overrides: [
              apiClientProvider.overrideWithValue(snapshot.data!),
              appVariantProvider.overrideWithValue(widget.variant),
            ],
            child: AppUpdateGate(
              variant: widget.variant,
              child: const GuruSpaceApp(),
            ),
          );
        }
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          home: Scaffold(
            backgroundColor: Colors.white,
            body: snapshot.hasError
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(28),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.cloud_off_rounded,
                            size: 48,
                            color: Color(0xFF007A33),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'UKHUWAH Mobile belum dapat disiapkan.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F2418),
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Tutup aplikasi, buka kembali, lalu coba lagi.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Color(0xFF5E6F5E)),
                          ),
                          const SizedBox(height: 20),
                          FilledButton.icon(
                            onPressed: _retry,
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('Coba lagi'),
                          ),
                        ],
                      ),
                    ),
                  )
                : SafeArea(
                    child: Column(
                      children: [
                        const Spacer(),
                        Center(
                          child: Image.asset(
                            'assets/images/native_splash_logo.png',
                            width: 280,
                            errorBuilder: (_, _, _) => const SizedBox(
                              width: 32,
                              height: 32,
                              child: CircularProgressIndicator(
                                strokeWidth: 3,
                                color: Color(0xFF39B54A),
                              ),
                            ),
                          ),
                        ),
                        const Spacer(),
                        const Padding(
                          padding: EdgeInsets.only(bottom: 24),
                          child: Text(
                            "Powered by iBaenk's",
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFF5E6F5E),
                              fontSize: 12,
                              letterSpacing: 1.4,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        );
      },
    );
  }
}
