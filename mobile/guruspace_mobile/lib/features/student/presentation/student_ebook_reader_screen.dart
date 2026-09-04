import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:turn_page_transition/turn_page_transition.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';

class StudentEbookDocument {
  const StudentEbookDocument({
    required this.id,
    required this.title,
    required this.author,
    required this.category,
    required this.contentType,
    required this.pageCount,
    required this.progress,
    required this.currentPage,
    this.description = '',
    this.contentUrl,
    this.contentText,
  });

  final String id;
  final String title;
  final String author;
  final String category;
  final String contentType;
  final int pageCount;
  final int progress;
  final int currentPage;
  final String description;
  final String? contentUrl;
  final String? contentText;

  bool get isArticle => contentType == 'ARTICLE';
  bool get isPdf => contentType == 'PDF';
}

typedef EbookPdfPageBuilder =
    Widget Function(BuildContext context, int pageNumber);

typedef EbookProgressSaver =
    Future<void> Function({
      required int progressPercent,
      required int currentPage,
      required int secondsReadDelta,
    });

class StudentEbookReaderScreen extends ConsumerStatefulWidget {
  const StudentEbookReaderScreen({
    super.key,
    required this.document,
    this.pdfPageBuilder,
    this.loadPdf,
    this.saveProgress,
  });

  final StudentEbookDocument document;
  final EbookPdfPageBuilder? pdfPageBuilder;
  final Future<String> Function()? loadPdf;
  final EbookProgressSaver? saveProgress;

  @override
  ConsumerState<StudentEbookReaderScreen> createState() =>
      _StudentEbookReaderScreenState();
}

