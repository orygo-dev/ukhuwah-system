import 'package:flutter/material.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: compact ? 36 : 44,
          height: compact ? 36 : 44,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.blue, AppColors.cyan],
            ),
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(
            Icons.school_rounded,
            color: Colors.white,
            size: compact ? 22 : 27,
          ),
        ),
        const SizedBox(width: 10),
        Text(
          'GuruSpace',
          style: TextStyle(
            fontSize: compact ? 20 : 25,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.8,
            color: AppColors.navy,
          ),
        ),
      ],
    );
  }
}
