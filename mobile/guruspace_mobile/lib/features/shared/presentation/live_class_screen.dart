import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:guruspace_mobile/core/providers.dart';
import 'package:guruspace_mobile/core/theme/app_theme.dart';
import 'package:livekit_client/livekit_client.dart' hide ConnectionState;
import 'package:livekit_client/livekit_client.dart' as lk show ConnectionState;
import 'package:permission_handler/permission_handler.dart';
import 'package:guruspace_mobile/features/shared/domain/pjj_live_lifecycle.dart';

bool pjjRoomControlMessageAllowed(
  String? type, {
  required bool fromServer,
  required bool senderIsModerator,
}) {
  const moderatorOnlyTypes = <String>{
    'quiz:launch',
    'quiz:close',
    'quiz:update',
    'q:update',
    'participant:publish',
  };
  return !moderatorOnlyTypes.contains(type) || fromServer || senderIsModerator;
}

class LiveClassScreen extends ConsumerStatefulWidget {
  const LiveClassScreen({
    super.key,
    required this.liveSessionId,
    this.initialCamera = false,
    this.initialMicrophone = true,
  });
  final String liveSessionId;
  final bool initialCamera;
  final bool initialMicrophone;

  @override
  ConsumerState<LiveClassScreen> createState() => _LiveClassScreenState();
}

