import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/ads/mobile_ad_config.dart';
import 'package:guruspace_mobile/core/ads/student_admob_banner.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:guruspace_mobile/core/widgets/async_content.dart';
import 'package:guruspace_mobile/features/shared/presentation/notifications_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_ebook_reader_screen.dart';

class StudentReadingScreen extends ConsumerStatefulWidget {
  const StudentReadingScreen({super.key, this.loadBooks});

  final Future<List<Map<String, dynamic>>> Function()? loadBooks;

  @override
  ConsumerState<StudentReadingScreen> createState() =>
      _StudentReadingScreenState();
}

class _StudentReadingScreenState extends ConsumerState<StudentReadingScreen> {
  late Future<List<_ReadingBook>> _future;
  final _search = TextEditingController();
  final _listKey = GlobalKey();
  String? _category;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<List<_ReadingBook>> _load() async {
    final rows = widget.loadBooks != null
        ? await widget.loadBooks!()
        : (await ref
              .read(apiClientProvider)
              .getJson('/api/reading/books'))['books'];
    if (rows is! List) return const [];
    return rows
        .whereType<Map>()
        .map((item) => _ReadingBook.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
    ref.invalidate(studentDashboardProvider);
  }

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    return Scaffold(
      key: const Key('student-reading-page'),
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: canPop ? const BackButton(color: AppColors.navy) : null,
        titleSpacing: canPop ? null : 20,
        title: const Text(
          'Zona Baca',
          style: TextStyle(
            color: AppColors.navy,
            fontSize: 22,
            fontWeight: FontWeight.w900,
            letterSpacing: -.4,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Pemberitahuan',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const NotificationsScreen(),
                ),
              );
            },
            icon: const Icon(
              Icons.notifications_none_rounded,
              color: AppColors.navy,
            ),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: FutureBuilder<List<_ReadingBook>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingView(label: 'Menyiapkan perpustakaan...');
          }
          if (snapshot.hasError) {
            return ErrorView(message: '${snapshot.error}', onRetry: _refresh);
          }
          return _buildContent(snapshot.data ?? const []);
        },
      ),
    );
  }

  Widget _buildContent(List<_ReadingBook> books) {
    final query = _search.text.trim().toLowerCase();
    final catalogCategories = books.map((book) => book.category).toSet();
    final categoryTiles = _categoryTilesFor(catalogCategories);
    final visible = books.where((book) {
      if (_category != null &&
          book.category.toLowerCase() != _category!.toLowerCase()) {
        return false;
      }
      if (query.isEmpty) return true;
      return '${book.title} ${book.author} ${book.category}'
          .toLowerCase()
          .contains(query);
    }).toList();
    final featured = (_category == null && query.isEmpty ? books : visible)
        .take(8)
        .toList();
    final ongoing =
        books.where((book) => book.progress > 0 && book.progress < 100).toList()
          ..sort((a, b) => b.progress.compareTo(a.progress));
    final continueBook = ongoing.isNotEmpty ? ongoing.first : null;

    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        key: _listKey,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 36),
        children: [
          TextField(
            key: const Key('student-reading-search'),
            controller: _search,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Cari buku, penulis, atau topik...',
              hintStyle: const TextStyle(
                color: Color(0xFF98A2B3),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              prefixIcon: const Icon(
                Icons.search_rounded,
                color: Color(0xFF98A2B3),
              ),
              suffixIcon: query.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Hapus pencarian',
                      onPressed: () {
                        _search.clear();
                        setState(() {});
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
              filled: true,
              fillColor: const Color(0xFFF2F4F7),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 14,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
                borderSide: const BorderSide(color: AppColors.blue, width: 1.2),
              ),
            ),
          ),
          const SizedBox(height: 22),
          _SectionHeading(
            title: 'Kategori',
            actionLabel: 'Lihat Semua',
            onAction: () => setState(() => _category = null),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 108,
            child: ListView.separated(
              key: const Key('student-reading-categories'),
              scrollDirection: Axis.horizontal,
              itemCount: categoryTiles.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final tile = categoryTiles[index];
                final selected =
                    _category?.toLowerCase() == tile.label.toLowerCase();
                return _CategoryCard(
                  tile: tile,
                  selected: selected,
                  onTap: () => setState(() {
                    _category = selected ? null : tile.label;
                  }),
                );
              },
            ),
          ),
          if (featured.isNotEmpty) ...[
            const SizedBox(height: 26),
            _SectionHeading(
              title: 'Buku Unggulan',
              actionLabel: 'Lihat Semua',
              onAction: () => setState(() {
                _category = null;
                _search.clear();
              }),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 214,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: featured.length,
                separatorBuilder: (_, _) => const SizedBox(width: 14),
                itemBuilder: (_, index) => _FeaturedBook(
                  book: featured[index],
                  onTap: () => _openBook(featured[index]),
                ),
              ),
            ),
          ],
          if (books.isNotEmpty)
            const StudentAdmobBanner(
              placement: StudentAdmobPlacement.readingBanner,
            ),
          if (continueBook != null) ...[
            const SizedBox(height: 26),
            const _SectionHeading(title: 'Progress Membaca'),
            const SizedBox(height: 12),
            _ContinueReadingCard(
              book: continueBook,
              onContinue: () => _openBook(continueBook),
            ),
          ],
          const SizedBox(height: 26),
          _SectionHeading(
            title: _category == null ? 'Koleksi Bacaan' : 'Hasil Kategori',
            trailing: '${visible.length} buku',
          ),
          const SizedBox(height: 12),
          if (visible.isEmpty)
            _ReadingEmpty(hasCatalog: books.isNotEmpty)
          else
            ...visible.map(
              (book) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _ReadingRow(book: book, onTap: () => _openBook(book)),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _openBook(_ReadingBook book) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => StudentEbookReaderScreen(
          document: StudentEbookDocument(
            id: book.id,
            title: book.title,
            author: book.author,
            category: book.category,
            contentType: book.contentType,
            pageCount: book.pageCount,
            progress: book.progress,
            currentPage: book.currentPage,
            description: book.description,
            contentUrl: book.contentUrl,
            contentText: book.contentText,
          ),
        ),
      ),
    );
    await _refresh();
  }
}

