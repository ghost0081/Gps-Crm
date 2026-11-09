class SafetyNotificationModel {
  final String id;
  final String eventId;
  final String type;
  final String category;
  final String title;
  final String body;
  final bool critical;
  final bool isRead;
  final DateTime occurredAt;
  final String? zoneName;

  SafetyNotificationModel({
    required this.id,
    required this.eventId,
    required this.type,
    required this.category,
    required this.title,
    required this.body,
    required this.critical,
    required this.isRead,
    required this.occurredAt,
    this.zoneName,
  });

  factory SafetyNotificationModel.fromJson(Map<String, dynamic> json) {
    return SafetyNotificationModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      eventId: json['eventId']?.toString() ?? '',
      type: json['type']?.toString() ?? 'other',
      category: json['category']?.toString() ?? 'other',
      title: json['title']?.toString() ?? 'Safety Alert',
      body: json['body']?.toString() ?? '',
      critical: json['critical'] == true,
      isRead: json['read'] == true,
      occurredAt: json['occurredAt'] != null 
          ? DateTime.tryParse(json['occurredAt'].toString()) ?? DateTime.now() 
          : DateTime.now(),
      zoneName: json['zoneName']?.toString(),
    );
  }
}
