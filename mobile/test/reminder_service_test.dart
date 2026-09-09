import 'package:flutter/material.dart' show TimeOfDay;
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/notifications/reminder_service.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

void main() {
  tzdata.initializeTimeZones();
  final london = tz.getLocation('Europe/London');

  test('rolls to tomorrow when the time has already passed today', () {
    final from = tz.TZDateTime(london, 2026, 6, 1, 14, 0);
    final next = ReminderService.nextInstanceOf(
      const TimeOfDay(hour: 9, minute: 0),
      from: from,
    );
    expect(next, tz.TZDateTime(london, 2026, 6, 2, 9, 0));
  });

  test('stays today when the time is still ahead', () {
    final from = tz.TZDateTime(london, 2026, 6, 1, 7, 30);
    final next = ReminderService.nextInstanceOf(
      const TimeOfDay(hour: 9, minute: 0),
      from: from,
    );
    expect(next, tz.TZDateTime(london, 2026, 6, 1, 9, 0));
  });

  test('an exact match on the current minute rolls forward', () {
    final from = tz.TZDateTime(london, 2026, 6, 1, 9, 0);
    final next = ReminderService.nextInstanceOf(
      const TimeOfDay(hour: 9, minute: 0),
      from: from,
    );
    expect(next.day, 2);
  });
}