class _CategoryTile {
  const _CategoryTile({
    required this.label,
    required this.icon,
    required this.accent,
    required this.soft,
  });

  final String label;
  final IconData icon;
  final Color accent;
  final Color soft;
}

const _presetCategoryTiles = <_CategoryTile>[
  _CategoryTile(
    label: 'Fiksi',
    icon: Icons.menu_book_rounded,
    accent: Color(0xFF007A33),
    soft: Color(0xFFE8F6EA),
  ),
  _CategoryTile(
    label: 'Non-Fiksi',
    icon: Icons.auto_stories_rounded,
    accent: Color(0xFFF59E0B),
    soft: Color(0xFFFFF4E5),
  ),
  _CategoryTile(
    label: 'Sains',
    icon: Icons.science_rounded,
    accent: Color(0xFF0D9488),
    soft: Color(0xFFE6F7F4),
  ),
  _CategoryTile(
    label: 'Sejarah',
    icon: Icons.account_balance_rounded,
    accent: Color(0xFFEA580C),
    soft: Color(0xFFFFEDE4),
  ),
  _CategoryTile(
    label: 'Biografi',
    icon: Icons.person_rounded,
    accent: Color(0xFF007A33),
    soft: Color(0xFFE8F6EA),
  ),
];

List<_CategoryTile> _categoryTilesFor(Set<String> catalog) {
  final tiles = <_CategoryTile>[..._presetCategoryTiles];
  final known = _presetCategoryTiles
      .map((tile) => tile.label.toLowerCase())
      .toSet();
  final extras =
      catalog
          .where((name) => name.trim().isNotEmpty)
          .where((name) => !known.contains(name.toLowerCase()))
          .toList()
        ..sort();
  for (final name in extras) {
    tiles.add(
      _CategoryTile(
        label: name,
        icon: Icons.local_library_rounded,
        accent: AppColors.blue,
        soft: AppColors.blueSoft,
      ),
    );
  }
  return tiles;
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.tile,
    required this.selected,
    required this.onTap,
  });

  final _CategoryTile tile;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    key: Key('student-reading-category-${tile.label}'),
    onTap: onTap,
    borderRadius: BorderRadius.circular(18),
    child: SizedBox(
      width: 78,
      child: Column(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: selected ? tile.accent : const Color(0xFFE8F6EA),
                width: selected ? 1.6 : 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: selected
                      ? tile.accent.withValues(alpha: .18)
                      : const Color(0x140F172A),
                  blurRadius: selected ? 16 : 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Center(
              child: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: tile.soft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(tile.icon, color: tile.accent, size: 24),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tile.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: selected ? tile.accent : const Color(0xFF344054),
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    ),
  );
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({
    required this.title,
    this.trailing,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? trailing;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(
          title,
          style: const TextStyle(
            color: AppColors.navy,
            fontSize: 17,
            fontWeight: FontWeight.w900,
            letterSpacing: -.2,
          ),
        ),
      ),
      if (trailing != null)
        Text(
          trailing!,
          style: const TextStyle(
            color: AppColors.muted,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      if (actionLabel != null && onAction != null)
        TextButton(
          onPressed: onAction,
          style: TextButton.styleFrom(
            foregroundColor: AppColors.blue,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Text(
            actionLabel!,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
          ),
        ),
    ],
  );
}

class _ContinueReadingCard extends StatelessWidget {
  const _ContinueReadingCard({required this.book, required this.onContinue});

  final _ReadingBook book;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(20),
    elevation: 0,
    child: InkWell(
      onTap: onContinue,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        key: const Key('student-reading-continue-card'),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFD7E8D9)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x120F172A),
              blurRadius: 18,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _BookCover(book: book, width: 58, height: 76),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        book.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.navy,
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        book.author,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(99),
                              child: LinearProgressIndicator(
                                value: book.progress / 100,
                                minHeight: 7,
                                backgroundColor: const Color(0xFFE8F6EA),
                                color: AppColors.blue,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            '${book.progress}%',
                            style: const TextStyle(
                              color: AppColors.blue,
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: onContinue,
              style: TextButton.styleFrom(
                foregroundColor: AppColors.blue,
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Lanjutkan Membaca',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ReadingBook {
  const _ReadingBook({
    required this.id,
    required this.title,
    required this.author,
    required this.description,
    required this.category,
    required this.contentType,
    required this.estimatedMinutes,
    required this.pageCount,
    required this.progress,
    required this.currentPage,
    this.coverUrl,
    this.contentUrl,
    this.contentText,
  });

  final String id;
  final String title;
  final String author;
  final String description;
  final String category;
  final String contentType;
  final int estimatedMinutes;
  final int pageCount;
  final int progress;
  final int currentPage;
  final String? coverUrl;
  final String? contentUrl;
  final String? contentText;

  factory _ReadingBook.fromJson(Map<String, dynamic> json) {
    final rawProgress = json['progress'];
    final progressRows = rawProgress is List
        ? rawProgress.whereType<Map>()
        : const <Map>[];
    final firstProgress = progressRows.isEmpty ? null : progressRows.first;
    return _ReadingBook(
      id: '${json['id'] ?? ''}',
      title: '${json['title'] ?? 'Bacaan'}',
      author: '${json['authorName'] ?? 'GenPro'}',
      description: '${json['description'] ?? ''}',
      category: '${json['category'] ?? 'Literasi'}',
      contentType: '${json['contentType'] ?? 'ARTICLE'}',
      estimatedMinutes: (json['estimatedMinutes'] as num?)?.toInt() ?? 10,
      pageCount: (json['pageCount'] as num?)?.toInt() ?? 1,
      progress:
          (firstProgress?['progressPercent'] as num?)?.toInt() ??
          (json['progressPercent'] as num?)?.toInt() ??
          0,
      currentPage: (firstProgress?['currentPage'] as num?)?.toInt() ?? 1,
      coverUrl: json['coverUrl']?.toString(),
      contentUrl: json['contentUrl']?.toString(),
      contentText: json['contentText']?.toString(),
    );
  }
}

class _FeaturedBook extends StatelessWidget {
  const _FeaturedBook({required this.book, required this.onTap});
  final _ReadingBook book;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 118,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _BookCover(book: book, width: 118, height: 152),
          const SizedBox(height: 8),
          Text(
            book.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.navy,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            book.author,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.muted,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );
}

class _BookCover extends StatelessWidget {
  const _BookCover({
    required this.book,
    required this.width,
    required this.height,
  });
  final _ReadingBook book;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final url = book.coverUrl?.trim();
    final resolved = url == null || url.isEmpty
        ? null
        : resolveAppMediaUrl(url);
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: width,
        height: height,
        child: resolved == null
            ? Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF007A33), Color(0xFF39B54A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: const Icon(
                  Icons.auto_stories_rounded,
                  color: Colors.white,
                  size: 34,
                ),
              )
            : Image.network(
                resolved,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  color: const Color(0xFFE4F0FF),
                  child: const Icon(
                    Icons.auto_stories_rounded,
                    color: AppColors.blue,
                  ),
                ),
              ),
      ),
    );
  }
}

