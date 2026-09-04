import 'package:flutter/material.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final size = compact ? 36.0 : 44.0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(13),
          child: Image.asset(
            'assets/images/app_launcher_icon.png',
            width: size,
            height: size,
            fit: BoxFit.cover,
            filterQuality: FilterQuality.high,
          ),
        ),
        const SizedBox(width: 10),
        Text(
          'UKHUWAH',
          style: TextStyle(
            fontSize: compact ? 20 : 25,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.8,
            color: const Color(0xFF007A33),
          ),
        ),
      ],
    );
  }
}
