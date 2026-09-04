import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/dashboard_components.dart';

Future<void> _loadPlusJakartaSans() async {
  final loader = FontLoader('PlusJakartaSans');
  for (final weight in const [
    'Regular',
    'Medium',
    'SemiBold',
    'Bold',
    'ExtraBold',
  ]) {
    loader.addFont(
      rootBundle.load(
        'assets/fonts/plus_jakarta_sans/PlusJakartaSans-$weight.ttf',
      ),
    );
  }
  await loader.load();
}

void main() {
  setUpAll(_loadPlusJakartaSans);

  testWidgets('Plus Jakarta Sans aman pada menu cepat layar Android sempit', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const definitions = [
      ('Absensi', 'absensi.png', Icons.event_available_rounded),
      ('Tugas', 'tugas.png', Icons.assignment_turned_in_rounded),
      ('Quiz', 'quiz.png', Icons.quiz_rounded),
      ('PJJ', 'pjj.png', Icons.video_camera_front_rounded),
      ('TKA', 'tka.png', Icons.psychology_outlined),
      ('Zona Baca', 'zona_baca.png', Icons.auto_stories_rounded),
      ('Zona Kreasi', 'zona_kreasi.png', Icons.smart_display_rounded),
      ('Mading', 'mading.png', Icons.newspaper_rounded),
    ];

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(320, 700),
            textScaler: TextScaler.linear(1.3),
          ),
          child: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(12),
              child: QuickMenuGrid(
                dense: true,
                frameless: true,
                items: definitions
                    .map(
                      (item) => QuickMenuItem(
                        label: item.$1,
                        icon: item.$3,
                        color: AppColors.blue,
                        assetPath: 'assets/icons/menu/${item.$2}',
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 250)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Zona Kreasi'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(QuickMenuGrid),
      matchesGoldenFile('goldens/plus_jakarta_quick_menu_narrow.png'),
    );
  });
}