class _LiveClassScreenState extends ConsumerState<LiveClassScreen>
    with WidgetsBindingObserver {
  static const MethodChannel _backgroundChannel = MethodChannel(
    'genpro/pjj_background',
  );
  Room? _room;
  final Map<Room, EventsListener<RoomEvent>> _roomEventListeners = {};
  String _title = 'Kelas PJJ';
  String? _error;
  bool _loading = true;
  bool _camera = false;
  bool _microphone = false;
  bool _canPublishMedia = true;
  String _roomMode = 'MEETING';
  String _role = 'STUDENT';
  Map<String, dynamic>? _activeQuiz;
  Map<String, int> _quizAnswers = {};
  double? _quizScore;
  bool _quizBusy = false;
  String? _quizError;
  Timer? _quizPollTimer;
  bool _handRaised = false;
  bool _handBusy = false;
  bool _speakerOn = true;
  bool _audioBusy = false;
  bool _frontCamera = true;
  bool _cameraSwitchBusy = false;
  bool _cameraBusy = false;
  bool _microphoneBusy = false;
  bool _leaving = false;
  bool _chatOpen = false;
  int _unreadChat = 0;
  final PjjConnectionAttemptGate _connectGate = PjjConnectionAttemptGate();
  String? _connectionNotice;
  Timer? _connectionNoticeTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _camera = widget.initialCamera;
    _microphone = widget.initialMicrophone;
    _connect();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _connectionNoticeTimer?.cancel();
      if (mounted) {
        setState(
          () => _connectionNotice = 'Kelas tetap aktif di latar belakang',
        );
      }
      return;
    }
    if (state == AppLifecycleState.resumed) {
      unawaited(_recoverAfterResume());
    }
  }

  Future<void> _recoverAfterResume() async {
    final room = _room;
    if (room != null &&
        room.connectionState == lk.ConnectionState.disconnected) {
      _room = null;
      await _disposeRoom(room);
      if (!mounted) return;
      setState(() {
        _loading = true;
        _error = null;
        _connectionNotice = 'Memulihkan kelas...';
      });
      await _connect();
      return;
    }
    if (mounted) {
      _connectionNoticeTimer?.cancel();
      setState(() => _connectionNotice = 'Kembali ke kelas');
      _connectionNoticeTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => _connectionNotice = null);
      });
    }
  }

  Future<void> _connect() async {
    final generation = _connectGate.begin();
    if (generation == null) return;
    Room? attemptRoom;
    try {
      final credentials = await ref
          .read(apiClientProvider)
          .postJson(
            '/api/livekit/token',
            data: {'liveSessionId': widget.liveSessionId},
          );
      if (!mounted || !_connectGate.isCurrent(generation)) return;
      _title = credentials['title']?.toString() ?? _title;
      _role = credentials['role']?.toString() ?? _role;
      _roomMode = credentials['roomMode']?.toString() ?? 'MEETING';
      _canPublishMedia =
          credentials['canPublishMedia'] == true ||
          _role != 'STUDENT' ||
          _roomMode != 'CLASSROOM';
      if (!_canPublishMedia) {
        _camera = false;
        _microphone = false;
      }
      final permissionKinds = pjjRequiredPermissions(
        camera: _canPublishMedia && _camera,
        microphone: _canPublishMedia && _microphone,
      );
      final requestedPermissions = <Permission>[
        if (permissionKinds.contains('camera')) Permission.camera,
        if (permissionKinds.contains('microphone')) Permission.microphone,
      ];
      final permission = requestedPermissions.isEmpty
          ? <Permission, PermissionStatus>{}
          : await requestedPermissions.request();
      if (permission.values.any((value) => !value.isGranted)) {
        throw Exception(
          permission.values.any((value) => value.isPermanentlyDenied)
              ? 'Izin kamera atau mikrofon ditolak permanen. Aktifkan melalui Pengaturan perangkat.'
              : 'Izin kamera atau mikrofon diperlukan untuk masuk kelas.',
        );
      }
      if (!mounted || !_connectGate.isCurrent(generation)) return;
      final room = Room(
        roomOptions: const RoomOptions(adaptiveStream: true, dynacast: true),
      );
      attemptRoom = room;
      _room = room;
      room.addListener(_onRoomChanged);
      _roomEventListeners[room] = room.createListener()
        ..on<RoomReconnectingEvent>((_) {
          if (mounted) {
            setState(() => _connectionNotice = 'Menghubungkan ulang...');
          }
        })
        ..on<RoomReconnectedEvent>((_) {
          if (!mounted) return;
          _connectionNoticeTimer?.cancel();
          setState(() => _connectionNotice = 'Koneksi pulih');
          _connectionNoticeTimer = Timer(const Duration(seconds: 4), () {
            if (mounted) setState(() => _connectionNotice = null);
          });
        })
        ..on<RoomDisconnectedEvent>((event) {
          if (mounted) {
            setState(
              () => _connectionNotice =
                  'Koneksi terputus (${event.reason?.name ?? 'unknown'})',
            );
          }
        })
        ..on<DataReceivedEvent>((event) {
          _handleRoomData(event.data, sender: event.participant);
        });
      await room.prepareConnection(
        credentials['wsUrl'].toString(),
        credentials['token'].toString(),
      );
      await room.connect(
        credentials['wsUrl'].toString(),
        credentials['token'].toString(),
      );
      if (!mounted || !_connectGate.isCurrent(generation)) {
        if (identical(_room, room)) {
          _room = null;
          await _disposeRoom(room);
        }
        return;
      }
      try {
        await room.localParticipant?.setMicrophoneEnabled(
          _canPublishMedia && _microphone,
        );
        await room.localParticipant?.setCameraEnabled(
          _canPublishMedia && _camera,
        );
      } catch (_) {
        // Stay connected in degraded mode; controls can retry each device.
      }
      unawaited(_refreshActiveQuiz());
      if (_role == 'STUDENT') unawaited(_refreshHandState());
      _quizPollTimer?.cancel();
      _quizPollTimer = Timer.periodic(const Duration(seconds: 8), (_) {
        unawaited(_refreshActiveQuiz());
      });
      try {
        await _backgroundChannel.invokeMethod<void>('start');
      } on MissingPluginException {
        // iOS background audio is configured through UIBackgroundModes.
      } on PlatformException {
        // Remain connected; foreground service support is best-effort.
      }
      if (mounted) setState(() => _loading = false);
    } catch (error) {
      if (attemptRoom != null && identical(_room, attemptRoom)) {
        _room = null;
        await _disposeRoom(attemptRoom);
      }
      if (mounted) {
        setState(() {
          _error = '$error';
          _loading = false;
        });
      }
    } finally {
      _connectGate.finish(generation);
    }
  }

  Future<void> _disposeRoom(Room room) async {
    room.removeListener(_onRoomChanged);
    await _roomEventListeners.remove(room)?.dispose();
    try {
      await room.disconnect();
    } finally {
      await room.dispose();
    }
  }

  void _onRoomChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _connectGate.cancel();
    _connectionNoticeTimer?.cancel();
    _quizPollTimer?.cancel();
    final room = _room;
    _room = null;
    if (room != null) {
      unawaited(_disposeRoom(room));
    }
    unawaited(_backgroundChannel.invokeMethod<void>('stop').catchError((_) {}));
    super.dispose();
  }

  void _handleRoomData(List<int> data, {Participant? sender}) {
    try {
      final decoded = jsonDecode(utf8.decode(data));
      if (decoded is! Map) return;
      final type = decoded['type']?.toString();
      if (!pjjRoomControlMessageAllowed(
        type,
        fromServer: sender == null,
        senderIsModerator: sender != null && _isHostParticipant(sender),
      )) {
        return;
      }
      if (type == 'quiz:launch' ||
          type == 'quiz:close' ||
          type == 'quiz:update') {
        unawaited(_refreshActiveQuiz());
      }
      if (type == 'q:new' || type == 'q:update') {
        unawaited(_refreshHandState());
      }
      if (type == 'chat:persisted' && !_chatOpen && mounted) {
        setState(() => _unreadChat += 1);
      }
      if (type == 'participant:publish') {
        final target = decoded['targetIdentity']?.toString();
        final localId = _room?.localParticipant?.identity;
        if (target != null && target == localId) {
          final allowed = decoded['canPublishMedia'] == true;
          if (mounted) {
            setState(() {
              _canPublishMedia = allowed;
              if (!allowed) {
                _camera = false;
                _microphone = false;
              }
            });
          }
          if (!allowed) {
            unawaited(
              _room?.localParticipant?.setCameraEnabled(false) ??
                  Future.value(),
            );
            unawaited(
              _room?.localParticipant?.setMicrophoneEnabled(false) ??
                  Future.value(),
            );
          }
        }
      }
    } catch (_) {}
  }

  Future<void> _refreshActiveQuiz() async {
    try {
      final data = await ref
          .read(apiClientProvider)
          .getJson('/api/pjj/sessions/${widget.liveSessionId}/quizzes');
      if (!mounted) return;
      final active = data['activeQuiz'];
      setState(() {
        if (active is Map<String, dynamic>) {
          _activeQuiz = active;
          final attempt = active['myAttempt'];
          if (attempt is Map && attempt['status'] == 'SUBMITTED') {
            _quizScore = (attempt['score'] as num?)?.toDouble();
          }
        } else if (active is Map) {
          _activeQuiz = Map<String, dynamic>.from(active);
        } else {
          _activeQuiz = null;
          _quizScore = null;
          _quizAnswers = {};
        }
      });
    } catch (_) {
      // ignore poll failures
    }
  }

  Future<void> _submitQuiz() async {
    final quiz = _activeQuiz;
    if (quiz == null) return;
    final quizId = quiz['id']?.toString();
    if (quizId == null) return;
    setState(() {
      _quizBusy = true;
      _quizError = null;
    });
    try {
      final client = ref.read(apiClientProvider);
      await client.postJson(
        '/api/pjj/sessions/${widget.liveSessionId}/quizzes/$quizId/attempts',
        data: {'action': 'start'},
      );
      final questions = (quiz['questions'] as List? ?? const []);
      final answers = <Map<String, dynamic>>[];
      for (final raw in questions) {
        if (raw is! Map) continue;
        final questionId = raw['id']?.toString();
        if (questionId == null) continue;
        answers.add({
          'questionId': questionId,
          'selectedIndex': _quizAnswers[questionId] ?? 0,
        });
      }
      final result = await client.postJson(
        '/api/pjj/sessions/${widget.liveSessionId}/quizzes/$quizId/attempts',
        data: {'action': 'submit', 'answers': answers},
      );
      if (!mounted) return;
      setState(() {
        _quizScore = (result['attempt']?['score'] as num?)?.toDouble() ?? 0;
        _quizBusy = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _quizBusy = false;
        _quizError = '$error';
      });
    }
  }

  Future<void> _refreshHandState() async {
    if (_role != 'STUDENT') return;
    try {
      final data = await ref
          .read(apiClientProvider)
          .getJson('/api/pjj/sessions/${widget.liveSessionId}/questions');
      final viewer = data['viewer'];
      final studentId = viewer is Map ? viewer['studentId']?.toString() : null;
      final questions = data['questions'] as List? ?? const [];
      final raised =
          studentId != null &&
          questions.whereType<Map>().any((question) {
            final student = question['student'];
            return question['isHandRaise'] == true &&
                question['status']?.toString() == 'OPEN' &&
                student is Map &&
                student['id']?.toString() == studentId;
          });
      if (_handBusy && !raised) return;
      if (mounted && raised != _handRaised) {
        setState(() => _handRaised = raised);
      }
    } catch (_) {
      // The existing state remains authoritative until the server is reachable.
    }
  }

  Future<void> _raiseHand() async {
    if (_role != 'STUDENT' || _handBusy) return;
    if (_handRaised) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tangan Anda masih terangkat.')),
      );
      return;
    }
    setState(() => _handBusy = true);
    try {
      final result = await ref
          .read(apiClientProvider)
          .postJson(
            '/api/pjj/sessions/${widget.liveSessionId}/questions',
            data: const {'body': 'Angkat tangan', 'isHandRaise': true},
          );
      final question = result['question'];
      final questionId = question is Map ? question['id']?.toString() : null;
      if (mounted) setState(() => _handRaised = true);
      if (questionId != null) {
        try {
          await _room?.localParticipant?.publishData(
            utf8.encode(
              jsonEncode({'type': 'q:new', 'questionId': questionId}),
            ),
            reliable: true,
          );
        } catch (_) {
          // Persistence is authoritative; data broadcast only accelerates UI.
        }
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Tangan diangkat. Guru telah diberi tahu.'),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal mengangkat tangan: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _handBusy = false);
    }
  }

  Future<void> _toggleSpeaker() async {
    if (_audioBusy) return;
    final next = !_speakerOn;
    setState(() => _audioBusy = true);
    try {
      final room = _room;
      if (room == null) throw StateError('Ruang belum terhubung.');
      await room.setSpeakerOn(next);
      if (mounted) setState(() => _speakerOn = next);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Output audio gagal dipindahkan: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _audioBusy = false);
    }
  }

  Future<void> _switchCamera() async {
    if (_cameraSwitchBusy) return;
    if (!_camera || !_canPublishMedia) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nyalakan kamera terlebih dahulu.')),
      );
      return;
    }
    setState(() => _cameraSwitchBusy = true);
    try {
      final participant = _room?.localParticipant;
      LocalVideoTrack? cameraTrack;
      for (final publication
          in participant?.videoTrackPublications ?? const []) {
        if (publication.source == TrackSource.camera &&
            publication.track is LocalVideoTrack) {
          cameraTrack = publication.track as LocalVideoTrack;
          break;
        }
      }
      if (cameraTrack == null) throw StateError('Track kamera belum tersedia.');
      final next = _frontCamera ? CameraPosition.back : CameraPosition.front;
      await cameraTrack.setCameraPosition(next);
      if (mounted) setState(() => _frontCamera = !_frontCamera);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Kamera gagal dibalik: $error')));
      }
    } finally {
      if (mounted) setState(() => _cameraSwitchBusy = false);
    }
  }

  void _showWhiteboard() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PjjWhiteboardSheet(sessionId: widget.liveSessionId),
    );
  }

  void _showAttendance() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PjjAttendanceSheet(
        sessionId: widget.liveSessionId,
        roomConnected: _room?.connectionState == lk.ConnectionState.connected,
      ),
    );
  }

  Future<void> _openQuiz() async {
    await _refreshActiveQuiz();
    if (!mounted) return;
    if (_activeQuiz == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Belum ada kuis yang sedang berlangsung.'),
        ),
      );
      return;
    }
    setState(() {});
  }

  Future<void> _toggleCamera() async {
    if (_cameraBusy) return;
    if (!_canPublishMedia) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Anda belum dipromote untuk menyalakan kamera di mode classroom.',
            ),
          ),
        );
      }
      return;
    }
    final value = !_camera;
    setState(() => _cameraBusy = true);
    if (value) {
      final status = await Permission.camera.request();
      if (!status.isGranted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                status.isPermanentlyDenied
                    ? 'Izin kamera ditolak permanen. Aktifkan melalui Pengaturan perangkat.'
                    : 'Izin kamera diperlukan untuk menampilkan video.',
              ),
            ),
          );
        }
        if (mounted) setState(() => _cameraBusy = false);
        return;
      }
    }
    try {
      await _room?.localParticipant?.setCameraEnabled(value);
      if (mounted) setState(() => _camera = value);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Kamera gagal diaktifkan: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _cameraBusy = false);
    }
  }

  Future<void> _toggleMicrophone() async {
    if (_microphoneBusy) return;
    if (!_canPublishMedia) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Anda belum dipromote untuk menyalakan mikrofon di mode classroom.',
            ),
          ),
        );
      }
      return;
    }
    final value = !_microphone;
    setState(() => _microphoneBusy = true);
    if (value) {
      final status = await Permission.microphone.request();
      if (!status.isGranted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                status.isPermanentlyDenied
                    ? 'Izin mikrofon ditolak permanen. Aktifkan melalui Pengaturan perangkat.'
                    : 'Izin mikrofon diperlukan untuk berbicara di kelas.',
              ),
            ),
          );
        }
        if (mounted) setState(() => _microphoneBusy = false);
        return;
      }
    }
    try {
      await _room?.localParticipant?.setMicrophoneEnabled(value);
      if (mounted) setState(() => _microphone = value);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Mikrofon gagal diaktifkan: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _microphoneBusy = false);
    }
  }

  Future<void> _leave() async {
    if (_leaving) return;
    _leaving = true;
    _connectGate.cancel();
    _connectionNoticeTimer?.cancel();
    final room = _room;
    _room = null;
    try {
      if (room != null) await _disposeRoom(room);
    } catch (_) {}
    try {
      await _backgroundChannel.invokeMethod<void>('stop');
    } catch (_) {}
    if (mounted) Navigator.pop(context);
  }

  Widget _buildQuizOverlay() {
    final quiz = _activeQuiz;
    if (quiz == null) return const SizedBox.shrink();
    final questions = quiz['questions'] as List? ?? const [];
    return Material(
      color: Colors.black.withValues(alpha: 0.88),
      child: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Card(
              margin: const EdgeInsets.all(16),
              color: const Color(0xFF0F2138),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        quiz['title']?.toString() ?? 'Kuis live',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (_quizScore != null) ...[
                        Text(
                          'Skor Anda: ${_quizScore!.toStringAsFixed(_quizScore! % 1 == 0 ? 0 : 1)}',
                          style: const TextStyle(
                            color: Color(0xFF86EFAC),
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: () => setState(() {
                            _activeQuiz = null;
                            _quizScore = null;
                            _quizAnswers = {};
                          }),
                          child: const Text('Tutup'),
                        ),
                      ] else ...[
                        for (var i = 0; i < questions.length; i++) ...[
                          Builder(
                            builder: (context) {
                              final raw = questions[i];
                              if (raw is! Map) return const SizedBox.shrink();
                              final questionId = raw['id']?.toString() ?? '';
                              final options =
                                  (raw['options'] as List? ?? const [])
                                      .map((e) => e.toString())
                                      .toList();
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${i + 1}. ${raw['prompt']}',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    RadioGroup<int>(
                                      groupValue: _quizAnswers[questionId],
                                      onChanged: (value) {
                                        if (value == null) return;
                                        setState(() {
                                          _quizAnswers[questionId] = value;
                                        });
                                      },
                                      child: Column(
                                        children: [
                                          for (
                                            var o = 0;
                                            o < options.length;
                                            o++
                                          )
                                            RadioListTile<int>(
                                              value: o,
                                              title: Text(
                                                options[o],
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                ),
                                              ),
                                              activeColor: AppColors.blue,
                                            ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ],
                        if (_quizError != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              _quizError!,
                              style: const TextStyle(color: Colors.redAccent),
                            ),
                          ),
                        FilledButton(
                          onPressed: _quizBusy ? null : _submitQuiz,
                          child: _quizBusy
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Kirim jawaban'),
                        ),
                      ],
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF071426),
      appBar: AppBar(
        backgroundColor: const Color(0xFF071426),
        foregroundColor: Colors.white,
        title: Text(_title),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(child: Text('${_participantList.length} peserta')),
          ),
        ],
      ),
      body: Stack(
        children: [
          SafeArea(
            child: _loading
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(),
                        SizedBox(height: 16),
                        Text(
                          'Menghubungkan ke kelas…',
                          style: TextStyle(color: Colors.white),
                        ),
                      ],
                    ),
                  )
                : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.cloud_off_rounded,
                            color: Colors.white,
                            size: 56,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white),
                          ),
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: () {
                              setState(() {
                                _loading = true;
                                _error = null;
                              });
                              _connect();
                            },
                            child: const Text('Coba Lagi'),
                          ),
                        ],
                      ),
                    ),
                  )
                : Column(
                    children: [
                      if (_connectionNotice != null)
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 9,
                          ),
                          color: _connectionNotice == 'Koneksi pulih'
                              ? Colors.green.shade700
                              : Colors.orange.shade800,
                          child: Text(
                            _connectionNotice!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      Expanded(
                        child: _participantList.isEmpty
                            ? const Center(
                                child: Text(
                                  'Menunggu guru memulai kelas…',
                                  style: TextStyle(color: Colors.white70),
                                ),
                              )
                            : _ClassroomStageLayout(
                                stage: _stageParticipant!,
                                strip: _stripParticipants,
                                stageShowsScreenShare: _hasScreenShare(
                                  _stageParticipant!,
                                ),
                              ),
                      ),
                      if (_role == 'STUDENT')
                        PjjStudentControlPanel(
                          microphoneOn: _microphone,
                          cameraOn: _camera,
                          handRaised: _handRaised,
                          speakerOn: _speakerOn,
                          handBusy: _handBusy,
                          unreadChat: _unreadChat,
                          connected:
                              _room?.connectionState ==
                              lk.ConnectionState.connected,
                          canPublishMedia: _canPublishMedia,
                          onMicrophone: _toggleMicrophone,
                          onCamera: _toggleCamera,
                          onRaiseHand: _raiseHand,
                          onChat: () => unawaited(_showChat()),
                          onLeave: _leave,
                          onParticipants: _showParticipants,
                          onSpeaker: _toggleSpeaker,
                          onFlipCamera: _switchCamera,
                          onWhiteboard: _showWhiteboard,
                          onAttendance: _showAttendance,
                          onQuiz: _openQuiz,
                        )
                      else
                        Container(
                          padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
                          decoration: const BoxDecoration(
                            color: Color(0xFF0F2138),
                            borderRadius: BorderRadius.vertical(
                              top: Radius.circular(28),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              _ControlButton(
                                icon: _microphone
                                    ? Icons.mic_rounded
                                    : Icons.mic_off_rounded,
                                label: 'Mikrofon',
                                active: _microphone,
                                onTap: _toggleMicrophone,
                              ),
                              _ControlButton(
                                icon: _camera
                                    ? Icons.videocam_rounded
                                    : Icons.videocam_off_rounded,
                                label: 'Kamera',
                                active: _camera,
                                onTap: _toggleCamera,
                              ),
                              _ControlButton(
                                icon: Icons.people_outline_rounded,
                                label: 'Peserta',
                                active: false,
                                onTap: _showParticipants,
                              ),
                              _ControlButton(
                                icon: Icons.chat_bubble_outline_rounded,
                                label: 'Chat',
                                active: false,
                                onTap: () => unawaited(_showChat()),
                              ),
                              _ControlButton(
                                icon: Icons.call_end_rounded,
                                label: 'Keluar',
                                color: Colors.red,
                                active: true,
                                onTap: _leave,
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
          ),
          if (_activeQuiz != null && _role == 'STUDENT')
            Positioned.fill(child: _buildQuizOverlay()),
        ],
      ),
    );
  }

  List<Participant> get _participantList {
    final room = _room;
    if (room == null) return const [];
    return [
      if (room.localParticipant != null) room.localParticipant!,
      ...room.remoteParticipants.values,
    ];
  }

  Participant? get _stageParticipant {
    final participants = _participantList;
    if (participants.isEmpty) return null;

    for (final participant in participants) {
      if (_hasScreenShare(participant)) return participant;
    }
    for (final participant in participants) {
      if (_isHostParticipant(participant)) return participant;
    }
    for (final participant in participants) {
      if (!identical(participant, _room?.localParticipant) &&
          _hasCamera(participant)) {
        return participant;
      }
    }
    return participants.first;
  }

  List<Participant> get _stripParticipants {
    final stage = _stageParticipant;
    if (stage == null) return const [];
    return _participantList
        .where((participant) {
          if (participant.identity == stage.identity) return false;
          if (_roomMode == 'CLASSROOM') {
            return _isPublisherParticipant(participant);
          }
          return true;
        })
        .toList(growable: false);
  }

  static bool _hasScreenShare(Participant participant) {
    return participant.isScreenShareEnabled();
  }

  static bool _hasCamera(Participant participant) {
    return participant.isCameraEnabled();
  }

  static String? _roleOf(Participant participant) {
    final raw = participant.metadata;
    if (raw == null || raw.trim().isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map && decoded['role'] is String) {
        return decoded['role'] as String;
      }
    } catch (_) {}
    return null;
  }

  static bool _isHostParticipant(Participant participant) {
    final role = _roleOf(participant);
    return role != null && role != 'STUDENT';
  }

  static bool _isPublisherParticipant(Participant participant) {
    return _isHostParticipant(participant) ||
        _hasScreenShare(participant) ||
        _hasCamera(participant);
  }

  void _showParticipants() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Peserta (${_participantList.length})',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              ..._participantList.map(
                (participant) => ListTile(
                  leading: const CircleAvatar(
                    child: Icon(Icons.person_rounded),
                  ),
                  title: Text(
                    participant.name.isNotEmpty
                        ? participant.name
                        : participant.identity,
                  ),
                  trailing: Icon(
                    participant.isMuted
                        ? Icons.mic_off_rounded
                        : Icons.mic_rounded,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showChat() async {
    if (mounted) {
      setState(() {
        _chatOpen = true;
        _unreadChat = 0;
      });
    }
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _PjjChatSheet(sessionId: widget.liveSessionId),
    );
    if (mounted) setState(() => _chatOpen = false);
  }
}