class _StudentEbookReaderScreenState
    extends ConsumerState<StudentEbookReaderScreen> {
  static const _readerBackground = Color(0xFF071225);
  static const _readerSurface = Color(0xF0162742);

  Future<String>? _pdfFile;
  Future<PdfDocument>? _pdfDocument;
  WebViewController? _webController;
  Uri? _externalContentUri;
  late TurnPageController _turnController;
  final Map<int, TransformationController> _pageTransforms = {};
  Timer? _saveTimer;
  Timer? _recenterTimer;
  late final DateTime _openedAt;
  late DateTime _lastSavedAt;
  late int _currentPage;
  int _pageCount = 1;
  int _downloaded = 0;
  int _downloadTotal = 0;
  int _webProgress = 0;
  int _turnGeneration = 0;
  int _windowStart = 1;
  int _windowCount = 1;
  bool _chromeVisible = true;
  bool _saving = false;
  bool _saveRequested = false;
  bool _completeRequested = false;
  bool _pageZoomed = false;
  bool _articleDark = false;
  double _articleFontSize = 17;

  @override
  void initState() {
    super.initState();
    _openedAt = DateTime.now();
    _lastSavedAt = _openedAt;
    _pageCount = widget.document.pageCount.clamp(1, 100000);
    _currentPage = widget.document.currentPage.clamp(1, _pageCount);
    _configureTurnWindow(_currentPage);
    if (widget.document.isPdf) {
      _pdfFile = widget.loadPdf?.call() ?? _preparePdf();
      if (widget.pdfPageBuilder == null) {
        _pdfDocument = _pdfFile!.then(_openPdfDocument);
      }
    } else if (!widget.document.isArticle) {
      _prepareWebReader();
    }
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    _recenterTimer?.cancel();
    _turnController.removeListener(_handleTurnPageChanged);
    try {
      _turnController.dispose();
    } catch (_) {}
    for (final controller in _pageTransforms.values) {
      controller.dispose();
    }
    unawaited(_saveProgress());
    final document = _pdfDocument;
    if (document != null) {
      unawaited(document.then((value) => value.dispose()).catchError((_) {}));
    }
    super.dispose();
  }

  TurnPageController _createTurnController(int initialIndex) {
    final controller = TurnPageController(
      initialPage: initialIndex,
      duration: const Duration(milliseconds: 430),
      thresholdValue: .28,
    );
    controller.addListener(_handleTurnPageChanged);
    return controller;
  }

  void _configureTurnWindow(int actualPage) {
    final safePage = actualPage.clamp(1, _pageCount);
    final start = (safePage - 3).clamp(1, _pageCount);
    final end = (safePage + 3).clamp(start, _pageCount);
    _windowStart = start;
    _windowCount = end - start + 1;
    _turnGeneration++;
    final next = _createTurnController(safePage - start);
    final previous = _turnGeneration == 1 ? null : _turnController;
    _turnController = next;
    if (previous != null) {
      previous.removeListener(_handleTurnPageChanged);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        try {
          previous.dispose();
        } catch (_) {}
      });
    }
  }

  void _handleTurnPageChanged() {
    if (!mounted) return;
    final page = _windowStart + _turnController.currentIndex;
    if (page != _currentPage) {
      _pageTransforms[_currentPage]?.value = Matrix4.identity();
      if (_pageZoomed) setState(() => _pageZoomed = false);
      _setPage(page);
    }
  }

  void _handleTurnCompleted(bool _) {
    _handleTurnPageChanged();
    final localIndex = _currentPage - _windowStart;
    if (localIndex <= 1 || localIndex >= _windowCount - 2) {
      _scheduleWindowRecenter(_currentPage);
    }
  }

  void _scheduleWindowRecenter(int page) {
    _recenterTimer?.cancel();
    _recenterTimer = Timer(const Duration(milliseconds: 760), () {
      if (!mounted || page != _currentPage) return;
      setState(() => _configureTurnWindow(page));
    });
  }

  Future<PdfDocument> _openPdfDocument(String filePath) async {
    await pdfrxFlutterInitialize();
    final document = await PdfDocument.openFile(filePath);
    if (mounted) {
      final actualCount = document.pages.length.clamp(1, 100000);
      final actualPage = _currentPage.clamp(1, actualCount);
      if (actualCount != _pageCount || actualPage != _currentPage) {
        _pageCount = actualCount;
        _currentPage = actualPage;
        _configureTurnWindow(actualPage);
        setState(() {});
      }
    }
    return document;
  }

  Uri get _contentUri {
    final raw = widget.document.contentUrl?.trim() ?? '';
    return Uri.parse(resolveAppMediaUrl(raw));
  }

  Future<String> _preparePdf() async {
    if ((widget.document.contentUrl ?? '').trim().isEmpty) {
      throw StateError('Berkas ebook belum tersedia.');
    }
    final cacheRoot = await getTemporaryDirectory();
    final cacheDirectory = Directory('${cacheRoot.path}/genpro_ebooks');
    if (!await cacheDirectory.exists()) {
      await cacheDirectory.create(recursive: true);
    }
    final safeId = widget.document.id.replaceAll(
      RegExp(r'[^a-zA-Z0-9_-]'),
      '_',
    );
    final target = File('${cacheDirectory.path}/$safeId.pdf');
    if (await target.exists() && await target.length() > 4) {
      final signature = await target
          .openRead(0, 4)
          .fold<List<int>>(<int>[], (bytes, chunk) => bytes..addAll(chunk));
      if (String.fromCharCodes(signature) == '%PDF') return target.path;
      await target.delete();
    }

    final temporary = File('${target.path}.part');
    await ref
        .read(apiClientProvider)
        .downloadToFile(
          _contentUri.toString(),
          temporary.path,
          onReceiveProgress: (received, total) {
            if (!mounted) return;
            setState(() {
              _downloaded = received;
              _downloadTotal = total;
            });
          },
        );
    final signature = await temporary
        .openRead(0, 4)
        .fold<List<int>>(<int>[], (bytes, chunk) => bytes..addAll(chunk));
    if (signature.length < 4 || String.fromCharCodes(signature) != '%PDF') {
      await temporary.delete();
      throw const FormatException(
        'Berkas yang diterima bukan PDF yang valid. Hubungi pengelola sekolah.',
      );
    }
    await temporary.rename(target.path);
    return target.path;
  }

  void _prepareWebReader() {
    final uri = safeExternalUri(_contentUri.toString());
    if (uri == null) return;
    if (!isSameOriginAppUri(uri)) {
      _externalContentUri = uri;
      return;
    }
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.disabled)
      ..setBackgroundColor(Colors.white)
      ..enableZoom(true)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            final destination = Uri.tryParse(request.url);
            return destination != null && isSameOriginAppUri(destination)
                ? NavigationDecision.navigate
                : NavigationDecision.prevent;
          },
          onProgress: (progress) {
            if (mounted) setState(() => _webProgress = progress);
          },
          onWebResourceError: (error) {
            if (error.isForMainFrame == true && mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Bacaan gagal dimuat: ${error.description}'),
                ),
              );
            }
          },
        ),
      )
      ..loadRequest(uri);
    _webController = controller;
  }

  void _setPage(int page) {
    if (!mounted) return;
    final safePage = page.clamp(1, _pageCount);
    if (_currentPage == safePage) return;
    setState(() => _currentPage = safePage);
    _scheduleProgressSave();
  }

  void _scheduleProgressSave() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 900), _saveProgress);
  }

  Future<void> _saveProgress({bool completed = false}) async {
    if (_saving) {
      _saveRequested = true;
      _completeRequested = _completeRequested || completed;
      return;
    }
    _saving = true;
    final saveStartedAt = DateTime.now();
    final seconds = saveStartedAt
        .difference(_lastSavedAt)
        .inSeconds
        .clamp(1, 3600);
    final shouldComplete = completed || _completeRequested;
    _completeRequested = false;
    final percent = shouldComplete
        ? 100
        : ((_currentPage / _pageCount) * 100).round().clamp(1, 99);
    try {
      if (widget.saveProgress != null) {
        await widget.saveProgress!(
          progressPercent: percent,
          currentPage: shouldComplete ? _pageCount : _currentPage,
          secondsReadDelta: seconds,
        );
      } else {
        await ref
            .read(apiClientProvider)
            .postJson(
              '/api/reading/progress',
              data: {
                'bookId': widget.document.id,
                'progressPercent': percent,
                'currentPage': shouldComplete ? _pageCount : _currentPage,
                'secondsReadDelta': seconds,
              },
            );
      }
      _lastSavedAt = saveStartedAt;
    } catch (_) {
      // Progres berikutnya akan mencoba menyimpan kembali. Membaca tidak diblokir.
    } finally {
      _saving = false;
      if (_saveRequested) {
        _saveRequested = false;
        unawaited(_saveProgress());
      }
    }
  }

  Future<void> _goToPage(int page) async {
    final safePage = page.clamp(1, _pageCount);
    final windowEnd = _windowStart + _windowCount - 1;
    if (safePage >= _windowStart && safePage <= windowEnd) {
      final localIndex = safePage - _windowStart;
      if (_turnController.currentIndex != localIndex) {
        await _turnController.animateToPage(localIndex);
      }
      _setPage(safePage);
      _scheduleWindowRecenter(safePage);
    } else {
      setState(() {
        _currentPage = safePage;
        _configureTurnWindow(safePage);
      });
      _scheduleProgressSave();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.document.isArticle) return _buildArticleReader();
    if (!widget.document.isPdf) return _buildWebReader();
    return PopScope(
      onPopInvokedWithResult: (_, _) => unawaited(_saveProgress()),
      child: Scaffold(
        key: const Key('student-ebook-reader-page'),
        backgroundColor: _readerBackground,
        body: Stack(
          children: [
            Positioned.fill(child: _buildPdfBody()),
            _buildTopChrome(),
            _buildBottomChrome(),
            if (!_chromeVisible)
              Positioned(
                top: MediaQuery.paddingOf(context).top + 10,
                right: 12,
                child: _GlassIconButton(
                  tooltip: 'Tampilkan kontrol',
                  icon: Icons.visibility_outlined,
                  onPressed: () => setState(() => _chromeVisible = true),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPdfBody() => FutureBuilder<String>(
    future: _pdfFile,
    builder: (context, snapshot) {
      if (snapshot.hasError) return _ReaderError(message: '${snapshot.error}');
      if (!snapshot.hasData) {
        final progress = _downloadTotal > 0
            ? _downloaded / _downloadTotal
            : null;
        return _ReaderLoading(progress: progress, title: widget.document.title);
      }
      if (widget.pdfPageBuilder != null) {
        return _buildPageTurnView(
          pageBuilder: widget.pdfPageBuilder!,
          itemCount: _pageCount,
        );
      }
      return FutureBuilder<PdfDocument>(
        future: _pdfDocument,
        builder: (context, documentSnapshot) {
          if (documentSnapshot.hasError) {
            return _ReaderError(message: '${documentSnapshot.error}');
          }
          final document = documentSnapshot.data;
          if (document == null) {
            return _ReaderLoading(progress: null, title: widget.document.title);
          }
          return _buildPageTurnView(
            itemCount: document.pages.length,
            pageBuilder: (context, pageNumber) => PdfPageView(
              key: ValueKey('pdf-page-$pageNumber'),
              document: document,
              pageNumber: pageNumber,
              maximumDpi: 220,
              backgroundColor: Colors.white,
              decoration: const BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Color(0x66000000),
                    blurRadius: 18,
                    offset: Offset(0, 8),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );

  Widget _buildPageTurnView({
    required int itemCount,
    required EbookPdfPageBuilder pageBuilder,
  }) {
    final actualCount = itemCount.clamp(1, 100000);
    final windowEnd = (_windowStart + _windowCount - 1).clamp(
      _windowStart,
      actualCount,
    );
    final visibleCount = windowEnd - _windowStart + 1;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        14,
        MediaQuery.paddingOf(context).top + 88,
        14,
        158 + MediaQuery.paddingOf(context).bottom,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: KeyedSubtree(
          key: const Key('ebook-page-turn-view'),
          child: TurnPageView.builder(
            key: ValueKey('ebook-turn-generation-$_turnGeneration'),
            controller: _turnController,
            itemCount: visibleCount,
            animationTransitionPoint: .48,
            useOnSwipe: !_pageZoomed,
            useOnTap: !_pageZoomed,
            onSwipe: _handleTurnCompleted,
            onTap: _handleTurnCompleted,
            overleafColorBuilder: (_) => const Color(0xFFF1EEE7),
            overleafBorderColorBuilder: (_) => const Color(0xFFD6D0C4),
            overleafBorderWidthBuilder: (_) => .7,
            itemBuilder: (context, index) {
              final pageNumber = _windowStart + index;
              final transform = _pageTransforms.putIfAbsent(
                pageNumber,
                TransformationController.new,
              );
              return ColoredBox(
                color: Colors.white,
                child: InteractiveViewer(
                  key: ValueKey('zoomable-pdf-page-$pageNumber'),
                  transformationController: transform,
                  minScale: 1,
                  maxScale: 4,
                  panEnabled: _pageZoomed,
                  boundaryMargin: const EdgeInsets.all(80),
                  onInteractionUpdate: (_) {
                    final zoomed = transform.value.getMaxScaleOnAxis() > 1.015;
                    if (!mounted) return;
                    if (pageNumber == _currentPage && zoomed != _pageZoomed) {
                      setState(() => _pageZoomed = zoomed);
                    }
                  },
                  onInteractionEnd: (_) {
                    final zoomed = transform.value.getMaxScaleOnAxis() > 1.015;
                    if (!mounted) return;
                    if (pageNumber == _currentPage && zoomed != _pageZoomed) {
                      setState(() => _pageZoomed = zoomed);
                    }
                  },
                  child: SizedBox.expand(
                    child: pageBuilder(context, pageNumber),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildTopChrome() => AnimatedPositioned(
    duration: const Duration(milliseconds: 220),
    curve: Curves.easeOutCubic,
    top: _chromeVisible ? 0 : -130,
    left: 0,
    right: 0,
    child: SafeArea(
      bottom: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 10, 12, 0),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: _readerSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0x1FFFFFFF)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x44000000),
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            _GlassIconButton(
              tooltip: 'Kembali',
              icon: Icons.arrow_back_rounded,
              onPressed: () => Navigator.maybePop(context),
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.document.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    widget.document.author,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFFADBBD0),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            _GlassIconButton(
              tooltip: 'Mode fokus',
              icon: Icons.fullscreen_rounded,
              onPressed: () => setState(() => _chromeVisible = false),
            ),
            _GlassIconButton(
              tooltip: 'Pengaturan bacaan',
              icon: Icons.more_vert_rounded,
              onPressed: _showPdfSettings,
            ),
          ],
        ),
      ),
    ),
  );

  Widget _buildBottomChrome() {
    final progress = _pageCount <= 1
        ? 0.0
        : (_currentPage - 1) / (_pageCount - 1);
    return AnimatedPositioned(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      bottom: _chromeVisible ? 0 : -190,
      left: 0,
      right: 0,
      child: SafeArea(
        top: false,
        minimum: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: Container(
          padding: const EdgeInsets.fromLTRB(15, 11, 15, 13),
          decoration: BoxDecoration(
            color: _readerSurface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0x1FFFFFFF)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x55000000),
                blurRadius: 26,
                offset: Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        trackHeight: 3,
                        thumbShape: const RoundSliderThumbShape(
                          enabledThumbRadius: 6,
                        ),
                        overlayShape: const RoundSliderOverlayShape(
                          overlayRadius: 15,
                        ),
                      ),
                      child: Slider(
                        key: const Key('ebook-page-slider'),
                        value: progress.clamp(0, 1),
                        onChanged: _pageCount <= 1
                            ? null
                            : (value) => _goToPage(
                                1 + (value * (_pageCount - 1)).round(),
                              ),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 45,
                    child: Text(
                      '${(progress * 100).round()}%',
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: Color(0xFFC6D2E4),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 5),
              Row(
                children: [
                  _PageButton(
                    tooltip: 'Halaman sebelumnya',
                    icon: Icons.chevron_left_rounded,
                    onPressed: _currentPage > 1
                        ? () => _goToPage(_currentPage - 1)
                        : null,
                  ),
                  Expanded(
                    child: Semantics(
                      label: 'Halaman $_currentPage dari $_pageCount',
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: '$_currentPage',
                              style: const TextStyle(color: Color(0xFF3C91FF)),
                            ),
                            TextSpan(text: '  /  $_pageCount'),
                          ],
                        ),
                        key: const Key('ebook-page-indicator'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFFADBBD0),
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  _PageButton(
                    tooltip: 'Halaman selanjutnya',
                    icon: Icons.chevron_right_rounded,
                    onPressed: _currentPage < _pageCount
                        ? () => _goToPage(_currentPage + 1)
                        : null,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _setCurrentPageZoom(double scale) {
    final controller = _pageTransforms.putIfAbsent(
      _currentPage,
      TransformationController.new,
    );
    controller.value = scale <= 1
        ? Matrix4.identity()
        : Matrix4.diagonal3Values(scale, scale, 1);
    setState(() => _pageZoomed = scale > 1);
  }

  Future<void> _showPdfSettings() => showModalBottomSheet<void>(
    context: context,
    backgroundColor: const Color(0xFF0F2418),
    showDragHandle: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
    ),
    builder: (context) => SafeArea(
      minimum: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Pengaturan bacaan',
            style: TextStyle(
              color: Colors.white,
              fontSize: 19,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Cubit layar untuk memperbesar, atau gunakan kontrol berikut.',
            style: TextStyle(color: Color(0xFF9EADC2), height: 1.45),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    _setCurrentPageZoom(1);
                    Navigator.pop(context);
                  },
                  icon: const Icon(Icons.zoom_out_rounded),
                  label: const Text('Ukuran asli'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () {
                    _setCurrentPageZoom(1.65);
                    Navigator.pop(context);
                  },
                  icon: const Icon(Icons.zoom_in_rounded),
                  label: const Text('Perbesar'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );

  Widget _buildWebReader() {
    final controller = _webController;
    return Scaffold(
      key: const Key('student-ebook-reader-page'),
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        leading: const BackButton(),
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.document.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              widget.document.author,
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Muat ulang',
            onPressed: controller?.reload,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
        bottom: controller != null && _webProgress < 100
            ? PreferredSize(
                preferredSize: const Size.fromHeight(3),
                child: LinearProgressIndicator(value: _webProgress / 100),
              )
            : null,
      ),
      body: controller != null
          ? WebViewWidget(controller: controller)
          : _ExternalReadingSource(
              uri: _externalContentUri,
              onOpen: _externalContentUri == null
                  ? null
                  : () => launchUrl(
                      _externalContentUri!,
                      mode: LaunchMode.externalApplication,
                    ),
            ),
    );
  }

  Widget _buildArticleReader() {
    final background = _articleDark
        ? const Color(0xFF111927)
        : const Color(0xFFF8F5EE);
    final foreground = _articleDark
        ? const Color(0xFFE5E9F0)
        : const Color(0xFF243247);
    return Scaffold(
      key: const Key('student-ebook-reader-page'),
      backgroundColor: background,
      appBar: AppBar(
        backgroundColor: background,
        surfaceTintColor: background,
        leading: const BackButton(),
        title: Text(
          widget.document.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            tooltip: 'Pengaturan bacaan',
            onPressed: () => setState(() => _articleDark = !_articleDark),
            icon: Icon(
              _articleDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
            ),
          ),
          IconButton(
            tooltip: 'Perbesar teks',
            onPressed: () => setState(
              () => _articleFontSize = (_articleFontSize + 1).clamp(15, 23),
            ),
            icon: const Icon(Icons.text_increase_rounded),
          ),
        ],
      ),
      body: SelectionArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 18, 24, 120),
          children: [
            Text(
              widget.document.category.toUpperCase(),
              style: const TextStyle(
                color: AppColors.blue,
                fontSize: 11,
                fontWeight: FontWeight.w900,
                letterSpacing: .8,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              widget.document.title,
              style: TextStyle(
                color: foreground,
                fontSize: 29,
                height: 1.15,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              widget.document.author,
              style: TextStyle(color: foreground.withValues(alpha: .62)),
            ),
            const SizedBox(height: 28),
            Text(
              widget.document.contentText?.trim().isNotEmpty == true
                  ? widget.document.contentText!
                  : widget.document.description,
              style: TextStyle(
                color: foreground,
                fontSize: _articleFontSize,
                height: 1.82,
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(18, 8, 18, 16),
        child: FilledButton.icon(
          onPressed: () async {
            await _saveProgress(completed: true);
            if (!mounted) return;
            Navigator.pop(context);
          },
          icon: const Icon(Icons.check_circle_outline_rounded),
          label: const Text('Selesai membaca'),
        ),
      ),
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });
  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    onPressed: onPressed,
    style: IconButton.styleFrom(foregroundColor: Colors.white),
    icon: Icon(icon),
  );
}

class _PageButton extends StatelessWidget {
  const _PageButton({
    required this.tooltip,
    required this.icon,
    this.onPressed,
  });
  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => IconButton.filledTonal(
    tooltip: tooltip,
    onPressed: onPressed,
    style: IconButton.styleFrom(
      foregroundColor: Colors.white,
      disabledForegroundColor: const Color(0xFF607089),
      backgroundColor: const Color(0xFF20324F),
      disabledBackgroundColor: const Color(0xFF17263D),
    ),
    icon: Icon(icon),
  );
}

class _ReaderLoading extends StatelessWidget {
  const _ReaderLoading({required this.progress, required this.title});
  final double? progress;
  final String title;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 44),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: const Color(0xFF132743),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(
              Icons.auto_stories_rounded,
              color: Color(0xFF4B9BFF),
              size: 34,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Menyiapkan $title',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Ebook disimpan sementara agar halaman berikutnya lebih cepat.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF5E6F5E), height: 1.45),
          ),
          const SizedBox(height: 20),
          LinearProgressIndicator(
            value: progress,
            minHeight: 5,
            borderRadius: BorderRadius.circular(10),
            backgroundColor: const Color(0xFF26364E),
          ),
        ],
      ),
    ),
  );
}

class _ExternalReadingSource extends StatelessWidget {
  const _ExternalReadingSource({required this.uri, required this.onOpen});

  final Uri? uri;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.open_in_new_rounded,
              color: AppColors.blue,
              size: 52,
            ),
            const SizedBox(height: 16),
            Text(
              uri == null
                  ? 'Tautan bacaan tidak valid'
                  : 'Bacaan tersedia di sumber eksternal',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF17213A),
                fontSize: 19,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              uri == null
                  ? 'Hubungi pengelola sekolah untuk memperbarui tautan.'
                  : 'Demi keamanan, sumber di luar GenPro dibuka pada browser perangkat.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, height: 1.45),
            ),
            if (onOpen != null) ...[
              const SizedBox(height: 20),
              FilledButton.icon(
                key: const Key('open-external-reading-source'),
                onPressed: onOpen,
                icon: const Icon(Icons.open_in_new_rounded),
                label: const Text('Buka sumber bacaan'),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _ReaderError extends StatelessWidget {
  const _ReaderError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.menu_book_outlined,
            color: Color(0xFF6EAFFF),
            size: 52,
          ),
          const SizedBox(height: 16),
          const Text(
            'Ebook belum dapat dibuka',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 19,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message.replaceFirst('Bad state: ', ''),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFFA7B5C9), height: 1.45),
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => Navigator.maybePop(context),
            icon: const Icon(Icons.arrow_back_rounded),
            label: const Text('Kembali ke Zona Baca'),
          ),
        ],
      ),
    ),
  );
}
