class StudentSocialUser {
  const StudentSocialUser({
    required this.id,
    required this.studentId,
    required this.name,
    required this.schoolName,
    this.avatarUrl,
  });
  final String id;
  final String? studentId;
  final String name;
  final String schoolName;
  final String? avatarUrl;

  factory StudentSocialUser.fromJson(Map<String, dynamic> json) =>
      StudentSocialUser(
        id: json['id']?.toString() ?? '',
        studentId: json['studentId']?.toString(),
        name: json['name']?.toString() ?? 'Siswa',
        schoolName: json['schoolName']?.toString() ?? 'Sekolah belum tercantum',
        avatarUrl: json['avatarUrl']?.toString(),
      );
}

class StudentConversationSummary {
  const StudentConversationSummary({
    required this.id,
    required this.otherUser,
    required this.updatedAt,
    required this.unread,
    this.lastMessage,
  });
  final String id;
  final StudentSocialUser otherUser;
  final StudentSocialMessage? lastMessage;
  final DateTime updatedAt;
  final bool unread;

  factory StudentConversationSummary.fromJson(Map<String, dynamic> json) =>
      StudentConversationSummary(
        id: json['id']?.toString() ?? '',
        otherUser: StudentSocialUser.fromJson(
          Map<String, dynamic>.from(json['otherUser'] as Map? ?? const {}),
        ),
        lastMessage: json['lastMessage'] is Map
            ? StudentSocialMessage.fromJson(
                Map<String, dynamic>.from(json['lastMessage'] as Map),
              )
            : null,
        updatedAt:
            DateTime.tryParse(json['updatedAt']?.toString() ?? '') ??
            DateTime.now(),
        unread: json['unread'] == true,
      );
}

class StudentMessageRequestItem {
  const StudentMessageRequestItem({
    required this.id,
    required this.sender,
    required this.message,
    required this.createdAt,
  });
  final String id;
  final StudentSocialUser sender;
  final String message;
  final DateTime createdAt;

  factory StudentMessageRequestItem.fromJson(Map<String, dynamic> json) =>
      StudentMessageRequestItem(
        id: json['id']?.toString() ?? '',
        sender: StudentSocialUser.fromJson(
          Map<String, dynamic>.from(json['sender'] as Map? ?? const {}),
        ),
        message: json['message']?.toString() ?? '',
        createdAt:
            DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
            DateTime.now(),
      );
}

class StudentInboxData {
  const StudentInboxData({
    required this.conversations,
    required this.requests,
    required this.unreadTotal,
  });
  final List<StudentConversationSummary> conversations;
  final List<StudentMessageRequestItem> requests;
  final int unreadTotal;

  factory StudentInboxData.fromJson(Map<String, dynamic> json) =>
      StudentInboxData(
        conversations: (json['conversations'] as List? ?? const [])
            .whereType<Map>()
            .map(
              (item) => StudentConversationSummary.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList(),
        requests: (json['requests'] as List? ?? const [])
            .whereType<Map>()
            .map(
              (item) => StudentMessageRequestItem.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList(),
        unreadTotal: (json['unreadTotal'] as num?)?.toInt() ?? 0,
      );
}

class StudentSocialMessage {
  const StudentSocialMessage({
    required this.id,
    required this.senderId,
    required this.content,
    required this.createdAt,
    required this.isMine,
  });
  final String id;
  final String senderId;
  final String content;
  final DateTime createdAt;
  final bool isMine;

  factory StudentSocialMessage.fromJson(Map<String, dynamic> json) =>
      StudentSocialMessage(
        id: json['id']?.toString() ?? '',
        senderId: json['senderId']?.toString() ?? '',
        content: json['content']?.toString() ?? '',
        createdAt:
            DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
            DateTime.now(),
        isMine: json['isMine'] == true,
      );
}

class StudentConversationDetail {
  const StudentConversationDetail({
    required this.id,
    required this.otherUser,
    required this.messages,
  });
  final String id;
  final StudentSocialUser otherUser;
  final List<StudentSocialMessage> messages;

  factory StudentConversationDetail.fromJson(Map<String, dynamic> json) {
    final conversation = Map<String, dynamic>.from(
      json['conversation'] as Map? ?? const {},
    );
    return StudentConversationDetail(
      id: conversation['id']?.toString() ?? '',
      otherUser: StudentSocialUser.fromJson(
        Map<String, dynamic>.from(
          conversation['otherUser'] as Map? ?? const {},
        ),
      ),
      messages: (json['messages'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                StudentSocialMessage.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
    );
  }
}