class PjjStudentControlPanel extends StatelessWidget {
  const PjjStudentControlPanel({
    super.key,
    required this.microphoneOn,
    required this.cameraOn,
    required this.handRaised,
    required this.speakerOn,
    required this.handBusy,
    required this.unreadChat,
    required this.connected,
    required this.canPublishMedia,
    required this.onMicrophone,
    required this.onCamera,
    required this.onRaiseHand,
    required this.onChat,
    required this.onLeave,
    required this.onParticipants,
    required this.onSpeaker,
    required this.onFlipCamera,
    required this.onWhiteboard,
    required this.onAttendance,
    required this.onQuiz,
  });

  final bool microphoneOn;
  final bool cameraOn;
  final bool handRaised;
  final bool speakerOn;
  final bool handBusy;
  final int unreadChat;
  final bool connected;
  final bool canPublishMedia;
  final VoidCallback onMicrophone;
  final VoidCallback onCamera;
  final VoidCallback onRaiseHand;
  final VoidCallback onChat;
  final VoidCallback onLeave;
  final VoidCallback onParticipants;
  final VoidCallback onSpeaker;
  final VoidCallback onFlipCamera;
  final VoidCallback onWhiteboard;
  final VoidCallback onAttendance;
  final VoidCallback onQuiz;

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('pjj-student-control-panel'),
    padding: const EdgeInsets.fromLTRB(12, 10, 12, 14),
    decoration: const BoxDecoration(
      color: Color(0xFF0F2138),
      borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(
              connected ? Icons.wifi_rounded : Icons.wifi_off_rounded,
              color: connected ? const Color(0xFF45D69E) : Colors.orange,
              size: 15,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                connected ? 'Koneksi stabil' : 'Menghubungkan kembali…',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              canPublishMedia
                  ? 'Kamera & mikrofon diizinkan'
                  : 'Menunggu izin media guru',
              style: const TextStyle(color: Colors.white54, fontSize: 9.5),
            ),
          ],
        ),
        const SizedBox(height: 9),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            Expanded(
              child: _ControlButton(
                key: const Key('pjj-control-microphone'),
                icon: microphoneOn ? Icons.mic_rounded : Icons.mic_off_rounded,
                label: 'Mikrofon',
                active: microphoneOn,
                onTap: onMicrophone,
              ),
            ),
            Expanded(
              child: _ControlButton(
                key: const Key('pjj-control-camera'),
                icon: cameraOn
                    ? Icons.videocam_rounded
                    : Icons.videocam_off_rounded,
                label: 'Kamera',
                active: cameraOn,
                onTap: onCamera,
              ),
            ),
            Expanded(
              child: _ControlButton(
                key: const Key('pjj-control-hand'),
                icon: Icons.pan_tool_alt_rounded,
                label: handRaised ? 'Terangkat' : 'Angkat tangan',
                active: handRaised,
                color: handRaised ? Colors.orange : null,
                onTap: handBusy ? null : onRaiseHand,
              ),
            ),
            Expanded(
              child: _ControlButton(
                key: const Key('pjj-control-chat'),
                icon: Icons.chat_bubble_outline_rounded,
                label: 'Chat',
                active: false,
                badge: unreadChat,
                onTap: onChat,
              ),
            ),
            Expanded(
              child: _ControlButton(
                key: const Key('pjj-control-leave'),
                icon: Icons.call_end_rounded,
                label: 'Keluar',
                color: Colors.red,
                active: true,
                onTap: onLeave,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 69,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _SecondaryControl(
                key: const Key('pjj-control-participants'),
                icon: Icons.groups_2_outlined,
                label: 'Peserta',
                onTap: onParticipants,
              ),
              _SecondaryControl(
                key: const Key('pjj-control-speaker'),
                icon: speakerOn
                    ? Icons.volume_up_rounded
                    : Icons.hearing_rounded,
                label: speakerOn ? 'Speaker' : 'Earpiece',
                active: speakerOn,
                onTap: onSpeaker,
              ),
              _SecondaryControl(
                key: const Key('pjj-control-flip-camera'),
                icon: Icons.cameraswitch_rounded,
                label: 'Balik kamera',
                onTap: onFlipCamera,
              ),
              _SecondaryControl(
                key: const Key('pjj-control-board'),
                icon: Icons.draw_outlined,
                label: 'Papan tulis',
                onTap: onWhiteboard,
              ),
              _SecondaryControl(
                key: const Key('pjj-control-attendance'),
                icon: Icons.fact_check_outlined,
                label: 'Kehadiran',
                onTap: onAttendance,
              ),
              _SecondaryControl(
                key: const Key('pjj-control-quiz'),
                icon: Icons.quiz_outlined,
                label: 'Kuis',
                onTap: onQuiz,
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _SecondaryControl extends StatelessWidget {
  const _SecondaryControl({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 88,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 22, color: active ? AppColors.cyan : Colors.white70),
          const SizedBox(height: 5),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white70, fontSize: 9.5),
          ),
        ],
      ),
    ),
  );
}

