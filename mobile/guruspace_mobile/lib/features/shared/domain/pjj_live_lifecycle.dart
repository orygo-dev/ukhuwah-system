import 'dart:math';

class PjjConnectionAttemptGate {
  int _generation = 0;
  bool _connecting = false;

  int? begin() {
    if (_connecting) return null;
    _connecting = true;
    return ++_generation;
  }

  bool isCurrent(int generation) => generation == _generation;

  void finish(int generation) {
    if (generation == _generation) _connecting = false;
  }

  void cancel() {
    _generation += 1;
    _connecting = false;
  }
}

Set<String> pjjRequiredPermissions({
  required bool camera,
  required bool microphone,
}) => {if (camera) 'camera', if (microphone) 'microphone'};

String pjjClientMessageId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
