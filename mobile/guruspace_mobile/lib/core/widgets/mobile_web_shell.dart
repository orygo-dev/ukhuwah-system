import 'package:flutter/material.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';

class MobileWebHeader extends StatelessWidget implements PreferredSizeWidget {
  const MobileWebHeader({
    super.key,
    this.onNotifications,
    this.onMenu,
    this.notificationCount = 0,
    this.showMenu = false,
  });

  final VoidCallback? onNotifications;
  final VoidCallback? onMenu;
  final int notificationCount;
  final bool showMenu;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      automaticallyImplyLeading: false,
      toolbarHeight: 64,
      shape: const Border(bottom: BorderSide(color: AppColors.border)),
      titleSpacing: 16,
      title: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _BrandMark(),
          SizedBox(width: 10),
          Text(
            'GuruSpace',
            style: TextStyle(
              color: AppColors.blue,
              fontSize: 20,
              fontWeight: FontWeight.w900,
              letterSpacing: -.6,
            ),
          ),
        ],
      ),
      actions: [
        _HeaderButton(
          icon: Icons.notifications_none_rounded,
          onTap: onNotifications,
          badge: notificationCount,
          tooltip: 'Pemberitahuan',
        ),
        if (showMenu)
          _HeaderButton(
            icon: Icons.grid_view_rounded,
            onTap: onMenu,
            tooltip: 'Semua menu',
          ),
        const SizedBox(width: 8),
      ],
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        gradient: AppGradients.brand,
        shape: BoxShape.circle,
        boxShadow: const [
          BoxShadow(
            color: Color(0x33007A33),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: const Text(
        'G',
        style: TextStyle(
          color: Colors.white,
          fontSize: 19,
          fontWeight: FontWeight.w900,
          letterSpacing: -1,
        ),
      ),
    );
  }
}

