import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

/// Sound + haptic feedback for the board. Haptics always accompany a
/// visible change, never replace one (spec §17.1); iOS/Android route them
/// through the system haptic setting. The win sound has a visual
/// equivalent (the cascade), so a muted or deaf player misses nothing.
class GameFeedback {
  GameFeedback({bool muted = false}) : _muted = muted;

  final AudioPlayer _player = AudioPlayer();
  bool _muted;

  set muted(bool value) => _muted = value;

  Future<void> select() => HapticFeedback.selectionClick();

  Future<void> swap() => HapticFeedback.lightImpact();

  Future<void> solved() async {
    await HapticFeedback.mediumImpact();
    if (_muted) return;
    try {
      await _player.play(AssetSource('audio/win.mp3'));
    } catch (_) {
      // A missing/unplayable asset must never break the solve flow.
    }
  }

  void dispose() => _player.dispose();
}
