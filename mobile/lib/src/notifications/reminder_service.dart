import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:flutter/material.dart' show TimeOfDay;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

/// Fixed notification id for the daily reminder — there is only ever one,
/// so scheduling replaces it.
const _reminderId = 1001;

const _channelId = 'daily_reminder';
const _channelName = 'Daily reminder';
const _channelDescription = "A nudge when the day's puzzle is ready.";

/// Wraps [FlutterLocalNotificationsPlugin] for the one thing the app
/// schedules: a repeating local notification at the user's chosen time
/// (spec §10). No remote push here — that's a later phase.
///
/// The plugin is injectable so tests can assert on the scheduled payload
/// without a platform channel.
class ReminderService {
  ReminderService({FlutterLocalNotificationsPlugin? plugin})
    : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  bool _ready = false;

  /// One-time setup: load the tz database, point `tz.local` at the device
  /// zone, initialise the plugin, and register the Android channel. Safe
  /// to call repeatedly.
  Future<void> init() async {
    if (_ready) return;
    tzdata.initializeTimeZones();
    try {
      final info = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(info.identifier));
    } catch (_) {
      // Unknown / renamed zone — fall back to UTC rather than crash.
      tz.setLocalLocation(tz.getLocation('UTC'));
    }

    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          // The permission ask happens from the settings toggle instead,
          // so the system prompt has context.
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );
    await _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(
          const AndroidNotificationChannel(
            _channelId,
            _channelName,
            description: _channelDescription,
          ),
        );
    _ready = true;
  }

  /// Ask the OS for permission to post notifications. Returns whether it
  /// was granted. iOS shows the system prompt; Android 13+ shows the
  /// runtime permission dialog, older Android is granted implicitly.
  Future<bool> requestPermission() async {
    await init();
    final ios = _plugin
        .resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin
        >();
    if (ios != null) {
      return await ios.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          ) ??
          false;
    }
    final android = _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    if (android != null) {
      return await android.requestNotificationsPermission() ?? false;
    }
    return false;
  }

  /// (Re)schedule the daily reminder at [time] local, repeating every day.
  /// Replaces any existing schedule.
  Future<void> scheduleDaily({
    required TimeOfDay time,
    required String title,
    required String body,
  }) async {
    await init();
    await _plugin.cancel(id: _reminderId);
    await _plugin.zonedSchedule(
      id: _reminderId,
      title: title,
      body: body,
      scheduledDate: nextInstanceOf(time),
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDescription,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      matchDateTimeComponents: DateTimeComponents.time,
      payload: 'daily',
    );
  }

  /// Drop the scheduled reminder.
  Future<void> cancel() async {
    await init();
    await _plugin.cancel(id: _reminderId);
  }

  /// The next wall-clock occurrence of [time] in the device zone — today
  /// if it's still ahead, otherwise tomorrow.
  @visibleForTesting
  static tz.TZDateTime nextInstanceOf(TimeOfDay time, {tz.TZDateTime? from}) {
    final now = from ?? tz.TZDateTime.now(tz.local);
    var next = tz.TZDateTime(
      now.location,
      now.year,
      now.month,
      now.day,
      time.hour,
      time.minute,
    );
    if (!next.isAfter(now)) {
      next = next.add(const Duration(days: 1));
    }
    return next;
  }
}