class _HeaderButton extends StatelessWidget {
  const _HeaderButton({
    required this.icon,
    required this.onTap,
    required this.tooltip,
    this.badge = 0,
  });
  final IconData icon;
  final VoidCallback? onTap;
  final String tooltip;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 8),
          child: IconButton(
            tooltip: tooltip,
            onPressed: onTap,
            style: IconButton.styleFrom(
              backgroundColor: AppColors.surfaceMuted,
              foregroundColor: AppColors.navy,
              minimumSize: const Size.square(40),
            ),
            icon: Icon(icon, size: 21),
          ),
        ),
        if (badge > 0)
          Positioned(
            right: 2,
            top: 6,
            child: Container(
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              padding: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(
                color: AppColors.danger,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              alignment: Alignment.center,
              child: Text(
                badge > 99 ? '99+' : '$badge',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 8,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class WebBottomNavItem {
  const WebBottomNavItem({
    required this.label,
    required this.icon,
    this.activeIcon,
    this.primary = false,
  });
  final String label;
  final IconData icon;
  final IconData? activeIcon;
  final bool primary;

  IconData resolvedIcon(bool selected) =>
      selected ? (activeIcon ?? icon) : icon;
}

enum MobileBottomNavStyle { standard, student }

class MobileWebBottomNav extends StatelessWidget {
  const MobileWebBottomNav({
    super.key,
    required this.items,
    required this.index,
    required this.onChanged,
    this.style = MobileBottomNavStyle.standard,
  });
  final List<WebBottomNavItem> items;
  final int index;
  final ValueChanged<int> onChanged;
  final MobileBottomNavStyle style;

  @override
  Widget build(BuildContext context) {
    if (style == MobileBottomNavStyle.student) {
      return _StudentModernBottomNav(
        items: items,
        index: index,
        onChanged: onChanged,
      );
    }
    return SafeArea(
      top: false,
      child: Container(
        height: 76,
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.border)),
          boxShadow: [
            BoxShadow(
              color: Color(0x140F172A),
              blurRadius: 22,
              offset: Offset(0, -8),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(items.length, (i) {
            final item = items[i];
            final selected = i == index;
            return Expanded(
              child: InkResponse(
                onTap: () => onChanged(i),
                child: SizedBox(
                  height: 76,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Transform.translate(
                        offset: Offset(0, item.primary ? -11 : 0),
                        child: Container(
                          width: item.primary ? 56 : 38,
                          height: item.primary ? 56 : 34,
                          decoration: BoxDecoration(
                            gradient: item.primary
                                ? const LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      AppColors.blue,
                                      AppColors.blueBright,
                                    ],
                                  )
                                : null,
                            color: item.primary
                                ? null
                                : selected
                                ? AppColors.blueSoft
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(
                              item.primary ? 19 : 14,
                            ),
                            boxShadow: item.primary
                                ? const [
                                    BoxShadow(
                                      color: Color(0x52007A33),
                                      blurRadius: 22,
                                      offset: Offset(0, 10),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Icon(
                            item.resolvedIcon(selected),
                            size: item.primary ? 26 : 22,
                            color: item.primary
                                ? Colors.white
                                : selected
                                ? AppColors.blue
                                : const Color(0xFF64748B),
                          ),
                        ),
                      ),
                      Transform.translate(
                        offset: Offset(0, item.primary ? -8 : 2),
                        child: Text(
                          item.label,
                          maxLines: 1,
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: selected
                                ? FontWeight.w800
                                : FontWeight.w600,
                            color: selected
                                ? AppColors.blue
                                : const Color(0xFF64748B),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _StudentModernBottomNav extends StatelessWidget {
  const _StudentModernBottomNav({
    required this.items,
    required this.index,
    required this.onChanged,
  });

  final List<WebBottomNavItem> items;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    minimum: const EdgeInsets.fromLTRB(12, 0, 12, 8),
    child: Container(
      key: const Key('student-bottom-navigation'),
      height: 78,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .98),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0xFFD7E8D9)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x260B3679),
            blurRadius: 28,
            offset: Offset(0, 10),
          ),
          BoxShadow(
            color: Color(0x0D1E64D8),
            blurRadius: 4,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: List.generate(items.length, (i) {
          final item = items[i];
          return Expanded(
            child: _StudentBottomNavItem(
              item: item,
              selected: index == i,
              onTap: () => onChanged(i),
            ),
          );
        }),
      ),
    ),
  );
}

class _StudentBottomNavItem extends StatelessWidget {
  const _StudentBottomNavItem({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final WebBottomNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final keyLabel = item.label.toLowerCase().replaceAll(' ', '-');
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: Key('student-bottom-$keyLabel'),
          onTap: onTap,
          borderRadius: BorderRadius.circular(22),
          splashColor: const Color(0x1F2165E8),
          highlightColor: const Color(0x102165E8),
          child: SizedBox.expand(
            child: item.primary
                ? _StudentPrimaryNavContent(item: item, selected: selected)
                : _StudentRegularNavContent(item: item, selected: selected),
          ),
        ),
      ),
    );
  }
}

class _StudentPrimaryNavContent extends StatelessWidget {
  const _StudentPrimaryNavContent({required this.item, required this.selected});

  final WebBottomNavItem item;
  final bool selected;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Transform.translate(
        offset: const Offset(0, -11),
        child: AnimatedScale(
          scale: selected ? 1.07 : 1,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutBack,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF0B5A26),
                  Color(0xFF007A33),
                  Color(0xFF39B54A),
                ],
              ),
              borderRadius: BorderRadius.circular(21),
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: [
                BoxShadow(
                  color: const Color(
                    0xFF007A33,
                  ).withValues(alpha: selected ? .46 : .32),
                  blurRadius: selected ? 25 : 18,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Positioned(
                  top: 8,
                  left: 11,
                  child: Container(
                    width: 17,
                    height: 7,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .18),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                Icon(
                  item.resolvedIcon(selected),
                  color: Colors.white,
                  size: 28,
                ),
              ],
            ),
          ),
        ),
      ),
      Transform.translate(
        offset: const Offset(0, -8),
        child: Text(
          item.label,
          style: TextStyle(
            color: const Color(0xFF007A33),
            fontSize: 10.5,
            fontWeight: selected ? FontWeight.w900 : FontWeight.w800,
            letterSpacing: -.1,
          ),
        ),
      ),
    ],
  );
}

class _StudentRegularNavContent extends StatelessWidget {
  const _StudentRegularNavContent({required this.item, required this.selected});

  final WebBottomNavItem item;
  final bool selected;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        width: 43,
        height: 34,
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFE8F6EA) : Colors.transparent,
          borderRadius: BorderRadius.circular(13),
          border: selected ? Border.all(color: const Color(0xFFD7E8D9)) : null,
        ),
        child: Icon(
          item.resolvedIcon(selected),
          size: 22,
          color: selected ? const Color(0xFF007A33) : const Color(0xFF667085),
        ),
      ),
      const SizedBox(height: 3),
      Text(
        item.label,
        maxLines: 1,
        overflow: TextOverflow.fade,
        softWrap: false,
        style: TextStyle(
          fontSize: 9.8,
          fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
          color: selected ? const Color(0xFF007A33) : const Color(0xFF667085),
        ),
      ),
      AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        margin: const EdgeInsets.only(top: 3),
        width: selected ? 16 : 0,
        height: 3,
        decoration: BoxDecoration(
          color: const Color(0xFF007A33),
          borderRadius: BorderRadius.circular(99),
        ),
      ),
    ],
  );
}

class PageIntro extends StatelessWidget {
  const PageIntro({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.description,
    this.icon = Icons.auto_awesome_rounded,
  });
  final String eyebrow;
  final String title;
  final String description;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.large),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.blueSoft,
              borderRadius: BorderRadius.circular(AppRadii.medium),
            ),
            child: Icon(icon, color: AppColors.blue, size: 23),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  eyebrow.toUpperCase(),
                  style: const TextStyle(
                    color: AppColors.blue,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .9,
                  ),
                ),
                const SizedBox(height: 3),
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 3),
                Text(
                  description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
