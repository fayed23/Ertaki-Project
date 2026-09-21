import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;
import 'package:ertaki_mobile/api.dart';

class NotifyHub {
  NotifyHub._();
  static final instance = NotifyHub._();

  final _plugin = FlutterLocalNotificationsPlugin();
  bool ready = false;
  String? lastSeenId;

  Future<void> init() async {
    if (kIsWeb) {
      ready = false;
      return;
    }
    tzdata.initializeTimeZones();
    try {
      tz.setLocalLocation(tz.getLocation('Africa/Algiers'));
    } catch (_) {
      tz.setLocalLocation(tz.UTC);
    }
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings();
    await _plugin.initialize(
      const InitializationSettings(android: android, iOS: ios),
    );
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
    ready = true;
  }

  Future<void> registerDevice(ApiClient api) async {
    // Real FCM token needs firebase_messaging + google-services.
    // Register a stable device id so the API can store preference; push uses FCM_SERVER_KEY when set.
    final prefs = await SharedPreferences.getInstance();
    var token = prefs.getString('deviceToken');
    if (token == null) {
      token = 'local-${DateTime.now().millisecondsSinceEpoch}';
      await prefs.setString('deviceToken', token);
    }
    try {
      await api.post('/device-tokens', {
        'token': token,
        'platform': kIsWeb ? 'web' : defaultTargetPlatform.name,
      });
    } catch (_) {}
  }

  Future<void> scheduleStudentDeadlineReminder({
    required int hour,
    required int minute,
  }) async {
    if (!ready) return;
    final now = tz.TZDateTime.now(tz.local);
    var when = tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);
    if (!when.isAfter(now)) {
      when = when.add(const Duration(days: 1));
    }
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'deadline',
        'تذكير التقرير',
        channelDescription: 'تذكير بإرسال التقرير قبل منتصف الليل',
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
    );
    await _plugin.zonedSchedule(
      1001,
      'تذكير بتقرير اليوم',
      'اقترب منتصف الليل — أرسل تقريرك إن لم تفعل بعد.',
      when,
      details,
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      matchDateTimeComponents: DateTimeComponents.time,
    );
  }

  Future<void> cancelDeadlineReminder() async {
    if (!ready) return;
    await _plugin.cancel(1001);
  }

  Future<void> showLocal(String title, String body, {int id = 2000}) async {
    if (!ready) return;
    await _plugin.show(
      id,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'inbox',
          'إشعارات ارتق',
          channelDescription: 'تنبيهات التقارير والغياب',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }

  Future<void> pollAndAlert(ApiClient api) async {
    try {
      final list = await api.get('/notifications') as List<dynamic>;
      if (list.isEmpty) return;
      final newest = list.first as Map<String, dynamic>;
      final id = '${newest['id']}';
      final prefs = await SharedPreferences.getInstance();
      final seen = prefs.getString('lastNotifId');
      if (seen == id) return;
      await prefs.setString('lastNotifId', id);
      if (seen != null) {
        await showLocal('${newest['title']}', '${newest['body']}', id: id.hashCode);
      }
    } catch (_) {}
  }
}
