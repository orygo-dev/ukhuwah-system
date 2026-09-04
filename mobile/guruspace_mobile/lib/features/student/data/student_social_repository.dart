import 'package:guruspace_mobile/core/network/api_client.dart';
import 'package:guruspace_mobile/features/student/domain/student_social_models.dart';

class StudentSocialRepository {
  const StudentSocialRepository(this._client);
  final ApiClient _client;
  static const _base = '/api/mobile/v1/student/social';

  Future<StudentInboxData> getInbox() async =>
      StudentInboxData.fromJson(await _client.getJson('$_base/inbox'));

  Future<int> getUnreadCount() async {
    final json = await _client.getJson('$_base/unread');
    return (json['unreadCount'] as num?)?.toInt() ?? 0;
  }

  Future<({bool following, bool mutual})> setFollow(
    String studentId, {
    required bool following,
  }) async {
    final path = '$_base/follows/${Uri.encodeComponent(studentId)}';
    final json = following
        ? await _client.postJson(path, data: const {})
        : await _client.deleteJson(path);
    return (
      following: json['following'] == true,
      mutual: json['mutual'] == true,
    );
  }

  Future<String> startConversation(String studentId) async {
    final json = await _client.postJson(
      '$_base/conversations/start',
      data: {'studentId': studentId},
    );
    return json['conversationId']?.toString() ?? '';
  }

  Future<String?> requestMessage(String studentId, String message) async {
    final json = await _client.postJson(
      '$_base/requests',
      data: {'studentId': studentId, 'message': message},
    );
    return json['conversationId']?.toString();
  }

  Future<String?> respondRequest(String requestId, bool accept) async {
    final json = await _client.patchJson(
      '$_base/requests/${Uri.encodeComponent(requestId)}',
      {'action': accept ? 'ACCEPT' : 'REJECT'},
    );
    return json['conversationId']?.toString();
  }

  Future<StudentConversationDetail> getConversation(String id) async =>
      StudentConversationDetail.fromJson(
        await _client.getJson(
          '$_base/conversations/${Uri.encodeComponent(id)}',
        ),
      );

  Future<StudentSocialMessage> sendMessage({
    required String conversationId,
    required String content,
    required String clientMessageId,
  }) async {
    final json = await _client.postJson(
      '$_base/conversations/${Uri.encodeComponent(conversationId)}',
      data: {'content': content, 'clientMessageId': clientMessageId},
    );
    return StudentSocialMessage.fromJson(
      Map<String, dynamic>.from(json['message'] as Map? ?? const {}),
    );
  }
}
