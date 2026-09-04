import 'dart:io';

import 'package:image/image.dart' as img;

const _icons = <String, String>{
  'Absensi.png': 'absensi.png',
  'Mading.png': 'mading.png',
  'PJJ.png': 'pjj.png',
  'Quiz.png': 'quiz.png',
  'TKA.png': 'tka.png',
  'Tugas.png': 'tugas.png',
  'Zona Baca.png': 'zona_baca.png',
  'Zona Kreasi.png': 'zona_kreasi.png',
};

void main(List<String> args) {
  final packageRoot = Directory.current;
  final sourceRoot = args.isNotEmpty
      ? Directory(args.first)
      : _resolveSourceRoot(packageRoot);
  final outputRoot = Directory(
    '${packageRoot.path}${Platform.pathSeparator}assets${Platform.pathSeparator}icons${Platform.pathSeparator}menu',
  )..createSync(recursive: true);

  for (final entry in _icons.entries) {
    final source = File(
      '${sourceRoot.path}${Platform.pathSeparator}${entry.key}',
    );
    if (!source.existsSync()) {
      throw StateError('Icon source tidak ditemukan: ${source.path}');
    }
    final decoded = img.decodePng(source.readAsBytesSync());
    if (decoded == null || decoded.width == 0 || decoded.height == 0) {
      throw StateError('Icon PNG tidak valid: ${source.path}');
    }
    final square = img.copyResize(
      decoded,
      width: 256,
      height: 256,
      interpolation: img.Interpolation.cubic,
    );
    final target = File(
      '${outputRoot.path}${Platform.pathSeparator}${entry.value}',
    );
    target.writeAsBytesSync(img.encodePng(square, level: 9), flush: true);
    stdout.writeln(
      '${entry.key} -> ${entry.value} (${target.lengthSync()} bytes)',
    );
  }
}

Directory _resolveSourceRoot(Directory packageRoot) {
  final gitRoot = Process.runSync('git', [
    'rev-parse',
    '--show-toplevel',
  ], workingDirectory: packageRoot.path);
  if (gitRoot.exitCode == 0) {
    final root = gitRoot.stdout.toString().trim();
    if (root.isNotEmpty) {
      final candidate = Directory('$root${Platform.pathSeparator}icon-menu');
      if (candidate.existsSync()) return candidate;
    }
  }
  final candidate = Directory(
    '${packageRoot.parent.parent.path}${Platform.pathSeparator}icon-menu',
  );
  if (candidate.existsSync()) return candidate;
  throw StateError(
    'Folder icon-menu tidak ditemukan dari ${packageRoot.path}.',
  );
}