class _ReadingRow extends StatelessWidget {
  const _ReadingRow({required this.book, required this.onTap});
  final _ReadingBook book;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xFFF5FAF6),
    borderRadius: BorderRadius.circular(17),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(17),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: const Color(0xFFD7E8D9)),
        ),
        child: Row(
          children: [
            _BookCover(book: book, width: 52, height: 68),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    book.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.navy,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    book.author,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                    ),
                  ),
                  if (book.progress > 0) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: LinearProgressIndicator(
                            value: book.progress / 100,
                            minHeight: 5,
                            borderRadius: BorderRadius.circular(8),
                            backgroundColor: const Color(0xFFD7E8D9),
                            color: AppColors.blue,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${book.progress}%',
                          style: const TextStyle(
                            color: AppColors.blue,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ReadingEmpty extends StatelessWidget {
  const _ReadingEmpty({this.hasCatalog = false});
  final bool hasCatalog;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 22),
    decoration: BoxDecoration(
      color: const Color(0xFFF5FAF6),
      borderRadius: BorderRadius.circular(19),
      border: Border.all(color: const Color(0xFFD7E8D9)),
    ),
    child: Column(
      children: [
        const Icon(Icons.menu_book_rounded, color: AppColors.blue, size: 44),
        const SizedBox(height: 11),
        Text(
          hasCatalog ? 'Bacaan belum ditemukan' : 'Ebook belum tersedia',
          style: const TextStyle(
            color: AppColors.navy,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          hasCatalog
              ? 'Coba kata kunci atau kategori yang berbeda.'
              : 'Belum ada bacaan terbit untuk akunmu.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.muted),
        ),
      ],
    ),
  );
}