class _PjjWhiteboardSheet extends ConsumerStatefulWidget {
  const _PjjWhiteboardSheet({required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<_PjjWhiteboardSheet> createState() =>
      _PjjWhiteboardSheetState();
}

class _PjjStroke {
  const _PjjStroke({
    required this.id,
    required this.color,
    required this.width,
    required this.erase,
    required this.points,
  });

  final String id;
  final Color color;
  final double width;
  final bool erase;
  final List<Offset> points;

  static _PjjStroke? fromJson(Map<dynamic, dynamic> json) {
    final rawPoints = json['points'];
    if (rawPoints is! List) return null;
    final points = rawPoints
        .whereType<List>()
        .where((point) => point.length == 2)
        .map(
          (point) => Offset(
            (point[0] as num?)?.toDouble().clamp(0, 1) ?? 0,
            (point[1] as num?)?.toDouble().clamp(0, 1) ?? 0,
          ),
        )
        .toList(growable: false);
    if (points.length < 2) return null;
    final rawColor = json['color']?.toString() ?? '#1D4ED8';
    final hex = rawColor.replaceFirst('#', '');
    final value = int.tryParse(hex, radix: 16) ?? 0x1D4ED8;
    return _PjjStroke(
      id: json['id']?.toString() ?? '',
      color: Color(0xFF000000 | value),
      width: ((json['width'] as num?)?.toDouble() ?? 3).clamp(1, 50),
      erase: json['erase'] == true,
      points: points,
    );
  }
}

class _PjjWhiteboardSheetState extends ConsumerState<_PjjWhiteboardSheet> {
  static const _colors = <Color>[
    Color(0xFFF8FAFC),
    Color(0xFF38BDF8),
    Color(0xFFFBBF24),
    Color(0xFFF87171),
    Color(0xFF4ADE80),
    Color(0xFFC084FC),
  ];
  Timer? _pollTimer;
  List<_PjjStroke> _strokes = const [];
  List<Offset> _draft = const [];
  Color _color = _colors.first;
  double _width = 3;
  bool _loading = true;
  bool _sending = false;
  String? _error;
  int _loadGeneration = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      unawaited(_load(silent: true));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final generation = ++_loadGeneration;
    try {
      final json = await ref
          .read(apiClientProvider)
          .getJson('/api/pjj/sessions/${widget.sessionId}/whiteboard');
      final state = json['state'];
      final rows = state is Map
          ? state['strokes'] as List? ?? const []
          : const [];
      final strokes = rows
          .whereType<Map>()
          .map(_PjjStroke.fromJson)
          .whereType<_PjjStroke>()
          .toList(growable: false);
      if (!mounted || generation != _loadGeneration) return;
      setState(() {
        _strokes = strokes;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted || generation != _loadGeneration || silent) return;
      setState(() {
        _loading = false;
        _error = '$error';
      });
    }
  }

  void _startStroke(DragStartDetails details, Size size) {
    if (_sending || size.isEmpty) return;
    setState(() => _draft = [_normalize(details.localPosition, size)]);
  }

  void _extendStroke(DragUpdateDetails details, Size size) {
    if (_sending || _draft.isEmpty || _draft.length >= 200) return;
    final point = _normalize(details.localPosition, size);
    if ((point - _draft.last).distance < .002) return;
    setState(() => _draft = [..._draft, point]);
  }

  static Offset _normalize(Offset point, Size size) => Offset(
    (point.dx / size.width).clamp(0, 1),
    (point.dy / size.height).clamp(0, 1),
  );

  Future<void> _finishStroke() async {
    if (_sending) return;
    final points = _draft;
    if (points.length < 2) {
      if (mounted) setState(() => _draft = const []);
      return;
    }
    final id = 'android-${DateTime.now().microsecondsSinceEpoch}';
    final stroke = _PjjStroke(
      id: id,
      color: _color,
      width: _width,
      erase: false,
      points: points,
    );
    setState(() {
      _draft = const [];
      _strokes = [..._strokes, stroke];
      _sending = true;
    });
    try {
      final colorHex =
          '#${(_color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
      await ref
          .read(apiClientProvider)
          .postJson(
            '/api/pjj/sessions/${widget.sessionId}/whiteboard',
            data: {
              'kind': 'stroke',
              'stroke': {
                'id': id,
                'color': colorHex,
                'width': _width,
                'erase': false,
                'points': points.map((point) => [point.dx, point.dy]).toList(),
              },
            },
          );
      await _load(silent: true);
    } catch (error) {
      if (mounted) {
        setState(
          () => _strokes = _strokes.where((item) => item.id != id).toList(),
        );
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Coretan gagal disimpan: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
    height: MediaQuery.sizeOf(context).height * .88,
    decoration: const BoxDecoration(
      color: Color(0xFFF5F7FB),
      borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
    ),
    child: SafeArea(
      top: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 10, 8),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'Papan tulis bersama',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                ),
                if (_sending)
                  const Padding(
                    padding: EdgeInsets.only(right: 10),
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                IconButton(
                  tooltip: 'Tutup',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                ..._colors.map(
                  (color) => IconButton(
                    onPressed: () => setState(() => _color = color),
                    icon: Icon(
                      _color == color ? Icons.check_circle : Icons.circle,
                      color: color,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.line_weight_rounded, size: 18),
                Expanded(
                  child: Slider(
                    value: _width,
                    min: 1,
                    max: 12,
                    onChanged: (value) => setState(() => _width = value),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: const [
                    BoxShadow(color: Color(0x18000000), blurRadius: 16),
                  ],
                ),
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(_error!, textAlign: TextAlign.center),
                              const SizedBox(height: 12),
                              FilledButton(
                                onPressed: _load,
                                child: const Text('Coba lagi'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : LayoutBuilder(
                        builder: (context, constraints) {
                          final size = constraints.biggest;
                          return GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onPanStart: (details) =>
                                _startStroke(details, size),
                            onPanUpdate: (details) =>
                                _extendStroke(details, size),
                            onPanEnd: (_) => unawaited(_finishStroke()),
                            onPanCancel: () =>
                                setState(() => _draft = const []),
                            child: CustomPaint(
                              painter: _PjjWhiteboardPainter(
                                strokes: _strokes,
                                draft: _draft,
                                draftColor: _color,
                                draftWidth: _width,
                              ),
                              size: Size.infinite,
                            ),
                          );
                        },
                      ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _PjjWhiteboardPainter extends CustomPainter {
  const _PjjWhiteboardPainter({
    required this.strokes,
    required this.draft,
    required this.draftColor,
    required this.draftWidth,
  });

  final List<_PjjStroke> strokes;
  final List<Offset> draft;
  final Color draftColor;
  final double draftWidth;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFF0F172A),
    );
    canvas.saveLayer(Offset.zero & size, Paint());
    for (final stroke in strokes) {
      _paintPath(
        canvas,
        size,
        stroke.points,
        stroke.color,
        stroke.width,
        erase: stroke.erase,
      );
    }
    _paintPath(canvas, size, draft, draftColor, draftWidth);
    canvas.restore();
  }

  static void _paintPath(
    Canvas canvas,
    Size size,
    List<Offset> points,
    Color color,
    double width, {
    bool erase = false,
  }) {
    if (points.length < 2) return;
    final path = Path()
      ..moveTo(points.first.dx * size.width, points.first.dy * size.height);
    for (final point in points.skip(1)) {
      path.lineTo(point.dx * size.width, point.dy * size.height);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..blendMode = erase ? BlendMode.clear : BlendMode.srcOver
        ..strokeWidth = width
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke,
    );
  }

  @override
  bool shouldRepaint(covariant _PjjWhiteboardPainter oldDelegate) =>
      oldDelegate.strokes != strokes || oldDelegate.draft != draft;
}

class _PjjAttendanceSheet extends ConsumerStatefulWidget {
  const _PjjAttendanceSheet({
    required this.sessionId,
    required this.roomConnected,
  });

  final String sessionId;
  final bool roomConnected;

  @override
  ConsumerState<_PjjAttendanceSheet> createState() =>
      _PjjAttendanceSheetState();
}

class _PjjAttendanceSheetState extends ConsumerState<_PjjAttendanceSheet> {
  Timer? _pollTimer;
  Map<dynamic, dynamic>? _student;
  Map<dynamic, dynamic> _summary = const {};
  bool _loading = true;
  String? _error;
  int _loadGeneration = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    _pollTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      unawaited(_load(silent: true));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final generation = ++_loadGeneration;
    try {
      final json = await ref
          .read(apiClientProvider)
          .getJson('/api/pjj/sessions/${widget.sessionId}/roster');
      final students = json['students'] as List? ?? const [];
      final student = students.whereType<Map>().firstOrNull;
      if (!mounted || generation != _loadGeneration) return;
      setState(() {
        _student = student;
        _summary = json['summary'] is Map
            ? json['summary'] as Map<dynamic, dynamic>
            : const {};
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted || generation != _loadGeneration || silent) return;
      setState(() {
        _loading = false;
        _error = '$error';
      });
    }
  }

  static String _duration(dynamic raw) {
    final seconds = raw is num ? raw.toInt() : 0;
    final minutes = seconds ~/ 60;
    final rest = seconds % 60;
    return '${minutes}m ${rest}s';
  }

  bool get _isOnline => widget.roomConnected || _student?['online'] == true;

  @override
  Widget build(BuildContext context) => Container(
    height: MediaQuery.sizeOf(context).height * .58,
    padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
    decoration: const BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
    ),
    child: SafeArea(
      top: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Kehadiran saya',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
                ),
              ),
              IconButton(
                tooltip: 'Perbarui',
                onPressed: _load,
                icon: const Icon(Icons.refresh_rounded),
              ),
              IconButton(
                tooltip: 'Tutup',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (_error != null)
            Expanded(
              child: Center(child: Text(_error!, textAlign: TextAlign.center)),
            )
          else if (_student == null)
            const Expanded(
              child: Center(child: Text('Data kehadiran belum tersedia.')),
            )
          else ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F6FF),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _student!['name']?.toString() ?? 'Siswa',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _AttendanceLine(
                    icon: _isOnline ? Icons.circle : Icons.circle_outlined,
                    label: _isOnline ? 'Online' : 'Offline',
                    color: _isOnline ? Colors.green : Colors.grey,
                  ),
                  _AttendanceLine(
                    icon: Icons.fact_check_outlined,
                    label:
                        'Status: ${_student!['attendanceStatus'] ?? 'ABSENT'}',
                  ),
                  _AttendanceLine(
                    icon: Icons.timer_outlined,
                    label:
                        'Durasi tercatat: ${_duration(_student!['totalSeconds'])}',
                  ),
                  _AttendanceLine(
                    icon: Icons.login_rounded,
                    label: 'Jumlah bergabung: ${_student!['joinCount'] ?? 0}',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Ringkasan kelas: ${_summary['online'] ?? 0} online dari '
              '${_summary['totalStudents'] ?? 0} siswa',
              style: const TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 8),
            const Text(
              'Kehadiran dihitung oleh server dari aktivitas masuk dan keluar ruang.',
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ],
        ],
      ),
    ),
  );
}

class _AttendanceLine extends StatelessWidget {
  const _AttendanceLine({required this.icon, required this.label, this.color});

  final IconData icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Row(
      children: [
        Icon(icon, size: 18, color: color ?? AppColors.blue),
        const SizedBox(width: 9),
        Expanded(child: Text(label)),
      ],
    ),
  );
}

class _PjjChatSheet extends ConsumerStatefulWidget {
  const _PjjChatSheet({required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<_PjjChatSheet> createState() => _PjjChatSheetState();
}

class _PjjChatMessage {
  const _PjjChatMessage({
    required this.id,
    required this.body,
    required this.senderName,
  });

  final String id;
  final String body;
  final String senderName;
}

class _PjjChatSheetState extends ConsumerState<_PjjChatSheet> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _pollTimer;
  List<_PjjChatMessage> _messages = const [];
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      unawaited(_load(silent: true));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final json = await ref
          .read(apiClientProvider)
          .getJson('/api/pjj/sessions/${widget.sessionId}/chat');
      final rows = json['messages'] as List? ?? const [];
      final messages = rows
          .whereType<Map>()
          .map(
            (item) => _PjjChatMessage(
              id: item['id']?.toString() ?? '',
              body: item['body']?.toString() ?? '',
              senderName: item['senderName']?.toString() ?? 'Peserta',
            ),
          )
          .where((item) => item.body.isNotEmpty)
          .toList();
      if (!mounted) return;
      setState(() {
        _messages = messages;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted || silent) return;
      setState(() {
        _loading = false;
        _error = '$error';
      });
    }
  }

  Future<void> _send() async {
    final body = _controller.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref
          .read(apiClientProvider)
          .postJson(
            '/api/pjj/sessions/${widget.sessionId}/chat',
            data: {'clientMessageId': pjjClientMessageId(), 'body': body},
          );
      if (!mounted) return;
      _controller.clear();
      await _load(silent: true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 18,
      ),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .55,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Chat kelas', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                  ? Center(child: Text(_error!, textAlign: TextAlign.center))
                  : _messages.isEmpty
                  ? const Center(
                      child: Text(
                        'Belum ada pesan. Tulis pertanyaan untuk guru.',
                        textAlign: TextAlign.center,
                      ),
                    )
                  : ListView.builder(
                      controller: _scrollController,
                      itemCount: _messages.length,
                      itemBuilder: (context, index) {
                        final message = _messages[index];
                        return ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            message.senderName,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(message.body),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _controller,
              minLines: 1,
              maxLines: 3,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _send(),
              decoration: InputDecoration(
                hintText: 'Tulis pesan...',
                suffixIcon: IconButton(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PjjCameraPreview extends StatefulWidget {
  const PjjCameraPreview({super.key, required this.enabled});
  final bool enabled;

  @override
  State<PjjCameraPreview> createState() => _PjjCameraPreviewState();
}

class _PjjCameraPreviewState extends State<PjjCameraPreview> {
  LocalVideoTrack? _track;
  String? _error;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    if (widget.enabled) unawaited(_start());
  }

  @override
  void didUpdateWidget(covariant PjjCameraPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.enabled == widget.enabled) return;
    if (widget.enabled) {
      unawaited(_start());
    } else {
      unawaited(_stop());
    }
  }

  Future<void> _start() async {
    final generation = ++_generation;
    final permission = await Permission.camera.request();
    if (!permission.isGranted) {
      if (mounted && generation == _generation) {
        setState(() => _error = 'Izin kamera belum diberikan');
      }
      return;
    }
    try {
      final track = await LocalVideoTrack.createCameraTrack();
      if (!mounted || generation != _generation || !widget.enabled) {
        await track.stop();
        await track.dispose();
        return;
      }
      final previous = _track;
      setState(() {
        _track = track;
        _error = null;
      });
      if (previous != null) {
        await previous.stop();
        await previous.dispose();
      }
    } catch (error) {
      if (mounted && generation == _generation) {
        setState(() => _error = 'Kamera tidak dapat dibuka: $error');
      }
    }
  }

  Future<void> _stop() async {
    _generation += 1;
    final track = _track;
    _track = null;
    if (mounted) setState(() => _error = null);
    if (track != null) {
      await track.stop();
      await track.dispose();
    }
  }

  @override
  void dispose() {
    _generation += 1;
    final track = _track;
    _track = null;
    if (track != null) {
      unawaited(track.stop().then((_) => track.dispose()));
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final track = _track;
    if (!widget.enabled) {
      return const Center(
        child: Icon(
          Icons.videocam_off_rounded,
          size: 52,
          color: AppColors.muted,
        ),
      );
    }
    if (track != null) {
      return VideoTrackRenderer(track);
    }
    return Center(
      child: _error == null
          ? const CircularProgressIndicator()
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!, textAlign: TextAlign.center),
            ),
    );
  }
}

class _ClassroomStageLayout extends StatelessWidget {
  const _ClassroomStageLayout({
    required this.stage,
    required this.strip,
    required this.stageShowsScreenShare,
  });

  final Participant stage;
  final List<Participant> strip;
  final bool stageShowsScreenShare;

  @override
  Widget build(BuildContext context) {
    final stageLabel = stageShowsScreenShare
        ? 'Layar dibagikan'
        : _LiveClassScreenState._isHostParticipant(stage)
        ? 'Guru'
        : 'Utama';

    return Column(
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: _ParticipantTile(
              participant: stage,
              preferScreenShare: stageShowsScreenShare,
              labelBadge: stageLabel,
            ),
          ),
        ),
        if (strip.isNotEmpty)
          SizedBox(
            height: 118,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
                  child: Text(
                    'Peserta kelas · ${strip.length}',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                    scrollDirection: Axis.horizontal,
                    itemCount: strip.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(width: 8),
                    itemBuilder: (_, index) => SizedBox(
                      width: 112,
                      child: _ParticipantTile(
                        participant: strip[index],
                        compact: true,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _ParticipantTile extends StatefulWidget {
  const _ParticipantTile({
    required this.participant,
    this.preferScreenShare = false,
    this.compact = false,
    this.labelBadge,
  });
  final Participant participant;
  final bool preferScreenShare;
  final bool compact;
  final String? labelBadge;

  @override
  State<_ParticipantTile> createState() => _ParticipantTileState();
}

class _ParticipantTileState extends State<_ParticipantTile> {
  @override
  void initState() {
    super.initState();
    widget.participant.addListener(_changed);
  }

  @override
  void didUpdateWidget(covariant _ParticipantTile oldWidget) {
    oldWidget.participant.removeListener(_changed);
    super.didUpdateWidget(oldWidget);
    widget.participant.addListener(_changed);
  }

  @override
  void dispose() {
    widget.participant.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  VideoTrack? get _video {
    VideoTrack? camera;
    for (final publication in widget.participant.videoTrackPublications) {
      final track = publication.track;
      if (publication.muted || track is! VideoTrack) continue;
      if (publication.source == TrackSource.screenShareVideo) {
        if (widget.preferScreenShare) return track;
        continue;
      }
      camera ??= track;
    }
    if (widget.preferScreenShare) {
      for (final publication in widget.participant.videoTrackPublications) {
        final track = publication.track;
        if (!publication.muted &&
            publication.source == TrackSource.screenShareVideo &&
            track is VideoTrack) {
          return track;
        }
      }
    }
    return camera;
  }

  @override
  Widget build(BuildContext context) {
    final participant = widget.participant;
    final video = _video;
    final name = participant.name.isNotEmpty
        ? participant.name
        : participant.identity;
    final avatarSize = widget.compact ? 22.0 : 38.0;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: const Color(0xFF16304F),
        borderRadius: BorderRadius.circular(widget.compact ? 16 : 20),
        border: participant.isSpeaking
            ? Border.all(color: AppColors.cyan, width: widget.compact ? 2 : 3)
            : Border.all(color: const Color(0x33FFFFFF)),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (video != null)
            VideoTrackRenderer(video)
          else
            Center(
              child: CircleAvatar(
                radius: avatarSize,
                backgroundColor: AppColors.blue,
                child: Text(
                  name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: widget.compact ? 18 : 30,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
          if (widget.labelBadge != null)
            Positioned(
              top: 10,
              left: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  widget.labelBadge!,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .2,
                  ),
                ),
              ),
            ),
          Positioned(
            left: widget.compact ? 8 : 10,
            right: widget.compact ? 8 : 10,
            bottom: widget.compact ? 7 : 9,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: widget.compact ? 11 : 14,
                      shadows: const [Shadow(blurRadius: 8)],
                    ),
                  ),
                ),
                Icon(
                  participant.isMuted
                      ? Icons.mic_off_rounded
                      : Icons.mic_rounded,
                  color: participant.isMuted ? Colors.redAccent : Colors.white,
                  size: widget.compact ? 14 : 18,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  const _ControlButton({
    super.key,
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
    this.color,
    this.badge = 0,
  });
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback? onTap;
  final Color? color;
  final int badge;
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Stack(
        clipBehavior: Clip.none,
        children: [
          IconButton.filled(
            onPressed: onTap,
            icon: Icon(icon),
            style: IconButton.styleFrom(
              backgroundColor:
                  color ?? (active ? AppColors.blue : const Color(0xFF334B68)),
              disabledBackgroundColor: const Color(0xFF263C57),
              foregroundColor: Colors.white,
              fixedSize: const Size(48, 48),
            ),
          ),
          if (badge > 0)
            Positioned(
              top: -3,
              right: -3,
              child: Container(
                constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                padding: const EdgeInsets.symmetric(horizontal: 5),
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: Colors.red,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  badge > 99 ? '99+' : '$badge',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
        ],
      ),
      const SizedBox(height: 5),
      Text(label, style: const TextStyle(color: Colors.white70, fontSize: 9.5)),
    ],
  );
}
