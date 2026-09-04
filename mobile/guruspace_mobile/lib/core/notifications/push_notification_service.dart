import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:path_provider/path_provider.dart';
import 'package:guruspace_mobile/core/config/app_config.dart';
import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/features/shared/presentation/notifications_screen.dart';
import 'package:guruspace_mobile/features/student/presentation/student_inbox_screen.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class PushNotificationService {
  PushNotificationService._();

  static final instance = PushNotificationService._();
  static const fallbackChannelId = 'genpro_default';
  static const _notificationColor = Color(0xFF007A33);
  static const _largeIcon = DrawableResourceAndroidBitmap(
    'ic_notification_logo',
  );
  static final inboxRevision = ValueNotifier<int>(0);

  final navigatorKey = GlobalKey<NavigatorState>();
  final _localNotifications = FlutterLocalNotificationsPlugin();
  ApiClient? _api;
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _messageSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  bool _initialized = false;
  bool _launchCaptured = false;
  bool _firebaseAvailable = false;
  bool _authenticated = false;
  bool _appReady = false;
  int _navigatorRetries = 0;
  String _channelId = fallbackChannelId;
  String? _registeredUserId;
  String? _registeredAppId;
  String? _skippedUserId;
  String? _desiredUserId;
  String? _desiredAppId;
  int _authGeneration = 0;
  Future<void>? _syncTask;
  String? _pendingNotificationId;
  bool _pendingOpenInbox = false;
  bool _pendingOpenStudentInbox = false;
  String? _pendingConversationId;

  Future<void> captureLaunchMessage() async {
    if (_launchCaptured) return;
    _launchCaptured = true;
    try {
      await Firebase.initializeApp().timeout(const Duration(seconds: 8));
      _firebaseAvailable = true;
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      _openedSubscription ??= FirebaseMessaging.onMessageOpenedApp.listen(
        _rememberNavigation,
      );
      final initialMessage = await FirebaseMessaging.instance
          .getInitialMessage()
          .timeout(const Duration(seconds: 5));
      if (initialMessage != null) _rememberNavigation(initialMessage);
    } catch (error) {
      _firebaseAvailable = false;
      debugPrint('Firebase Messaging tidak tersedia: $error');
    }
  }

  Future<void> initialize(ApiClient api) async {
    if (_initialized) return;
    _initialized = true;
    _api = api;
    try {
      if (!_launchCaptured || !_firebaseAvailable) {
        await captureLaunchMessage();
      }
      if (!_firebaseAvailable) return;
      await _loadChannelConfiguration();
      await _initializeLocalNotifications();
      _messageSubscription ??= FirebaseMessaging.onMessage.listen(
        _showForegroundNotification,
      );
      _openedSubscription ??= FirebaseMessaging.onMessageOpenedApp.listen(
        _rememberNavigation,
      );
      _tokenSubscription ??= FirebaseMessaging.instance.onTokenRefresh.listen((
        token,
      ) async {
        final userId = _registeredUserId;
        final appId = _registeredAppId;
        if (userId != null && appId != null) {
          await _registerToken(token, appId);
        }
      });
    } catch (error) {
      _firebaseAvailable = false;
      debugPrint('Firebase Messaging tidak tersedia: $error');
    }
  }

  Future<void> _loadChannelConfiguration() async {
    try {
      final config = await _api?.getJson('/api/push/config');
      final configured = config?['androidChannelId']?.toString().trim();
      if (configured?.isNotEmpty == true) _channelId = configured!;
    } catch (_) {
      _channelId = fallbackChannelId;
    }
  }

  Future<void> _initializeLocalNotifications() async {
    const initialization = InitializationSettings(
      android: AndroidInitializationSettings('ic_stat_genpro'),
      iOS: DarwinInitializationSettings(),
    );
    await _localNotifications.initialize(
      settings: initialization,
      onDidReceiveNotificationResponse: (response) {
        final payload = response.payload?.trim();
        if (payload?.startsWith('conversation:') == true) {
          _pendingConversationId = payload!.substring('conversation:'.length);
          _pendingOpenStudentInbox = true;
        } else if (payload == 'student_inbox') {
          _pendingOpenStudentInbox = true;
        } else if (payload != null && payload.isNotEmpty) {
          _pendingNotificationId = payload;
          _pendingOpenInbox = true;
        }
        flushPendingNavigation();
      },
    );
    final android = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await android?.createNotificationChannel(
      AndroidNotificationChannel(
        _channelId,
        'Notifikasi GenPro',
        description: 'Informasi dan pemberitahuan penting dari GenPro.',
        importance: Importance.high,
        enableVibration: true,
      ),
    );
  }

  Future<void> syncAuthenticated({
    required String userId,
    required String appId,
  }) async {
    _authenticated = true;
    if (_desiredUserId != userId || _desiredAppId != appId) {
      _desiredUserId = userId;
      _desiredAppId = appId;
      _authGeneration += 1;
      _skippedUserId = null;
      if (_registeredUserId != userId || _registeredAppId != appId) {
        _registeredUserId = null;
        _registeredAppId = null;
      }
    }
    if (_registeredUserId == userId && _registeredAppId == appId) {
      flushPendingNavigation();
      return;
    }
    if (_skippedUserId == userId || !_firebaseAvailable) {
      flushPendingNavigation();
      return;
    }
    _syncTask ??= _syncDesiredAccount().whenComplete(() => _syncTask = null);
    await _syncTask;
  }

  Future<void> _syncDesiredAccount() async {
    while (_authenticated && _desiredUserId != null && _desiredAppId != null) {
      final userId = _desiredUserId!;
      final appId = _desiredAppId!;
      final generation = _authGeneration;
      if (_registeredUserId == userId && _registeredAppId == appId) return;
      if (_skippedUserId == userId || !_firebaseAvailable) return;

      try {
        final settings = await FirebaseMessaging.instance.requestPermission(
          alert: true,
          badge: true,
          sound: true,
        );
        if (!_isCurrentAuthentication(generation, userId, appId)) continue;
        if (settings.authorizationStatus == AuthorizationStatus.denied) {
          _skippedUserId = userId;
          flushPendingNavigation();
          return;
        }
        final token = await FirebaseMessaging.instance.getToken();
        if (!_isCurrentAuthentication(generation, userId, appId)) continue;
        if (token?.isNotEmpty != true) {
          _skippedUserId = userId;
          flushPendingNavigation();
          return;
        }
        await _registerToken(token!, appId);
        if (!_isCurrentAuthentication(generation, userId, appId)) continue;
        _registeredUserId = userId;
        _registeredAppId = appId;
        _skippedUserId = null;
        flushPendingNavigation();
      } catch (error) {
        if (!_isCurrentAuthentication(generation, userId, appId)) continue;
        _skippedUserId = userId;
        debugPrint('Token push gagal disinkronkan: $error');
        flushPendingNavigation();
        return;
      }
    }
  }

  bool _isCurrentAuthentication(int generation, String userId, String appId) {
    return _authenticated &&
        generation == _authGeneration &&
        userId == _desiredUserId &&
        appId == _desiredAppId;
  }

  Future<void> _registerToken(String token, String appId) async {
    await _api?.postJson(
      '/api/push/devices',
      data: {
        'token': token,
        'platform': Platform.isAndroid ? 'ANDROID' : 'IOS',
        'appId': appId,
        'deviceName': Platform.operatingSystemVersion,
      },
    );
  }

  Future<void> unregister() async {
    _authenticated = false;
    _appReady = false;
    _desiredUserId = null;
    _desiredAppId = null;
    _authGeneration += 1;
    final activeSync = _syncTask;
    if (activeSync != null) await activeSync;
    if (!_firebaseAvailable) {
      _clearRegistrationState();
      return;
    }
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token?.isNotEmpty == true) {
        await _api?.deleteJson('/api/push/devices', data: {'token': token});
      }
      await FirebaseMessaging.instance.deleteToken();
    } catch (error) {
      debugPrint('Token push gagal dinonaktifkan: $error');
    } finally {
      _clearRegistrationState();
    }
  }

  void _clearRegistrationState() {
    _registeredUserId = null;
    _registeredAppId = null;
    _skippedUserId = null;
    _pendingNotificationId = null;
    _pendingOpenInbox = false;
    _pendingOpenStudentInbox = false;
    _pendingConversationId = null;
    _navigatorRetries = 0;
  }

  void markAppReady() {
    _appReady = true;
    flushPendingNavigation();
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final type = message.data['type']?.toString();
    if (type == 'student_message' || type == 'student_message_request') {
      inboxRevision.value += 1;
    }
    final notification = message.notification;
    if (notification == null) return;
    final imageUrl = _notificationImageUrl(message);
    final imagePath = imageUrl == null
        ? null
        : await _downloadNotificationImage(imageUrl);
    try {
      await _localNotifications.show(
        id: notification.hashCode,
        title: notification.title ?? 'GenPro',
        body: notification.body ?? 'Ada pemberitahuan baru.',
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            'Notifikasi GenPro',
            channelDescription:
                'Informasi dan pemberitahuan penting dari GenPro.',
            importance: Importance.high,
            priority: Priority.high,
            color: _notificationColor,
            icon: 'ic_stat_genpro',
            largeIcon: _largeIcon,
            styleInformation: imagePath == null
                ? BigTextStyleInformation(
                    notification.body ?? 'Ada pemberitahuan baru.',
                  )
                : BigPictureStyleInformation(
                    FilePathAndroidBitmap(imagePath),
                    largeIcon: _largeIcon,
                    hideExpandedLargeIcon: true,
                  ),
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        payload: _notificationPayload(message),
      );
    } finally {
      if (imagePath != null) {
        try {
          await File(imagePath).delete();
        } catch (_) {
          // The OS may already have released or removed the temporary file.
        }
      }
    }
  }

  void _rememberNavigation(RemoteMessage message) {
    final type = message.data['type']?.toString();
    if (type == 'student_message' || type == 'student_message_request') {
      _pendingConversationId = message.data['conversationId']
          ?.toString()
          .trim();
      _pendingOpenStudentInbox = true;
      inboxRevision.value += 1;
      flushPendingNavigation();
      return;
    }
    final notificationId = _messageNotificationId(message);
    if (notificationId != null && notificationId.isNotEmpty) {
      _pendingNotificationId = notificationId;
    }
    _pendingOpenInbox = true;
    flushPendingNavigation();
  }

  void flushPendingNavigation() {
    if (!_authenticated || !_appReady) return;
    final notificationId = _pendingNotificationId?.trim();
    final shouldOpen =
        _pendingOpenStudentInbox ||
        _pendingOpenInbox ||
        (notificationId != null && notificationId.isNotEmpty);
    if (!shouldOpen) return;
    final navigator = navigatorKey.currentState;
    if (navigator == null) {
      if (_navigatorRetries++ > 40) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        flushPendingNavigation();
      });
      return;
    }
    _navigatorRetries = 0;
    if (_pendingOpenStudentInbox) {
      final conversationId = _pendingConversationId;
      _pendingOpenStudentInbox = false;
      _pendingConversationId = null;
      navigator.push<void>(
        MaterialPageRoute(
          builder: (_) => StudentInboxScreen(
            initialConversationId: conversationId?.isEmpty == true
                ? null
                : conversationId,
          ),
        ),
      );
      return;
    }
    _pendingNotificationId = null;
    _pendingOpenInbox = false;
    navigator.push<void>(
      MaterialPageRoute(
        builder: (_) => NotificationsPage(
          initialNotificationId: notificationId?.isEmpty == true
              ? null
              : notificationId,
        ),
      ),
    );
  }

  Future<void> dispose() async {
    await _tokenSubscription?.cancel();
    await _messageSubscription?.cancel();
    await _openedSubscription?.cancel();
  }

  String? _messageNotificationId(RemoteMessage message) {
    for (final key in const ['notificationId', 'notification_id', 'id']) {
      final value = message.data[key]?.toString().trim();
      if (value != null && value.isNotEmpty) return value;
    }
    return null;
  }

  String _notificationPayload(RemoteMessage message) {
    final type = message.data['type']?.toString();
    if (type == 'student_message') {
      final id = message.data['conversationId']?.toString().trim() ?? '';
      return id.isEmpty ? 'student_inbox' : 'conversation:$id';
    }
    if (type == 'student_message_request') return 'student_inbox';
    return _messageNotificationId(message) ?? '';
  }

  String? _notificationImageUrl(RemoteMessage message) {
    final fromData = message.data['imageUrl']?.toString().trim();
    if (fromData?.isNotEmpty == true) return fromData;
    final fromAndroid = message.notification?.android?.imageUrl?.trim();
    if (fromAndroid?.isNotEmpty == true) return fromAndroid;
    final fromApple = message.notification?.apple?.imageUrl?.trim();
    if (fromApple?.isNotEmpty == true) return fromApple;
    return null;
  }

  Future<String?> _downloadNotificationImage(String imageUrl) async {
    final resolved = resolveAppMediaUrl(imageUrl);
    if (resolved.isEmpty) return null;
    final uri = safeExternalUri(resolved);
    if (uri == null || !isSameOriginAppUri(uri)) return null;
    const maxImageBytes = 5 * 1024 * 1024;
    final client = HttpClient();
    try {
      final request = await client.getUrl(uri);
      request.followRedirects = false;
      final result = await request.close().timeout(const Duration(seconds: 8));
      if (result.statusCode < 200 || result.statusCode >= 300) return null;
      final contentType = result.headers.contentType?.mimeType.toLowerCase();
      if (contentType == null || !contentType.startsWith('image/')) return null;
      if (result.contentLength > maxImageBytes) return null;
      final builder = BytesBuilder(copy: false);
      var length = 0;
      await for (final chunk in result.timeout(const Duration(seconds: 8))) {
        length += chunk.length;
        if (length > maxImageBytes) return null;
        builder.add(chunk);
      }
      final bytes = builder.takeBytes();
      if (bytes.isEmpty) return null;
      final directory = await getTemporaryDirectory();
      final file = File(
        '${directory.path}/push_${DateTime.now().millisecondsSinceEpoch}.jpg',
      );
      await file.writeAsBytes(bytes, flush: true);
      return file.path;
    } catch (_) {
      return null;
    } finally {
      client.close(force: true);
    }
  }
}
